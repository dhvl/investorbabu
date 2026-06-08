import pandas as pd
import yfinance as yf
import os
import logging
from datetime import timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

POS_FILE = "bluecandle_dataset.csv"
NEG_FILE = "bluecandle_dataset_negatives.csv"
OUTPUT_FILE = "training_dataset.csv"

def build_features():
    if not os.path.exists(POS_FILE) or not os.path.exists(NEG_FILE):
        logging.error("Source CSV files not found. Run Step 1 and 2 first.")
        return

    df_pos = pd.read_csv(POS_FILE)
    df_pos['is_signal'] = 1

    df_neg = pd.read_csv(NEG_FILE)
    df_neg['is_signal'] = 0

    # Combine to get the list of all timestamps we need to feature-engineer
    df_all = pd.concat([df_pos, df_neg], ignore_index=True)
    df_all['target_signal_dt'] = pd.to_datetime(df_all['target_signal_dt'])
    
    symbols = df_all['symbol'].unique()
    
    final_rows = []
    
    # We download 60 days of 15m data per symbol to have enough history for EMAs and RSI
    for symbol in symbols:
        yf_symbol = f"{symbol}.NS"
        logging.info(f"Processing features for {yf_symbol}...")
        
        try:
            # max history for 15m is 60d
            df_hist = yf.download(yf_symbol, period="60d", interval="15m", progress=False)
            if df_hist.empty:
                continue
                
            if df_hist.index.tz is not None:
                df_hist.index = df_hist.index.tz_convert(None)
                
            # Flatten multi-index columns if present
            if isinstance(df_hist.columns, pd.MultiIndex):
                df_hist.columns = df_hist.columns.get_level_values(0)

            # Calculate Technical Indicators natively using pandas
            
            # RSI (14)
            delta = df_hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df_hist['RSI_14'] = 100 - (100 / (1 + rs))
            
            # MACD (12, 26, 9)
            ema12 = df_hist['Close'].ewm(span=12, adjust=False).mean()
            ema26 = df_hist['Close'].ewm(span=26, adjust=False).mean()
            df_hist['MACD_12_26_9'] = ema12 - ema26
            df_hist['MACDs_12_26_9'] = df_hist['MACD_12_26_9'].ewm(span=9, adjust=False).mean()
            df_hist['MACDh_12_26_9'] = df_hist['MACD_12_26_9'] - df_hist['MACDs_12_26_9']
            
            # EMAs
            df_hist['EMA_20'] = df_hist['Close'].ewm(span=20, adjust=False).mean()
            df_hist['EMA_50'] = df_hist['Close'].ewm(span=50, adjust=False).mean()
            
            # Bollinger Bands (20, 2)
            sma20 = df_hist['Close'].rolling(window=20).mean()
            std20 = df_hist['Close'].rolling(window=20).std()
            df_hist['BBL_20_2.0'] = sma20 - (std20 * 2)
            df_hist['BBU_20_2.0'] = sma20 + (std20 * 2)
            df_hist['BBM_20_2.0'] = sma20
            
            # True Range / ATR (14)
            high_low = df_hist['High'] - df_hist['Low']
            high_close = (df_hist['High'] - df_hist['Close'].shift()).abs()
            low_close = (df_hist['Low'] - df_hist['Close'].shift()).abs()
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            df_hist['ATR_14'] = tr.rolling(window=14).mean()
            
            # Custom features
            df_hist['Volume_SMA20'] = df_hist['Volume'].rolling(20).mean()
            df_hist['Volume_Surge'] = df_hist['Volume'] / df_hist['Volume_SMA20']
            df_hist['Dist_EMA20_pct'] = (df_hist['Close'] - df_hist['EMA_20']) / df_hist['EMA_20'] * 100
            
            df_hist.dropna(inplace=True) # Drop rows with NaN from rolling calculations
            
            # Filter the combined dataframe for just this symbol
            symbol_signals = df_all[df_all['symbol'] == symbol]
            
            for _, sig in symbol_signals.iterrows():
                target_dt = sig['target_signal_dt']
                
                # Find the row in df_hist exactly matching the target_dt
                # If exact match not found (due to missing data), try closest previous within 15m
                try:
                    # Get index location of the target dt or the one just before it
                    idx = df_hist.index.get_indexer([target_dt], method='pad')[0]
                    if idx == -1:
                        continue
                        
                    # We want the features of the candle that JUST closed (the signal candle or candle prior)
                    row_data = df_hist.iloc[idx].to_dict()
                    
                    # Add our label and metadata
                    row_data['signal_id'] = sig['signal_id']
                    row_data['symbol'] = symbol
                    row_data['timestamp'] = target_dt
                    row_data['is_signal'] = sig['is_signal']
                    
                    final_rows.append(row_data)
                except Exception as e:
                    logging.warning(f"Could not align {target_dt} for {symbol}: {e}")
                    
        except Exception as e:
            logging.error(f"Error computing TA for {symbol}: {e}")
            
    if final_rows:
        df_final = pd.DataFrame(final_rows)
        # Reorder columns to put metadata first
        cols = ['signal_id', 'symbol', 'timestamp', 'is_signal'] + [c for c in df_final.columns if c not in ['signal_id', 'symbol', 'timestamp', 'is_signal']]
        df_final = df_final[cols]
        
        df_final.to_csv(OUTPUT_FILE, index=False)
        logging.info(f"Successfully saved feature engineered dataset with {len(df_final)} rows to {OUTPUT_FILE}")
    else:
        logging.warning("No rows generated.")

if __name__ == "__main__":
    build_features()
