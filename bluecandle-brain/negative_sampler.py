import json
import os
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import random
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIGNALS_FILE = "signals.json"
OUTPUT_FILE = "bluecandle_dataset_negatives.csv"

# The 5 instruments we are currently tracking
INSTRUMENTS = ["TATASTEEL", "DLF", "POLYCAB", "HAVELLS", "ADANIENSOL"]

def convert_to_datetime(date_str, time_str):
    dt_str = f"{date_str} {time_str}"
    try:
        return datetime.strptime(dt_str, "%d %b %Y %H:%M")
    except ValueError:
        return None

def build_negative_dataset():
    if not os.path.exists(SIGNALS_FILE):
        logging.error("signals.json not found.")
        return

    with open(SIGNALS_FILE, "r") as f:
        signals = json.load(f)

    # Build a set of positive signal timestamps per instrument to avoid them
    positive_times = {symbol: set() for symbol in INSTRUMENTS}
    for sig in signals:
        sym = sig.get("instrument")
        if sym in positive_times:
            dt = convert_to_datetime(sig.get("candle_date"), sig.get("candle_time"))
            if dt:
                positive_times[sym].add(dt)

    dataset = []
    
    # We'll pull 30 days of 15m data to find our negative samples
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=30)

    for symbol in INSTRUMENTS:
        yf_symbol = f"{symbol}.NS"
        logging.info(f"Fetching 30d history for {yf_symbol}...")
        
        try:
            df = yf.download(yf_symbol, start=start_dt.strftime("%Y-%m-%d"), end=end_dt.strftime("%Y-%m-%d"), interval="15m", progress=False)
            
            if df.empty:
                continue
                
            if df.index.tz is not None:
                df.index = df.index.tz_convert(None)

            # Iterate through all available 15m candles
            # We need at least 10 previous candles to build the feature row
            for i in range(10, len(df)):
                current_time = df.index[i].to_pydatetime()
                
                # Check if this exact timestamp is a known Positive signal
                # If it is, or if it's within 1 hour of a positive signal (to be safe), we skip it.
                is_positive = False
                for p_time in positive_times[symbol]:
                    if abs((current_time - p_time).total_seconds()) <= 3600:
                        is_positive = True
                        break
                
                if is_positive:
                    continue
                    
                # We have a valid negative sample! Let's extract it.
                history_slice = df.iloc[i-9:i+1] # The 10 candles ending at current_time
                
                if len(history_slice) == 10:
                    row_data = {
                        "signal_id": f"{symbol}_{current_time.strftime('%Y%m%d_%H%M')}_NEG",
                        "symbol": symbol,
                        "target_signal_dt": current_time,
                        "confidence": "none" # Label for negative
                    }
                    
                    for j in range(10):
                        idx_name = 10 - j 
                        row = history_slice.iloc[j]
                        
                        row_data[f"Open_t-{idx_name}"] = float(row["Open"].iloc[0]) if isinstance(row["Open"], pd.Series) else float(row["Open"])
                        row_data[f"Close_t-{idx_name}"] = float(row["Close"].iloc[0]) if isinstance(row["Close"], pd.Series) else float(row["Close"])
                        row_data[f"High_t-{idx_name}"] = float(row["High"].iloc[0]) if isinstance(row["High"], pd.Series) else float(row["High"])
                        row_data[f"Low_t-{idx_name}"] = float(row["Low"].iloc[0]) if isinstance(row["Low"], pd.Series) else float(row["Low"])
                        row_data[f"Volume_t-{idx_name}"] = float(row["Volume"].iloc[0]) if isinstance(row["Volume"], pd.Series) else float(row["Volume"])

                    dataset.append(row_data)
                    
        except Exception as e:
            logging.error(f"Error processing {yf_symbol}: {e}")

    # We likely have thousands of negatives now. 
    # Let's randomly sample 1000 of them to prevent massively imbalancing the training data 
    # (since we only have 122 positives). We want a ratio of roughly 1:8.
    if len(dataset) > 1000:
        logging.info(f"Found {len(dataset)} valid negative candidates. Randomly sampling 1000...")
        dataset = random.sample(dataset, 1000)

    if dataset:
        df_out = pd.DataFrame(dataset)
        df_out.to_csv(OUTPUT_FILE, index=False)
        logging.info(f"Successfully saved {len(dataset)} NEGATIVE samples to {OUTPUT_FILE}.")

if __name__ == "__main__":
    build_negative_dataset()
