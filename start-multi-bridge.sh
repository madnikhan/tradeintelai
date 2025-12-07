#!/bin/bash

# Start Multi-Bridge Manager for 50+ MT5 Accounts
# This script manages multiple bridge instances, one per account

echo "🚀 Starting Multi-Bridge Manager..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Navigate to bridge directory
cd "$(dirname "$0")/mt5-bridge" || exit 1

# Check if manager is already running
if pgrep -f "multi-bridge-manager.py" > /dev/null; then
    echo "⚠️  Multi-Bridge Manager is already running"
    echo "   To restart, run: pkill -f multi-bridge-manager.py"
    exit 1
fi

# Start Multi-Bridge Manager
# You can specify accounts to start: --accounts 123456 789012 345678
python3 multi-bridge-manager.py \
    --port 8079 \
    --config bridge-config.json \
    > multi-bridge-manager.log 2>&1 &

MANAGER_PID=$!

# Wait a moment for manager to start
sleep 2

# Check if manager started successfully
if ps -p $MANAGER_PID > /dev/null; then
    echo "✅ Multi-Bridge Manager started (PID: $MANAGER_PID)"
    echo "   Manager API: http://localhost:8079"
    echo "   Log file: mt5-bridge/multi-bridge-manager.log"
else
    echo "❌ Failed to start Multi-Bridge Manager"
    exit 1
fi

# Start Bridge Router (optional - provides single entry point)
if [ "$1" != "--no-router" ]; then
    echo ""
    echo "🚀 Starting Bridge Router..."
    
    python3 bridge-router.py \
        --port 8080 \
        --manager http://localhost:8079 \
        > bridge-router.log 2>&1 &
    
    ROUTER_PID=$!
    sleep 1
    
    if ps -p $ROUTER_PID > /dev/null; then
        echo "✅ Bridge Router started (PID: $ROUTER_PID)"
        echo "   Router API: http://localhost:8080 (frontend connects here)"
        echo "   Log file: mt5-bridge/bridge-router.log"
    else
        echo "⚠️  Bridge Router failed to start (you can still use individual bridges)"
    fi
fi

echo ""
echo "📊 To add accounts, use the Manager API:"
echo "   curl -X POST http://localhost:8079/account/123456/add"
echo ""
echo "📊 To check status:"
echo "   curl http://localhost:8079/status"
echo ""
echo "🛑 To stop:"
echo "   pkill -f multi-bridge-manager.py"
echo "   pkill -f bridge-router.py"

