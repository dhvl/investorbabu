"""
trade_tracker.py — Monitors order status and sends Telegram updates.

Runs alongside the main scanner. Every 5 minutes:
  - Checks Zerodha order book for status changes
  - Sends Telegram alert when orders fill, exit, or get squared off
  - Logs all events to daily trade file

At 3:30 PM IST:
  - Sends complete daily P&L summary to all 3 members
"""

import json
import os
import time
import logging
import threading
from datetime import datetime, timezone, timedelta
from upstox_broker import get_orders, get_trades, delete_gtt
from telegram_bot import send_message, send_trade_message

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# ── State tracking ────────────────────────────────────────────
tracked_orders  = {}   # order_id → last known status
daily_trades    = []   # completed trade records
summary_sent    = False

def load_tracked_orders():
    global tracked_orders
    if os.path.exists("tracked_orders.json"):
        try:
            with open("tracked_orders.json", "r") as f:
                tracked_orders = json.load(f)
            logger.info(f"[Tracker] Loaded {len(tracked_orders)} tracked orders from persistent cache")
        except Exception as e:
            logger.error(f"[Tracker] Failed to load tracked_orders.json: {e}")

def save_tracked_orders():
    try:
        with open("tracked_orders.json", "w") as f:
            json.dump(tracked_orders, f, indent=2)
    except Exception as e:
        logger.error(f"[Tracker] Failed to save tracked_orders.json: {e}")

def _get_summary_flag():
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    return ".summary_" + datetime.now(IST).strftime("%Y%m%d")

def _is_summary_sent():
    import os
    return os.path.exists(_get_summary_flag())

def _mark_summary_sent():
    import os, glob
    flag = _get_summary_flag()
    open(flag, "w").write("sent")
    for f in glob.glob(".summary_*"):
        if f != flag:
            os.remove(f)


def get_ist_now():
    return datetime.now(IST)


def load_daily_log():
    """Load today's trade log if exists."""
    global daily_trades
    today    = get_ist_now().strftime("%Y%m%d")
    log_file = f"trades_{today}.json"
    if os.path.exists(log_file):
        with open(log_file) as f:
            daily_trades = json.load(f)
    return daily_trades


def save_daily_log():
    """Save today's trade log."""
    today    = get_ist_now().strftime("%Y%m%d")
    log_file = f"trades_{today}.json"
    with open(log_file, "w") as f:
        json.dump(daily_trades, f, indent=2)


def register_order(order_id: str, symbol: str, transaction_type: str,
                   entry_price: float, quantity: int,
                   target_price: float, stop_loss_price: float):
    """Register a new order for tracking."""
    tracked_orders[str(order_id)] = {
        "order_id":         str(order_id),
        "symbol":           symbol,
        "transaction_type": transaction_type,
        "entry_price":      entry_price,
        "average_entry":    entry_price,
        "quantity":         quantity,
        "target_price":     target_price,
        "stop_loss_price":  stop_loss_price,
        "status":           "OPEN",
        "exit_price":       None,
        "pnl":              None,
        "registered_at":    get_ist_now().isoformat(),
        "pyramided":        False,
        "sl_order_id":      None,
    }
    logger.info(f"[Tracker] Registered order: {order_id} {symbol} {transaction_type}")
    save_tracked_orders()


