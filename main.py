"""
main.py — Programmatic Bluecandle Signal Scanner. Run this on your VPS.

Every 15 minutes, 24/7:
  1. Programmatically downloads 15-minute candle data via yfinance.
  2. Detects the mathematically first Inside Bar of the day.
  3. Validates the signal, prevents duplicates, and runs ML brain prediction for Indian stocks.
  4. Executes trades automatically (Zerodha for Indian stocks, Simulation for US/Crypto).
  5. Alerts the Team (Dhaval & Eashaan) immediately.
  6. Maps message IDs to track thumbs-up (👍) reactions from the Admin to verify the math/timing in the database.
"""

import time
import logging
import os
import json
import subprocess
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

from config import (
    SCAN_INTERVAL_MINUTES,
    MARKET_START_HOUR, MARKET_START_MINUTE,
    MARKET_END_HOUR, MARKET_END_MINUTE,
    SCREENSHOTS_DIR
)
from telegram_bot import (
    send_message, send_trade_message, send_admin_only_message,
    format_expiry_message, format_startup_message,
    format_error_message, test_telegram, format_signal_message
)
from trade_tracker import start_tracker
from state import (
    is_duplicate, save_signal,
    check_expired_signals, reset_daily_state
)
from inside_bar_helper import get_first_inside_bar_of_day, get_timezone

load_dotenv()
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
IST = timezone(timedelta(hours=5, minutes=30))

# ── Logging ────────────────────────────────────────────────────────────────────
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)s  %(message)s",
    handlers= [
        logging.FileHandler("bluecandle.log"),
    ]
)
logger = logging.getLogger(__name__)


INDIAN_HOLIDAYS_2026 = {
    "2026-01-26",  # Republic Day
    "2026-03-03",  # Holi
    "2026-03-26",  # Shri Ram Navami
    "2026-03-31",  # Shri Mahavir Jayanti
    "2026-04-03",  # Good Friday
    "2026-04-14",  # Dr. Baba Saheb Ambedkar Jayanti
    "2026-05-01",  # Maharashtra Day
    "2026-05-28",  # Bakri Id
    "2026-06-26",  # Muharram
    "2026-09-14",  # Ganesh Chaturthi
    "2026-10-02",  # Mahatma Gandhi Jayanti
    "2026-10-20",  # Dussehra
    "2026-11-10",  # Diwali-Balipratipada
    "2026-11-24",  # Prakash Gurpurb Sri Guru Nanak Dev
    "2026-12-25",  # Christmas
}

def is_market_open():
    """Check if we're within trading hours IST on a weekday and not a holiday."""
    now   = datetime.now(IST)
    if now.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
        return False
        
    date_str = now.strftime("%Y-%m-%d")
    if date_str in INDIAN_HOLIDAYS_2026:
        return False
        
    start = now.replace(hour=MARKET_START_HOUR, minute=MARKET_START_MINUTE,
                        second=0, microsecond=0)
    end   = now.replace(hour=MARKET_END_HOUR,   minute=MARKET_END_MINUTE,
                        second=0, microsecond=0)
    return start <= now <= end


def is_us_commodities_open():
    """Check if US commodities markets are currently active (Eastern Time)."""
    import pytz
    now = datetime.now(pytz.timezone('Asia/Kolkata'))
    try:
        est = now.astimezone(pytz.timezone('US/Eastern'))
    except Exception:
        # Fallback manual timezone shift (IST - 9h 30m)
        est = now - timedelta(hours=9, minutes=30)
        
    weekday = est.weekday()  # Monday=0, ..., Sunday=6
    hour = est.hour
    
    if weekday == 4:  # Friday close at 17:00 (5 PM EST)
        return hour < 17
    if weekday == 5:  # Saturday is fully closed
        return False
    if weekday == 6:  # Sunday open at 18:00 (6 PM EST)
        return hour >= 18
    return True


def load_symbols():
    """Dynamically load symbols list from local configuration files."""
    indian = []
    if os.path.exists("instruments.json"):
        try:
            with open("instruments.json", "r") as f:
                indian = list(json.load(f).keys())
        except Exception as e:
            logger.error(f"Error loading instruments.json: {e}")
            
    us_comm = []
    if os.path.exists("instruments_us.json"):
        try:
            with open("instruments_us.json", "r") as f:
                us_comm = list(json.load(f).keys())
        except Exception as e:
            logger.error(f"Error loading instruments_us.json: {e}")
            
    crypto = []
    if os.path.exists("instruments_crypto.json"):
        try:
            with open("instruments_crypto.json", "r") as f:
                crypto = list(json.load(f).keys())
        except Exception as e:
            logger.error(f"Error loading instruments_crypto.json: {e}")
            
    return indian, us_comm, crypto


def save_and_log_signal(signal, is_us):
    """Save the signal state and append to database file (with Supabase sync)."""
    # Save to state.py so duplicate check works across runs
    save_signal(signal)
    
    import db_helper
    db_helper.save_signal(signal)



