#!/bin/bash

# Start MT5 WebSocket Server
# This script starts the WebSocket server for real-time MT5 connectivity

echo "🚀 Starting MT5 WebSocket Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if TypeScript is installed
if ! command -v tsx &> /dev/null && ! command -v ts-node &> /dev/null; then
    echo "📦 Installing TypeScript execution tools..."
    npm install -g tsx
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Start WebSocket server
cd "$PROJECT_ROOT"

echo "📡 Starting WebSocket server on port 8081 (HTTP bridge stays on 8080)..."
echo "   WebSocket URL: ws://localhost:8081/mt5-ws"
export WS_PORT=8081
export BRIDGE_HTTP_URL=http://localhost:8080
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the WebSocket server
if command -v tsx &> /dev/null; then
    tsx mt5-bridge/websocket-server.ts
elif command -v ts-node &> /dev/null; then
    ts-node mt5-bridge/websocket-server.ts
else
    echo "❌ TypeScript execution tool not found. Please install tsx or ts-node."
    exit 1
fi
