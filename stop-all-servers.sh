#!/bin/bash
# Stop all servers (Next.js, MT5 bridge, ngrok)

echo "🛑 Stopping all servers..."
echo ""

# Stop Next.js (port 3000)
echo "1. Stopping Next.js (port 3000)..."
PID_3000=$(lsof -ti:3000 2>/dev/null)
if [ -n "$PID_3000" ]; then
    kill -9 $PID_3000 2>/dev/null
    echo "   ✅ Next.js stopped (PID: $PID_3000)"
else
    echo "   ℹ️  Next.js not running"
fi

# Also kill by process name
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "node.*3000" 2>/dev/null

# Stop MT5 bridge (port 8080)
echo ""
echo "2. Stopping MT5 bridge (port 8080)..."
PID_8080=$(lsof -ti:8080 2>/dev/null)
if [ -n "$PID_8080" ]; then
    kill -9 $PID_8080 2>/dev/null
    echo "   ✅ MT5 bridge stopped (PID: $PID_8080)"
else
    echo "   ℹ️  MT5 bridge not running"
fi

# Stop ngrok
echo ""
echo "3. Stopping ngrok processes..."
if pgrep -f ngrok >/dev/null 2>&1; then
    pkill -f ngrok 2>/dev/null
    echo "   ✅ ngrok stopped"
else
    echo "   ℹ️  ngrok not running"
fi

# Verify
echo ""
echo "4. Verifying all servers are stopped..."
echo ""

PORT_3000=$(lsof -ti:3000 2>/dev/null)
PORT_8080=$(lsof -ti:8080 2>/dev/null)
NGROK=$(pgrep -f ngrok 2>/dev/null)

if [ -z "$PORT_3000" ] && [ -z "$PORT_8080" ] && [ -z "$NGROK" ]; then
    echo "   ✅ All servers stopped successfully!"
else
    echo "   ⚠️  Some processes may still be running:"
    [ -n "$PORT_3000" ] && echo "   - Port 3000: PID $PORT_3000"
    [ -n "$PORT_8080" ] && echo "   - Port 8080: PID $PORT_8080"
    [ -n "$NGROK" ] && echo "   - ngrok: PID $NGROK"
fi

echo ""
echo "✅ Done!"

