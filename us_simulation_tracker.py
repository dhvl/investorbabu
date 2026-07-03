import json
import time
import logging
import requests
import pandas as pd
import os
from datetime import datetime, timezone, timedelta
import pytz

IST = pytz.timezone('Asia/Kolkata')
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIM_LOG = "us_simulated_orders.json"

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

def get_sizing_config(symbol):
    global_capital, global_lot_size = None, None
    settings_path = "simulation_settings.json"
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r") as f:
                settings = json.load(f)
                category = "crypto" if symbol == "BTCUSD" else "us"
                cat_settings = settings.get(category, {})
                global_capital = float(cat_settings.get("capital", 10000.0))
                global_lot_size = float(cat_settings.get("lot_size", 0.0))
        except Exception:
            pass

    path = "instrument_configs.json"
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                configs = json.load(f)
                if symbol in configs:
                    cfg = configs[symbol]
                    mode_cfg = cfg.get("sim", {})
                    capital = mode_cfg.get("capital")
                    lot_size = mode_cfg.get("lot_size")
                    ret_capital = float(capital) if capital is not None else (global_capital if global_capital is not None else 10000.0)
                    ret_lot_size = float(lot_size) if lot_size is not None else (global_lot_size if global_lot_size is not None else 0.0)
                    return ret_capital, ret_lot_size
        except Exception:
            pass
    if global_capital is not None and global_lot_size is not None:
        return global_capital, global_lot_size
    if symbol == "BTCUSD":
        return 0.0, 0.1
    return 10000.0, 0.0

def calculate_quantity(symbol, entry_price):
    capital, lot_size = get_sizing_config(symbol)
    if lot_size > 0:
        return lot_size
    if symbol == "BTCUSD":
        return round(capital / entry_price, 4)
    return max(1, int(capital / entry_price))

