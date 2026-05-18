import os
import json
import time
import logging
import yfinance as yf
from datetime import datetime, timezone, timedelta
from telegram_bot import send_trade_message

# Enforce IST timezone
IST = timezone(timedelta(hours=5, minutes=30))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIGNALS_LOG = "/home/investo/bluecandle/signals.json"
SIM_LOG = "/home/investo/bluecandle/simulated_orders.json"
CAPITAL_PER_TRADE = 10000

def calculate_quantity(price):
    if price <= 0:
        return 0
    return max(int(CAPITAL_PER_TRADE / price), 1)

def run_simulation_tracking():
    logging.info("[Sim Tracker] Starting simulated trade tracking engine...")
    
    while True:
        try:
            now = datetime.now(IST)
            
            # Reset state at midnight (00:00 IST)
            if now.hour == 0 and now.minute == 0 and now.second < 15:
                logging.info("[Sim Tracker] Midnight reset — backing up simulation history.")
                # We can backup simulated_orders.json if needed
                
            # Only track during active trading and monitoring hours (9 AM to 4 PM IST)
            if not (9 <= now.hour <= 16):
                time.sleep(60)
                continue

            today_str = now.strftime("%d %b %Y")  # e.g., "18 May 2026"
            
            # 1. Load TV signals
            signals = []
            if os.path.exists(SIGNALS_LOG):
                try:
                    with open(SIGNALS_LOG, "r") as f:
                        signals = json.load(f)
                except Exception as err:
                    logging.error(f"[Sim Tracker] Error loading signals: {err}")

            # 2. Filter for today's signals
            today_signals = [s for s in signals if s.get("candle_date") == today_str]

            # 3. Load existing simulated orders
            sim_orders = []
            if os.path.exists(SIM_LOG):
                try:
                    with open(SIM_LOG, "r") as f:
                        sim_orders = json.load(f)
                except Exception as err:
                    logging.error(f"[Sim Tracker] Error loading sim orders: {err}")

            # 4. Enrich simulated orders with any new signals today
            updated = False
            for sig in today_signals:
                symbol = sig.get("instrument")
                candle_time = sig.get("candle_time")
                
                # Check if this signal is already represented in sim_orders
                exists = False
                for order in sim_orders:
                    if order.get("symbol") == symbol and order.get("time") == candle_time and order.get("date") == today_str:
                        exists = True
                        break
                        
                if not exists:
                    # New signal found! Place buy & sell legs in pending simulation
                    buy_entry = sig.get("buy_entry")
                    buy_target = sig.get("buy_target")
                    buy_stop = sig.get("buy_stop_loss")
                    
                    sell_entry = sig.get("sell_entry")
                    sell_target = sig.get("sell_target")
                    sell_stop = sig.get("sell_stop_loss")
                    
                    if buy_entry and sell_entry:
                        new_order = {
                            "symbol": symbol,
                            "date": today_str,
                            "time": candle_time,
                            "buy_entry": float(buy_entry),
                            "buy_target": float(buy_target),
                            "buy_stop_loss": float(buy_stop),
                            "buy_qty": calculate_quantity(float(buy_entry)),
                            "sell_entry": float(sell_entry),
                            "sell_target": float(sell_target),
                            "sell_stop_loss": float(sell_stop),
                            "sell_qty": calculate_quantity(float(sell_entry)),
                            "status": "PENDING",
                            "active_leg": None,
                            "entry_price": None,
                            "exit_price": None,
                            "entry_time": None,
                            "exit_time": None,
                            "pnl": 0.0,
                            "ltp": float(sig.get("price", buy_entry))
                        }
                        sim_orders.append(new_order)
                        updated = True
                        logging.info(f"[Sim Tracker] Registered new simulation breakout bracket for {symbol}")

            # 5. Fetch live LTPs for all active symbols to update status
            active_symbols = list(set([o["symbol"] for o in sim_orders if o["status"] in ["PENDING", "ACTIVE"]]))
            ltps = {}
            for symbol in active_symbols:
                try:
                    ticker = yf.Ticker(f"{symbol}.NS")
                    # yfinance fast_info retrieval
                    ltps[symbol] = float(ticker.fast_info['last_price'])
                except Exception as yf_err:
                    logging.error(f"[Sim Tracker] Failed to fetch yfinance price for {symbol}: {yf_err}")

            # 6. Execute paper-trading matches
            for order in sim_orders:
                symbol = order["symbol"]
                if symbol not in ltps:
                    continue
                    
                ltp = ltps[symbol]
                order["ltp"] = ltp
                
                # Check transition states
                if order["status"] == "PENDING":
                    # Breakout Check
                    if ltp >= order["buy_entry"]:
                        order["status"] = "ACTIVE"
                        order["active_leg"] = "BUY"
                        order["entry_price"] = order["buy_entry"]
                        order["entry_time"] = datetime.now(IST).isoformat()
                        updated = True
                        
                        msg = (
                            f"🔔 <b>[SIMULATION] BUY LEG FILLED — {symbol}</b>\n\n"
                            f"📈 Long Entry filled at Rs {order['buy_entry']:.2f}\n"
                            f"Quantity   : {order['buy_qty']} shares\n"
                            f"Target     : Rs {order['buy_target']:.2f}\n"
                            f"Stop Loss  : Rs {order['buy_stop_loss']:.2f}\n"
                            f"Sim Time   : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                        )
                        send_trade_message(msg)
                        logging.info(f"[Sim Tracker] Long breakout filled for {symbol} at {order['buy_entry']}")
                        
                    elif ltp <= order["sell_entry"]:
                        order["status"] = "ACTIVE"
                        order["active_leg"] = "SELL"
                        order["entry_price"] = order["sell_entry"]
                        order["entry_time"] = datetime.now(IST).isoformat()
                        updated = True
                        
                        msg = (
                            f"🔔 <b>[SIMULATION] SELL LEG FILLED — {symbol}</b>\n\n"
                            f"📉 Short Entry filled at Rs {order['sell_entry']:.2f}\n"
                            f"Quantity   : {order['sell_qty']} shares\n"
                            f"Target     : Rs {order['sell_target']:.2f}\n"
                            f"Stop Loss  : Rs {order['sell_stop_loss']:.2f}\n"
                            f"Sim Time   : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                        )
                        send_trade_message(msg)
                        logging.info(f"[Sim Tracker] Short breakout filled for {symbol} at {order['sell_entry']}")
                        
                elif order["status"] == "ACTIVE":
                    # Exit Check
                    entry = order["entry_price"]
                    qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
                    
                    if order["active_leg"] == "BUY":
                        # Target Hit
                        if ltp >= order["buy_target"]:
                            order["status"] = "TARGET HIT"
                            order["exit_price"] = order["buy_target"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (order["buy_target"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((order["buy_target"] - entry) / entry) * 100
                            msg = (
                                f"✅ <b>[SIMULATION] TARGET HIT (+Rs {pnl:.2f}) — {symbol}</b>\n\n"
                                f"🟢 BUY position completed!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['buy_target']:.2f}\n"
                                f"Return      : +{pnl_pct:.2f}%\n"
                                f"PnL         : +Rs {pnl:.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Long Target hit for {symbol} at {order['buy_target']}")
                            
                        # Stop Loss Hit
                        elif ltp <= order["buy_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["buy_stop_loss"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (order["buy_stop_loss"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((order["buy_stop_loss"] - entry) / entry) * 100
                            msg = (
                                f"❌ <b>[SIMULATION] STOP LOSS HIT (-Rs {abs(pnl):.2f}) — {symbol}</b>\n\n"
                                f"🔴 BUY position stopped out!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['buy_stop_loss']:.2f}\n"
                                f"Return      : {pnl_pct:.2f}%\n"
                                f"PnL         : -Rs {abs(pnl):.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Long Stop Loss hit for {symbol} at {order['buy_stop_loss']}")
                            
                        else:
                            # Update running unrealized PnL
                            unrealized_pnl = (ltp - entry) * qty
                            if order["pnl"] != round(unrealized_pnl, 2):
                                order["pnl"] = round(unrealized_pnl, 2)
                                updated = True
                                
                    elif order["active_leg"] == "SELL":
                        # Target Hit
                        if ltp <= order["sell_target"]:
                            order["status"] = "TARGET HIT"
                            order["exit_price"] = order["sell_target"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (entry - order["sell_target"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((entry - order["sell_target"]) / entry) * 100
                            msg = (
                                f"✅ <b>[SIMULATION] TARGET HIT (+Rs {pnl:.2f}) — {symbol}</b>\n\n"
                                f"🟢 SELL position completed!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['sell_target']:.2f}\n"
                                f"Return      : +{pnl_pct:.2f}%\n"
                                f"PnL         : +Rs {pnl:.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Short Target hit for {symbol} at {order['sell_target']}")
                            
                        # Stop Loss Hit
                        elif ltp >= order["sell_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["sell_stop_loss"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (entry - order["sell_stop_loss"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((entry - order["sell_stop_loss"]) / entry) * 100
                            msg = (
                                f"❌ <b>[SIMULATION] STOP LOSS HIT (-Rs {abs(pnl):.2f}) — {symbol}</b>\n\n"
                                f"🔴 SELL position stopped out!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['sell_stop_loss']:.2f}\n"
                                f"Return      : {pnl_pct:.2f}%\n"
                                f"PnL         : -Rs {abs(pnl):.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Short Stop Loss hit for {symbol} at {order['sell_stop_loss']}")
                            
                        else:
                            # Update running unrealized PnL
                            unrealized_pnl = (entry - ltp) * qty
                            if order["pnl"] != round(unrealized_pnl, 2):
                                order["pnl"] = round(unrealized_pnl, 2)
                                updated = True

            # 7. Save updated sim orders
            if updated or active_symbols:
                with open(SIM_LOG, "w") as f:
                    json.dump(sim_orders, f, indent=2)
                    
        except Exception as e:
            logging.error(f"[Sim Tracker] Loop error: {e}")
            
        time.sleep(10)

if __name__ == "__main__":
    run_simulation_tracking()