def run_scan():
    """Unified programmatic scan cycle for all active asset classes."""
    from trade_engine import _is_already_traded
    logger.info(f"--- Programmatic scan started at {datetime.now().strftime('%H:%M:%S')} ---")
    signals_found = 0

    indian_symbols, us_symbols, crypto_symbols = load_symbols()
    scan_list = []  # List of (symbol, is_us)

    # 1. Indian Stocks Filter
    if is_market_open():
        for sym in indian_symbols:
            scan_list.append((sym, False))
    else:
        logger.info("Indian stock market is closed. Skipping Indian scan.")

    # 2. US Commodities Filter
    if is_us_commodities_open():
        for sym in us_symbols:
            scan_list.append((sym, True))
    else:
        logger.info("US commodities market is closed. Skipping US commodities scan.")

    # 3. Crypto Scan (Trades 24/7)
    for sym in crypto_symbols:
        scan_list.append((sym, True))

    if not scan_list:
        logger.info("No active markets to scan.")
        return 0

    logger.info(f"Active instruments to scan: {[item[0] for item in scan_list]}")

    for symbol, is_us in scan_list:
        try:
            # Skip if Indian stock is already traded today
            if not is_us and _is_already_traded(symbol):
                continue

            # Check today's date in correct timezone
            tz = get_timezone(symbol, is_us)
            now_tz = datetime.now(tz)
            date_str = now_tz.strftime("%Y-%m-%d")

            # Pause briefly to prevent yfinance rate limits
            time.sleep(2)

            # Get first inside bar of the day
            raw_signal = get_first_inside_bar_of_day(symbol, date_str, is_us=is_us)
            if not raw_signal:
                continue

            # Duplicate check
            if is_duplicate(raw_signal):
                continue

            # New valid signal found! Build complete dictionary
            high = raw_signal["high"]
            low = raw_signal["low"]
            price = raw_signal["price"]

            # Calculate trade parameters
            tick = {
                "XAGUSD": 0.005,
                "XAUUSD": 0.10,
                "OILUSD": 0.01,
                "CUCUSD": 0.0005,
                "BTCUSD": 1.0
            }.get(symbol, 0.01) if is_us else 0.05

            dec_places = len(str(tick).split('.')[1]) if '.' in str(tick) else 2

            b_entry = round(high + tick, dec_places)
            s_entry = round(low - tick, dec_places)

            signal = {
                "instrument": symbol,
                "price": price,
                "high": high,
                "low": low,
                "candle_date": raw_signal["candle_date"],
                "candle_time": raw_signal["candle_time"],
                "detected_at": datetime.now().isoformat(),
                "screenshot": "PROGRAMMATIC",
                "confidence": "high",
                "spread_pct": raw_signal["spread_pct"],
                "buy_entry": b_entry,
                "buy_target": round(b_entry * 1.01, dec_places),
                "buy_pyramid": round(b_entry * 1.01, dec_places),
                "buy_stop_loss": low,
                "sell_entry": s_entry,
                "sell_target": round(s_entry * 0.99, dec_places),
                "sell_pyramid": round(s_entry * 0.99, dec_places),
                "sell_stop_loss": high,
                "status": "DETECTED"
            }

            if "brain_prediction" in raw_signal:
                signal["brain_prediction"] = raw_signal["brain_prediction"]
                signal["brain_probability"] = raw_signal["brain_probability"]

            logger.info(f"NEW SIGNAL DETECTED: {symbol} at {signal['candle_time']}. Executing trade...")

            # Format and Send Signal to Team and Ganesh Immediately
            msg = format_signal_message(signal)
            res_alert = send_trade_message(msg)

            # Record message mapping for Dhaval's thumbs-up reaction check
            if res_alert.get("success"):
                msg_id = res_alert.get("message_id")
                if msg_id:
                    try:
                        reactions_path = "pending_reactions.json"
                        reactions = {}
                        if os.path.exists(reactions_path):
                            with open(reactions_path, "r") as f:
                                reactions = json.load(f)
                        reactions[str(msg_id)] = symbol
                        with open(reactions_path, "w") as f:
                            json.dump(reactions, f, indent=2)
                    except Exception as rx_err:
                        logger.error(f"Error writing to pending_reactions.json: {rx_err}")
                        
                save_and_log_signal(signal, is_us)
                signals_found += 1
                logger.info(f"Alert sent to Team for {symbol}")
            else:
                logger.error(f"Failed to send Telegram alert for {symbol}")
                continue

            # --- EXECUTION ---
            if not is_us:
                # Place trade via Zerodha Kite
                from trade_engine import execute_signal
                trade_ok = execute_signal(signal)
                if trade_ok:
                    logger.info(f"Kite orders placed for {symbol}")
                    signal["status"] = "TRADED"
                else:
                    signal["status"] = "SKIPPED"
            else:
                # US commodities and Crypto simulation execution
                buy_target = round(b_entry * 1.01, dec_places)
                sell_target = round(s_entry * 0.99, dec_places)
                b_sl = float(low)
                s_sl = float(high)

                sim_msg = (
                    f"⚠️ [SIMULATION PLACED] - {symbol}\n"
                    f"{datetime.now(IST).strftime('%d %b, %I:%M %p IST')}\n\n"
                    f"🟢 BUY LEG\n"
                    f"Entry    : {b_entry}\n"
                    f"Target   : {buy_target}\n"
                    f"Stop-Loss: {b_sl}\n\n"
                    f"🔴 SELL LEG\n"
                    f"Entry    : {s_entry}\n"
                    f"Target   : {sell_target}\n"
                    f"Stop-Loss: {s_sl}\n\n"
                    f"US Simulation - tracking active."
                )
                send_trade_message(sim_msg)
                signal["status"] = "TRADED"

                # Trigger US simulation replay in background
                try:
                    subprocess.Popen(["python3.11", "us_replay_today.py"])
                except Exception:
                    try:
                        subprocess.Popen(["python3", "us_replay_today.py"])
                    except Exception as e:
                        logger.error(f"Failed to trigger us_replay_today.py: {e}")

        except Exception as e:
            logger.error(f"Crash processing {symbol}: {e}")
            send_admin_only_message(format_error_message(f"Crash processing {symbol}: {e}"))
            continue

    # Check for expired signals in state
    expired = check_expired_signals()
    for instrument in expired:
        logger.info(f"{instrument}: Signal expired")
        send_trade_message(format_expiry_message(instrument))

    logger.info(f"--- Scan complete: {signals_found} new signals, {len(expired)} expired ---")
    return signals_found