def check_orders():
    """
    Check all tracked orders against broker order book.
    Monitor active positions, trigger pyramiding when price moves in favor by 0.35%,
    and square-off at target. Send Telegram alerts.
    """
    if not tracked_orders:
        return

    try:
        orders = get_orders()
    except Exception as e:
        logger.error(f"[Tracker] Could not fetch orders: {e}")
        return

    # Build lookup dict
    order_lookup = {str(o["order_id"]): o for o in orders}

    from upstox_broker import get_ltp, place_regular_order, cancel_order, place_gtt_oco

    for order_id, tracked in list(tracked_orders.items()):
        # Stage A: Monitor ACTIVE positions
        if tracked.get("status") == "ACTIVE":
            symbol = tracked["symbol"]
            qty = tracked["quantity"]
            tx_type = tracked["transaction_type"]
            entry = tracked["entry_price"]
            avg_entry = tracked.get("average_entry", entry)
            target = tracked["target_price"]
            sl_price = tracked["stop_loss_price"]
            sl_order_id = tracked.get("sl_order_id")

            # 1. Fetch real-time LTP
            ltp = get_ltp(symbol)
            if ltp == 0.0:
                continue

            # 2. Check if Broker Stop Loss (SL) order got filled
            sl_filled = False
            exit_price = sl_price
            if sl_order_id and str(sl_order_id) in order_lookup:
                sl_order = order_lookup[str(sl_order_id)]
                if sl_order.get("status") in ["COMPLETE", "EXECUTED"]:
                    sl_filled = True
                    exit_price = float(sl_order.get("average_price", sl_price))

            if sl_filled:
                logger.info(f"[Tracker] {symbol} ACTIVE trade hit Stop Loss at Rs {exit_price}")
                if tx_type == "BUY":
                    pnl = (exit_price - avg_entry) * qty
                else:
                    pnl = (avg_entry - exit_price) * qty
                
                tracked["status"] = "COMPLETE"
                tracked["exit_price"] = exit_price
                tracked["pnl"] = round(pnl, 2)
                save_tracked_orders()

                daily_trades.append({
                    "symbol":           symbol,
                    "transaction_type": tx_type,
                    "entry_price":      avg_entry,
                    "exit_price":       exit_price,
                    "quantity":         qty,
                    "pnl":              tracked["pnl"],
                    "status":           "COMPLETE",
                    "time":             get_ist_now().strftime("%I:%M %p IST"),
                })
                save_daily_log()

                pnl_pct = round((abs(pnl) / (avg_entry * qty)) * 100, 2)
                msg = (
                    f"❌ <b>STOP LOSS HIT — {symbol}</b>\n\n"
                    f"Stop loss triggered and filled at Rs {exit_price:.2f}\n"
                    f"Quantity : {qty} shares\n"
                    f"Final P&L: Rs {tracked['pnl']:+.2f} ({pnl_pct:.2f}%)\n"
                    f"Time     : {get_ist_now().strftime('%I:%M %p IST')}"
                )
                send_trade_message(msg)
                continue

            # 3. Check if Target got hit
            target_hit = False
            if tx_type == "BUY" and ltp >= target:
                target_hit = True
            elif tx_type == "SELL" and ltp <= target:
                target_hit = True

            if target_hit:
                logger.info(f"[Tracker] {symbol} ACTIVE trade hit target price {target} (LTP={ltp})")
                # Cancel the stop-loss order at the broker
                if sl_order_id:
                    try:
                        cancel_order(sl_order_id)
                    except Exception as cancel_err:
                        logger.error(f"[Tracker] Failed to cancel SL order {sl_order_id}: {cancel_err}")

                # Place market square-off order to exit
                exit_action = "SELL" if tx_type == "BUY" else "BUY"
                exit_price = ltp
                # For SMC, MARKET orders are not allowed on the API platform, so we place a LIMIT order
                # slightly below LTP (for SELL) or above LTP (for BUY) to guarantee immediate execution.
                exit_limit_price = round(ltp - 0.15, 2) if exit_action == "SELL" else round(ltp + 0.15, 2)
                exit_success = False
                err_details = "Unknown error"
                try:
                    res_exit = place_regular_order(symbol, exit_action, qty, "LIMIT", exit_limit_price)
                    if res_exit["success"]:
                        exit_success = True
                        time.sleep(1)
                        try:
                            fresh_orders = get_orders()
                            fresh_lookup = {str(o["order_id"]): o for o in fresh_orders}
                            exit_order = fresh_lookup.get(str(res_exit["order_id"]))
                            if exit_order and exit_order.get("average_price"):
                                exit_price = float(exit_order["average_price"])
                        except Exception:
                            pass
                    else:
                        err_details = res_exit.get("message", "Broker rejection")
                except Exception as exit_err:
                    logger.error(f"[Tracker] Target exit square-off failed: {exit_err}")
                    err_details = str(exit_err)

                if not exit_success:
                    logger.error(f"[Tracker] Target exit failed for {symbol}: {err_details}")
                    if not tracked.get("target_alert_sent"):
                        tracked["target_alert_sent"] = True
                        save_tracked_orders()
                        msg = (
                            f"🚨 <b>CRITICAL: TARGET EXIT FAILED — {symbol}</b>\n\n"
                            f"Target of Rs {target:.2f} was hit (LTP Rs {ltp:.2f}), but the exit order failed!\n"
                            f"Error: {err_details}\n\n"
                            f"⚠️ <b>Action Required:</b> Please square off the position manually in your broker terminal immediately!"
                        )
                        send_trade_message(msg)
                    continue

                if tx_type == "BUY":
                    pnl = (exit_price - avg_entry) * qty
                else:
                    pnl = (avg_entry - exit_price) * qty

                tracked["status"] = "COMPLETE"
                tracked["exit_price"] = exit_price
                tracked["pnl"] = round(pnl, 2)
                save_tracked_orders()

                daily_trades.append({
                    "symbol":           symbol,
                    "transaction_type": tx_type,
                    "entry_price":      avg_entry,
                    "exit_price":       exit_price,
                    "quantity":         qty,
                    "pnl":              tracked["pnl"],
                    "status":           "COMPLETE",
                    "time":             get_ist_now().strftime("%I:%M %p IST"),
                })
                save_daily_log()

                pnl_pct = round((abs(pnl) / (avg_entry * qty)) * 100, 2)
                msg = (
                    f"✅ <b>TARGET HIT — {symbol}</b>\n\n"
                    f"Position exited at Rs {exit_price:.2f}\n"
                    f"Quantity : {qty} shares\n"
                    f"Final P&L: Rs {tracked['pnl']:+.2f} (+{pnl_pct:.2f}%)\n"
                    f"Time     : {get_ist_now().strftime('%I:%M %p IST')}"
                )
                send_trade_message(msg)
                continue

            # 4. Check if Pyramiding is triggered (0.35% movement in direction of trade)
            if not tracked.get("pyramided", False):
                pyramid_triggered = False
                if tx_type == "BUY" and ltp >= entry * 1.0035:
                    pyramid_triggered = True
                elif tx_type == "SELL" and ltp <= entry * 0.9965:
                    pyramid_triggered = True

                if pyramid_triggered:
                    logger.info(f"[Tracker] {symbol} pyramiding triggered. Price moved 0.35% in favor (LTP={ltp})")
                    # For SMC, MARKET orders are not allowed on the API platform, so we place a LIMIT order
                    # slightly above LTP (for BUY) or below LTP (for SELL) to guarantee immediate execution.
                    pyr_limit_price = round(ltp + 0.15, 2) if tx_type == "BUY" else round(ltp - 0.15, 2)
                    try:
                        res_pyr = place_regular_order(symbol, tx_type, qty, "LIMIT", pyr_limit_price)
                        if res_pyr["success"]:
                            time.sleep(1)
                            pyr_price = ltp
                            try:
                                fresh_orders = get_orders()
                                fresh_lookup = {str(o["order_id"]): o for o in fresh_orders}
                                pyr_order = fresh_lookup.get(str(res_pyr["order_id"]))
                                if pyr_order and pyr_order.get("average_price"):
                                    pyr_price = float(pyr_order["average_price"])
                            except Exception:
                                pass

                            # Recalculate average entry
                            new_avg_entry = (entry + pyr_price) / 2
                            new_sl = new_avg_entry

                            # Cancel old stop loss order at broker
                            if sl_order_id:
                                try:
                                    cancel_order(sl_order_id)
                                except Exception as c_err:
                                    logger.error(f"[Tracker] Failed to cancel old SL: {c_err}")

                            # Place new stop loss order at break-even for total qty
                            new_sl_order_id = None
                            try:
                                gtt_tx_type = "SELL" if tx_type == "BUY" else "BUY"
                                gtt_res = place_gtt_oco(
                                    symbol=symbol,
                                    current_price=pyr_price,
                                    quantity=qty * 2,
                                    target_price=target,
                                    stop_loss_price=new_sl,
                                    transaction_type=gtt_tx_type
                                )
                                if gtt_res["success"]:
                                    new_sl_order_id = gtt_res.get("gtt_id")
                                else:
                                    err_msg = gtt_res.get("message", "Broker rejection")
                                    logger.error(f"[Tracker] Trailed SL GTT placement failed for {symbol}: {err_msg}")
                                    send_trade_message(
                                        f"🚨 <b>WARNING: Trailed SL Placement Failed — {symbol}</b>\n\n"
                                        f"Position doubled, but trailing Stop Loss placement failed!\n"
                                        f"Error: {err_msg}\n\n"
                                        f"⚠️ <b>Action Required:</b> Please place your trailed SL order of {qty * 2} shares manually at Rs {new_sl:.2f}."
                                    )
                            except Exception as sl_err:
                                logger.error(f"[Tracker] Failed to place new trailed SL order: {sl_err}")
                                send_trade_message(
                                    f"🚨 <b>WARNING: Trailed SL Placement Exception — {symbol}</b>\n\n"
                                    f"Position doubled, but trailing Stop Loss placement encountered an error!\n"
                                    f"Error: {sl_err}\n\n"
                                    f"⚠️ <b>Action Required:</b> Please place your trailed SL order of {qty * 2} shares manually at Rs {new_sl:.2f}."
                                )

                            # Update tracked status
                            tracked["pyramided"] = True
                            tracked["average_entry"] = new_avg_entry
                            tracked["quantity"] = qty * 2
                            tracked["stop_loss_price"] = new_sl
                            if new_sl_order_id:
                                tracked["sl_order_id"] = new_sl_order_id
                            save_tracked_orders()

                            msg = (
                                f"🚀 <b>PYRAMIDING TRIGGERED — {symbol}</b>\n\n"
                                f"Position doubled: added {qty} shares at Rs {pyr_price:.2f}\n"
                                f"New Quantity: {qty * 2} shares\n"
                                f"New Avg Entry: Rs {new_avg_entry:.2f}\n"
                                f"Stop Loss Trailed to Break-even: Rs {new_sl:.2f}\n"
                                f"Time: {get_ist_now().strftime('%I:%M %p IST')}"
                            )
                            send_trade_message(msg)
                        else:
                            err_msg = res_pyr.get("message", "Broker rejection")
                            logger.error(f"[Tracker] Pyramiding order failed for {symbol}: {err_msg}")
                            send_trade_message(
                                f"⚠️ <b>WARNING: Pyramiding Order Failed — {symbol}</b>\n\n"
                                f"Pyramiding was triggered at Rs {ltp:.2f}, but the broker order failed to place!\n"
                                f"Error: {err_msg}\n\n"
                                f"No manual action is required, the system will retry placement in the next loop."
                            )
                    except Exception as pyr_err:
                        logger.error(f"[Tracker] Pyramiding order placement failed: {pyr_err}")
                        send_trade_message(
                            f"⚠️ <b>WARNING: Pyramiding Exception — {symbol}</b>\n\n"
                            f"Pyramiding was triggered at Rs {ltp:.2f}, but order placement encountered an error!\n"
                            f"Error: {pyr_err}\n\n"
                            f"No manual action is required, the system will retry placement in the next loop."
                        )

            continue

        # Stage B: Handle pending breakout triggers
        if tracked["status"] in ["COMPLETE", "EXECUTED", "CANCELLED", "REJECTED"]:
            continue  # Already finalised

        upstox_order = order_lookup.get(order_id)
        if not upstox_order:
            continue

        new_status   = upstox_order["status"]
        last_status  = tracked["status"]

        if new_status == last_status:
            continue

        # Status changed!
        tracked["status"] = new_status
        save_tracked_orders()
        symbol             = tracked["symbol"]
        qty                = tracked["quantity"]
        entry              = tracked["entry_price"]
        tx_type            = tracked["transaction_type"]

        logger.info(f"[Tracker] {symbol} {order_id}: {last_status} → {new_status}")

        if new_status in ["COMPLETE", "EXECUTED"]:
            # Cancel the opposite breakout leg for this symbol to prevent double-execution
            for other_id, other_tracked in list(tracked_orders.items()):
                if other_tracked["symbol"] == symbol and other_id != order_id and other_tracked["status"] == "OPEN":
                    logger.info(f"[Tracker] Cancelling opposite leg {other_id} for {symbol} due to breakout fill")
                    try:
                        from upstox_broker import cancel_order
                        cancel_order(other_id)
                        other_tracked["status"] = "CANCELLED"
                        save_tracked_orders()
                    except Exception as cancel_err:
                        logger.error(f"[Tracker] Failed to cancel opposite leg {other_id}: {cancel_err}")

            exit_price = float(upstox_order.get("average_price", entry))
            
            # Transition status to ACTIVE for real-time monitoring
            tracked["status"] = "ACTIVE"
            tracked["entry_price"] = exit_price
            tracked["average_entry"] = exit_price
            tracked["pyramided"] = False
            save_tracked_orders()

            # Place initial Stop Loss order at broker
            gtt_msg_part = "Not set"
            sl_order_id = None
            try:
                from upstox_broker import place_gtt_oco
                gtt_tx_type = "SELL" if tx_type == "BUY" else "BUY"
                gtt_res = place_gtt_oco(
                    symbol=symbol,
                    current_price=exit_price,
                    quantity=qty,
                    target_price=tracked["target_price"],
                    stop_loss_price=tracked["stop_loss_price"],
                    transaction_type=gtt_tx_type
                )
                if gtt_res["success"]:
                    sl_order_id = gtt_res.get("gtt_id")
                    tracked["sl_order_id"] = sl_order_id
                    save_tracked_orders()
                    logger.info(f"[Tracker] GTT exit placed successfully for {symbol}: {sl_order_id}")
                    gtt_msg_part = f"✅ Active (ID: {sl_order_id})"
                else:
                    logger.error(f"[Tracker] GTT exit failed for {symbol}: {gtt_res.get('message')}")
                    gtt_msg_part = f"⚠️ Failed: {gtt_res.get('message')}"
            except Exception as gtt_err:
                logger.error(f"[Tracker] GTT placement exception: {gtt_err}")
                gtt_msg_part = f"⚠️ Exception: {gtt_err}"

            msg = (
                f"🚀 <b>POSITION ACTIVE — {symbol}</b>\n\n"
                f"{'📈' if tx_type == 'BUY' else '📉'} {tx_type} breakout filled\n"
                f"Entry Price : Rs {exit_price:.2f}\n"
                f"Quantity    : {qty} shares\n"
                f"Stop Loss   : Rs {tracked['stop_loss_price']:.2f}\n"
                f"Target      : Rs {tracked['target_price']:.2f}\n"
                f"Stop Loss ID: {gtt_msg_part}\n"
                f"Time        : {get_ist_now().strftime('%I:%M %p IST')}"
            )
            send_trade_message(msg)

        elif new_status == "CANCELLED":
            msg = (
                f"🚫 <b>ORDER CANCELLED — {symbol}</b>\n\n"
                f"{tx_type} order at Rs {entry:.2f} was cancelled\n"
                f"Time: {get_ist_now().strftime('%I:%M %p IST')}"
            )
            send_trade_message(msg)

        elif new_status == "REJECTED":
            reason = upstox_order.get("status_message", "Unknown reason")
            msg = (
                f"⛔ <b>ORDER REJECTED — {symbol}</b>\n\n"
                f"{tx_type} order at Rs {entry:.2f} was rejected\n"
                f"Reason: {reason}\n"
                f"Time: {get_ist_now().strftime('%I:%M %p IST')}"
            )
            send_trade_message(msg)


