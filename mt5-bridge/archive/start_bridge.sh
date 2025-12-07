#!/bin/bash
echo "🚀 Starting AI Trading System MT5 Bridge..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install it first."
    exit 1
fi

# Check if required Python packages are installed
if ! python3 -c "import zmq" &> /dev/null; then
    echo "📦 Installing required Python packages..."
    pip3 install pyzmq
fi

echo "✅ Starting ZeroMQ bridge server..."
cd "$(dirname "$0")"
python3 zmq_server.py

