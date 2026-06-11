import os
import json
import time
import logging
import yfinance as yf
import pandas as pd
import requests

def download_yf_clean(ticker, interval="1m", range_str="1d"):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range_str}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        if not data.get('chart', {}).get('result'):
            return pd.DataFrame()
        result = data['chart']['result'][0]
        timestamps = result.get('timestamp', [])
        if not timestamps:
            return pd.DataFrame()
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        
        opens = quote.get('open', [])
        highs = quote.get('high', [])
        lows = quote.get('low', [])
        closes = quote.get('close', [])
        volumes = quote.get('volume', [])
        
        df_data = []
        for i in range(len(timestamps)):
            if i >= len(opens) or opens[i] is None or highs[i] is None or lows[i] is None or closes[i] is None:
                continue
            df_data.append({
                'timestamp': pd.to_datetime(timestamps[i], unit='s', utc=True),
                'Open': float(opens[i]),
                'High': float(highs[i]),
                'Low': float(lows[i]),
                'Close': float(closes[i]),
                'Volume': float(volumes[i] if volumes[i] is not None else 0)
            })
            
        if not df_data:
            return pd.DataFrame()
            
        df = pd.DataFrame(df_data)
        tz_name = result.get('meta', {}).get('exchangeTimezoneName', 'UTC')
        df['timestamp'] = df['timestamp'].dt.tz_convert(tz_name)
        df.set_index('timestamp', inplace=True)
        return df
    except Exception as e:
        logging.error(f"[YahooFinance Clean] Error downloading {ticker}: {e}")
        return pd.DataFrame()

from datetime import datetime, timezone, timedelta
from telegram_bot import send_trade_message

# Enforce IST timezone
IST = timezone(timedelta(hours=5, minutes=30))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIGNALS_LOG = "/home/investo/bluecandle/signals.json"
SIM_LOG = "/home/investo/bluecandle/simulated_orders.json"
CAPITAL_PER_TRADE = 10000
TARGET_R = 1.0
TRIGGER_R = 0.8
LOCK_R = 0.7

def get_completed_15m_candle(df, current_time):
    try:
        minute_offset = current_time.minute % 15
        rounded = current_time.replace(second=0, microsecond=0) - timedelta(minutes=minute_offset)
        candle_start = rounded - timedelta(minutes=15)
        candle_end = rounded - timedelta(minutes=1)
        
        # Slicing index
        candle_df = df.loc[candle_start:candle_end]
        if not candle_df.empty:
            c_high = float(candle_df['High'].max())
            c_low = float(candle_df['Low'].min())
            return c_high, c_low
    except Exception:
        pass
    return None, None

def calculate_quantity(entry_price):
    risk_per_trade = 100  # Gives 10k capital per trade
    return max(1, int(risk_per_trade / (entry_price * 0.01)))


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