def send_daily_summary():
    """Send complete daily P&L summary from local daily trade logs."""
    global summary_sent
    if summary_sent or _is_summary_sent():
        return
    summary_sent = True
    _mark_summary_sent()

    now_str = get_ist_now().strftime("%d %b %Y")
    logger.info("[Tracker] Generating daily P&L summary from local tracker database...")
    
    # Load today's log to make sure we have all filled positions
    trades = load_daily_log()
    sep = "━━━━━━━━━━━━━━━━━━━━"

    if not trades:
        msg = f"📊 <b>DAILY SUMMARY — {now_str}</b>\n\nNo execution logs recorded today. System idle."
        send_trade_message(msg)
        logger.info("[Tracker] Daily summary sent (no trades today)")
        return

    total_pnl = sum(t["pnl"] for t in trades)
    winning   = [t for t in trades if t["pnl"] > 0]
    losing    = [t for t in trades if t["pnl"] < 0]

    lines = []
    for t in sorted(trades, key=lambda x: x["pnl"], reverse=True):
        sign2 = "🟢 WIN" if t["pnl"] >= 0 else "🔴 LOSS"
        lines.append(f"• {t['symbol']} | {sign2} | Rs {t['pnl']:+.2f}")

    msg = (
        f"📊 <b>DAILY SUMMARY — {now_str}</b>\n"
        f"Source: Local Tracker Database\n\n"
        f"{chr(10).join(lines)}\n\n"
        f"{sep}\n"
        f"💰 <b>Total P&L:</b> Rs {total_pnl:+.2f}\n"
        f"✅ <b>Winning Trades:</b> {len(winning)}\n"
        f"❌ <b>Losing Trades:</b> {len(losing)}\n"
        f"{sep}\n"
        f"All MIS positions squared off."
    )

    send_trade_message(msg)
    logger.info("[Tracker] Daily summary sent successfully")

