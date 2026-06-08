import json
import os
import yfinance as yf
from datetime import datetime, timedelta
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")

SIGNALS_FILE = "/home/investo/bluecandle/signals.json"

def convert_to_datetime(date_str, time_str):
    dt_str = f"{date_str} {time_str}"
    try:
        return datetime.strptime(dt_str, "%d %b %Y %H:%M")
    except ValueError:
        return None

def analyze_targets():
    if not os.path.exists(SIGNALS_FILE):
        print("signals.json not found.")
        return

    with open(SIGNALS_FILE, "r") as f:
        signals = json.load(f)

    # Clean out any test signals
    signals = [s for s in signals if "Brain V2" not in str(s.get("status", ""))]

    total_analyzed = 0
    hit_1_percent = 0
    hit_stop_loss = 0
    expired_end_of_day = 0

    print(f"Analyzing {len(signals)} historical signals for a strict 1% return...\n")

    # Group signals by instrument to minimize yfinance calls
    signals_by_symbol = {}
    for sig in signals:
        sym = sig.get("instrument")
        if sym not in signals_by_symbol:
            signals_by_symbol[sym] = []
        signals_by_symbol[sym].append(sig)

    for symbol, sym_signals in signals_by_symbol.items():
        yf_symbol = f"{symbol}.NS"
        
        # Download 60d of 5m data to track exact intraday movements
        # We use 5m for higher resolution tracking after the signal
        df = yf.download(yf_symbol, period="60d", interval="5m", progress=False)
        if df.empty:
            continue
            
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        if df.index.tz is not None:
            df.index = df.index.tz_convert(None)

        for sig in sym_signals:
            dt = convert_to_datetime(sig.get("candle_date"), sig.get("candle_time"))
            if not dt: continue
            
            original_high = float(sig.get("high", 0))
            original_low = float(sig.get("low", 0))
            
            if original_high == 0 or original_low == 0: continue
            
            # Exact V1 Logic Simulation - Adjusted for 0.50% Target
            entry_price = original_high * 1.0015
            target_pct = entry_price * 1.005
            
            # Stop loss is original low, OR min 0.50% away, whichever is wider (lower)
            min_sl_buffer = entry_price * 0.995
            stop_loss = min(original_low, min_sl_buffer)
            
            # Filter forward price action for the SAME DAY only (MIS trades square off at 3:20 PM)
            same_day_end = dt.replace(hour=15, minute=20)
            forward_df = df[(df.index > dt) & (df.index <= same_day_end)]
            
            if forward_df.empty:
                continue

            total_analyzed += 1
            
            # Scan forward to see what happened first
            trade_resolved = False
            for index, row in forward_df.iterrows():
                h = float(row["High"])
                l = float(row["Low"])
                
                # Did we hit the 0.20% target?
                if h >= target_pct:
                    hit_1_percent += 1
                    trade_resolved = True
                    break
                
                # Did we hit the stop loss?
                if l <= stop_loss:
                    hit_stop_loss += 1
                    trade_resolved = True
                    break
                    
            if not trade_resolved:
                expired_end_of_day += 1

    if total_analyzed == 0:
        print("No forward data could be analyzed.")
        return

    win_rate = (hit_1_percent / total_analyzed) * 100
    
    print("="*40)
    print(" 🎯 0.50% TARGET ANALYSIS REPORT")
    print("    (0.50% Target | Minimum 0.50% SL)")
    print("="*40)
    print(f"Total Signals Analyzed: {total_analyzed}")
    print(f"Hit 0.50% Target:       {hit_1_percent} ({win_rate:.1f}%)")
    print(f"Hit Stop Loss:          {hit_stop_loss} ({(hit_stop_loss/total_analyzed)*100:.1f}%)")
    print(f"Expired at 3:20 PM:     {expired_end_of_day} ({(expired_end_of_day/total_analyzed)*100:.1f}%)")
    print("="*40)
    print("Conclusion: Is a 0.20% fractional target doable?")
    if win_rate > 50:
        print("YES! The edge is massive at 0.20%.")
    else:
        print("Challenging.")

if __name__ == "__main__":
    analyze_targets()
