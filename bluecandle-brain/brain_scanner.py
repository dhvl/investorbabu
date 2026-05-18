import os
import json
import logging
import pandas as pd
import yfinance as yf
import joblib
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Paths
MODEL_FILE = "/home/investo/bluecandle/bluecandle_model.joblib"
FEATURES_FILE = "/home/investo/bluecandle/model_features.joblib"
SIGNALS_LOG = "/home/investo/bluecandle/signals.json"

INSTRUMENTS = ["TATASTEEL", "DLF", "POLYCAB", "HAVELLS", "ADANIENSOL"]
IST = timezone(timedelta(hours=5, minutes=30))

def calculate_features(df_hist):
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
    return df_hist

def scan():
    if not os.path.exists(MODEL_FILE):
        logging.error("Model file not found. Cannot run Brain Scanner.")
        return
        
    clf = joblib.load(MODEL_FILE)
    feature_cols = joblib.load(FEATURES_FILE)
    
    # Load existing signals
    existing_signals = []
    if os.path.exists(SIGNALS_LOG):
        try:
            with open(SIGNALS_LOG, "r") as f:
                existing_signals = json.load(f)
        except:
            pass

    for symbol in INSTRUMENTS:
        yf_symbol = f"{symbol}.NS"
        try:
            df = yf.download(yf_symbol, period="60d", interval="15m", progress=False)
            if df.empty:
                continue
                
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            df = calculate_features(df)
            df.dropna(inplace=True)
            
            # 1. Enrich existing signals in signals.json
            for sig in existing_signals:
                if sig.get("instrument") == symbol:
                    status = sig.get("status", "")
                    # Process signals that don't have the Brain Verification string yet
                    if not status or "Verified" not in status:
                        # Find the matching row in historical df
                        for idx, row in df.iterrows():
                            idx_dt = idx.to_pydatetime()
                            # Correct timezone to IST
                            if idx_dt.tzinfo is not None:
                                idx_dt = idx_dt.astimezone(IST)
                                
                            # yfinance timestamp is START time. Let's add 15 minutes to match TV CLOSE time.
                            idx_end_dt = idx_dt + timedelta(minutes=15)
                            idx_date = idx_end_dt.strftime("%d %b %Y")
                            idx_time = idx_end_dt.strftime("%H:%M")
                            if idx_date == sig.get("candle_date") and idx_time == sig.get("candle_time"):
                                X_pred = pd.DataFrame([row[feature_cols]])
                                prediction = clf.predict(X_pred)[0]
                                prob = float(clf.predict_proba(X_pred)[0][1]) * 100
                                if prediction == 1:
                                    sig["status"] = f"🧠 Brain Verified ({prob:.1f}%)"
                                    logging.info(f"🧠 Brain Verified: {symbol} at {idx_time} with {prob:.1f}% prob")
                                else:
                                    sig["status"] = f"DETECTED (Brain: {prob:.1f}%)"
                                    logging.info(f"🧠 Brain Weak / Stale: {symbol} at {idx_time} with {prob:.1f}% prob")
                                break

            # 2. Scanner verification for the last completed candle (V2 ONLY breakout detection)
            last_row = df.iloc[-1]
            last_dt = df.index[-1].to_pydatetime()
            if last_dt.tzinfo is not None:
                last_dt = last_dt.astimezone(IST)
                
            # yfinance timestamp is START time. Add 15 minutes to stamp close time.
            last_end_dt = last_dt + timedelta(minutes=15)
            candle_date = last_end_dt.strftime("%d %b %Y")
            candle_time = last_end_dt.strftime("%H:%M")
            
            X_pred = pd.DataFrame([last_row[feature_cols]])
            prediction = clf.predict(X_pred)[0]
            prob = float(clf.predict_proba(X_pred)[0][1]) * 100
            
            if prediction == 1:
                logging.info(f"🧠 BRAIN DETECTED SIGNAL: {symbol} at {candle_time} ({prob:.1f}%)")
                
                found_existing = False
                for sig in existing_signals:
                    if sig.get("instrument") == symbol and sig.get("candle_date") == candle_date and sig.get("candle_time") == candle_time:
                        sig["status"] = f"🧠 Brain Verified ({prob:.1f}%)"
                        found_existing = True
                        break
                
                if not found_existing:
                    high = float(last_row["High"])
                    low = float(last_row["Low"])
                    spread = ((high - low) / low) * 100
                    
                    new_sig = {
                        "instrument": symbol,
                        "price": float(last_row["Close"]),
                        "high": high,
                        "low": low,
                        "candle_date": candle_date,
                        "candle_time": candle_time,
                        "detected_at": datetime.now().isoformat(),
                        "confidence": "High",
                        "spread_pct": spread,
                        "status": f"🧠 Brain V2 ONLY ({prob:.1f}%)"
                    }
                    existing_signals.append(new_sig)
                    
        except Exception as e:
            logging.error(f"Brain failed to scan {symbol}: {e}")

    # Save updated signals back
    with open(SIGNALS_LOG, "w") as f:
        json.dump(existing_signals, f, indent=2)

if __name__ == "__main__":
    scan()