INDIAN_HOLIDAYS_2026 = {
    "2026-01-26",  # Republic Day
    "2026-03-03",  # Holi
    "2026-03-26",  # Shri Ram Navami
    "2026-03-31",  # Shri Mahavir Jayanti
    "2026-04-03",  # Good Friday
    "2026-04-14",  # Dr. Baba Saheb Ambedkar Jayanti
    "2026-05-01",  # Maharashtra Day
    "2026-05-28",  # Bakri Id
    "2026-06-26",  # Muharram
    "2026-09-14",  # Ganesh Chaturthi
    "2026-10-02",  # Mahatma Gandhi Jayanti
    "2026-10-20",  # Dussehra
    "2026-11-10",  # Diwali-Balipratipada
    "2026-11-24",  # Prakash Gurpurb Sri Guru Nanak Dev
    "2026-12-25",  # Christmas
}

def is_trading_day():
    now = datetime.now(IST)
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    date_str = now.strftime("%Y-%m-%d")
    if date_str in INDIAN_HOLIDAYS_2026:
        return False
    return True

def run_tracker():
    """Main tracker loop — runs with fast polling during market hours."""
    global summary_sent
    logger.info("[Tracker] Started order tracking")
    load_daily_log()
    load_tracked_orders()

    while True:
        try:
            now = get_ist_now()

            # Send daily summary at 3:30 PM (only on trading days)
            if now.hour == 15 and now.minute >= 30 and not summary_sent:
                if is_trading_day():
                    send_daily_summary()
                else:
                    summary_sent = True
                    logger.info("[Tracker] Weekend/Holiday detected, skipping daily summary alert.")

            # Reset summary flag at midnight
            if now.hour == 0 and now.minute == 0:
                summary_sent = False
                daily_trades.clear()

            # Check orders during and after market hours
            if (9 <= now.hour <= 16) and is_trading_day():
                check_orders()
                time.sleep(3)  # Fast poll check every 3 seconds during market hours
            else:
                time.sleep(60)  # Slow check every minute outside market hours

        except Exception as e:
            logger.error(f"[Tracker] Error: {e}")
            time.sleep(60)


