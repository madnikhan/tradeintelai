#!/bin/bash
echo "🚀 Starting Wine-Compatible MT5 HTTP Bridge..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install it first."
    exit 1
fi

# Check if symlinks exist
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/mt5-commands"
RESPONSES_DIR="$PROJECT_ROOT/mt5-responses"

if [ ! -L "$COMMANDS_DIR" ] && [ ! -L "$RESPONSES_DIR" ]; then
    echo "⚠️  WARNING: No symlinks found to MT5 Files folder!"
    echo ""
    echo "The bridge needs to write to MT5's Files folder for the EA to read commands."
    echo "Run this to configure paths:"
    echo "  ./mt5-bridge/configure-paths.sh"
    echo ""
    echo "Or see: mt5-bridge/QUICK_FIX.md for instructions"
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

cd "$(dirname "$0")"
python3 wine-mt5-connector.py

