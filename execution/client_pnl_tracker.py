#!/usr/bin/env python3
"""
execution/client_pnl_tracker.py — Multi-client Daily Profit & 20% Commission Tracker
Logs completed live trades per client ID (e.g., Nuvama ID 45644658), calculates:
- Daily Realized Gross Profit
- 20% InvestorBabu Commission Cut
- 80% Net Client Distribution
- Persists to client_daily_pnl.json
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("ClientPnLTracker")
IST = timezone(timedelta(hours=5, minutes=30))

PNL_LOG_PATH = os.getenv("CLIENT_PNL_PATH", "data/client_daily_pnl.json")
if not os.path.exists(os.path.dirname(PNL_LOG_PATH)) and os.path.dirname(PNL_LOG_PATH):
    os.makedirs(os.path.dirname(PNL_LOG_PATH), exist_ok=True)


def load_pnl_records() -> list:
    if os.path.exists(PNL_LOG_PATH):
        try:
            with open(PNL_LOG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read {PNL_LOG_PATH}: {e}")
    return []


def save_pnl_records(records: list):
    try:
        with open(PNL_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save {PNL_LOG_PATH}: {e}")


def record_client_trade(
    client_id: str = "45644658",
    client_name: str = "Dhaval Vadgama",
    broker: str = "Nuvama Wealth",
    symbol: str = "TATASTEEL",
    action: str = "SELL",
    entry_price: float = 0.0,
    exit_price: float = 0.0,
    quantity: int = 1,
    pnl: float = 0.0,
    status: str = "TARGET_HIT",
    exit_reason: str = "1.0% Target Hit"
):
    """
    Log a completed trade for a client and update the 20% commission calculations.
    """
    records = load_pnl_records()
    now_ist = datetime.now(IST)
    today_str = now_ist.strftime("%Y-%m-%d")
    time_str = now_ist.strftime("%I:%M %p IST")

    # Find or create daily record for this client
    entry = None
    for r in records:
        if r.get("date") == today_str and str(r.get("client_id")) == str(client_id):
            entry = r
            break

    if not entry:
        entry = {
            "id": f"pnl-{today_str.replace('-', '')}-{client_id}",
            "date": today_str,
            "client_id": str(client_id),
            "client_name": client_name,
            "broker": broker,
            "gross_profit": 0.0,
            "commission_rate": 0.20,
            "commission_amount": 0.0,
            "net_client_profit": 0.0,
            "trades_count": 0,
            "payout_status": "PENDING",
            "trades": []
        }
        records.insert(0, entry)

    trade_entry = {
        "symbol": symbol,
        "action": action,
        "entry_price": round(entry_price, 2),
        "exit_price": round(exit_price, 2),
        "quantity": quantity,
        "pnl": round(pnl, 2),
        "target_pct": 1.0,
        "status": status,
        "exit_reason": exit_reason,
        "time": time_str
    }

    entry["trades"].append(trade_entry)
    entry["trades_count"] = len(entry["trades"])

    # Compute daily aggregate P&L
    total_gross = sum(float(t.get("pnl", 0.0)) for t in entry["trades"])
    entry["gross_profit"] = round(total_gross, 2)

    # 20% commission on positive gross profits
    if entry["gross_profit"] > 0:
        entry["commission_amount"] = round(entry["gross_profit"] * 0.20, 2)
        entry["net_client_profit"] = round(entry["gross_profit"] - entry["commission_amount"], 2)
    else:
        entry["commission_amount"] = 0.0
        entry["net_client_profit"] = entry["gross_profit"]

    save_pnl_records(records)
    logger.info(
        f"[ClientPnL] Logged trade for {client_id} ({symbol}): Gross P&L Rs {entry['gross_profit']:.2f}, "
        f"20% Commission: Rs {entry['commission_amount']:.2f}, Net Client: Rs {entry['net_client_profit']:.2f}"
    )
    return entry


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing Client P&L Tracker...")
    res = record_client_trade(
        client_id="45644658",
        client_name="Dhaval Vadgama",
        broker="Nuvama Wealth",
        symbol="TATASTEEL",
        action="SELL",
        entry_price=184.02,
        exit_price=182.20,
        quantity=10000,
        pnl=18200.0,
        status="TARGET_HIT",
        exit_reason="1.0% Target Hit"
    )
    print("Result:", res)
