import json
import yfinance as yf
import pandas as pd
import requests
import os
from datetime import datetime, timezone, timedelta
import pytz

IST = pytz.timezone('Asia/Kolkata')
today_str = os.getenv("REPLAY_DATE") or datetime.now(IST).strftime("%d %b %Y")

SIGNALS_LOG = "us_signals.json"
INDIAN_SIGNALS_LOG = "signals.json"
SIM_LOG = "eashaan_simulated_orders.json"

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

def download_yf_clean(ticker, interval="1m", range_str="1d", start=None, end=None):
    try:
        if start and end:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&period1={int(pd.to_datetime(start).timestamp())}&period2={int(pd.to_datetime(end).timestamp())}"
        else:
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
        print(f"[YahooFinance Clean] Error downloading {ticker}: {e}")
        return pd.DataFrame()

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

def get_sizing_config(symbol):
    # Standard settings loader
    global_capital, global_lot_size = None, None
    settings_path = "simulation_settings.json"
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r") as f:
                settings = json.load(f)
                category = "crypto" if symbol == "BTCUSD" else ("us" if symbol in ["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD"] else "indian")
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

# Load signals
signals = []
for path in [SIGNALS_LOG, INDIAN_SIGNALS_LOG]:
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                signals.extend(json.load(f))
        except Exception as e:
            print(f"Error loading {path}: {e}")

today_signals = [s for s in signals if s.get("candle_date") == today_str]

seen_keys = set()
unique_today_signals = []
for s in today_signals:
    inst = s.get("instrument")
    time_str = s.get("candle_time", "00:00")
    key = (inst, time_str)
    if key not in seen_keys:
        seen_keys.add(key)
        unique_today_signals.append(s)
today_signals = unique_today_signals

if not today_signals:
    print(f"No signals found for {today_str}")

existing_orders = []
if os.path.exists(SIM_LOG):
    try:
        with open(SIM_LOG, "r") as f:
            existing_orders = json.load(f)
    except:
        pass

historical_orders = [o for o in existing_orders if o.get("date") != today_str]
today_orders = []

