import os
import json
import time
import logging
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta

# Timezone config
IST = timezone(timedelta(hours=5, minutes=30))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIGNALS_LOG = "signals.json"
SIM_LOG = "simulated_orders.json"

LOT_SIZES = {
    "TATASTEEL": 5500,
    "DLF": 1650,
    "HAVELLS": 500,
    "BHEL": 5250,
    "ADANIENSOL": 250,
    "PFC": 6250,
    "TATACHEM": 550,
    "ADANIPORTS": 650,
    "TCS": 175,
    "RELIANCE": 250,
    "INFY": 400,
    "HDFCBANK": 550,
    "ICICIBANK": 700,
    "SBIN": 1500,
    "ITC": 1600,
    "LT": 300,
    "AXISBANK": 625
}

# Define Baskets
CURRENT_BASKET = ["TATASTEEL", "DLF", "HAVELLS", "BHEL", "ADANIENSOL"]
OPTIMIZED_BASKET = ["PFC", "BHEL", "HAVELLS", "TATACHEM", "ADANIPORTS"]

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

def calculate_quantity(symbol, entry_price, plan):
    # If futures or dynamic volume, use 2 lots
    if "futures" in plan or plan == "dynamic_volume":
        return LOT_SIZES.get(symbol, 100) * 2
        
    # If entry price is invalid (vetoed), return 0
    if entry_price <= 0.0 or entry_price >= 999999.0:
        return 0
        
    # For basic Cash Equity, default to 1 Lakh capital per trade
    capital = 100000.0
    return max(1, int(capital / entry_price))

def spawn_second_trade(parent_order: dict, leg: str, trigger_time: str, sim_orders: list):
    symbol = parent_order["symbol"]
    plan = parent_order["plan"]
    today_str = parent_order["date"]
    
    # 0.15% offset from target for the new entry
    if leg == "BUY":
        new_entry = round(parent_order["buy_target"] * 1.0015, 2)
        new_tgt = round(new_entry * 1.004, 2)
        new_sl = round(new_entry * 0.99, 2)
        
        buy_entry = new_entry
        buy_target = new_tgt
        buy_stop = new_sl
        buy_qty = calculate_quantity(symbol, buy_entry, plan)
        
        sell_entry = 0.0 # Vetoed
        sell_target = 0.0
        sell_stop = 0.0
        sell_qty = 0
    else:
        new_entry = round(parent_order["sell_target"] * 0.9985, 2)
        new_tgt = round(new_entry * 0.996, 2)
        new_sl = round(new_entry * 1.01, 2)
        
        sell_entry = new_entry
        sell_target = new_tgt
        sell_stop = new_sl
        sell_qty = calculate_quantity(symbol, sell_entry, plan)
        
        buy_entry = 999999.0 # Vetoed
        buy_target = 999999.0
        buy_stop = 999999.0
        buy_qty = 0
        
    new_order = {
        "symbol": symbol,
        "date": today_str,
        "time": trigger_time.split("T")[1][:5] if "T" in trigger_time else "10:00",
        "plan": plan,
        "buy_entry": buy_entry,
        "buy_target": buy_target,
        "buy_stop_loss": buy_stop,
        "buy_qty": buy_qty,
        "sell_entry": sell_entry,
        "sell_target": sell_target,
        "sell_stop_loss": sell_stop,
        "sell_qty": sell_qty,
        "status": "PENDING",
        "active_leg": None,
        "entry_price": None,
        "exit_price": None,
        "entry_time": None,
        "exit_time": None,
        "pnl": 0.0,
        "ltp": parent_order["ltp"],
        "buy_stop_loss_original": buy_stop,
        "sell_stop_loss_original": sell_stop,
        "is_sar": False,
        "is_second_trade": True
    }
    sim_orders.append(new_order)
    logging.info(f"[Indian Sim Tracker] [{symbol} ({plan})] Spawned second trend-following trade at entry {new_entry} (leg: {leg})")

def get_nifty_trend() -> float:
    try:
        import requests
        url = "https://query1.finance.yahoo.com/v8/finance/chart/^NSEI"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=10)
        data = res.json()
        result = data.get("chart", {}).get("result", [None])[0]
        if result:
            last_price = result["meta"]["regularMarketPrice"]
            prev_close = result["meta"]["chartPreviousClose"]
            if prev_close > 0:
                return ((last_price - prev_close) / prev_close) * 100
    except Exception as e:
        logging.error(f"Error fetching Nifty trend for sim: {e}")
    return 0.0

