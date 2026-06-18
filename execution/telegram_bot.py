import os
import json
import logging
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_API = f'https://investorbabu.vercel.app/api/telegram-proxy?path=bot{TELEGRAM_BOT_TOKEN}'
HISTORY_FILE = 'telegram_history.json'

ADMIN_IDS = [id.strip() for id in os.getenv('TELEGRAM_ADMIN_CHAT_ID', '945073334').split(',') if id.strip()]
TRADE_IDS = ADMIN_IDS
SIGNAL_EXPIRY_HOURS = 2

def _log_message(text, chat_ids):
    try:
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
        history.append({'timestamp': datetime.now().isoformat(), 'chat_ids': chat_ids, 'text': text})
        if len(history) > 200: history = history[-200:]
        with open(HISTORY_FILE, 'w') as f: json.dump(history, f, indent=2)
    except Exception as e: logger.error(f'Failed to log telegram history: {e}')

def load_clients():
    clients = {}
    if os.path.exists("clients.json"):
        try:
            with open("clients.json") as f:
                clients = json.load(f)
        except Exception:
            pass
    return clients

def send_admin_only_message(text, parse_mode='HTML'):
    if not TELEGRAM_BOT_TOKEN or 'YOUR_' in TELEGRAM_BOT_TOKEN:
        return {"success": False, "message_id": None}
    
    chat_ids = list(ADMIN_IDS)
    sent_ids = list(chat_ids)
    msg_id = None
    
    for chat_id in chat_ids:
        try: 
            res = requests.post(f'{TELEGRAM_API}/sendMessage', json={'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}, timeout=10)
            if res.status_code == 200:
                res_json = res.json()
                if res_json.get("ok"):
                    msg_id = res_json["result"]["message_id"]
            else:
                logger.error(f"Telegram response error (admin {chat_id}): HTTP {res.status_code} - {res.text}")
        except Exception as err:
            logger.error(f"Telegram exception (admin {chat_id}): {err}")
        
    _log_message(text, sent_ids)
    return {"success": msg_id is not None, "message_id": msg_id}


def send_message(text, parse_mode='HTML'):
    if not TELEGRAM_BOT_TOKEN or 'YOUR_' in TELEGRAM_BOT_TOKEN: return False

    clients = load_clients()
    chat_ids = list(ADMIN_IDS)
    sent_ids = list(chat_ids)
    
    # Send to Admins
    for chat_id in chat_ids:
        try: 
            res = requests.post(f'{TELEGRAM_API}/sendMessage', json={'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}, timeout=10)
            if res.status_code != 200:
                logger.error(f"Telegram response error (admin {chat_id}): HTTP {res.status_code} - {res.text}")
        except Exception as err:
            logger.error(f"Telegram exception (admin {chat_id}): {err}")
        
    # Send to Whitelisted Clients only if it is a Blue Candle breakout signal
    if "BLUE CANDLE DETECTED" in text:
        for client_id, client_data in clients.items():
            if client_id in chat_ids:
                continue
            whitelist = [x.strip().upper() for x in client_data.get("whitelisted_instruments", [])]
            allowed = False
            for inst in whitelist:
                if f"#{inst}" in text or inst in text:
                    allowed = True
                    break
            if allowed:
                try: 
                    res = requests.post(f'{TELEGRAM_API}/sendMessage', json={'chat_id': client_id, 'text': text, 'parse_mode': parse_mode}, timeout=10)
                    if res.status_code == 200:
                        sent_ids.append(client_id)
                    else:
                        logger.error(f"Telegram response error (client {client_id}): HTTP {res.status_code} - {res.text}")
                except Exception as err:
                    logger.error(f"Telegram exception (client {client_id}): {err}")
                
    _log_message(text, sent_ids)
    return True

def send_trade_message(text, parse_mode='HTML'):
    if not TELEGRAM_BOT_TOKEN or 'YOUR_' in TELEGRAM_BOT_TOKEN:
        return {"success": False, "message_id": None}
    
    clients = load_clients()
    chat_ids = list(TRADE_IDS)
    sent_ids = list(chat_ids)
    msg_id = None
    
    # Send to Admins
    for chat_id in chat_ids:
        try: 
            res = requests.post(f'{TELEGRAM_API}/sendMessage', json={'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}, timeout=10)
            if res.status_code == 200:
                res_json = res.json()
                if str(chat_id) == "945073334" and res_json.get("ok"):
                    msg_id = res_json["result"]["message_id"]
            else:
                logger.error(f"Telegram response error (admin {chat_id}): HTTP {res.status_code} - {res.text}")
        except Exception as err:
            logger.error(f"Telegram exception (admin {chat_id}): {err}")
        
    # Send to Whitelisted Clients only if it is a Blue Candle breakout signal
    if "BLUE CANDLE DETECTED" in text:
        for client_id, client_data in clients.items():
            if client_id in chat_ids:
                continue
            whitelist = [x.strip().upper() for x in client_data.get("whitelisted_instruments", [])]
            allowed = False
            for inst in whitelist:
                if f"#{inst}" in text or inst in text:
                    allowed = True
                    break
            if allowed:
                try: 
                    res = requests.post(f'{TELEGRAM_API}/sendMessage', json={'chat_id': client_id, 'text': text, 'parse_mode': parse_mode}, timeout=10)
                    if res.status_code == 200:
                        sent_ids.append(client_id)
                    else:
                        logger.error(f"Telegram response error (client {client_id}): HTTP {res.status_code} - {res.text}")
                except Exception as err:
                    logger.error(f"Telegram exception (client {client_id}): {err}")
                
    _log_message(text, sent_ids)
    return {"success": len(sent_ids) > 0, "message_id": msg_id}


def format_signal_message(signal):
    """
    Format a Blue Candle signal into a highly professional Bloomberg-style alert.
    """
    instrument = signal["instrument"]
    price      = signal["price"]
    high       = signal["high"]
    low        = signal["low"]
    spread     = signal["spread_pct"]
    confidence = signal.get("confidence", "medium").upper()
    detected   = datetime.now().strftime("%d %b %Y | %H:%M:%S IST")
    expiry     = (datetime.now() + timedelta(hours=SIGNAL_EXPIRY_HOURS)).strftime("%H:%M IST")

    conf_emoji = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴"}.get(confidence, "🟡")

    return f"""⚡ <b>ALGO TRANSMISSION — BLUE CANDLE DETECTED</b>

📊 <b>ASSET:</b> #{instrument}
💰 <b>LTP:</b> Rs {price}
🕐 <b>TIMESTAMP:</b> {detected}
{conf_emoji} <b>CONFIDENCE:</b> {confidence}
📏 <b>SPREAD:</b> {spread:.3f}%

📥 <b>ORDER PARAMETERS EXECUTION:</b>

🟢 <b>BUY BREAKOUT LEG</b>
  • Entry Trigger : <code>{high}</code>
  • Order size    : 1 Lot (Base Allocation)
  • Target (1.0%) : <code>{signal['buy_target']}</code>
  • Stop Loss     : <code>{signal['buy_stop_loss']}</code>

🔴 <b>SELL BREAKOUT LEG</b>
  • Entry Trigger : <code>{low}</code>
  • Order size    : 1 Lot (Base Allocation)
  • Target (1.0%) : <code>{signal['sell_target']}</code>
  • Stop Loss     : <code>{signal['sell_stop_loss']}</code>

⚙️ <b>EXECUTION SYSTEM RULES:</b>
  • Bracket execution: simultaneous multi-leg entry order.
  • One-Cancels-Other (OCO): Opposite leg is cancelled instantly on fill.
  • Signal Expiration: <b>{expiry}</b>
━━━━━━━━━━━━━━━━━━━━━━━━"""

def format_expiry_message(instrument):
    return f"⏰ <b>SYSTEM NOTICE — SIGNAL EXPIRED</b>\n\nSignal time-limit exceeded for <b>#{instrument}</b>. Bracket entry orders purged. Zero exposure."

def format_skip_message(instrument, reason):
    return f"⏭ <b>SYSTEM NOTICE — SIGNAL SKIPPED</b>\n\nAsset: <b>#{instrument}</b>\n<b>Action:</b> FILTERED BY SYSTEM GATES\n<b>Reason:</b> {reason}"

def format_startup_message(instruments):
    inst_list = ', '.join(instruments)
    is_us = any(x in ["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD", "BTCUSD", "ETHUSD"] for x in instruments)
    flag = "🇺🇸" if is_us else "🇮🇳"
    return f"🚀 <b>BLUECANDLE LIVE {flag}</b>\n\nScanning market signals.\n\n📦 <b>Monitoring:</b> {inst_list}\n🕐 <b>Started:</b> {datetime.now().strftime('%I:%M %p')} IST"

def format_error_message(error_text):
    return f"⚠️ <b>BLUECANDLE SYSTEM ERROR</b>\n\n<code>{error_text}</code>"

def test_telegram():
    return send_message('✅ <b>Bluecandle Telegram connected!</b>')

if __name__ == '__main__':
    test_telegram()
