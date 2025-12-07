#!/bin/bash
# Interactive script to configure MT5 Files directory paths

echo "🔧 MT5 Bridge Path Configuration"
echo "=================================="
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/mt5-commands"
RESPONSES_DIR="$PROJECT_ROOT/mt5-responses"

echo "This script will help you connect the bridge to MT5's Files folder."
echo ""
echo "To find your MT5 Files folder:"
echo "1. Open MT5 terminal"
echo "2. Go to: File → Open Data Folder"
echo "3. Navigate to: MQL5 → Files"
echo "4. Copy the full path shown in the address bar"
echo ""

read -p "Enter the full path to MT5 Files folder (or press Enter to skip): " MT5_FILES_PATH

if [ -z "$MT5_FILES_PATH" ]; then
    echo "⚠️  Skipping configuration. Bridge will use project directory."
    echo "   Make sure to create symlinks manually if needed."
    exit 0
fi

# Validate path
if [ ! -d "$MT5_FILES_PATH" ]; then
    echo "❌ Error: Directory does not exist: $MT5_FILES_PATH"
    exit 1
fi

echo ""
echo "✅ Found MT5 Files directory: $MT5_FILES_PATH"
echo ""

# Create directories in MT5 Files folder
mkdir -p "$MT5_FILES_PATH/mt5-commands"
mkdir -p "$MT5_FILES_PATH/mt5-responses"

# Remove existing symlinks/directories
if [ -L "$COMMANDS_DIR" ] || [ -d "$COMMANDS_DIR" ]; then
    echo "⚠️  Removing existing $COMMANDS_DIR"
    rm -rf "$COMMANDS_DIR"
fi

if [ -L "$RESPONSES_DIR" ] || [ -d "$RESPONSES_DIR" ]; then
    echo "⚠️  Removing existing $RESPONSES_DIR"
    rm -rf "$RESPONSES_DIR"
fi

# Create symlinks
echo "🔗 Creating symlinks..."
ln -s "$MT5_FILES_PATH/mt5-commands" "$COMMANDS_DIR"
ln -s "$MT5_FILES_PATH/mt5-responses" "$RESPONSES_DIR"

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Symlinks created:"
echo "  $COMMANDS_DIR -> $MT5_FILES_PATH/mt5-commands"
echo "  $RESPONSES_DIR -> $MT5_FILES_PATH/mt5-responses"
echo ""
echo "📝 Next steps:"
echo "1. Make sure MT5FileBridgeEA is running in MT5"
echo "2. Restart the bridge: ./mt5-bridge/start-wine-bridge.sh"
echo "3. Test the connection from the dashboard"