for sig in today_signals:
    symbol = sig["instrument"]
    high = sig.get("high")
    low = sig.get("low")
    
    if high and low:
        tick = TICK_SIZES.get(symbol, 0.05)
        dec_places = len(str(tick).split('.')[1]) if '.' in str(tick) else 2
        
        buy_entry = round(high + tick, dec_places)
        sell_entry = round(low - tick, dec_places)
        
        # SL/Target at 1% of entry price
        buy_stop = round(buy_entry * 0.99, dec_places)
        sell_stop = round(sell_entry * 1.01, dec_places)
        
        buy_target = round(buy_entry * 1.01, dec_places)
        sell_target = round(sell_entry * 0.99, dec_places)
        
        for plan in ["basic", "growth"]:
            new_order = {
                "symbol": symbol,
                "date": today_str,
                "time": sig.get("candle_time"),
                "plan": plan,
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
            today_orders.append(new_order)

print(f"Generated {len(today_orders)} initial brackets for Eashaan Replay today.")

# Download 1m data for all mapped symbols
hist_data = {}
for sym in list(set([o["symbol"] for o in today_orders])):
    yf_sym = YF_MAP.get(sym, sym)
    if sym not in YF_MAP:
        yf_sym = f"{sym}.NS"
    print(f"Downloading 1m data for {sym} ({yf_sym})...")
    # Date logic for backtests
    if today_str == "22 Jun 2026":
        df = download_yf_clean(yf_sym, start="2026-06-22", end="2026-06-23", interval="1m")
    else:
        df = download_yf_clean(yf_sym, interval="1m", range_str="1d")
    hist_data[sym] = df

# We replay chronologically minute by minute
all_times = set()
for sym, df in hist_data.items():
    for idx in df.index:
        all_times.add(idx)

sorted_times = sorted(list(all_times))

for current_time in sorted_times:
    current_time_ist = current_time.astimezone(IST) if current_time.tzinfo else current_time
    
    for order in list(today_orders):
        sym = order["symbol"]
        df = hist_data[sym]
        if current_time not in df.index:
            continue
            
        # Ensure we only evaluate after breakout candle has started
        order_time_str = order.get("time")
        if order_time_str:
            try:
                h, m = map(int, order_time_str.split(":"))
                signal_start_minutes = h * 60 + m + 15
                current_minutes = current_time_ist.hour * 60 + current_time_ist.minute
                if current_minutes < signal_start_minutes:
                    continue
            except Exception as e:
                pass
            
        row = df.loc[current_time]
        try:
            if hasattr(row, 'iloc'):
                if len(row.shape) > 1:
                    row = row.iloc[0]
            c_high = float(row['High'].iloc[0] if hasattr(row['High'], 'iloc') else row['High'])
            c_low = float(row['Low'].iloc[0] if hasattr(row['Low'], 'iloc') else row['Low'])
            c_close = float(row['Close'].iloc[0] if hasattr(row['Close'], 'iloc') else row['Close'])
        except Exception as e:
            continue
            
        dec_places = len(str(TICK_SIZES.get(sym, 0.01)).split('.')[1]) if '.' in str(TICK_SIZES.get(sym, 0.01)) else 2
        
        # 3:15 PM Auto Square-Off Check
        if order["status"] == "ACTIVE" and ((current_time_ist.hour == 15 and current_time_ist.minute >= 15) or current_time_ist.hour >= 16):
            order["status"] = "SQ OFF"
            order["exit_price"] = c_close
            order["exit_time"] = current_time_ist.isoformat()
            qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
            pnl = (c_close - order["entry_price"]) * qty if order["active_leg"] == "BUY" else (order["entry_price"] - c_close) * qty
            order["pnl"] = round(pnl, 2)
            continue

        if order["status"] in ["PENDING", "PENDING_SAR"]:
            if order["status"] == "PENDING":
                if c_high >= order["buy_entry"]:
                    order["status"] = "ACTIVE"
                    order["active_leg"] = "BUY"
                    order["entry_price"] = order["buy_entry"]
                    order["entry_time"] = current_time_ist.isoformat()
                elif c_low <= order["sell_entry"]:
                    order["status"] = "ACTIVE"
                    order["active_leg"] = "SELL"
                    order["entry_price"] = order["sell_entry"]
                    order["entry_time"] = current_time_ist.isoformat()
            else:  # PENDING_SAR
                if order["active_leg"] == "BUY" and c_high >= order["buy_entry"]:
                    order["status"] = "ACTIVE"
                    order["entry_price"] = order["buy_entry"]
                    order["entry_time"] = current_time_ist.isoformat()
                elif order["active_leg"] == "SELL" and c_low <= order["sell_entry"]:
                    order["status"] = "ACTIVE"
                    order["entry_price"] = order["sell_entry"]
                    order["entry_time"] = current_time_ist.isoformat()

        elif order["status"] == "ACTIVE":
            entry = order["entry_price"]
            qty = order["buy_qty"] if order["active_leg"] == "BUY" else order["sell_qty"]
            plan = order.get("plan", "basic")
            
            if order["active_leg"] == "BUY":
                pnl = (c_close - entry) * qty
                order["pnl"] = round(pnl, 2)
                
                # 1. Target check
                if plan == "basic" and order.get("buy_target") is not None:
                    if c_high >= order["buy_target"]:
                        order["status"] = "TARGET HIT"
                        order["exit_price"] = order["buy_target"]
                        order["exit_time"] = current_time_ist.isoformat()
                        pnl = (order["buy_target"] - entry) * qty
                        order["pnl"] = round(pnl, 2)
                        continue

                # 2. Stop Loss check
                if c_low <= order["buy_stop_loss"]:
                    is_trailed = order["buy_stop_loss"] > order["buy_stop_loss_original"]
                    order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                    order["exit_price"] = order["buy_stop_loss"]
                    order["exit_time"] = current_time_ist.isoformat()
                    pnl = (order["buy_stop_loss"] - entry) * qty
                    order["pnl"] = round(pnl, 2)
                    
                    # Martingale SAR Reversal
                    is_original_sl = order["buy_stop_loss"] == order["buy_stop_loss_original"]
                    if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                        sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                        sar_entry = order["sell_entry"]
                        new_sar = {
                            "symbol": sym,
                            "date": today_str,
                            "time": current_time_ist.strftime("%H:%M"),
                            "plan": plan,
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
                        today_orders.append(new_sar)
                        print(f"[{sym}] Queued SAR Reversal SELL for {sar_qty} qty at {sar_entry}")
                else:
                    # Growth plan trailing SL
                    highest = order.get("highest_reached", entry)
                    if c_high > highest:
                        order["highest_reached"] = c_high
                        highest = c_high
                        
                    sl_candidates = [order["buy_stop_loss"]]
                    profit_pct = (highest - entry) / entry * 100
                    
                    if plan == "growth":
                        if profit_pct >= 1.0:
                            sl_candidates.append(highest * 0.997)
                        elif profit_pct >= 0.7:
                            sl_candidates.append(entry * 1.004)
                        elif profit_pct >= 0.4:
                            sl_candidates.append(entry)
                            
                    c_high_15m, c_low_15m = get_completed_15m_candle(df, current_time_ist)
                    if c_low_15m is not None:
                        if c_low_15m > order["buy_stop_loss"]:
                            if c_low_15m < c_close:
                                sl_candidates.append(c_low_15m)
                                
                    new_sl = max(sl_candidates)
                    new_sl = round(new_sl, dec_places)
                    if order["buy_stop_loss"] != new_sl:
                        order["buy_stop_loss"] = new_sl

            elif order["active_leg"] == "SELL":
                pnl = (entry - c_close) * qty
                order["pnl"] = round(pnl, 2)
                
                # 1. Target check
                if plan == "basic" and order.get("sell_target") is not None:
                    if c_low <= order["sell_target"]:
                        order["status"] = "TARGET HIT"
                        order["exit_price"] = order["sell_target"]
                        order["exit_time"] = current_time_ist.isoformat()
                        pnl = (entry - order["sell_target"]) * qty
                        order["pnl"] = round(pnl, 2)
                        continue

                # 2. Stop Loss check
                if c_high >= order["sell_stop_loss"]:
                    is_trailed = order["sell_stop_loss"] < order["sell_stop_loss_original"]
                    order["status"] = "TRAILING SL HIT" if is_trailed else "SL HIT"
                    order["exit_price"] = order["sell_stop_loss"]
                    order["exit_time"] = current_time_ist.isoformat()
                    pnl = (entry - order["sell_stop_loss"]) * qty
                    order["pnl"] = round(pnl, 2)
                    
                    # Martingale SAR Reversal
                    is_original_sl = order["sell_stop_loss"] == order["sell_stop_loss_original"]
                    if pnl < 0 and is_original_sl and not order.get("is_sar", False):
                        sar_qty = round(qty * 2, 4) if sym == "BTCUSD" else int(qty * 2)
                        sar_entry = order["buy_entry"]
                        new_sar = {
                            "symbol": sym,
                            "date": today_str,
                            "time": current_time_ist.strftime("%H:%M"),
                            "plan": plan,
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
                        today_orders.append(new_sar)
                        print(f"[{sym}] Queued SAR Reversal BUY for {sar_qty} qty at {sar_entry}")
                else:
                    # Growth plan trailing SL
                    lowest = order.get("lowest_reached", entry)
                    if c_low < lowest:
                        order["lowest_reached"] = c_low
                        lowest = c_low
                        
                    sl_candidates = [order["sell_stop_loss"]]
                    profit_pct = (entry - lowest) / entry * 100
                    
                    if plan == "growth":
                        if profit_pct >= 1.0:
                            sl_candidates.append(lowest * 1.003)
                        elif profit_pct >= 0.7:
                            sl_candidates.append(entry * 0.996)
                        elif profit_pct >= 0.4:
                            sl_candidates.append(entry)
                            
                    c_high_15m, c_low_15m = get_completed_15m_candle(df, current_time_ist)
                    if c_high_15m is not None:
                        if c_high_15m < order["sell_stop_loss"]:
                            if c_high_15m > c_close:
                                sl_candidates.append(c_high_15m)
                                
                    new_sl = min(sl_candidates)
                    new_sl = round(new_sl, dec_places)
                    if order["sell_stop_loss"] != new_sl:
                        order["sell_stop_loss"] = new_sl

# Merge with historical orders and save to file
all_final_orders = historical_orders + today_orders
with open(SIM_LOG, "w") as f:
    json.dump(all_final_orders, f, indent=2)

print("Replay completed successfully.")
