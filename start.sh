#!/bin/bash
source ~/.bashrc
cd /home/investo/bluecandle

echo "Stopping existing processes..."
pkill -f "python3.*main.py" 2>/dev/null
pkill -f "postback_server.py" 2>/dev/null
pkill -f "simulation_tracker.py" 2>/dev/null

for i in {1..10}; do
    RUNNING=$(ps aux | grep -E "main.py|postback_server|simulation_tracker" | grep -v grep | wc -l)
    if [ "$RUNNING" -eq 0 ]; then
        echo "All processes stopped."
        break
    fi
    echo "Waiting... ($i/10)"
    sleep 2
done

pkill -9 -f "python3.*main.py" 2>/dev/null
pkill -9 -f "postback_server.py" 2>/dev/null
pkill -9 -f "simulation_tracker.py" 2>/dev/null
sleep 1

echo "Starting postback server..."
nohup python3.11 postback_server.py >> postback.log 2>&1 &
POSTBACK_PID=$!
sleep 2

if ps -p $POSTBACK_PID > /dev/null 2>&1; then
    echo "Postback server started (PID: $POSTBACK_PID)"
else
    echo "WARNING: Postback server failed to start!"
fi

echo "Starting scanner..."
nohup python3.11 main.py >> bluecandle.log 2>&1 &
SCANNER_PID=$!
sleep 2

if ps -p $SCANNER_PID > /dev/null 2>&1; then
    echo "Scanner started (PID: $SCANNER_PID)"
else
    echo "WARNING: Scanner failed to start!"
fi

echo "Starting real-time simulation tracker..."
nohup python3.11 simulation_tracker.py >> simulation_tracker.log 2>&1 &
SIM_TRACKER_PID=$!
sleep 2

if ps -p $SIM_TRACKER_PID > /dev/null 2>&1; then
    echo "Simulation tracker started (PID: $SIM_TRACKER_PID)"
else
    echo "WARNING: Simulation tracker failed to start!"
fi

echo ""
echo "All services running successfully."
echo "Watch logs: bash logs.sh"
echo "Stop:       bash stop.sh"