def run_simulation_tracking():
    logging.info("[Indian Sim Tracker] Starting live Indian simulated trade tracking engine...")
    
    while True:
        try:
            now = datetime.now(IST)
            
            # Inactive hours check (Skip weekends and nights)
            if now.weekday() >= 5:
                time.sleep(300)
                continue
            if not (9 <= now.hour <= 16):
                time.sleep(60)
                continue
                
            today_str = now.strftime("%d %b %Y")  
            
            sim_orders = []
            if os.path.exists(SIM_LOG):
                try:
                    with open(SIM_LOG, "r") as f:
                        sim_orders = json.load(f)
                except Exception as err:
                    logging.error(f"[Indian Sim Tracker] Error loading sim orders: {err}")
                    time.sleep(15)
                    continue

            signals = []
            if os.path.exists(SIGNALS_LOG):
                try:
                    with open(SIGNALS_LOG, "r") as f:
                        signals = json.load(f)
                except Exception as err:
                    logging.error(f"[Indian Sim Tracker] Error loading signals: {err}")

            # Filter for today's signals
            today_signals = [s for s in signals if s.get("candle_date") == today_str]

            # Load dynamic volume symbols for Type 4
            dynamic_symbols = []
            if os.path.exists("dynamic_symbols.json"):
                try:
                    with open("dynamic_symbols.json", "r") as f:
                        dynamic_symbols = json.load(f)
                except Exception as e:
                    logging.error(f"[Indian Sim Tracker] Error loading dynamic symbols: {e}")

            # Ingest new signals for each applicable plan
            updated = False
            for sig in today_signals:
                symbol = sig.get("instrument")
                candle_time = sig.get("candle_time")
                
                # Determine which plans apply to this symbol
                plans_to_add = []
                if symbol in CURRENT_BASKET:
                    plans_to_add.append("basic")         # Type 1: Cash Equity
                    plans_to_add.append("futures_same")   # Type 2: Futures of Same
                    plans_to_add.append("trend_following_equity") # Type 5: Trend-Following Cash Equity
                    plans_to_add.append("trend_following_futures") # Type 6: Trend-Following Futures
                if symbol in OPTIMIZED_BASKET:
                    plans_to_add.append("futures_selected") # Type 3: Futures of Selection
                if symbol in dynamic_symbols:
                    plans_to_add.append("dynamic_volume")   # Type 4: Dynamic Volume Basket
                
                for plan in plans_to_add:
                    # Check if already exists in Sim
                    exists = False
                    for order in sim_orders:
                        if (order.get("symbol") == symbol and 
                            order.get("date") == today_str and 
                            order.get("plan") == plan):
                            exists = True
                            break
                            
                    if not exists:
                        high = sig.get("high")
                        low = sig.get("low")
                        
                        if high and low:
                            tick = 0.05
                            
                            buy_entry = round(high + tick, 2)
                            sell_entry = round(low - tick, 2)
                            
                            # Apply Nifty Veto filter for F&O plans (Type 2, 3, 4)
                            if plan != "basic":
                                nifty_trend = get_nifty_trend()
                                if nifty_trend > 0.2:
                                    sell_entry = 0.0 # Veto short leg
                                    logging.info(f"[Indian Sim Tracker] {symbol} ({plan}): Nifty is +{nifty_trend:.2f}%. Vetoed Short leg (sell_entry=0.0)")
                                elif nifty_trend < -0.2:
                                    buy_entry = 999999.0 # Veto long leg
                                    logging.info(f"[Indian Sim Tracker] {symbol} ({plan}): Nifty is {nifty_trend:.2f}%. Vetoed Long leg (buy_entry=999999.0)")
                            
                            # Targets & Stop Loss (0.4% Target for all plans)
                            target_pct = 0.004
                            
                            buy_stop = round(buy_entry * 0.99, 2)
                            sell_stop = round(sell_entry * 1.01, 2)
                            buy_target = round(buy_entry * (1.0 + target_pct), 2)
                            sell_target = round(sell_entry * (1.0 - target_pct), 2)
                            
                            new_order = {
                                "symbol": symbol,
                                "date": today_str,
                                "time": candle_time,
                                "plan": plan,
                                "buy_entry": buy_entry,
                                "buy_target": buy_target,
                                "buy_stop_loss": buy_stop,
                                "buy_qty": calculate_quantity(symbol, buy_entry, plan),
                                "sell_entry": sell_entry,
                                "sell_target": sell_target,
                                "sell_stop_loss": sell_stop,
                                "sell_qty": calculate_quantity(symbol, sell_entry, plan),
                                "status": "PENDING",
                                "active_leg": None,
                                "entry_price": None,
                                "exit_price": None,
                                "entry_time": None,
                                "exit_time": None,
                                "pnl": 0.0,
                                "ltp": float(sig.get("price", buy_entry)),
                                "buy_stop_loss_original": buy_stop,
                                "sell_stop_loss_original": sell_stop,
                                "is_sar": False
                            }
                            sim_orders.append(new_order)
                            updated = True
                            logging.info(f"[Indian Sim Tracker] Registered new simulation ({plan}) for {symbol}")

            all_symbols = set([o["symbol"] for o in sim_orders if o["status"] in ["PENDING", "PENDING_SAR", "ACTIVE"]])
            
            if not all_symbols:
                time.sleep(30)
                continue
                
            # Fetch live data
            hist_data = {}
            for sym in list(all_symbols):
                yf_sym = f"{sym}.NS"
                try:
                    df = download_yf_clean(yf_sym, interval="1m", range_str="1d")
                    if not df.empty:
                        hist_data[sym] = df
                except Exception as e:
                    logging.error(f"[Indian Sim Tracker] Error fetching data for {sym}: {e}")

            # Process each order
            for order in sim_orders:
                sym = order["symbol"]
                plan = order.get("plan", "basic")
                if sym not in hist_data or hist_data[sym].empty:
                    continue
                    
                df = hist_data[sym]
                latest_row = df.iloc[-1]
                
                try:
                    c_high = float(latest_row['High'].iloc[0] if hasattr(latest_row['High'], 'iloc') else latest_row['High'])
                    c_low = float(latest_row['Low'].iloc[0] if hasattr(latest_row['Low'], 'iloc') else latest_row['Low'])
                    c_close = float(latest_row['Close'].iloc[0] if hasattr(latest_row['Close'], 'iloc') else latest_row['Close'])
                except Exception as e:
                    continue
                
                # Update LTP
                if order.get("ltp") != c_close:
                    order["ltp"] = c_close
                    updated = True

                current_iso = now.isoformat()

                if order["status"] in ["PENDING", "PENDING_SAR"]:
                    if order["status"] == "PENDING":
                        if c_high >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "BUY"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] BUY ENTRY triggered at {order['buy_entry']}")
                        elif c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "SELL"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] SELL ENTRY triggered at {order['sell_entry']}")
                    else:  # PENDING_SAR
                        if order["active_leg"] == "BUY" and c_high >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] BUY SAR ENTRY triggered at {order['buy_entry']}")
                        elif order["active_leg"] == "SELL" and c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] SELL SAR ENTRY triggered at {order['sell_entry']}")

                elif order["status"] == "ACTIVE":
                    entry = order["entry_price"]
                    qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
        
                    # 3:15 PM Auto Square-Off Check
                    if (now.hour == 15 and now.minute >= 15) or now.hour >= 16:
                        order["status"] = "SQ OFF"
                        order["exit_price"] = c_close
                        order["exit_time"] = current_iso
                        pnl = (c_close - entry) * qty if order["active_leg"] == "BUY" else (entry - c_close) * qty
                        order["pnl"] = round(pnl, 2)
                        updated = True
                        logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] Auto Squared-off at {c_close}")
                        continue

                    if order["active_leg"] == "BUY":
                        pnl = (c_close - entry) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        # Target Check
                        if order.get("buy_target") is not None:
                            if c_high >= order["buy_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["buy_target"]
                                order["exit_time"] = current_iso
                                pnl = (order["buy_target"] - entry) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] TARGET HIT! PnL: {order['pnl']}")
                                
                                # Spawn second trade for Trend-Following plans if it is the first trade
                                if plan in ["trend_following_equity", "trend_following_futures"] and not order.get("is_second_trade", False):
                                    spawn_second_trade(order, "BUY", current_iso, sim_orders)
                                continue
        
                        # Stop Loss Check
                        if c_low <= order["buy_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["buy_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (order["buy_stop_loss"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] SL HIT! PnL: {order['pnl']}")
        
                            # Martingale SAR Reversal
                            is_original_sl = order["buy_stop_loss"] == order["buy_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False) and plan == "basic":
                                sar_qty = int(qty * 2)
                                sar_entry = order["sell_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": order["buy_entry"],
                                    "buy_target": round(order["buy_entry"] * 1.01, 2),
                                    "buy_stop_loss": round(order["buy_entry"] * 0.99, 2),
                                    "buy_qty": sar_qty,
                                    "sell_entry": sar_entry,
                                    "sell_target": round(sar_entry * 0.99, 2),
                                    "sell_stop_loss": round(sar_entry * 1.01, 2),
                                    "sell_qty": sar_qty,
                                    "status": "PENDING_SAR",
                                    "active_leg": "SELL",
                                    "entry_price": None,
                                    "exit_price": None,
                                    "entry_time": None,
                                    "exit_time": None,
                                    "pnl": 0.0,
                                    "ltp": c_close,
                                    "is_sar": True,
                                    "buy_stop_loss_original": round(order["buy_entry"] * 0.99, 2),
                                    "sell_stop_loss_original": round(sar_entry * 1.01, 2)
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] Queued SAR Reversal SELL for {sar_qty} qty at {sar_entry}")
        
                    elif order["active_leg"] == "SELL":
                        pnl = (entry - c_close) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        # Target Check
                        if order.get("sell_target") is not None:
                            if c_low <= order["sell_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["sell_target"]
                                order["exit_time"] = current_iso
                                pnl = (entry - order["sell_target"]) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] TARGET HIT! PnL: {order['pnl']}")
                                
                                # Spawn second trade for Trend-Following plans if it is the first trade
                                if plan in ["trend_following_equity", "trend_following_futures"] and not order.get("is_second_trade", False):
                                    spawn_second_trade(order, "SELL", current_iso, sim_orders)
                                continue
        
                        # Stop Loss Check
                        if c_high >= order["sell_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["sell_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (entry - order["sell_stop_loss"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] SL HIT! PnL: {order['pnl']}")
        
                            # Martingale SAR Reversal
                            is_original_sl = order["sell_stop_loss"] == order["sell_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False) and plan == "basic":
                                sar_qty = int(qty * 2)
                                sar_entry = order["buy_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": sar_entry,
                                    "buy_target": round(sar_entry * 1.01, 2),
                                    "buy_stop_loss": round(sar_entry * 0.99, 2),
                                    "buy_qty": sar_qty,
                                    "sell_entry": order["sell_entry"],
                                    "sell_target": round(order["sell_entry"] * 0.99, 2),
                                    "sell_stop_loss": round(order["sell_entry"] * 1.01, 2),
                                    "sell_qty": sar_qty,
                                    "status": "PENDING_SAR",
                                    "active_leg": "BUY",
                                    "entry_price": None,
                                    "exit_price": None,
                                    "entry_time": None,
                                    "exit_time": None,
                                    "pnl": 0.0,
                                    "ltp": c_close,
                                    "is_sar": True,
                                    "buy_stop_loss_original": round(sar_entry * 0.99, 2),
                                    "sell_stop_loss_original": round(order["sell_entry"] * 1.01, 2)
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[Indian Sim Tracker] [{sym} ({plan})] Queued SAR Reversal BUY for {sar_qty} qty at {sar_entry}")

            # Save if updated
            if updated:
                with open(SIM_LOG, "w") as f:
                    json.dump(sim_orders, f, indent=2)
                    
        except Exception as main_err:
            logging.error(f"[Indian Sim Tracker] Main loop error: {main_err}")
            # Cooldown to avoid spamming Telegram (at most once every 30 minutes)
            now_ts = time.time()
            if not hasattr(run_simulation_tracking, "last_alert_time") or (now_ts - run_simulation_tracking.last_alert_time) > 1800:
                run_simulation_tracking.last_alert_time = now_ts
                try:
                    from telegram_bot import send_admin_only_message
                    send_admin_only_message(f"⚠️ <b>[Indian Sim Tracker] Loop Error Detected!</b>\nError: <code>{main_err}</code>")
                except Exception as tg_err:
                    logging.error(f"Failed to send Telegram alert: {tg_err}")
            
        time.sleep(10)

if __name__ == "__main__":
    run_simulation_tracking()
