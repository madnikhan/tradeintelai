#!/bin/bash
# Kill process on port 3000 (macOS compatible)

echo "🔍 Finding process on port 3000..."

# Get PID using lsof
PID=$(lsof -ti:3000 2>/dev/null)

if [ -z "$PID" ]; then
    echo "✅ Port 3000 is already free"
    exit 0
fi

echo "Found process: PID $PID"

# Try to kill it
echo "🛑 Killing process $PID..."
kill -9 $PID 2>/dev/null

# Wait a moment
sleep 1

# Verify
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Process still running, trying sudo..."
    sudo kill -9 $PID 2>/dev/null
    sleep 1
fi

# Final check
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Failed to kill process. Try manually:"
    echo "   sudo kill -9 $PID"
    exit 1
else
    echo "✅ Port 3000 is now free"
fi

