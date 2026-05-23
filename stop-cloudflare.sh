#!/bin/bash
# Stop Cloudflare Tunnels

echo "🛑 Stopping Cloudflare Tunnels..."

# Kill all cloudflared processes
pkill -f cloudflared

if [ $? -eq 0 ]; then
    echo "✅ Cloudflare tunnels stopped"
else
    echo "⚠️  No cloudflared processes found"
fi

# Clean up PID file if exists
if [ -f logs/cloudflare-pids.txt ]; then
    rm logs/cloudflare-pids.txt
    echo "✅ Cleaned up PID file"
fi

