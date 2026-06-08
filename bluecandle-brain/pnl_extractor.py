import os
import json
import glob
from datetime import datetime

DATA_DIR = "/home/investo/bluecandle"

def analyze_pnl():
    trade_files = glob.glob(os.path.join(DATA_DIR, "trades_*.json"))
    trade_files.sort()
    
    report_lines = []
    report_lines.append("# Daily P&L and Trade Performance Report")
    report_lines.append("\nThis report compares the daily trading performance over available history.")
    report_lines.append("\n## Daily Summary\n")
    report_lines.append("| Date | Total Trades | Wins | Losses | Win Rate | Total Capital Deployed | Total P&L | Return % |")
    report_lines.append("|---|---|---|---|---|---|---|---|")
    
    total_pnl_all_time = 0
    total_trades_all_time = 0
    
    for file in trade_files:
        try:
            date_str = file.split("_")[-1].replace(".json", "")
            if len(date_str) == 8:
                date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            else:
                date_formatted = date_str
                
            with open(file, "r") as f:
                trades = json.load(f)
                
            if not trades:
                continue
                
            daily_pnl = 0
            daily_capital = 0
            wins = 0
            losses = 0
            
            for t in trades:
                pnl = float(t.get("pnl", 0))
                qty = float(t.get("quantity", 0))
                entry = float(t.get("entry_price", 0))
                
                capital = qty * entry
                daily_pnl += pnl
                daily_capital += capital
                
                if pnl > 0:
                    wins += 1
                elif pnl < 0:
                    losses += 1
                    
            total_trades = len(trades)
            win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
            return_pct = (daily_pnl / daily_capital * 100) if daily_capital > 0 else 0
            
            total_pnl_all_time += daily_pnl
            total_trades_all_time += total_trades
            
            report_lines.append(f"| {date_formatted} | {total_trades} | {wins} | {losses} | {win_rate:.1f}% | ₹{daily_capital:,.2f} | ₹{daily_pnl:,.2f} | {return_pct:.2f}% |")
            
        except Exception as e:
            continue
            
    report_lines.append("\n## Conclusion\n")
    report_lines.append("Reviewing the data above allows us to compare recent performance to historical performance.")
    
    with open("pnl_report_temp.md", "w") as f:
        f.write("\n".join(report_lines))
    print("DONE")

if __name__ == "__main__":
    analyze_pnl()
