#!/bin/bash
# Start MT5 HTTP bridge (Mac/Linux with Wine, or standalone zip extract)
set -e

BRIDGE_ROOT="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_DIR="$BRIDGE_ROOT/mt5-commands"
RESPONSES_DIR="$BRIDGE_ROOT/mt5-responses"
CONNECTOR="$BRIDGE_ROOT/wine-mt5-connector.py"

echo "🚀 Starting Wine-Compatible MT5 HTTP Bridge..."
echo "📂 Bridge folder: $BRIDGE_ROOT"
echo ""

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.10+ from python.org"
    exit 1
fi

if [ ! -f "$CONNECTOR" ]; then
    echo "❌ Missing wine-mt5-connector.py in: $BRIDGE_ROOT"
    echo ""
    echo "You need the FULL bridge zip (not just this script)."
    echo "  1. Download tradeintel-bridge.zip from the dashboard"
    echo "  2. Unzip into a folder (e.g. ~/tradeintel-bridge)"
    echo "  3. cd into that folder and run: ./start-wine-bridge.sh"
    echo ""
    echo "Or use: ./colleague/start_colleague_bridge.sh"
    exit 1
fi

if [ ! -L "$COMMANDS_DIR" ] && [ ! -L "$RESPONSES_DIR" ]; then
    echo "⚠️  WARNING: No symlinks found to MT5 Files folder!"
    echo ""
    echo "The bridge needs to write to MT5's Files folder for the EA to read commands."
    echo "Run this from the bridge folder:"
    echo "  ./configure-paths.sh"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Starting Wine MT5 bridge server..."
echo "💡 This bridge uses file-based communication with MT5 Expert Advisor"
echo "📁 Commands directory: $COMMANDS_DIR"
echo "📁 Responses directory: $RESPONSES_DIR"
echo ""

cd "$BRIDGE_ROOT"
export MT5_BRIDGE_ROOT="$BRIDGE_ROOT"
python3 "$CONNECTOR"

