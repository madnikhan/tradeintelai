#!/bin/bash
# Script to set up symlinks for MT5 bridge

echo "🔗 MT5 Bridge Symlink Setup"
echo "============================"
echo ""

# Get the Windows path from user
read -p "Enter the MT5 Files folder path (Windows format, e.g., C:\\Program Files\\MetaTrader 5\\MQL5\\Files): " WINDOWS_PATH

if [ -z "$WINDOWS_PATH" ]; then
    echo "❌ No path provided. Exiting."
    exit 1
fi

# Convert Windows path to Mac/Wine path
# Replace C:\ with ~/.wine/drive_c/
# Replace backslashes with forward slashes
MAC_PATH=$(echo "$WINDOWS_PATH" | sed 's|^C:\\|~/.wine/drive_c/|' | sed 's|\\|/|g')
MAC_PATH=$(eval echo "$MAC_PATH")  # Expand ~

echo ""
echo "📁 Windows path: $WINDOWS_PATH"
echo "📁 Mac path: $MAC_PATH"
echo ""

# Check if path exists
if [ ! -d "$MAC_PATH" ]; then
    echo "❌ Path does not exist: $MAC_PATH"
    echo ""
    echo "Please verify:"
    echo "1. MT5 is installed and running"
    echo "2. The path is correct"
    echo "3. Try opening the folder in Finder to verify it exists"
    echo ""
    echo "Alternative: Find the path manually:"
    echo "  find ~/.wine -type d -name 'Files' | grep MQL5"
    exit 1
fi

echo "✅ Path exists!"
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/mt5-commands"
RESPONSES_DIR="$PROJECT_ROOT/mt5-responses"

# Create directories in MT5 Files folder
echo "📁 Creating directories in MT5 Files folder..."
mkdir -p "$MAC_PATH/mt5-commands"
mkdir -p "$MAC_PATH/mt5-responses"
echo "✅ Directories created"
echo ""

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
ln -s "$MAC_PATH/mt5-commands" "$COMMANDS_DIR"
ln -s "$MAC_PATH/mt5-responses" "$RESPONSES_DIR"

echo ""
echo "✅ Symlinks created!"
echo ""
echo "Verification:"
ls -la "$COMMANDS_DIR" "$RESPONSES_DIR"
echo ""
echo "📝 Next steps:"
echo "1. Make sure MT5FileBridgeEA is attached to a chart in MT5"
echo "2. Restart the bridge: kill \$(lsof -ti :8080) && ./mt5-bridge/start-wine-bridge.sh"
echo "3. Test: curl http://localhost:8080/account"