def run_us_simulation_tracking():
    logging.info("[US Sim Tracker] Starting live US/Crypto simulated trade tracking engine...")
    
    while True:
        try:
            now = datetime.now(IST)
            today_str = now.strftime("%d %b %Y")  
            
            # Load simulated orders
            sim_orders = []
            if os.path.exists(SIM_LOG):
                try:
                    with open(SIM_LOG, "r") as f:
                        sim_orders = json.load(f)
                except Exception as err:
                    logging.error(f"[US Sim Tracker] Error loading sim orders: {err}")
                    time.sleep(15)
                    continue

            # Load US signals
            signals = []
            if os.path.exists("us_signals.json"):
                try:
                    with open("us_signals.json", "r") as f:
                        signals = json.load(f)
                except Exception as err:
                    logging.error(f"[US Sim Tracker] Error loading signals: {err}")

            # Filter for today's signals
            today_signals = [s for s in signals if s.get("candle_date") == today_str]

            # Ingest new signals
            updated = False
            for sig in today_signals:
                symbol = sig.get("instrument")
                candle_time = sig.get("candle_time")
                
                # Check if already exists in Sim
                exists = False
                for order in sim_orders:
                    if order.get("symbol") == symbol and order.get("date") == today_str:
                        exists = True
                        break
                        
                if not exists:
                    high = sig.get("high")
                    low = sig.get("low")
                    
                    if high and low:
                        # Dynamic tick sizing
                        tick = TICK_SIZES.get(symbol, 0.05)
                        dec_places = len(str(tick).split('.')[1]) if '.' in str(tick) else 2
                        
                        buy_entry = round(high + tick, dec_places)
                        sell_entry = round(low - tick, dec_places)
                        
                        # Stop loss at 1% of entry price
                        buy_stop = round(buy_entry * 0.99, dec_places)
                        sell_stop = round(sell_entry * 1.01, dec_places)
                        
                        # Target at 1% of entry price
                        buy_target = round(buy_entry * 1.01, dec_places)
                        sell_target = round(sell_entry * 0.99, dec_places)
                        
                        new_order = {
                            "symbol": symbol,
                            "date": today_str,
                            "time": candle_time,
                            "plan": "basic",
                            "buy_entry": buy_entry,
                            "buy_target": buy_target,
                            "buy_stop_loss": buy_stop,
                            "buy_qty": calculate_quantity(symbol, buy_entry),
                            "sell_entry": sell_entry,
                            "sell_target": sell_target,
                            "sell_stop_loss": sell_stop,
                            "sell_qty": calculate_quantity(symbol, sell_entry),
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
                        logging.info(f"[US Sim Tracker] Registered new simulation breakout bracket for {symbol}")

            all_symbols = set([o["symbol"] for o in sim_orders if o["status"] in ["PENDING", "PENDING_SAR", "ACTIVE"]])
            
            if not all_symbols:
                time.sleep(30)
                continue
                
            # Fetch live data
            hist_data = {}
            for sym in list(all_symbols):
                yf_sym = YF_MAP.get(sym, sym)
                try:
                    df = download_yf_clean(yf_sym, interval="1m", range_str="1d")
                    if not df.empty:
                        hist_data[sym] = df
                except Exception as e:
                    logging.error(f"[US Sim Tracker] Error fetching data for {sym}: {e}")

            # Process each order
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
                            logging.info(f"[US Sim Tracker] [{sym}] BUY ENTRY triggered at {order['buy_entry']}")
                        elif c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["active_leg"] = "SELL"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[US Sim Tracker] [{sym}] SELL ENTRY triggered at {order['sell_entry']}")
                    else:  # PENDING_SAR
                        if order["active_leg"] == "BUY" and c_high >= order["buy_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["buy_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[US Sim Tracker] [{sym}] BUY SAR ENTRY triggered at {order['buy_entry']}")
                        elif order["active_leg"] == "SELL" and c_low <= order["sell_entry"]:
                            order["status"] = "ACTIVE"
                            order["entry_price"] = order["sell_entry"]
                            order["entry_time"] = current_iso
                            updated = True
                            logging.info(f"[US Sim Tracker] [{sym}] SELL SAR ENTRY triggered at {order['sell_entry']}")

                elif order["status"] == "ACTIVE":
                    entry = order["entry_price"]
                    qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
        
                    if order["active_leg"] == "BUY":
                        # Update PnL
                        pnl = (c_close - entry) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        # 1. Target check (1.0% target)
                        if order.get("buy_target") is not None:
                            if c_high >= order["buy_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["buy_target"]
                                order["exit_time"] = current_iso
                                pnl = (order["buy_target"] - entry) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[US Sim Tracker] [{sym}] TARGET HIT! PnL: {order['pnl']}")
                                continue
        
                        # 2. Stop Loss check
                        if c_low <= order["buy_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["buy_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (order["buy_stop_loss"] - entry) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[US Sim Tracker] [{sym}] SL HIT! PnL: {order['pnl']}")
        
                            # Martingale SAR (Only on loss and original SL, and only if not already a SAR trade)
                            is_original_sl = order["buy_stop_loss"] == order["buy_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                                sar_entry = order["sell_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": "basic",
                                    "buy_entry": order["buy_entry"],
                                    "buy_target": round(order["buy_entry"] * 1.01, dec_places),
                                    "buy_stop_loss": round(order["buy_entry"] * 0.99, dec_places),
                                    "buy_qty": sar_qty,
                                    "sell_entry": sar_entry,
                                    "sell_target": round(sar_entry * 0.99, dec_places),
                                    "sell_stop_loss": round(sar_entry * 1.01, dec_places),
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
                                    "buy_stop_loss_original": round(order["buy_entry"] * 0.99, dec_places),
                                    "sell_stop_loss_original": round(sar_entry * 1.01, dec_places)
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[US Sim Tracker] [{sym}] Queued SAR Reversal SELL for {sar_qty} qty at {sar_entry}")
        
                    elif order["active_leg"] == "SELL":
                        # Update PnL
                        pnl = (entry - c_close) * qty
                        if order.get("pnl") != round(pnl, 2):
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            
                        # 1. Target check (1.0% target)
                        if order.get("sell_target") is not None:
                            if c_low <= order["sell_target"]:
                                order["status"] = "TARGET HIT"
                                order["exit_price"] = order["sell_target"]
                                order["exit_time"] = current_iso
                                pnl = (entry - order["sell_target"]) * qty
                                order["pnl"] = round(pnl, 2)
                                updated = True
                                logging.info(f"[US Sim Tracker] [{sym}] TARGET HIT! PnL: {order['pnl']}")
                                continue
        
                        # 2. Stop Loss check
                        if c_high >= order["sell_stop_loss"]:
                            order["status"] = "SL HIT"
                            order["exit_price"] = order["sell_stop_loss"]
                            order["exit_time"] = current_iso
                            pnl = (entry - order["sell_stop_loss"]) * qty
                            order["pnl"] = round(pnl, 2)
                            updated = True
                            logging.info(f"[US Sim Tracker] [{sym}] SL HIT! PnL: {order['pnl']}")
        
                            # Martingale SAR (Only on loss and original SL, and only if not already a SAR trade)
                            is_original_sl = order["sell_stop_loss"] == order["sell_stop_loss_original"]
                            if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                                sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                                sar_entry = order["buy_entry"]
                                new_sar = {
                                    "symbol": sym,
                                    "date": today_str,
                                    "time": now.strftime("%H:%M"),
                                    "plan": "basic",
                                    "buy_entry": sar_entry,
                                    "buy_target": round(sar_entry * 1.01, dec_places),
                                    "buy_stop_loss": round(sar_entry * 0.99, dec_places),
                                    "buy_qty": sar_qty,
                                    "sell_entry": order["sell_entry"],
                                    "sell_target": round(order["sell_entry"] * 0.99, dec_places),
                                    "sell_stop_loss": round(order["sell_entry"] * 1.01, dec_places),
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
                                    "buy_stop_loss_original": round(sar_entry * 0.99, dec_places),
                                    "sell_stop_loss_original": round(order["sell_entry"] * 1.01, dec_places)
                                }
                                sim_orders.append(new_sar)
                                logging.info(f"[US Sim Tracker] [{sym}] Queued SAR Reversal BUY for {sar_qty} qty at {sar_entry}")

            # Save if updated
            if updated:
                with open(SIM_LOG, "w") as f:
                    json.dump(sim_orders, f, indent=2)
                    
        except Exception as main_err:
            logging.error(f"[US Sim Tracker] Main loop error: {main_err}")
            
        time.sleep(10)

if __name__ == "__main__":
    run_us_simulation_tracking()
