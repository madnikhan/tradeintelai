#!/bin/bash

# Start MT5 HTTP Bridge
# This script starts the Python bridge server in the background

cd "$(dirname "$0")/mt5-bridge"

echo "🚀 Starting MT5 HTTP Bridge..."
echo "📁 Working directory: $(pwd)"

# Kill any existing bridge process
pkill -f wine-mt5-connector.py 2>/dev/null
sleep 1

# Start the bridge
python3 wine-mt5-connector.py > bridge.log 2>&1 &
BRIDGE_PID=$!

echo "✅ Bridge started with PID: $BRIDGE_PID"
echo "📝 Logs: mt5-bridge/bridge.log"
echo ""
echo "To stop the bridge, run: pkill -f wine-mt5-connector.py"
echo "Or kill PID: $BRIDGE_PID"
echo ""
echo "Waiting 3 seconds to verify bridge is running..."
sleep 3

# Test if bridge is responding
if curl -s -m 2 http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Bridge is responding on http://localhost:8080"
else
    echo "⚠️  Bridge may not be responding. Check logs: mt5-bridge/bridge.log"
fi

