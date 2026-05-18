#!/bin/bash
pkill -f "python3.*main.py" 2>/dev/null && echo "Scanner stopped." || echo "Scanner was not running."
pkill -f "postback_server.py" 2>/dev/null && echo "Postback server stopped." || echo "Postback server was not running."
pkill -f "simulation_tracker.py" 2>/dev/null && echo "Simulation tracker stopped." || echo "Simulation tracker was not running."
