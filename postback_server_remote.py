"""
postback_server.py — Receives real-time order updates from Zerodha.

Zerodha sends a POST request to this server whenever an order status changes.
We then send a Telegram notification and log the trade.

Setup:
1. Run this server on port 5000
2. Set Postback URL in Kite developer console to:
   https://api.investorbabu.com/kite/postback
3. Apache proxy forwards api.investorbabu.com → localhost:5000

Runs alongside main.py as a separate process.
"""

import json
import logging
import os
import subprocess
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from telegram_bot import send_trade_message, send_message
from upstox_broker import get_orders, get_trades, delete_gtt, check_and_cancel_other_gtt
import config

app = Flask(__name__)
logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)s  %(message)s",
    handlers= [
        logging.FileHandler("postback.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# Track orders we placed today (loaded from signals.json)
def load_our_orders():
    """Load order IDs we placed today from signals.json."""
    try:
        if os.path.exists("signals.json"):
            with open("signals.json") as f:
                data = json.load(f)
                orders = {}
                for signal in data.get("signals", []):
                    if signal.get("buy_order_id"):
                        orders[str(signal["buy_order_id"])] = {
                            "symbol":           signal["instrument"],
                            "transaction_type": "BUY",
                            "entry_price":      signal["high"],
                            "quantity":         signal.get("quantity", 0),
                            "target_price":     signal["buy_target"],
                            "stop_loss_price":  signal["low"],
                        }
                    if signal.get("sell_order_id"):
                        orders[str(signal["sell_order_id"])] = {
                            "symbol":           signal["instrument"],
                            "transaction_type": "SELL",
                            "entry_price":      signal["low"],
                            "quantity":         signal.get("quantity", 0),
                            "target_price":     signal["sell_target"],
                            "stop_loss_price":  signal["high"],
                        }
                return orders
    except Exception as e:
        logger.error(f"Error loading orders: {e}")
    return {}


def save_trade_log(trade: dict):
    """Append trade to daily log file."""
    today    = datetime.now(IST).strftime("%Y%m%d")
    log_file = f"trades_{today}.json"

    trades = []
    if os.path.exists(log_file):
        with open(log_file) as f:
            trades = json.load(f)

    trades.append(trade)
    with open(log_file, "w") as f:
        json.dump(trades, f, indent=2)


@app.route("/upstox/postback", methods=["POST"])
def upstox_postback():
    """Receive order update from Upstox."""
    try:
        data = request.get_json(force=True) or request.form.to_dict()
        logger.info(f"Postback received: {json.dumps(data)}")

        order_id   = str(data.get("order_id", ""))
        status     = str(data.get("status", "")).upper()
        symbol     = data.get("trading_symbol") or data.get("tradingsymbol") or ""
        filled_qty = data.get("filled_quantity") or data.get("filled_qty", 0)
        avg_price  = float(data.get("average_price", 0))
        tx_type    = data.get("transaction_type", "")

        if not order_id or not status:
            return jsonify({"status": "ignored"}), 200

        # OCO GTT Cancellation: If this was triggered by a GTT leg, delete the other leg
        gtt_order_id = data.get("gtt_order_id")
        if gtt_order_id:
            check_and_cancel_other_gtt(gtt_order_id)

        # Load our orders to check if this is our order
        our_orders = load_our_orders()
        our_order  = our_orders.get(order_id)

        now_str = datetime.now(IST).strftime("%d %b, %I:%M %p IST")

        if status == "COMPLETE":
            entry_price = our_order["entry_price"] if our_order else avg_price
            quantity    = our_order["quantity"] if our_order else filled_qty

            # Calculate P&L
            if tx_type == "BUY":
                pnl = (avg_price - entry_price) * quantity
            else:
                pnl = (entry_price - avg_price) * quantity

            pnl_pct   = round((abs(pnl) / (entry_price * quantity)) * 100, 2) if entry_price else 0
            pnl_emoji = "✅" if pnl >= 0 else "❌"

            msg = (
                f"{pnl_emoji} <b>ORDER FILLED — {symbol}</b>\n\n"
                f"{'📈' if tx_type == 'BUY' else '📉'} {tx_type} completed\n"
                f"Entry    : Rs {entry_price:.2f}\n"
                f"Exit     : Rs {avg_price:.2f}\n"
                f"Quantity : {quantity} shares\n"
                f"P&L      : Rs {pnl:+.2f} ({'+' if pnl >= 0 else ''}{pnl_pct}%)\n"
                f"Time     : {now_str}"
            )
            send_trade_message(msg)

            # Save to trade log
            save_trade_log({
                "order_id":         order_id,
                "symbol":           symbol,
                "transaction_type": tx_type,
                "entry_price":      entry_price,
                "exit_price":       avg_price,
                "quantity":         quantity,
                "pnl":              round(pnl, 2),
                "status":           "COMPLETE",
                "time":             now_str,
            })

        elif status == "CANCELLED":
            msg = (
                f"🚫 <b>ORDER CANCELLED — {symbol}</b>\n\n"
                f"{tx_type} order cancelled\n"
                f"Time: {now_str}"
            )
            send_trade_message(msg)

        elif status == "REJECTED":
            reason = data.get("status_message") or data.get("reject_reason", "Unknown")
            msg = (
                f"⛔ <b>ORDER REJECTED — {symbol}</b>\n\n"
                f"{tx_type} order rejected\n"
                f"Reason: {reason}\n"
                f"Time: {now_str}"
            )
            send_message(msg)  # Admin only for rejections

        logger.info(f"Postback processed: {symbol} {tx_type} {status}")
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        logger.error(f"Postback error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/upstox/reconcile", methods=["GET"])
def reconcile_trades():
    """Fetch actual P&L and trades directly from Upstox for today."""
    try:
        import requests
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {os.getenv('UPSTOX_ACCESS_TOKEN')}"
        }
        res_pos = requests.get("https://api.upstox.com/v2/portfolio/get-positions", headers=headers, timeout=10)
        positions = res_pos.json().get("data", []) if res_pos.status_code == 200 else []
        trades = get_trades()

        # Map positions for easy lookup
        pos_map = {p.get("trading_symbol") or p.get("tradingsymbol"): p for p in positions if "trading_symbol" in p or "tradingsymbol" in p}
        
        symbol_stats = {}
        # Use trades to identify what was active today
        for t in trades:
            symbol = t.get("trading_symbol") or t.get("tradingsymbol")
            if not symbol or symbol not in config.INSTRUMENTS:
                continue

            if symbol not in symbol_stats:
                pos = pos_map.get(symbol, {})
                symbol_stats[symbol] = {
                    "symbol": symbol,
                    "pnl": round(float(pos.get("pnl", 0)), 2) if pos.get("pnl") is not None else 0.0,
                    "buy_val": round(float(pos.get("buy_value", 0)), 2) if pos.get("buy_value") is not None else 0.0,
                    "sell_val": round(float(pos.get("sell_value", 0)), 2) if pos.get("sell_value") is not None else 0.0,
                    "avg_price": float(pos.get("average_price", 0)) if pos.get("average_price") else 0.0,
                    "last_price": float(pos.get("last_price", 0)) if pos.get("last_price") else 0.0,
                    "trades": []
                }
            
            symbol_stats[symbol]["trades"].append({
                "order_id": t["order_id"],
                "type": t["transaction_type"],
                "qty": t["quantity"],
                "price": t["average_price"],
                "time": str(t.get("exchange_timestamp") or t.get("order_timestamp", ""))
            })

        # Add any active positions that didn't have trades today
        for symbol, p in pos_map.items():
            if symbol in config.INSTRUMENTS and symbol not in symbol_stats:
                symbol_stats[symbol] = {
                    "symbol": symbol,
                    "pnl": round(float(p.get("pnl", 0)), 2) if p.get("pnl") is not None else 0.0,
                    "buy_val": round(float(p.get("buy_value", 0)), 2) if p.get("buy_value") is not None else 0.0,
                    "sell_val": round(float(p.get("sell_value", 0)), 2) if p.get("sell_value") is not None else 0.0,
                    "avg_price": float(p.get("average_price", 0)) if p.get("average_price") else 0.0,
                    "last_price": float(p.get("last_price", 0)) if p.get("last_price") else 0.0,
                    "trades": []
                }

        results = list(symbol_stats.values())

        return jsonify({
            "status": "ok",
            "date": datetime.now(IST).strftime("%Y-%m-%d"),
            "upstox_data": results
        }), 200

    except Exception as e:
        logger.error(f"Reconcile error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/kite/instruments", methods=["GET", "POST", "DELETE"])
def manage_instruments():
    """List, add, or delete instruments from instruments.json, instruments_us.json, or instruments_crypto.json."""
    market = request.args.get("market", "in").lower()
    
    if market == "us":
        filename = "instruments_us.json"
    elif market == "crypto":
        filename = "instruments_crypto.json"
    else:
        filename = "instruments.json"
        
    path = os.path.join(os.path.dirname(__file__), filename)
    
    if request.method == "POST":
        try:
            data = request.get_json(force=True)
            symbol = data.get("symbol", "").upper().strip()
            
            if not symbol:
                return jsonify({"error": "Symbol is required"}), 400
                
            instruments = {}
            if os.path.exists(path):
                with open(path, "r") as f:
                    try:
                        instruments = json.load(f)
                    except Exception:
                        pass
            
            # Default formatting rules
            if market == "in":
                full_symbol = f"NSE:{symbol}" if ":" not in symbol else symbol
            else:
                full_symbol = symbol
                
            instruments[symbol] = full_symbol
            
            with open(path, "w") as f:
                json.dump(instruments, f, indent=4)
                
            # Reload Indian INSTRUMENTS in memory if it was the Indian market
            if market == "in":
                config.INSTRUMENTS = instruments
            
            logger.info(f"Added {market} instrument: {symbol} ({full_symbol})")
            return jsonify({"status": "ok", "message": f"Added {symbol}"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    elif request.method == "DELETE":
        try:
            data = request.get_json(force=True)
            symbol = data.get("symbol", "").upper().strip()
            
            if not symbol:
                return jsonify({"error": "Symbol is required"}), 400
                
            if not os.path.exists(path):
                return jsonify({"error": "No instruments found"}), 404
                
            with open(path, "r") as f:
                instruments = json.load(f)
                
            if symbol in instruments:
                del instruments[symbol]
                with open(path, "w") as f:
                    json.dump(instruments, f, indent=4)
                
                if market == "in":
                    config.INSTRUMENTS = instruments
                
                logger.info(f"Deleted {market} instrument: {symbol}")
                return jsonify({"status": "ok", "message": f"Deleted {symbol}"}), 200
            else:
                return jsonify({"error": f"Instrument {symbol} not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    # GET method
    try:
        if os.path.exists(path):
            with open(path) as f:
                return jsonify(json.load(f)), 200
        return jsonify({}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status":  "ok",
        "time":    datetime.now(IST).strftime("%d %b %Y %I:%M %p IST"),
        "service": "Bluecandle Postback Server"
    }), 200


@app.route("/telegram/webhook", methods=["POST"])
def telegram_webhook():
    """Receive and handle Telegram user messages (interactive registration)."""
    try:
        update = request.get_json(force=True)
        if not update or "message" not in update:
            return jsonify({"status": "ignored"}), 200

        message = update["message"]
        chat = message.get("chat", {})
        chat_id = str(chat.get("id", ""))
        text = message.get("text", "").strip()

        if not chat_id or not text:
            return jsonify({"status": "ignored"}), 200

        # Load states and clients
        states = {}
        if os.path.exists("registration_states.json"):
            try:
                with open("registration_states.json") as f:
                    states = json.load(f)
            except Exception:
                pass

        clients = {}
        if os.path.exists("clients.json"):
            try:
                with open("clients.json") as f:
                    clients = json.load(f)
            except Exception:
                pass

        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        telegram_api = f"https://api.telegram.org/bot{bot_token}"

        def send_reply(msg_text):
            try:
                requests.post(f"{telegram_api}/sendMessage", json={
                    "chat_id": chat_id,
                    "text": msg_text,
                    "parse_mode": "HTML"
                }, timeout=10)
            except Exception as re:
                logger.error(f"Failed to send Telegram reply: {re}")

        # Check state/intent
        if text.startswith("/start"):
            states[chat_id] = "AWAITING_NAME"
            with open("registration_states.json", "w") as f:
                json.dump(states, f, indent=2)

            send_reply(
                "🚀 <b>Welcome to InvestorBabu!</b>\n\n"
                "I am your automated breakout signal delivery assistant.\n\n"
                "Please reply directly to this message with your <b>Full Name</b> to register in our backend database."
            )
        elif states.get(chat_id) == "AWAITING_NAME":
            name = text
            
            # Load pending clients
            pending = {}
            if os.path.exists("pending_clients.json"):
                try:
                    with open("pending_clients.json") as f:
                        pending = json.load(f)
                except Exception:
                    pass
            
            pending[chat_id] = {
                "name": name,
                "requested_at": datetime.now(IST).isoformat()
            }
            with open("pending_clients.json", "w") as f:
                json.dump(pending, f, indent=2)

            # Clear state
            if chat_id in states:
                del states[chat_id]
            with open("registration_states.json", "w") as f:
                json.dump(states, f, indent=2)

            send_reply(
                f"⏳ <b>Registration Request Submitted</b>\n\n"
                f"Thank you, <b>{name}</b>. Your details have been submitted to the administrator for approval.\n"
                f"Your Chat ID: <code>{chat_id}</code>\n\n"
                f"You will be notified immediately here once your access is approved."
            )

            # Notify Admin (Dhaval)
            admin_token = os.getenv("TELEGRAM_BOT_TOKEN")
            admin_api = f"https://api.telegram.org/bot{admin_token}"
            admin_ids = [id.strip() for id in os.getenv("TELEGRAM_ADMIN_CHAT_ID", "945073334").split(",") if id.strip()]
            admin_msg = (
                f"🔔 <b>New Registration Request</b>\n\n"
                f"Name: <b>{name}</b>\n"
                f"Chat ID: <code>{chat_id}</code>\n\n"
                f"Please approve this user from your Admin Dashboard."
            )
            for aid in admin_ids:
                try:
                    requests.post(f"{admin_api}/sendMessage", json={
                        "chat_id": aid,
                        "text": admin_msg,
                        "parse_mode": "HTML"
                    }, timeout=10)
                except Exception:
                    pass

        return jsonify({"status": "ok"}), 200

    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/clients", methods=["GET"])
def get_clients():
    """Retrieve active and pending clients."""
    try:
        clients = {}
        if os.path.exists("clients.json"):
            with open("clients.json") as f:
                clients = json.load(f)
        
        pending = {}
        if os.path.exists("pending_clients.json"):
            with open("pending_clients.json") as f:
                pending = json.load(f)
                
        return jsonify({
            "status": "ok",
            "clients": clients,
            "pending": pending
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/clients/approve", methods=["POST"])
def approve_client():
    """Approve a pending client."""
    try:
        data = request.get_json(force=True)
        chat_id = str(data.get("chat_id", ""))
        name = data.get("name", "")
        client_type = data.get("type", "chatbot") # "chatbot" or "live"
        whitelisted = data.get("whitelisted_instruments", [])
        broker = data.get("broker", "")

        if not chat_id:
            return jsonify({"status": "error", "message": "Missing Chat ID"}), 400

        # Load existing clients
        clients = {}
        if os.path.exists("clients.json"):
            with open("clients.json") as f:
                clients = json.load(f)

        # Remove from pending list
        pending = {}
        if os.path.exists("pending_clients.json"):
            with open("pending_clients.json") as f:
                pending = json.load(f)
            if chat_id in pending:
                if not name:
                    name = pending[chat_id].get("name", "")
                del pending[chat_id]
                with open("pending_clients.json", "w") as f:
                    json.dump(pending, f, indent=2)

        # Save to clients
        clients[chat_id] = {
            "name": name,
            "type": client_type,
            "whitelisted_instruments": whitelisted
        }
        if client_type == "live" and broker:
            clients[chat_id]["broker"] = broker
            
        with open("clients.json", "w") as f:
            json.dump(clients, f, indent=2)

        # Notify the user on Telegram
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        telegram_api = f"https://api.telegram.org/bot{bot_token}"
        
        if client_type == "chatbot":
            insts_str = ", ".join(whitelisted) if whitelisted else "None configured"
            msg = (
                f"🎉 <b>Your Account Has Been Approved!</b>\n\n"
                f"Congratulations, <b>{name}</b>! The administrator has approved your Telegram account.\n\n"
                f"⚙️ <b>Setup:</b> Chat Bot Only\n"
                f"📦 <b>Whitelisted Assets:</b> <code>{insts_str}</code>\n\n"
                f"You will receive breakout signal alerts directly in this chat."
            )
        else:
            msg = (
                f"🎉 <b>Your Account Has Been Approved!</b>\n\n"
                f"Congratulations, <b>{name}</b>! The administrator has approved your live trading account.\n\n"
                f"⚙️ <b>Setup:</b> Live Trading\n"
                f"💼 <b>Broker:</b> <code>{broker.upper()}</code>\n\n"
                f"You will receive signal notifications and automated order executions."
            )
            
        try:
            requests.post(f"{telegram_api}/sendMessage", json={
                "chat_id": chat_id,
                "text": msg,
                "parse_mode": "HTML"
            }, timeout=10)
        except Exception as te:
            logger.error(f"Failed to notify client of approval: {te}")

        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/clients/update", methods=["POST"])
def update_client():
    """Update active client configuration."""
    try:
        data = request.get_json(force=True)
        chat_id = str(data.get("chat_id", ""))
        name = data.get("name", "")
        client_type = data.get("type", "chatbot")
        whitelisted = data.get("whitelisted_instruments", [])
        broker = data.get("broker", "")

        if not chat_id:
            return jsonify({"status": "error", "message": "Missing Chat ID"}), 400

        clients = {}
        if os.path.exists("clients.json"):
            with open("clients.json") as f:
                clients = json.load(f)

        if chat_id not in clients:
            return jsonify({"status": "error", "message": "Client not found"}), 404

        clients[chat_id] = {
            "name": name or clients[chat_id].get("name", "Unknown"),
            "type": client_type,
            "whitelisted_instruments": whitelisted
        }
        if client_type == "live" and broker:
            clients[chat_id]["broker"] = broker

        with open("clients.json", "w") as f:
            json.dump(clients, f, indent=2)

        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/clients/delete", methods=["POST"])
def delete_client():
    """Remove a client from active or pending lists."""
    try:
        data = request.get_json(force=True)
        chat_id = str(data.get("chat_id", ""))

        if not chat_id:
            return jsonify({"status": "error", "message": "Missing Chat ID"}), 400

        # Remove from active
        clients = {}
        if os.path.exists("clients.json"):
            with open("clients.json") as f:
                clients = json.load(f)
            if chat_id in clients:
                del clients[chat_id]
                with open("clients.json", "w") as f:
                    json.dump(clients, f, indent=2)

        # Remove from pending
        pending = {}
        if os.path.exists("pending_clients.json"):
            with open("pending_clients.json") as f:
                pending = json.load(f)
            if chat_id in pending:
                del pending[chat_id]
                with open("pending_clients.json", "w") as f:
                    json.dump(pending, f, indent=2)

        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route("/api/alerts/tradingview", methods=["POST"])
def tradingview_alert():
    """Receive signal from TradingView alert email parser."""
    try:
        data = request.get_json(force=True)
        symbol = str(data.get("instrument", "")).upper().strip()
        price = float(data.get("price", 0))
        high = float(data.get("high", 0))
        low = float(data.get("low", 0))
        c_time = str(data.get("candle_time", "")).strip()
        c_date = str(data.get("candle_date", datetime.now(IST).strftime("%d %b %Y"))).strip()

        if not symbol or not price or not high or not low or not c_time:
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        # Check if symbol is US/Crypto or Indian
        is_us = symbol in ["XAGUSD", "XAUUSD", "OILUSD", "CUCUSD", "BTCUSD"]
        
        # Calculate brackets
        tick = {
            "XAGUSD": 0.005,
            "XAUUSD": 0.10,
            "OILUSD": 0.01,
            "CUCUSD": 0.0005,
            "BTCUSD": 1.0
        }.get(symbol, 0.05) if is_us else 0.05
        
        dec_places = len(str(tick).split('.')[1]) if '.' in str(tick) else 2
        
        b_entry = round(high + tick, dec_places)
        s_entry = round(low - tick, dec_places)
        b_sl = float(low)
        s_sl = float(high)
        
        buy_target = round(b_entry * 1.01, dec_places)
        sell_target = round(s_entry * 0.99, dec_places)

        signal = {
            "instrument": symbol,
            "price": price,
            "high": high,
            "low": low,
            "candle_date": c_date,
            "candle_time": c_time,
            "detected_at": datetime.now(IST).isoformat(),
            "screenshot": "screenshots/TV_ALERT_EMAIL.png",
            "confidence": "high",
            "spread_pct": round(((high - low) / price) * 100, 3),
            "buy_entry": b_entry,
            "buy_target": buy_target,
            "buy_pyramid": buy_target,
            "buy_stop_loss": b_sl,
            "sell_entry": s_entry,
            "sell_target": sell_target,
            "sell_pyramid": sell_target,
            "sell_stop_loss": s_sl
        }

        # Save to correct database
        db_path = "us_signals.json" if is_us else "signals.json"
        signals = []
        if os.path.exists(db_path):
            try:
                with open(db_path, "r") as f:
                    signals = json.load(f)
            except Exception:
                pass
                
        # Remove existing duplicates on date AND time to prevent duplicate entry
        signals = [s for s in signals if not (s.get("instrument") == symbol and s.get("candle_date") == c_date and s.get("candle_time") == c_time)]
        signals.append(signal)
        
        with open(db_path, "w") as f:
            json.dump(signals, f, indent=2)
            
        logger.info(f"Successfully processed TradingView alert for {symbol} at {c_time}")

        # Send Telegram notification
        from telegram_bot import format_signal_message, send_message
        msg = format_signal_message(signal)
        send_message(msg)

        # Trigger simulation replay in background
        replay_script = "us_replay_today.py" if is_us else "replay_today.py"
        try:
            subprocess.Popen(["python3.11", replay_script])
            logger.info(f"Triggered background replay of {replay_script}")
        except Exception as re:
            logger.error(f"Failed to start background replay: {re}")

        return jsonify({"status": "ok"}), 200

    except Exception as e:
        logger.error(f"TradingView alert error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/logs", methods=["GET"])
def get_system_logs():
    import re
    log_file = "/home/investo/bluecandle/bluecandle.log"
    if not os.path.exists(log_file):
        log_file = "bluecandle.log"
    
    if not os.path.exists(log_file):
        return jsonify([])
        
    try:
        with open(log_file, "r") as f:
            lines = f.readlines()[-150:]
            
        parsed_logs = []
        for line in lines:
            if not line.strip():
                continue
            match = re.match(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:,\d+)?\s+(?:\[)?(INFO|WARNING|ERROR|DEBUG)(?:\])?\s+(.*)$", line)
            if match:
                parsed_logs.append({
                    "timestamp": match.group(1),
                    "level": match.group(2),
                    "message": match.group(3).strip()
                })
            else:
                parsed_logs.append({
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "level": "INFO",
                    "message": line.strip()
                })
        return jsonify(parsed_logs)
    except Exception as e:
        return jsonify([{"timestamp": "", "level": "ERROR", "message": f"Error reading log file: {str(e)}"}]), 500


@app.route("/", methods=["GET"])
def index():
    return jsonify({"service": "investorbabu.com API", "status": "running"}), 200


if __name__ == "__main__":
    logger.info("Starting Bluecandle Postback Server on port 5000...")
    # Set webhook on startup
    import requests
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if token and "YOUR_" not in token:
        try:
            url = "https://api.investorbabu.com/telegram/webhook"
            requests.post(f"https://api.telegram.org/bot{token}/setWebhook?url={url}", timeout=10)
            logger.info(f"Telegram Webhook configured successfully to {url}")
        except Exception as we:
            logger.error(f"Failed to configure Telegram Webhook: {we}")
            
    app.run(host="0.0.0.0", port=5000, debug=False)
