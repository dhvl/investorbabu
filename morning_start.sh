#!/bin/bash
clear
echo ""
echo "============================================="
echo "  BLUECANDLE SCANNER - DAILY STARTUP (IN + US)"
echo "============================================="
echo ""

# Dynamically find the script's directory
BLUECANDLE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VPS_USER="root"
VPS_HOST="160.250.204.141"
VPS_PORT="22"

cd "$BLUECANDLE_DIR"

echo "[1/4] Exporting TradingView session for India..."
python3 export_cookies.py
echo "[OK] Indian cookies exported."
echo ""

echo "[2/4] Copying sessions to VPS..."
scp -P "$VPS_PORT" cookies.json storage_state.json "$VPS_USER@$VPS_HOST:/home/investo/bluecandle/"
echo "[OK] Indian session files copied to VPS."
echo ""

echo "[3/4] Restarting scanner on VPS..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "source ~/.bashrc && cd /home/investo/bluecandle && bash stop.sh && bash start.sh"
echo ""
echo "ALL DONE! Scanner is running."

