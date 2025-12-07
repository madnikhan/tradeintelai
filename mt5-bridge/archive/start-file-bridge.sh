#!/bin/bash
echo "🚀 Starting MT5 File Bridge..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install it first."
    exit 1
fi

echo "✅ Starting file bridge server..."
cd "$(dirname "$0")"
python3 file-bridge.py

