# config.py — Bluecandle Signal Detector settings

import os
from dotenv import load_dotenv
load_dotenv()

# ── TradingView ───────────────────────────────────────────────
TV_USERNAME      = os.getenv("TV_USERNAME")
TV_PASSWORD      = os.getenv("TV_PASSWORD")
TV_CHART_URL     = os.getenv("TV_CHART_URL", "https://www.tradingview.com/chart/F74VLK7x/")
TV_CHART_URL_US  = os.getenv("TV_CHART_URL_US", "https://www.tradingview.com/chart/4WoNWanm/")

# ── Telegram ──────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID")

# ── Anthropic ─────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

def load_instruments():
    import json
    path = os.path.join(os.path.dirname(__file__), 'instruments.json')
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}

INSTRUMENTS = load_instruments()

def reload_instruments():
    global INSTRUMENTS
    loaded = load_instruments()
    if loaded:
        INSTRUMENTS.clear()
        INSTRUMENTS.update(loaded)

# ── Scan Settings ─────────────────────────────────────────────
SCAN_INTERVAL_MINUTES = int(os.getenv("SCAN_INTERVAL_MINUTES", 15))
MAX_SPREAD_PCT        = float(os.getenv("MAX_SPREAD_PCT", 0.8))
SIGNAL_EXPIRY_HOURS   = int(os.getenv("SIGNAL_EXPIRY_HOURS", 2))

# ── Market Hours (IST) ────────────────────────────────────────
MARKET_START_HOUR    = int(os.getenv("MARKET_START_HOUR", 9))
MARKET_START_MINUTE  = int(os.getenv("MARKET_START_MINUTE", 15))
MARKET_END_HOUR      = int(os.getenv("MARKET_END_HOUR", 15))
MARKET_END_MINUTE    = int(os.getenv("MARKET_END_MINUTE", 30))

# ── Paths ─────────────────────────────────────────────────────
SCREENSHOTS_DIR  = "screenshots"
SIGNALS_LOG      = "signals.json"
STATE_FILE       = "state.json"    # Tracks last seen Blue Candle per instrument
