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

from datetime import datetime, timedelta
import pytz

IST = pytz.timezone('Asia/Kolkata')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIM_LOG = "/home/investo/bluecandle/us_simulated_orders.json"
TARGET_R = 1.0
TRIGGER_R = 0.8
LOCK_R = 0.7

def get_completed_15m_candle(df, current_time):
    try:
        minute_offset = current_time.minute % 15
        rounded = current_time.replace(second=0, microsecond=0) - timedelta(minutes=minute_offset)
        candle_start = rounded - timedelta(minutes=15)
        candle_end = rounded - timedelta(minutes=1)
        
        candle_df = df.loc[candle_start:candle_end]
        if not candle_df.empty:
            c_high = float(candle_df['High'].max())
            c_low = float(candle_df['Low'].min())
            return c_high, c_low
    except Exception:
        pass
    return None, None


YF_MAP = {
    "XAGUSD": "SI=F",   
    "XAUUSD": "GC=F",   
    "OILUSD": "CL=F",   
    "CUCUSD": "HG=F",
    "BTCUSD": "BTC-USD"
}

TICK_SIZES = {
    "XAGUSD": 0.005,
    "XAUUSD": 0.10,
    "OILUSD": 0.01,
    "CUCUSD": 0.0005,
    "BTCUSD": 1.0
}