def wait_until_next_scan(interval_minutes):
    """Wait until the next 15-minute boundary."""
    now     = datetime.now()
    minutes = now.minute
    seconds = now.second

    next_boundary = ((minutes // interval_minutes) + 1) * interval_minutes
    if next_boundary >= 60:
        next_boundary = 60

    wait_seconds = (next_boundary - minutes) * 60 - seconds
    logger.info(f"Next scan in {wait_seconds // 60}m {wait_seconds % 60}s (at :{next_boundary:02d})")

    while wait_seconds > 0:
        sleep_time = min(30, wait_seconds)
        time.sleep(sleep_time)
        wait_seconds -= sleep_time


def main():
    print("\n" + "="*60)
    print("  PROGRAMMATIC BLUECANDLE SIGNAL SCANNER")
    print("  (Active Auto-Execution & Team Alert Mode)")
    print("="*60)
    from datetime import datetime as _dt
    print(f"  Started: {_dt.now().strftime('%d %b %Y, %I:%M %p')}")
    print(f"  Scan interval: every {SCAN_INTERVAL_MINUTES} minutes")
    print("="*60 + "\n")

    logger.info("Testing Telegram connection...")
    if not test_telegram():
        logger.error("Telegram not working. Check bot credentials.")
        print("\n[ERROR] Telegram not working.")

    # Startup notify to Team
    send_trade_message(f"🚀 <b>BLUECANDLE PROGRAMMATIC LIVE</b>\n\nScanner process started 24/7.\nTime: {datetime.now().strftime('%I:%M %p')} IST")

    start_tracker()  # Start order monitoring
    
    # Generate daily SMC session token on startup
    try:
        from smc_session_manager import refresh_smc_session
        refresh_smc_session()
    except Exception as e:
        logger.error(f"Failed to generate SMC session token on startup: {e}")
        
    reset_daily_state()

    last_reset_date = datetime.now().date()

    while True:
        try:
            now = datetime.now()

            # Daily reset at market open (9:15 AM IST)
            if now.date() != last_reset_date and \
               now.hour == MARKET_START_HOUR and \
               now.minute >= MARKET_START_MINUTE:
                logger.info("New trading day — resetting daily state")
                reset_daily_state()
                
                # Regenerate daily SMC session token
                try:
                    from smc_session_manager import refresh_smc_session
                    refresh_smc_session()
                except Exception as e:
                    logger.error(f"Failed to regenerate daily SMC session token: {e}")
                    
                last_reset_date = now.date()

            # Scan all active asset classes
            run_scan()

            # Wait until next 15-minute mark
            wait_until_next_scan(SCAN_INTERVAL_MINUTES)

        except KeyboardInterrupt:
            logger.info("Scanner stopped by user")
            send_admin_only_message("🛑 <b>Bluecandle Scanner stopped.</b>")
            break
        except Exception as e:
            logger.error(f"Main loop error: {e}")
            send_admin_only_message(format_error_message(f"Main loop error: {e}"))
            time.sleep(60)


if __name__ == "__main__":
    main()
