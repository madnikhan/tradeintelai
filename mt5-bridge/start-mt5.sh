#!/bin/bash
# Start script for MT5 in Docker container

set -e

echo "🚀 Starting MT5 for account ${ACCOUNT_LOGIN}..."

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99

# Wait for Xvfb to start
sleep 2

# Start window manager (optional, for GUI)
fluxbox > /dev/null 2>&1 &

# Set up Wine prefix
export WINEPREFIX=/root/.wine
export WINEARCH=win64

# Start MT5 terminal
echo "📱 Launching MT5 Terminal..."
wine "C:\Program Files\MetaTrader 5\terminal64.exe" /portable /config:${ACCOUNT_LOGIN} &

# Wait for MT5 to start
sleep 5

# Attach EA (this would need to be automated via MQL5 or script)
echo "🤖 Attaching EA..."
# TODO: Implement EA attachment automation

# Keep container running
echo "✅ MT5 started for account ${ACCOUNT_LOGIN}"
echo "📊 Monitoring..."

# Keep script running
tail -f /dev/null