def run_us_simulation_tracking():
    logging.info("[US Sim Tracker] Starting live US simulated trade tracking engine...")
    
    while True:
        try:
            now = datetime.now(IST)
            today_str = now.strftime("%d %b %Y")  
            
            # 1. Load existing simulated orders
            sim_orders = []
            try:
                with open(SIM_LOG, "r") as f:
                    sim_orders = json.load(f)
            except Exception as err:
                logging.error(f"[US Sim Tracker] Error loading sim orders: {err}")
                time.sleep(15)
                continue

            active_symbols = set([o["symbol"] for o in sim_orders if o["status"] in ["PENDING", "ACTIVE"]])
            all_symbols = set([o["symbol"] for o in sim_orders])
            
            if not all_symbols:
                logging.info("[US Sim Tracker] No US orders to track.")
                time.sleep(30)
                continue
                
            # 2. Fetch live data
            hist_data = {}
            for sym in list(all_symbols):
                yf_sym = YF_MAP.get(sym, sym)
                try:
                    df = download_yf_clean(yf_sym, interval="1m", range_str="1d")
                    if not df.empty:
                        hist_data[sym] = df
                except Exception as e:
                    logging.error(f"[US Sim Tracker] Error fetching data for {sym}: {e}")

            # 3. Process each order against the latest 1m candle
            updated = False
            for order in sim_orders:
                sym = order["symbol"]
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

                dec_places = len(str(TICK_SIZES.get(sym, 0.01)).split('.')[1]) if '.' in str(TICK_SIZES.get(sym, 0.01)) else 2

                current_iso = now.isoformat()

                if order["status"] in ["PENDING", "PENDING_SAR"]:
                    if order["status"] == "PENDING":
                        if c_high >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "BUY"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[{sym}] BUY ENTRY triggered at {order['buy_entry']}")
                        elif c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "SELL"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[{sym}] SELL ENTRY triggered at {order['sell_entry']}")
                    else:  # PENDING_SAR
                        if order["active_leg"] == "BUY" and c_high >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[{sym}] BUY SAR ENTRY triggered at {order['buy_entry']}")
                        elif order["active_leg"] == "SELL" and c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[{sym}] SELL SAR ENTRY triggered at {order['sell_entry']}")

                elif order["status"] == "ACTIVE":
                    entry = order["entry_price"]
                    qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
                    plan = order.get("plan", "basic")
        
                    if order["active_leg"] == "BUY":
                        # Update running PnL
                        pnl = (c_close - entry) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        distance_1R = order.get("distance_1R")
                        if not distance_1R:
                            distance_1R = order["buy_entry"] * 0.01
                            order["distance_1R"] = distance_1R
                            updated = True
                            
                        # 1. Target check (1.0R) - only for basic plan
                        if plan == "basic" and order.get("buy_target") is not None:
                            if c_high >= order["buy_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["buy_target"]
                                order["exit_time"] = current_iso
                                pnl = (order["buy_target"] - entry) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[{sym}] TARGET HIT (+{TARGET_R:.1f}R)! PnL: ${order['pnl']}")
                                continue
        
                        # 2. Stop Loss check
                        if c_low <= order["buy_stop_loss"]:
                            is_trailed = order["buy_stop_loss"] > order["buy_stop_loss_original"]
                            order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                            order["exit_price"] = order["buy_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (order["buy_stop_loss"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[{sym}] {'TRAILING SL' if is_trailed else 'SL'} HIT! PnL: ${order['pnl']}")
        
                            # Eashaan Rule 3: Martingale SAR (Only on Loss and original SL)
                            is_original_sl = order["buy_stop_loss"] == order["buy_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                                # Reversal entry is at the original opposite breakout level (sell_entry)
                                sar_entry = order["sell_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": order["buy_entry"],
                                    "buy_target": round(order["buy_entry"] * 1.01, dec_places) if plan == "basic" else None,
                                    "buy_stop_loss": order["buy_entry"],
                                    "buy_qty": sar_qty,
                                    "sell_entry": sar_entry,
                                    "sell_target": round(sar_entry * 0.99, dec_places) if plan == "basic" else None,
                                    "sell_stop_loss": round(sar_entry + distance_1R, dec_places),
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
                                    "distance_1R": distance_1R,
                                    "buy_stop_loss_original": order["buy_entry"],
                                    "sell_stop_loss_original": round(sar_entry + distance_1R, dec_places)
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[{sym}] Queued Trailing SAR SELL for {sar_qty} qty at original trigger {sar_entry}")
                        else:
                            highest = order.get("highest_reached", entry)
                            if c_high > highest:
                                order["highest_reached"] = c_high
                                highest = c_high
                                
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
                            c_high_15m, c_low_15m = get_completed_15m_candle(df, now)
                            if c_low_15m is not None:
                                if c_low_15m > order["buy_stop_loss"]:
                                    if c_low_15m < c_close:
                                        sl_candidates.append(c_low_15m)
                                        
                            new_sl = max(sl_candidates)
                            new_sl = round(new_sl, dec_places)
                            if order["buy_stop_loss"] != new_sl:
                                order["buy_stop_loss"] = new_sl
                                updated = True
                                logging.info(f"[{sym}] Trailed BUY SL to {order['buy_stop_loss']} ({plan} plan)")
        
                    elif order["active_leg"] == "SELL":
                        # Update running PnL
                        pnl = (entry - c_close) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        distance_1R = order.get("distance_1R")
                        if not distance_1R:
                            distance_1R = order["sell_entry"] * 0.01
                            order["distance_1R"] = distance_1R
                            updated = True
                            
                        # 1. Target check (1.0R) - only for basic plan
                        if plan == "basic" and order.get("sell_target") is not None:
                            if c_low <= order["sell_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["sell_target"]
                                order["exit_time"] = current_iso
                                pnl = (entry - order["sell_target"]) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[{sym}] TARGET HIT (+{TARGET_R:.1f}R)! PnL: ${order['pnl']}")
                                continue
        
                        # 2. Stop Loss check
                        if c_high >= order["sell_stop_loss"]:
                            is_trailed = order["sell_stop_loss"] < order["sell_stop_loss_original"]
                            order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                            order["exit_price"] = order["sell_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (entry - order["sell_stop_loss"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[{sym}] {'TRAILING SL' if is_trailed else 'SL'} HIT! PnL: ${order['pnl']}")
        
                            # Eashaan Rule 3: Martingale SAR (Only on Loss and original SL)
                            is_original_sl = order["sell_stop_loss"] == order["sell_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                                # Reversal entry is at the original opposite breakout level (buy_entry)
                                sar_entry = order["buy_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": plan,
                                    "buy_entry": sar_entry,
                                    "buy_target": round(sar_entry * 1.01, dec_places) if plan == "basic" else None,
                                    "buy_stop_loss": round(sar_entry - distance_1R, dec_places),
                                    "buy_qty": sar_qty,
                                    "sell_entry": order["sell_entry"],
                                    "sell_target": round(order["sell_entry"] * 0.99, dec_places) if plan == "basic" else None,
                                    "sell_stop_loss": order["sell_entry"],
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
                                    "distance_1R": distance_1R,
                                    "buy_stop_loss_original": round(sar_entry - distance_1R, dec_places),
                                    "sell_stop_loss_original": order["sell_entry"]
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[{sym}] Queued Trailing SAR BUY for {sar_qty} qty at original trigger {sar_entry}")
                        else:
                            lowest = order.get("lowest_reached", entry)
                            if c_low < lowest:
                                order["lowest_reached"] = c_low
                                lowest = c_low
                                
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
                            c_high_15m, c_low_15m = get_completed_15m_candle(df, now)
                            if c_high_15m is not None:
                                if c_high_15m < order["sell_stop_loss"]:
                                    if c_high_15m > c_close:
                                        sl_candidates.append(c_high_15m)
                                        
                            new_sl = min(sl_candidates)
                            new_sl = round(new_sl, dec_places)
                            if order["sell_stop_loss"] != new_sl:
                                order["sell_stop_loss"] = new_sl
                                updated = True
                                logging.info(f"[{sym}] Trailed SELL SL to {order['sell_stop_loss']} ({plan} plan)")
        
            if updated:
                try:
                    with open(SIM_LOG, "w") as f:
                        json.dump(sim_orders, f, indent=2)
                    
                    # Synchronize to Supabase via database helper
                    import db_helper
                    for order in sim_orders:
                        cl_id = f"{order['symbol']}_{order['date']}_{order['time']}_{order.get('plan', 'basic')}_{order.get('is_sar', False)}"
                        order["cl_order_id"] = cl_id.replace(" ", "_")
                        db_helper.save_order(order)
                except Exception as err:
                    logging.error(f"[US Sim Tracker] Error saving/syncing sim orders: {err}")

        except Exception as e:
            logging.error(f"[US Sim Tracker] Unexpected error: {e}")

        # Poll every 15 seconds
        time.sleep(15)

if __name__ == "__main__":
    run_us_simulation_tracking()
