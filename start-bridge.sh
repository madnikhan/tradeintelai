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
echo "Waiting 5 seconds for bridge to initialize..."
sleep 5

# Test if bridge is responding (retry a few times; bridge can be busy during MT5 connector init)
BRIDGE_OK=0
for i in 1 2 3; do
    if curl -s -m 5 http://localhost:8080/health > /dev/null 2>&1; then
        BRIDGE_OK=1
        break
    fi
    [ $i -lt 3 ] && sleep 2
done
if [ "$BRIDGE_OK" = 1 ]; then
    echo "✅ Bridge is responding on http://localhost:8080"
else
    echo "⚠️  Bridge may not be responding. Check logs: mt5-bridge/bridge.log"
fi

