import os
import json
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("db_helper")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Check if database config is available
IS_DB_ACTIVE = bool(SUPABASE_URL and SUPABASE_KEY)

# Fallback paths for JSON compatibility
LOCAL_SIGNALS_FILE = "us_signals.json"
LOCAL_ORDERS_FILE = "us_simulated_orders.json"

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

# ── SIGNALS ──────────────────────────────────────────────────────────────────

def save_signal(signal):
    """
    Saves a signal to Supabase database. Falls back to us_signals.json.
    """
    if IS_DB_ACTIVE:
        try:
            url = f"{SUPABASE_URL}/rest/v1/signals"
            # Format candle_date to ISO format YYYY-MM-DD for PG compatibility if needed
            # (assuming input date is like '08 Jun 2026')
            date_raw = signal.get("candle_date")
            try:
                date_iso = datetime.strptime(date_raw, "%d %b %Y").strftime("%Y-%m-%d")
            except Exception:
                date_iso = date_raw

            payload = {
                "instrument": signal.get("instrument"),
                "price": signal.get("price"),
                "high": signal.get("high"),
                "low": signal.get("low"),
                "candle_date": date_iso,
                "candle_time": signal.get("candle_time"),
                "detected_at": signal.get("detected_at", datetime.now().isoformat()),
                "screenshot": signal.get("screenshot", "PROGRAMMATIC"),
                "confidence": signal.get("confidence", "high"),
                "spread_pct": signal.get("spread_pct"),
                "buy_entry": signal.get("buy_entry"),
                "buy_target": signal.get("buy_target"),
                "buy_stop_loss": signal.get("buy_stop_loss"),
                "sell_entry": signal.get("sell_entry"),
                "sell_target": signal.get("sell_target"),
                "sell_stop_loss": signal.get("sell_stop_loss"),
                "status": signal.get("status", "DETECTED")
            }
            res = requests.post(url, headers=get_headers(), json=payload)
            if res.status_code in [200, 201]:
                return res.json()[0]
            elif res.status_code == 409:
                logger.info(f"Duplicate signal ignored (unique constraint): {signal.get('instrument')} {signal.get('candle_time')}")
                return None
            else:
                logger.error(f"Error inserting signal: {res.text}")
        except Exception as e:
            logger.error(f"Database error saving signal: {e}")

    # Fallback to local file-based storage
    try:
        signals = []
        if os.path.exists(LOCAL_SIGNALS_FILE):
            with open(LOCAL_SIGNALS_FILE, "r") as f:
                signals = json.load(f)
        
        # Check uniqueness constraint locally
        is_dup = any(s.get("instrument") == signal.get("instrument") and 
                     s.get("candle_date") == signal.get("candle_date") and 
                     s.get("candle_time") == signal.get("candle_time") for s in signals)
        if not is_dup:
            signals.append(signal)
            with open(LOCAL_SIGNALS_FILE, "w") as f:
                json.dump(signals, f, indent=2)
            logger.info(f"Saved signal locally: {signal.get('instrument')} {signal.get('candle_time')}")
            return signal
    except Exception as e:
        logger.error(f"Failed fallback save signal: {e}")
    return None


def get_signals_by_date(date_str):
    """
    Fetches all signals for a specific date (format: '08 Jun 2026' or '2026-06-08')
    """
    if IS_DB_ACTIVE:
        try:
            # Try ISO conversion
            try:
                date_iso = datetime.strptime(date_str, "%d %b %Y").strftime("%Y-%m-%d")
            except Exception:
                date_iso = date_str
                
            url = f"{SUPABASE_URL}/rest/v1/signals?candle_date=eq.{date_iso}"
            res = requests.get(url, headers=get_headers())
            if res.status_code == 200:
                return res.json()
        except Exception as e:
            logger.error(f"Database error reading signals: {e}")
            
    # Fallback
    try:
        if os.path.exists(LOCAL_SIGNALS_FILE):
            with open(LOCAL_SIGNALS_FILE, "r") as f:
                sigs = json.load(f)
                return [s for s in sigs if s.get("candle_date") == date_str]
    except Exception as e:
        logger.error(f"Failed fallback read signals: {e}")
    return []

# ── ORDERS ───────────────────────────────────────────────────────────────────

def save_order(order):
    """
    Saves an order to Supabase or simulated_orders.json
    """
    if IS_DB_ACTIVE:
        try:
            url = f"{SUPABASE_URL}/rest/v1/orders"
            # PostGREST upsert/insert
            # cl_order_id handles idempotency
            res = requests.post(url, headers=get_headers(), json=order)
            if res.status_code in [200, 201]:
                return res.json()[0]
            elif res.status_code == 409:
                logger.info(f"Order insertion bypassed: ClOrderID already exists")
                return None
            else:
                logger.error(f"Error saving order to Supabase: {res.text}")
        except Exception as e:
            logger.error(f"Database error saving order: {e}")
            
    # Fallback
    try:
        orders = []
        if os.path.exists(LOCAL_ORDERS_FILE):
            with open(LOCAL_ORDERS_FILE, "r") as f:
                orders = json.load(f)
        
        # Prevent exact duplicate orders locally
        cl_id = order.get("cl_order_id")
        if cl_id and any(o.get("cl_order_id") == cl_id for o in orders):
            return None
            
        orders.append(order)
        with open(LOCAL_ORDERS_FILE, "w") as f:
            json.dump(orders, f, indent=2)
        return order
    except Exception as e:
        logger.error(f"Failed fallback save order: {e}")
    return None


def update_order(order_id, updates):
    """
    Updates an order by id (UUID for DB, index or match params for local fallback)
    """
    if IS_DB_ACTIVE:
        try:
            url = f"{SUPABASE_URL}/rest/v1/orders?id=eq.{order_id}"
            res = requests.patch(url, headers=get_headers(), json=updates)
            if res.status_code == 200:
                return res.json()[0]
        except Exception as e:
            logger.error(f"Database error updating order {order_id}: {e}")
            
    # Fallback
    try:
        if os.path.exists(LOCAL_ORDERS_FILE):
            with open(LOCAL_ORDERS_FILE, "r") as f:
                orders = json.load(f)
            updated = False
            for o in orders:
                # Fallback matching on UUID or custom ClOrderID
                if o.get("id") == order_id or o.get("cl_order_id") == order_id:
                    o.update(updates)
                    updated = True
                    break
            if updated:
                with open(LOCAL_ORDERS_FILE, "w") as f:
                    json.dump(orders, f, indent=2)
                return True
    except Exception as e:
        logger.error(f"Failed fallback update order: {e}")
    return False

# ── LOGS & SETTINGS ──────────────────────────────────────────────────────────

def log_event(client_id, level, message):
    """
    Logs events to client_logs table or standard python logging.
    """
    msg_formatted = f"Client {client_id}: {message}" if client_id else message
    if level == "ERROR":
        logger.error(msg_formatted)
    elif level == "WARNING":
        logger.warning(msg_formatted)
    else:
        logger.info(msg_formatted)

    if IS_DB_ACTIVE:
        try:
            url = f"{SUPABASE_URL}/rest/v1/client_logs"
            payload = {
                "client_id": client_id,
                "level": level,
                "message": message
            }
            requests.post(url, headers=get_headers(), json=payload)
        except Exception:
            pass
