import json
import os
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Load existing signals
SIGNALS_FILE = "signals.json"
OUTPUT_FILE = "bluecandle_dataset.csv"

def convert_to_datetime(date_str, time_str):
    # Example: "17 Apr 2026", "09:15"
    dt_str = f"{date_str} {time_str}"
    try:
        return datetime.strptime(dt_str, "%d %b %Y %H:%M")
    except ValueError:
        return None

def build_dataset():
    if not os.path.exists(SIGNALS_FILE):
        logging.error(f"File {SIGNALS_FILE} not found. Cannot build dataset.")
        return

    with open(SIGNALS_FILE, "r") as f:
        signals = json.load(f)

    logging.info(f"Loaded {len(signals)} signals from database.")
    
    dataset = []

    for idx, signal in enumerate(signals):
        symbol = signal.get("instrument")
        candle_date = signal.get("candle_date")
        candle_time = signal.get("candle_time")
        
        if not symbol or not candle_date or not candle_time:
            continue
            
        signal_dt = convert_to_datetime(candle_date, candle_time)
        if not signal_dt:
            continue

        # Add .NS for Yahoo Finance (NSE symbols)
        yf_symbol = f"{symbol}.NS"
        
        # We want data leading up to the signal. Let's pull 5 days of 15m data 
        # around the signal date to ensure we have enough history.
        start_dt = signal_dt - timedelta(days=5)
        end_dt = signal_dt + timedelta(days=1)
        
        logging.info(f"[{idx+1}/{len(signals)}] Fetching {yf_symbol} data for {signal_dt}...")
        
        try:
            # yfinance requires string dates for 15m intervals (max 60 days history from today)
            # If the signal is older than 60 days, yfinance will fail for 15m interval.
            # We'll use download with start/end
            df = yf.download(yf_symbol, start=start_dt.strftime("%Y-%m-%d"), end=end_dt.strftime("%Y-%m-%d"), interval="15m", progress=False)
            
            if df.empty:
                logging.warning(f"No data found for {yf_symbol} in that timeframe.")
                continue

            # Remove timezone info for safe comparison if necessary, but yfinance 15m is tz-aware (Asia/Kolkata)
            if df.index.tz is not None:
                df.index = df.index.tz_convert(None)

            # Filter for candles strictly before or at the signal time
            history_df = df[df.index <= signal_dt]
            
            if len(history_df) >= 10:
                # Get the last 10 candles leading up to the signal
                recent_candles = history_df.tail(10)
                
                # Flatten this into a single row for our ML dataset
                row_data = {
                    "signal_id": f"{symbol}_{signal_dt.strftime('%Y%m%d_%H%M')}",
                    "symbol": symbol,
                    "target_signal_dt": signal_dt,
                    "confidence": signal.get("confidence", "unknown")
                }
                
                # Create columns like Open_1, Close_1 ... Open_10, Close_10
                for i in range(10):
                    # i=0 is the oldest of the 10, i=9 is the actual signal candle
                    idx_name = 10 - i 
                    row = recent_candles.iloc[i]
                    # yfinance returns multi-index columns sometimes, handle it safely
                    open_price = float(row["Open"].iloc[0]) if isinstance(row["Open"], pd.Series) else float(row["Open"])
                    close_price = float(row["Close"].iloc[0]) if isinstance(row["Close"], pd.Series) else float(row["Close"])
                    high_price = float(row["High"].iloc[0]) if isinstance(row["High"], pd.Series) else float(row["High"])
                    low_price = float(row["Low"].iloc[0]) if isinstance(row["Low"], pd.Series) else float(row["Low"])
                    volume = float(row["Volume"].iloc[0]) if isinstance(row["Volume"], pd.Series) else float(row["Volume"])

                    row_data[f"Open_t-{idx_name}"] = open_price
                    row_data[f"Close_t-{idx_name}"] = close_price
                    row_data[f"High_t-{idx_name}"] = high_price
                    row_data[f"Low_t-{idx_name}"] = low_price
                    row_data[f"Volume_t-{idx_name}"] = volume
                
                dataset.append(row_data)
            else:
                logging.warning(f"Not enough historical candles found for {yf_symbol} before {signal_dt}.")

        except Exception as e:
            logging.error(f"Error fetching {yf_symbol}: {e}")

    # Save dataset
    if dataset:
        df_out = pd.DataFrame(dataset)
        df_out.to_csv(OUTPUT_FILE, index=False)
        logging.info(f"Dataset successfully saved to {OUTPUT_FILE} with {len(dataset)} samples.")
    else:
        logging.warning("No data was collected. Dataset is empty.")

if __name__ == "__main__":
    build_dataset()
