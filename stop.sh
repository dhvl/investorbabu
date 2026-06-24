#!/bin/bash
pkill -f "python3.*main.py" 2>/dev/null && echo "Scanner stopped." || echo "Scanner was not running."
pkill -f "postback_server.py" 2>/dev/null && echo "Postback server stopped." || echo "Postback server was not running."
pkill -f "simulation_tracker.py" 2>/dev/null && echo "Simulation tracker stopped." || echo "Simulation tracker was not running."
pkill -f "us_simulation_tracker.py" 2>/dev/null && echo "US simulation tracker stopped." || echo "US simulation tracker was not running."
pkill -f "eashaan_simulation_tracker.py" 2>/dev/null && echo "Eashaan simulation tracker stopped." || echo "Eashaan simulation tracker was not running."
pkill -f "email_alert_listener.py" 2>/dev/null && echo "Email listener stopped." || echo "Email listener was not running."

