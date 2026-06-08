"""
telegram_bot.py — Sends Blue Candle signal alerts to your Telegram.

Each alert contains:
- Instrument name
- Buy and Sell entry levels
- Pyramid triggers (where to add 2 more lots)
- Stop loss levels
- Spread info
- Confidence level
"""

import requests
import logging
import json
import os
from datetime import datetime, timedelta
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SIGNAL_EXPIRY_HOURS

logger = logging.getLogger(__name__)

TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
HISTORY_FILE = "telegram_history.json"

# All alerts go to Dhaval only
ADMIN_IDS = ["945073334"]

# Trade signals go to admin only for now
TRADE_IDS  = ADMIN_IDS


def _log_message(text, chat_ids):
    """Save message history to a JSON file for the dashboard."""
    try:
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        
        history.append({
            "timestamp": datetime.now().isoformat(),
            "chat_ids": chat_ids,
            "text": text
        })
        
        # Keep only last 200 messages to prevent file bloating
        if len(history) > 200:
            history = history[-200:]
            
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to log telegram history: {e}")


def send_message(text, parse_mode="HTML"):
    """Send a message to your Telegram chat."""
    if not TELEGRAM_BOT_TOKEN or "YOUR_" in TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram not configured. Message not sent.")
        logger.info(f"[TELEGRAM WOULD SEND]: {text}")
        return False

    chat_ids = ADMIN_IDS  # System messages go to Dhaval only
    success  = False
    
    # Log locally
    _log_message(text, chat_ids)
    
    for chat_id in chat_ids:
        try:
            resp = requests.post(
                f"{TELEGRAM_API}/sendMessage",
                json={
                    "chat_id":    chat_id,
                    "text":       text,
                    "parse_mode": parse_mode,
                },
                timeout=10
            )
            if resp.status_code == 200:
                logger.info(f"Telegram sent to {chat_id}")
                success = True
            else:
                logger.error(f"Telegram error for {chat_id}: {resp.status_code}")
        except Exception as e:
            logger.error(f"Telegram send failed for {chat_id}: {e}")
    return success


def send_trade_message(text, parse_mode="HTML"):
    """Send to everyone — trade signals, orders, P&L."""
    trade_ids = ["945073334", "1488710204", "929350168"]
    if not TELEGRAM_BOT_TOKEN or "YOUR_" in TELEGRAM_BOT_TOKEN:
        return False
    
    # Log locally
    _log_message(text, trade_ids)
    
    success = False
    for chat_id in trade_ids:
        try:
            resp = requests.post(
                f"{TELEGRAM_API}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
                timeout=10
            )
            if resp.status_code == 200:
                success = True
        except Exception as e:
            logger.error(f"Telegram trade send failed for {chat_id}: {e}")
    return success


def format_signal_message(signal):
    """
    Format a Blue Candle signal into a clean Telegram message.
    Uses HTML formatting for bold/monospace text.
    """
    instrument = signal["instrument"]
    price      = signal["price"]
    high       = signal["high"]
    low        = signal["low"]
    spread     = signal["spread_pct"]
    confidence = signal.get("confidence", "medium").upper()
    detected   = datetime.now().strftime("%d %b %Y, %I:%M %p IST")

    # Calculate expiry time
    expiry = (datetime.now() + timedelta(hours=SIGNAL_EXPIRY_HOURS)).strftime("%I:%M %p")

    # Confidence emoji
    conf_emoji = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴"}.get(confidence, "🟡")

    message = f"""🔵 <b>BLUE CANDLE SIGNAL</b> 🔵

📊 <b>Instrument:</b> {instrument}
💰 <b>Current Price:</b> {price}
🕐 <b>Detected:</b> {detected}
{conf_emoji} <b>Confidence:</b> {confidence}
📏 <b>Spread:</b> {spread}%

━━━━━━━━━━━━━━━━━━━━
🟢 <b>BUY LEG (Bullish)</b>
━━━━━━━━━━━━━━━━━━━━
  Entry (Break above H) : <code>{high}</code>
  Lot 1 : Buy 1 lot at <code>{high}</code>
  Pyramid trigger       : <code>{signal['buy_target']}</code> (H + 1%)
  Lot 2+3 : Add 2 lots at <code>{signal['buy_target']}</code>
  Stop Loss             : <code>{signal['buy_stop_loss']}</code> (Low)

━━━━━━━━━━━━━━━━━━━━
🔴 <b>SELL LEG (Bearish)</b>
━━━━━━━━━━━━━━━━━━━━
  Entry (Break below L) : <code>{low}</code>
  Lot 1 : Sell 1 lot at <code>{low}</code>
  Pyramid trigger       : <code>{signal['sell_target']}</code> (L - 1%)
  Lot 2+3 : Add 2 lots at <code>{signal['sell_target']}</code>
  Stop Loss             : <code>{signal['sell_stop_loss']}</code> (High)

━━━━━━━━━━━━━━━━━━━━
⚠️ <b>RULES:</b>
  • Place BOTH legs simultaneously
  • When one leg pyramids → cancel the other
  • Signal expires at <b>{expiry}</b>
  • This is a manual signal — YOU place the trade
━━━━━━━━━━━━━━━━━━━━"""

    return message


def format_expiry_message(instrument):
    """Alert when a signal has expired without being triggered."""
    return (
        f"⏰ <b>SIGNAL EXPIRED</b>\n\n"
        f"The Blue Candle signal for <b>{instrument}</b> "
        f"has expired after {SIGNAL_EXPIRY_HOURS} hours.\n"
        f"Neither leg was triggered. No action needed."
    )


def format_skip_message(instrument, reason):
    """Alert when a detected signal is skipped."""
    return (
        f"⏭ <b>SIGNAL SKIPPED: {instrument}</b>\n\n"
        f"The scanner detected a potential Blue Candle, but it was skipped.\n"
        f"<b>Reason:</b> {reason}\n\n"
        f"🔍 <i>Market volatility or timing check.</i>"
    )



def format_startup_message(instruments):
    """Message sent when the scanner starts."""
    inst_list = "\n".join([f"  • {i}" for i in instruments])
    return (
        f"🚀 <b>BLUECANDLE SCANNER STARTED</b>\n\n"
        f"Monitoring instruments:\n{inst_list}\n\n"
        f"Scanning every 15 minutes.\n"
        f"You will receive alerts when a Blue Candle signal is detected."
    )


def format_error_message(error_text):
    """Alert for system errors."""
    return (
        f"⚠️ <b>BLUECANDLE SYSTEM ERROR</b>\n\n"
        f"<code>{error_text}</code>\n\n"
        f"Please check the VPS logs."
    )


def test_telegram():
    """Send a connection confirmation message."""
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(IST)
    msg = (
        f"✅ <b>Bluecandle Telegram connected!</b>\n\n"
        f"You will receive Blue Candle signals here.\n"
        f"🕐 {now.strftime('%d %b %Y, %I:%M %p IST')}"
    )
    result = send_message(msg)
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Sending test message to Telegram...")
    if test_telegram():
        print("✓ Test message sent! Check your Telegram.")
    else:
        print("✗ Failed. Check your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env")
