"""
upstox_broker.py — Places orders via SMC ACE API (replacing Upstox).
"""

import os
import logging
import requests
import json
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

UPSTOX_API_KEY      = os.getenv("UPSTOX_API_KEY")
UPSTOX_API_SECRET   = os.getenv("UPSTOX_API_SECRET")

def get_upstox_access_token():
    token_path = "/home/investo/bluecandle/upstox_token.txt"
    if os.path.exists(token_path):
        try:
            with open(token_path, "r") as f:
                token = f.read().strip()
                if token:
                    return token
        except Exception:
            pass
    return os.getenv("UPSTOX_ACCESS_TOKEN")

def get_smc_tokens():
    path = "/home/investo/bluecandle/smc_tokens.json"
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "access_token": get_upstox_access_token(),
        "request_token": "99a351a9ad11aa0c95d6c3a71e1d89465ae6c1b6b2b0ac9d11cee104d5b1fc22" # Fallback
    }

def get_smc_headers():
    tokens = get_smc_tokens()
    smc_api_key = os.getenv("SMC_API_KEY", "e1ac02a1e79536156bd1")
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "request_token": tokens.get("request_token", ""),
        "x-Platform": "api",
        "X-Access-Token": tokens.get("access_token", ""),
        "x-Api-key": smc_api_key,
        "X-Client-Id": "HVI0518",
        "x-algo-id": "99999"  # Segments-wise Algo ID: 99999 for NSE
    }

def __getattr__(name):
    if name == "UPSTOX_ACCESS_TOKEN":
        return get_upstox_access_token()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

CAPITAL_PER_TRADE = 10000
EXCHANGE          = "NSE"  # SMC segment for NSE Equities

# Static mapping for the 5 monitored instruments to standard exchange tokens
SMC_TOKENS = {
    "TATASTEEL": "3499",
    "POLYCAB": "13528",
    "HAVELLS": "9819",
    "DLF": "14732",
    "ADANIENSOL": "10217",
    "IDEA": "14366",
    "BHEL": "438"
}

def get_nifty_trend() -> float:
    """Fetch Nifty 50 percentage change from yesterday's close using Yahoo Finance."""
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/^NSEI"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        last_price = data['chart']['result'][0]['meta']['regularMarketPrice']
        prev_close = data['chart']['result'][0]['meta']['chartPreviousClose']
        
        if prev_close > 0:
            return ((last_price - prev_close) / prev_close) * 100
        return 0.0
    except Exception as e:
        logger.error(f"[YahooFinance] Failed to fetch Nifty trend: {e}")
        return 0.0


def get_tick_size(symbol: str) -> float:
    """Get tick size of the instrument in Rupees based on SMC Master."""
    mapping = {
        "TATASTEEL": 0.01,
        "IDEA": 0.01,
        "DLF": 0.05,
        "ADANIENSOL": 0.10,
        "HAVELLS": 0.10,
        "POLYCAB": 0.50
    }
    return mapping.get(symbol.upper(), 0.05)