def run_simulation_tracking():
    logging.info("[Sim Tracker] Starting simulated trade tracking engine...")
    
    while True:
        try:
            now = datetime.now(IST)
            
            # Reset state at midnight (00:00 IST)
            if now.hour == 0 and now.minute == 0 and now.second < 15:
                logging.info("[Sim Tracker] Midnight reset — backing up simulation history.")
                # We can backup simulated_orders.json if needed
                
            # Check if today is a weekday and not a holiday
            date_str = now.strftime("%Y-%m-%d")
            if now.weekday() >= 5 or date_str in INDIAN_HOLIDAYS_2026:
                time.sleep(300)
                continue

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
                
                # Check if this signal is already represented in sim_orders (per symbol per day)
                exists = False
                for order in sim_orders:
                    if order.get("symbol") == symbol and order.get("date") == today_str:
                        exists = True
                        break
                        
                if not exists:
                    # Candle Spread Veto check disabled per user request (authenticity of bluesignal confirmed)
                    # high = sig.get("high")
                    # low = sig.get("low")
                    # if high and low:
                    #     candle_spread_pct = ((high - low) / low) * 100
                    #     if candle_spread_pct < 0.20 or candle_spread_pct > 1.00:
                    #         logging.info(f"[Sim Tracker] Skipping {symbol} - Candle spread ({candle_spread_pct:.2f}%) outside safety range (0.20% - 1.00%)")
                    #         continue
                            
                    # Apply Golden Hours Time Filter (11:30 AM - 1:30 PM Chop Zone)
                    if candle_time:
                        try:
                            h, m = map(int, candle_time.split(":"))
                            time_float = h + (m / 60.0)
                            if 11.5 <= time_float <= 13.5:
                                logging.info(f"[Sim Tracker] Skipping {symbol} - Inside Golden Hours Chop Zone ({candle_time})")
                                continue
                        except Exception as e:
                            logging.error(f"[Sim Tracker] Error parsing candle time {candle_time}: {e}")
                            
                    # New signal found! Place buy & sell legs in pending simulation
                    high = sig.get("high")
                    low = sig.get("low")
                    
                    if high and low:
                        # Apply Eashaan's execution rules
                        tick = 0.05
                        buy_entry = round(high + tick, 2)
                        sell_entry = round(low - tick, 2)
                        
                        buy_stop = low
                        sell_stop = high
                        
                        buy_target = round(buy_entry * 1.01, 2)
                        sell_target = round(sell_entry * 0.99, 2)
                        
                        for plan in ["basic", "growth"]:
                            new_order = {
                                "symbol": symbol,
                                "date": today_str,
                                "time": candle_time,
                                "plan": plan,
                                "buy_entry": buy_entry,
                                "buy_target": buy_target if plan == "basic" else None,
                                "buy_stop_loss": float(buy_stop),
                                "buy_qty": calculate_quantity(buy_entry),
                                "sell_entry": sell_entry,
                                "sell_target": sell_target if plan == "basic" else None,
                                "sell_stop_loss": float(sell_stop),
                                "sell_qty": calculate_quantity(sell_entry),
                                "status": "PENDING",
                                "active_leg": None,
                                "entry_price": None,
                                "exit_price": None,
                                "entry_time": None,
                                "exit_time": None,
                                "pnl": 0.0,
                                "ltp": float(sig.get("price", buy_entry)),
                                "buy_stop_loss_original": float(buy_stop),
                                "sell_stop_loss_original": float(sell_stop),
                                "is_sar": False
                            }
                            sim_orders.append(new_order)
                        updated = True
                        logging.info(f"[Sim Tracker] Registered new simulation breakout bracket for {symbol}")

            # 5. Fetch live LTPs and 1m DataFrames for all active symbols to update status
            active_symbols = list(set([o["symbol"] for o in sim_orders if o["status"] in ["PENDING", "PENDING_SAR", "ACTIVE"]]))
            ltps = {}
            dfs = {}
            for symbol in active_symbols:
                try:
                    df = download_yf_clean(f"{symbol}.NS", interval="1m", range_str="1d")
                    if not df.empty:
                        dfs[symbol] = df
                        ltps[symbol] = float(df['Close'].iloc[-1])
                except Exception as yf_err:
                    logging.error(f"[Sim Tracker] Failed to fetch yfinance data for {symbol}: {yf_err}")

            # 6. Execute paper-trading matches
            for order in sim_orders:
                symbol = order["symbol"]
                if symbol not in ltps:
                    continue
                    
                ltp = ltps[symbol]
                order["ltp"] = ltp
                
                # Check transition states
                if order["status"] in ["PENDING", "PENDING_SAR"]:
                    if order["status"] == "PENDING":
                        # Breakout Check
                        if ltp >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "BUY"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = datetime.now(IST).isoformat()
                            updated = True
                            
                            buy_target_str = f"Rs {order['buy_target']:.2f}" if order['buy_target'] is not None else "N/A"
                            msg = (
                                f"🔔 <b>[SIMULATION] BUY LEG FILLED — {symbol}</b>\n\n"
                                f"📈 Long Entry filled at Rs {order['buy_entry']:.2f}\n"
                                f"Quantity   : {order['buy_qty']} shares\n"
                                f"Target     : {buy_target_str}\n"
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
                            
                            sell_target_str = f"Rs {order['sell_target']:.2f}" if order['sell_target'] is not None else "N/A"
                            msg = (
                                f"🔔 <b>[SIMULATION] SELL LEG FILLED — {symbol}</b>\n\n"
                                f"📉 Short Entry filled at Rs {order['sell_entry']:.2f}\n"
                                f"Quantity   : {order['sell_qty']} shares\n"
                                f"Target     : {sell_target_str}\n"
                                f"Stop Loss  : Rs {order['sell_stop_loss']:.2f}\n"
                                f"Sim Time   : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Short breakout filled for {symbol} at {order['sell_entry']}")
                    else:  # PENDING_SAR
                        if order["active_leg"] == "BUY" and ltp >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = datetime.now(IST).isoformat()
                            updated = True
                            
                            buy_target_str = f"Rs {order['buy_target']:.2f}" if order['buy_target'] is not None else "N/A"
                            msg = (
                                f"🔄 <b>[SIMULATION SAR] BUY LEG FILLED — {symbol}</b>\n\n"
                                f"📈 Long Entry filled at Rs {order['buy_entry']:.2f}\n"
                                f"Quantity   : {order['buy_qty']} shares (Martingale x2)\n"
                                f"Stop Loss  : Rs {order['buy_stop_loss']:.2f}\n"
                                f"Sim Time   : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Long SAR breakout filled for {symbol} at {order['buy_entry']}")
                        elif order["active_leg"] == "SELL" and ltp <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = datetime.now(IST).isoformat()
                            updated = True
                            
                            sell_target_str = f"Rs {order['sell_target']:.2f}" if order['sell_target'] is not None else "N/A"
                            msg = (
                                f"🔄 <b>[SIMULATION SAR] SELL LEG FILLED — {symbol}</b>\n\n"
                                f"📉 Short Entry filled at Rs {order['sell_entry']:.2f}\n"
                                f"Quantity   : {order['sell_qty']} shares (Martingale x2)\n"
                                f"Stop Loss  : Rs {order['sell_stop_loss']:.2f}\n"
                                f"Sim Time   : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Short SAR breakout filled for {symbol} at {order['sell_entry']}")
                        
                elif order["status"] == "ACTIVE":
                    # Exit Check
                    entry = order["entry_price"]
                    qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
                    plan = order.get("plan", "basic")
                    dec_places = 2
                    
                    # 3:15 PM Auto Square-Off Check
                    if (now.hour == 15 and now.minute >= 15) or now.hour >= 16:
                        order["status"] = "SQ OFF"
                        order["exit_price"] = ltp
                        order["exit_time"] = datetime.now(IST).isoformat()
                        
                        pnl = (ltp - entry) * qty if order["active_leg"] == "BUY" else (entry - ltp) * qty
                        order["pnl"] = round(pnl, 2)
                        updated = True
                        
                        pnl_pct = (pnl / (entry * qty)) * 100
                        msg = (
                            f"⏰ <b>[SIMULATION] 3:15 PM AUTO SQUARE-OFF — {symbol} ({plan.upper()} plan)</b>\n\n"
                            f"🟡 {order['active_leg']} position closed!\n"
                            f"Entry Price : Rs {entry:.2f}\n"
                            f"Exit Price  : Rs {ltp:.2f}\n"
                            f"Return      : {pnl_pct:.2f}%\n"
                            f"PnL         : Rs {pnl:.2f}\n"
                            f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                        )
                        send_trade_message(msg)
                        logging.info(f"[Sim Tracker] Auto Squared-off {symbol} at {ltp}")
                        continue
                    
                    # Get DataFrame for candle tracking
                    df = dfs.get(symbol)
                    
                    if order["active_leg"] == "BUY":
                        distance_1R = order.get("distance_1R")
                        if not distance_1R:
                            distance_1R = order["buy_entry"] * 0.01
                            order["distance_1R"] = distance_1R
                            updated = True
                            
                        # 1. Target check (1.0R) - only for basic plan
                        if plan == "basic" and order.get("buy_target") is not None:
                            if ltp >= order["buy_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["buy_target"]
                                order["exit_time"] = datetime.now(IST).isoformat()
                                pnl = (order["buy_target"] - entry) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                
                                msg = (
                                    f"🎯 <b>[SIMULATION] TARGET HIT (+{TARGET_R:.1f}R) — {symbol} (BASIC plan)</b>\n\n"
                                    f"🔴 BUY position closed!\n"
                                    f"Entry Price : Rs {entry:.2f}\n"
                                    f"Exit Price  : Rs {order['buy_target']:.2f}\n"
                                    f"PnL         : Rs {pnl:+.2f}\n"
                                    f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                                )
                                send_trade_message(msg)
                                logging.info(f"[Sim Tracker] Long Target hit for {symbol} at {order['buy_target']}")
                                continue

                        # 2. Stop Loss check
                        if ltp <= order["buy_stop_loss"]:
                            is_trailed = order["buy_stop_loss"] > order["buy_stop_loss_original"]
                            order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                            order["exit_price"] = order["buy_stop_loss"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (order["buy_stop_loss"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((order["buy_stop_loss"] - entry) / entry) * 100
                            emoji = "✅" if is_trailed else "❌"
                            leg_status = "Trailing Stop Loss Hit!" if is_trailed else "STOP LOSS HIT"
                            
                            msg = (
                                f"{emoji} <b>[SIMULATION] {leg_status} ({pnl_pct:+.2f}%) — {symbol} ({plan.upper()} plan)</b>\n\n"
                                f"🔴 BUY position closed!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['buy_stop_loss']:.2f}\n"
                                f"PnL         : Rs {pnl:+.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Long SL hit for {symbol} at {order['buy_stop_loss']} ({plan} plan)")
                            
                            # Eashaan Rule 3: Martingale SAR (Only on Loss and original SL)
                            is_original_sl = order["buy_stop_loss"] == order["buy_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = int(qty * 2)
                                # Reversal entry is at the original opposite breakout level (sell_entry)
                                sar_entry = order["sell_entry"]
                                new_sar = {
                                    "symbol": symbol,
                                    "date": order["date"],
                                    "time": datetime.now(IST).strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": order["buy_entry"],
                                    "buy_target": round(order["buy_entry"] * 1.01, 2) if plan == "basic" else None,
                                    "buy_stop_loss": order["buy_entry"],
                                    "buy_qty": sar_qty,
                                    "sell_entry": sar_entry,
                                    "sell_target": round(sar_entry * 0.99, 2) if plan == "basic" else None,
                                    "sell_stop_loss": round(sar_entry + distance_1R, 2),
                                    "sell_qty": sar_qty,
                                    "status": "PENDING_SAR",
                                    "active_leg": "SELL",
                                    "entry_price": None,
                                    "exit_price": None,
                                    "entry_time": None,
                                    "exit_time": None,
                                    "pnl": 0.0,
                                    "ltp": ltp,
                                    "is_sar": True,
                                    "distance_1R": distance_1R,
                                    "buy_stop_loss_original": order["buy_entry"],
                                    "sell_stop_loss_original": round(sar_entry + distance_1R, 2)
                                }
                                sim_orders.append(new_sar)
                                send_trade_message(f"🔄 <b>[SIMULATION SAR] SELL BREAKOUT QUEUED — {symbol} ({plan.upper()} plan)</b>\nQuantity: {sar_qty} (Martingale x2)\nEntry Trigger: Rs {sar_entry:.2f}\nTrailing SL: Rs {new_sar['sell_stop_loss']:.2f}")
                        else:
                            # Trail Logic
                            highest = order.get("highest_reached", entry)
                            if ltp > highest:
                                order["highest_reached"] = ltp
                                highest = ltp
                                
                            sl_candidates = [order["buy_stop_loss"]]
                            
                            # A. Progressive lock trailing (Strategy 3)
                            profit_pct = (highest - entry) / entry * 100
                            if plan == "basic":
                                if profit_pct >= 0.7:
                                    sl_candidates.append(entry * 1.004)
                                elif profit_pct >= 0.4:
                                    sl_candidates.append(entry)
                            else: # growth plan
                                if profit_pct >= 1.0:
                                    sl_candidates.append(highest * 0.997)
                                elif profit_pct >= 0.7:
                                    sl_candidates.append(entry * 1.004)
                                elif profit_pct >= 0.4:
                                    sl_candidates.append(entry)
                                    
                            # B. Candle-low trailing (Strategy 2)
                            if df is not None and not df.empty:
                                ref_time = df.index[-1]
                                c_high_15m, c_low_15m = get_completed_15m_candle(df, ref_time)
                                if c_low_15m is not None:
                                    if c_low_15m > order["buy_stop_loss"]:
                                        if c_low_15m < ltp:
                                            sl_candidates.append(c_low_15m)
                                            
                            new_sl = max(sl_candidates)
                            new_sl = round(new_sl, dec_places)
                            if order["buy_stop_loss"] != new_sl:
                                order["buy_stop_loss"] = new_sl
                                updated = True
                                logging.info(f"[{symbol}] Trailed BUY SL to {order['buy_stop_loss']} ({plan} plan)")

                            # Update running unrealized PnL
                            unrealized_pnl = (ltp - entry) * qty
                            if order.get("pnl") != round(unrealized_pnl, 2):
                                order["pnl"] = round(unrealized_pnl, 2)
                                updated = True
                                
                    elif order["active_leg"] == "SELL":
                        distance_1R = order.get("distance_1R")
                        if not distance_1R:
                            distance_1R = order["sell_entry"] * 0.01
                            order["distance_1R"] = distance_1R
                            updated = True
                            
                        # 1. Target check (1.0R) - only for basic plan
                        if plan == "basic" and order.get("sell_target") is not None:
                            if ltp <= order["sell_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["sell_target"]
                                order["exit_time"] = datetime.now(IST).isoformat()
                                pnl = (entry - order["sell_target"]) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                
                                msg = (
                                    f"🎯 <b>[SIMULATION] TARGET HIT (+{TARGET_R:.1f}R) — {symbol} (BASIC plan)</b>\n\n"
                                    f"🔴 SELL position closed!\n"
                                    f"Entry Price : Rs {entry:.2f}\n"
                                    f"Exit Price  : Rs {order['sell_target']:.2f}\n"
                                    f"PnL         : Rs {pnl:+.2f}\n"
                                    f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                                )
                                send_trade_message(msg)
                                logging.info(f"[Sim Tracker] Short Target hit for {symbol} at {order['sell_target']}")
                                continue

                        # 2. Stop Loss check
                        if ltp >= order["sell_stop_loss"]:
                            is_trailed = order["sell_stop_loss"] < order["sell_stop_loss_original"]
                            order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                            order["exit_price"] = order["sell_stop_loss"]
                            order["exit_time"] = datetime.now(IST).isoformat()
                            pnl = (entry - order["sell_stop_loss"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                            pnl_pct = ((entry - order["sell_stop_loss"]) / entry) * 100
                            emoji = "✅" if is_trailed else "❌"
                            leg_status = "Trailing Stop Loss Hit!" if is_trailed else "STOP LOSS HIT"
                            
                            msg = (
                                f"{emoji} <b>[SIMULATION] {leg_status} ({pnl_pct:+.2f}%) — {symbol} ({plan.upper()} plan)</b>\n\n"
                                f"🔴 SELL position closed!\n"
                                f"Entry Price : Rs {entry:.2f}\n"
                                f"Exit Price  : Rs {order['sell_stop_loss']:.2f}\n"
                                f"PnL         : Rs {pnl:+.2f}\n"
                                f"Sim Time    : {datetime.now(IST).strftime('%I:%M:%S %p IST')}"
                            )
                            send_trade_message(msg)
                            logging.info(f"[Sim Tracker] Short SL hit for {symbol} at {order['sell_stop_loss']} ({plan} plan)")
                            
                            # Eashaan Rule 3: Martingale SAR (Only on Loss and original SL)
                            is_original_sl = order["sell_stop_loss"] == order["sell_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = int(qty * 2)
                                # Reversal entry is at the original opposite breakout level (buy_entry)
                                sar_entry = order["buy_entry"]
                                new_sar = {
                                    "symbol": symbol,
                                    "date": order["date"],
                                    "time": datetime.now(IST).strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": sar_entry,
                                    "buy_target": round(sar_entry * 1.01, 2) if plan == "basic" else None,
                                    "buy_stop_loss": round(sar_entry - distance_1R, 2),
                                    "buy_qty": sar_qty,
                                    "sell_entry": order["sell_entry"],
                                    "sell_target": round(order["sell_entry"] * 0.99, 2) if plan == "basic" else None,
                                    "sell_stop_loss": order["sell_entry"],
                                    "sell_qty": sar_qty,
                                    "status": "PENDING_SAR",
                                    "active_leg": "BUY",
                                    "entry_price": None,
                                    "exit_price": None,
                                    "entry_time": None,
                                    "exit_time": None,
                                    "pnl": 0.0,
                                    "ltp": ltp,
                                    "is_sar": True,
                                    "distance_1R": distance_1R,
                                    "buy_stop_loss_original": round(sar_entry - distance_1R, 2),
                                    "sell_stop_loss_original": order["sell_entry"]
                                }
                                sim_orders.append(new_sar)
                                send_trade_message(f"🔄 <b>[SIMULATION SAR] BUY BREAKOUT QUEUED — {symbol} ({plan.upper()} plan)</b>\nQuantity: {sar_qty} (Martingale x2)\nEntry Trigger: Rs {sar_entry:.2f}\nTrailing SL: Rs {new_sar['buy_stop_loss']:.2f}")
                        else:
                            lowest = order.get("lowest_reached", entry)
                            if ltp < lowest:
                                order["lowest_reached"] = ltp
                                lowest = ltp
                                
                            sl_candidates = [order["sell_stop_loss"]]
                            
                            # A. Progressive lock trailing (Strategy 3)
                            profit_pct = (entry - lowest) / entry * 100
                            if plan == "basic":
                                if profit_pct >= 0.7:
                                    sl_candidates.append(entry * 0.996)
                                elif profit_pct >= 0.4:
                                    sl_candidates.append(entry)
                            else: # growth plan
                                if profit_pct >= 1.0:
                                    sl_candidates.append(lowest * 1.003)
                                elif profit_pct >= 0.7:
                                    sl_candidates.append(entry * 0.996)
                                elif profit_pct >= 0.4:
                                    sl_candidates.append(entry)
                                    
                            # B. Candle-high trailing (Strategy 2)
                            if df is not None and not df.empty:
                                ref_time = df.index[-1]
                                c_high_15m, c_low_15m = get_completed_15m_candle(df, ref_time)
                                if c_high_15m is not None:
                                    if c_high_15m < order["sell_stop_loss"]:
                                        if c_high_15m > ltp:
                                            sl_candidates.append(c_high_15m)
                                            
                            new_sl = min(sl_candidates)
                            new_sl = round(new_sl, dec_places)
                            if order["sell_stop_loss"] != new_sl:
                                order["sell_stop_loss"] = new_sl
                                updated = True
                                logging.info(f"[{symbol}] Trailed SELL SL to {order['sell_stop_loss']} ({plan} plan)")

                            # Update running unrealized PnL
                            unrealized_pnl = (entry - ltp) * qty
                            if order.get("pnl") != round(unrealized_pnl, 2):
                                order["pnl"] = round(unrealized_pnl, 2)
                                updated = True

            # 7. Save updated sim orders
            if updated or active_symbols:
                with open(SIM_LOG, "w") as f:
                    json.dump(sim_orders, f, indent=2)
                
                # Synchronize to Supabase via database helper
                if updated:
                    import db_helper
                    for order in sim_orders:
                        cl_id = f"{order['symbol']}_{order['date']}_{order['time']}_{order.get('plan', 'basic')}_{order.get('is_sar', False)}"
                        order["cl_order_id"] = cl_id.replace(" ", "_")
                        db_helper.save_order(order)
                    
        except Exception as e:
            logging.error(f"[Sim Tracker] Loop error: {e}")
            
        time.sleep(10)

if __name__ == "__main__":
    run_simulation_tracking()
