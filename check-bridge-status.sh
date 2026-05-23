#!/bin/bash
# Check MT5 Bridge Status and Diagnose Issues

echo "🔍 MT5 Bridge Status Check"
echo "=========================="
echo ""

# Check 1: Is bridge process running?
echo "1️⃣ Checking bridge process..."
BRIDGE_PID=$(lsof -ti:8080 2>/dev/null)
if [ -n "$BRIDGE_PID" ]; then
    echo "   ✅ Bridge is running (PID: $BRIDGE_PID)"
else
    echo "   ❌ Bridge is NOT running on port 8080"
    echo "   💡 Start it with: npm run bridge"
    exit 1
fi

# Check 2: Is bridge responding?
echo ""
echo "2️⃣ Checking bridge health endpoint..."
HEALTH=$(curl -s http://localhost:8080/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    echo "   ✅ Bridge health check: $HEALTH"
    MT5_CONNECTED=$(echo $HEALTH | grep -o '"mt5_connected":[^,}]*' | cut -d: -f2)
    if [ "$MT5_CONNECTED" = "true" ]; then
        echo "   ✅ MT5 EA is connected!"
    else
        echo "   ⚠️  MT5 EA is NOT connected (mt5_connected: false)"
    fi
else
    echo "   ❌ Bridge is not responding"
    exit 1
fi

# Check 3: Test account endpoint
echo ""
echo "3️⃣ Testing account endpoint..."
ACCOUNT_RESPONSE=$(curl -s http://localhost:8080/account 2>/dev/null)
if echo "$ACCOUNT_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$ACCOUNT_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "   ⚠️  Account endpoint error: $ERROR_MSG"
else
    echo "   ✅ Account endpoint responding"
    echo "$ACCOUNT_RESPONSE" | python3 -m json.tool 2>/dev/null | head -10
fi

# Check 4: Check command/response directories
    echo ""
echo "4️⃣ Checking file directories..."
COMMANDS_DIR="/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands"
RESPONSES_DIR="/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-responses"

if [ -d "$COMMANDS_DIR" ]; then
    CMD_COUNT=$(ls -1 "$COMMANDS_DIR" 2>/dev/null | wc -l | tr -d ' ')
    echo "   📁 Commands directory: $COMMANDS_DIR"
    echo "   📊 Commands files: $CMD_COUNT"
    if [ "$CMD_COUNT" -eq 0 ]; then
        echo "   ⚠️  No command files found (EA might not be processing)"
    fi
else
    echo "   ❌ Commands directory not found: $COMMANDS_DIR"
fi

if [ -d "$RESPONSES_DIR" ]; then
    RESP_COUNT=$(ls -1 "$RESPONSES_DIR" 2>/dev/null | wc -l | tr -d ' ')
    echo "   📁 Responses directory: $RESPONSES_DIR"
    echo "   📊 Response files: $RESP_COUNT"
    if [ "$RESP_COUNT" -gt 0 ]; then
        LATEST_RESP=$(ls -t "$RESPONSES_DIR" 2>/dev/null | head -1)
        RESP_AGE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$RESPONSES_DIR/$LATEST_RESP" 2>/dev/null || echo "unknown")
        echo "   📅 Latest response: $LATEST_RESP (created: $RESP_AGE)"
    fi
else
    echo "   ❌ Responses directory not found: $RESPONSES_DIR"
fi

# Check 5: Check if EA is attached
echo ""
echo "5️⃣ EA Status Check..."
echo "   💡 To check if EA is attached:"
echo "   1. Open MT5 Terminal"
echo "   2. Go to View → Toolbox → Experts tab"
echo "   3. Look for 'MT5FileBridgeEA' with ✅ icon"
echo "   4. Check for initialization messages"
echo ""
echo "   If EA is not attached:"
echo "   1. Open any chart (e.g., EURUSD H1)"
echo "   2. Drag 'MT5FileBridgeEA' from Navigator onto chart"
echo "   3. Enable 'Allow live trading' checkbox"
echo "   4. Click OK"

echo ""
echo "=========================="
echo "✅ Status check complete!"