def get_sizing_config(symbol, mode="live"):
    path = os.path.join(os.path.dirname(__file__), "instrument_configs.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                configs = json.load(f)
                if symbol in configs:
                    cfg = configs[symbol]
                    mode_cfg = cfg.get(mode, {})
                    return float(mode_cfg.get("capital", 50000.0)), float(mode_cfg.get("lot_size", 0.0))
        except Exception:
            pass
    return 50000.0, 0.0

def calculate_quantity(symbol: str, price: float, direction: str = "BUY") -> int:
    if price <= 0:
        return 0
    capital, lot_size = get_sizing_config(symbol, "live")
    if lot_size > 0:
        return int(lot_size)
    try:
        nifty_trend = get_nifty_trend()
        if nifty_trend > 0.5 and direction.upper() == "BUY":
            capital *= 1.5
            logger.info(f"[Sizing] Nifty Trend is +{nifty_trend:.2f}%. Scaling BUY capital for {symbol} by 1.5x to Rs {capital}")
        elif nifty_trend < -0.5 and direction.upper() == "SELL":
            capital *= 1.5
            logger.info(f"[Sizing] Nifty Trend is {nifty_trend:.2f}%. Scaling SELL capital for {symbol} by 1.5x to Rs {capital}")
    except Exception as e:
        logger.error(f"[Sizing] Failed to check nifty trend for dynamic sizing: {e}")
    return max(int(capital / price), 1)



def get_instrument_key(symbol: str) -> str:
    """Resolve NSE symbol to SMC token ID."""
    token = SMC_TOKENS.get(symbol)
    if token:
        return token
    return symbol


def place_limit_buy(symbol: str, price: float, quantity: int = None) -> dict:
    """Place a STOP-LOSS LIMIT (SL) breakout buy order."""
    qty = quantity or calculate_quantity(symbol, price)
    tick = get_tick_size(symbol)
    inst_token = get_instrument_key(symbol)

    trigger_price = price
    limit_price = round(price + (2 * tick), 2)

    logger.info(f"[SMC] SL BUY Breakout Order: {symbol} x{qty} | Trigger={trigger_price:.2f} Limit={limit_price:.2f}")

    headers = get_smc_headers()
    payload = {
        "action": "BUY",
        "exchange": "NSE",
        "token": inst_token,
        "order_type": "STOPLOSS_LIMIT",
        "product_type": "INTRADAY",
        "quantity": str(qty),
        "disclose_quantity": "0",
        "price": f"{round(limit_price / tick) * tick:.2f}",
        "trigger_price": f"{round(trigger_price / tick) * tick:.2f}",
        "stop_loss_price": "0",
        "trailing_stop_loss": "0",
        "validity": "DAY",
        "tag": "bc_ent",  # Fixed to 6 characters (<10)
        "client_ip": "160.250.204.141",
        "x-algo-id": "99999"
    }

    try:
        res = requests.post("https://openapi.smctradeonline.com/orders/normal", json=payload, headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            order_id = res_data["data"]["order_id"]
            logger.info(f"[SMC] BUY order placed: {order_id}")
            return {"success": True, "order_id": order_id, "quantity": qty,
                    "message": f"SL BUY {qty} x {symbol} | Trigger={trigger_price} Limit={limit_price}"}
        else:
            err_msg = res_data.get("message") or res_data.get("code") or "Unknown error"
            msg = f"[SMC] BUY failed for {symbol}: {err_msg} (HTTP {res.status_code})"
            logger.error(msg)
            return {"success": False, "order_id": None, "quantity": 0, "message": msg}
    except Exception as e:
        msg = f"[SMC] BUY exception for {symbol}: {e}"
        logger.error(msg)
        return {"success": False, "order_id": None, "quantity": 0, "message": msg}


def place_limit_sell(symbol: str, price: float, quantity: int = None) -> dict:
    """Place a STOP-LOSS LIMIT (SL) breakout sell order."""
    qty = quantity or calculate_quantity(symbol, price)
    tick = get_tick_size(symbol)
    inst_token = get_instrument_key(symbol)

    trigger_price = price
    limit_price = round(price - (2 * tick), 2)

    logger.info(f"[SMC] SL SELL Breakout Order: {symbol} x{qty} | Trigger={trigger_price:.2f} Limit={limit_price:.2f}")

    headers = get_smc_headers()
    payload = {
        "action": "SELL",
        "exchange": "NSE",
        "token": inst_token,
        "order_type": "STOPLOSS_LIMIT",
        "product_type": "INTRADAY",
        "quantity": str(qty),
        "disclose_quantity": "0",
        "price": f"{round(limit_price / tick) * tick:.2f}",
        "trigger_price": f"{round(trigger_price / tick) * tick:.2f}",
        "stop_loss_price": "0",
        "trailing_stop_loss": "0",
        "validity": "DAY",
        "tag": "bc_ent",  # Fixed to 6 characters (<10)
        "client_ip": "160.250.204.141",
        "x-algo-id": "99999"
    }

    try:
        res = requests.post("https://openapi.smctradeonline.com/orders/normal", json=payload, headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            order_id = res_data["data"]["order_id"]
            logger.info(f"[SMC] SELL order placed: {order_id}")
            return {"success": True, "order_id": order_id, "quantity": qty,
                    "message": f"SL SELL {qty} x {symbol} | Trigger={trigger_price} Limit={limit_price}"}
        else:
            err_msg = res_data.get("message") or res_data.get("code") or "Unknown error"
            msg = f"[SMC] SELL failed for {symbol}: {err_msg} (HTTP {res.status_code})"
            logger.error(msg)
            return {"success": False, "order_id": None, "quantity": 0, "message": msg}
    except Exception as e:
        msg = f"[SMC] SELL exception for {symbol}: {e}"
        logger.error(msg)
        return {"success": False, "order_id": None, "quantity": 0, "message": msg}


def place_gtt_oco(symbol: str, current_price: float, quantity: int,
                  target_price: float, stop_loss_price: float,
                  transaction_type: str = "SELL") -> dict:
    inst_token = get_instrument_key(symbol)

    logger.info(f"[SMC] Placing exit protection order for {symbol} | Target={target_price} SL={stop_loss_price} Qty={quantity}")

    headers = get_smc_headers()
    tick = get_tick_size(symbol)
    if transaction_type == "SELL":
        limit_price = round(stop_loss_price - (2 * tick), 2)
    else:
        limit_price = round(stop_loss_price + (2 * tick), 2)

    payload = {
        "action": transaction_type,
        "exchange": "NSE",
        "token": inst_token,
        "order_type": "STOPLOSS_LIMIT",
        "product_type": "INTRADAY",
        "quantity": str(quantity),
        "disclose_quantity": "0",
        "price": f"{round(limit_price / tick) * tick:.2f}",
        "trigger_price": f"{round(stop_loss_price / tick) * tick:.2f}",
        "stop_loss_price": "0",
        "trailing_stop_loss": "0",
        "validity": "DAY",
        "tag": "bc_ex",  # Fixed to 5 characters (<10)
        "client_ip": "160.250.204.141",
        "x-algo-id": "99999"
    }

    try:
        res = requests.post("https://openapi.smctradeonline.com/orders/normal", json=payload, headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            order_id = res_data["data"]["order_id"]
            logger.info(f"[SMC] Exit stop loss order placed: {order_id}")
            return {"success": True, "gtt_id": order_id, "message": f"Exit SL set at {stop_loss_price}"}
        else:
            err_msg = res_data.get("message") or res_data.get("code") or "Unknown error"
            logger.error(f"[SMC] GTT/SL placement failed: {err_msg}")
    except Exception as e:
        logger.error(f"[SMC] GTT/SL placement exception: {e}")
        
    return {"success": False, "gtt_id": None, "message": "Failed to place stop loss exit order."}


def get_ltp(symbol: str) -> float:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}.NS"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            price = data["chart"]["result"][0]["meta"]["regularMarketPrice"]
            return float(price)
    except Exception as e:
        logger.error(f"[LTP] Error fetching quote for {symbol}: {e}")
    return 0.0


def place_regular_order(symbol: str, action: str, quantity: int, order_type: str = "MARKET", price: float = 0.0) -> dict:
    """
    Place a regular Market or Limit order (e.g. for pyramiding entry or target square-off).
    action: "BUY" or "SELL"
    order_type: "MARKET" or "LIMIT"
    """
    inst_token = get_instrument_key(symbol)
    headers = get_smc_headers()
    tick = get_tick_size(symbol)
    
    payload = {
        "action": action.upper(),
        "exchange": "NSE",
        "token": inst_token,
        "order_type": order_type.upper(),
        "product_type": "INTRADAY",
        "quantity": str(quantity),
        "disclose_quantity": "0",
        "price": f"{round(price / tick) * tick:.2f}" if order_type.upper() == "LIMIT" else "0",
        "trigger_price": "0",
        "stop_loss_price": "0",
        "trailing_stop_loss": "0",
        "validity": "DAY",
        "tag": "bc_reg",
        "client_ip": "160.250.204.141",
        "x-algo-id": "99999"
    }
    
    logger.info(f"[SMC] Placing regular {order_type} {action}: {symbol} x{quantity} price={price}")
    
    try:
        res = requests.post("https://openapi.smctradeonline.com/orders/normal", json=payload, headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            order_id = res_data["data"]["order_id"]
            logger.info(f"[SMC] Regular order placed successfully: {order_id}")
            return {"success": True, "order_id": order_id, "message": "Placed successfully"}
        else:
            err_msg = res_data.get("message") or res_data.get("code") or "Unknown error"
            logger.error(f"[SMC] Regular order failed: {err_msg}")
            return {"success": False, "order_id": None, "message": err_msg}
    except Exception as e:
        logger.error(f"[SMC] Regular order exception: {e}")
        return {"success": False, "order_id": None, "message": str(e)}



def delete_gtt(gtt_id: str) -> bool:
    return cancel_order(gtt_id)


def save_gtt_mapping(gtt_id_1: str, gtt_id_2: str):
    pass


def check_and_cancel_other_gtt(triggered_gtt_id: str):
    pass


def cancel_order(order_id: str) -> bool:
    try:
        headers = get_smc_headers()
        res = requests.delete(f"https://openapi.smctradeonline.com/orders/normal/{order_id}", headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            logger.info(f"[SMC] Cancelled order: {order_id}")
            return True
    except Exception as e:
        logger.error(f"[SMC] Cancel failed: {e}")
    return False


def get_orders() -> list:
    headers = get_smc_headers()
    try:
        res = requests.get("https://openapi.smctradeonline.com/reports/order-book", headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            orders = []
            for o in res_data.get("data", []):
                o_mapped = dict(o)
                o_mapped["order_id"] = str(o.get("order_id", ""))
                o_mapped["status"] = str(o.get("status", "")).upper()
                o_mapped["trading_symbol"] = o.get("symbol", "")
                o_mapped["transaction_type"] = o.get("action", "")
                o_mapped["average_price"] = float(o.get("trade_average_price") or o.get("average_price") or 0)
                orders.append(o_mapped)
            return orders
    except Exception as e:
        logger.error(f"[SMC] get_orders failed: {e}")
    return []


def get_trades() -> list:
    headers = get_smc_headers()
    try:
        res = requests.get("https://openapi.smctradeonline.com/reports/trade-book", headers=headers, timeout=10)
        res_data = res.json()
        if res.status_code == 200 and res_data.get("status") == "success":
            return res_data.get("data", [])
    except Exception as e:
        logger.error(f"[SMC] get_trades failed: {e}")
    return []