def start_tracker():
    """Start tracker in background thread."""
    t = threading.Thread(target=run_tracker, daemon=True)
    t.start()
    logger.info("[Tracker] Background tracker started")
    return t


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    print("Starting trade tracker...")
    run_tracker()


def get_broker_pnl():
    """Fetch actual P&L directly from Upstox trade book."""
    try:
        trades = get_trades()

        import json
        import os
        
        # Load valid instruments
        try:
            inst_path = os.path.join(os.path.dirname(__file__), "instruments.json")
            with open(inst_path, "r") as f:
                valid_instruments = set(json.load(f).keys())
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to load instruments.json for P&L filtering: {e}")
            valid_instruments = set()

        symbol_pnl = {}
        for t in trades:
            symbol = t["tradingsymbol"]
            
            # Skip any symbol not in our active instrument list
            if valid_instruments and symbol not in valid_instruments:
                continue
                
            qty    = t["quantity"]
            price  = t["average_price"]
            tx     = t["transaction_type"]

            if symbol not in symbol_pnl:
                symbol_pnl[symbol] = {"buy_qty": 0, "buy_val": 0,
                                       "sell_qty": 0, "sell_val": 0}
            if tx == "BUY":
                symbol_pnl[symbol]["buy_qty"]  += qty
                symbol_pnl[symbol]["buy_val"]  += qty * price
            else:
                symbol_pnl[symbol]["sell_qty"] += qty
                symbol_pnl[symbol]["sell_val"] += qty * price

        results = []
        for symbol, data in symbol_pnl.items():
            pnl = round(data["sell_val"] - data["buy_val"], 2)
            results.append({"symbol": symbol, "pnl": pnl})

        return results

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Zerodha P&L fetch failed: {e}")
        return None
