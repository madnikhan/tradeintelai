#!/bin/bash
# Script to find MT5 Files directory and create symlink

echo "🔍 Searching for MT5 Files directory..."

# Try common Wine paths
HOME_DIR="$HOME"
WINE_PATHS=(
    "$HOME_DIR/.wine/drive_c/users/$USER/AppData/Roaming/MetaQuotes/Terminal"
    "$HOME_DIR/.wine/drive_c/Users/$USER/AppData/Roaming/MetaQuotes/Terminal"
    "$HOME_DIR/.wine/drive_c/users/$(whoami)/AppData/Roaming/MetaQuotes/Terminal"
    "$HOME_DIR/.wine/drive_c/Users/$(whoami)/AppData/Roaming/MetaQuotes/Terminal"
)

MT5_FILES_DIR=""

for wine_base in "${WINE_PATHS[@]}"; do
    if [ -d "$wine_base" ]; then
        echo "📁 Found MetaQuotes Terminal directory: $wine_base"
        
        # Look for MQL5/Files in each terminal directory
        for terminal_dir in "$wine_base"/*; do
            if [ -d "$terminal_dir" ]; then
                mql5_files="$terminal_dir/MQL5/Files"
                if [ -d "$mql5_files" ]; then
                    MT5_FILES_DIR="$mql5_files"
                    echo "✅ Found MT5 Files directory: $MT5_FILES_DIR"
                    break 2
                fi
            fi
        done
    fi
done

if [ -z "$MT5_FILES_DIR" ]; then
    echo "❌ Could not find MT5 Files directory automatically"
    echo ""
    echo "Please find it manually:"
    echo "1. Open MT5 terminal"
    echo "2. Go to: File → Open Data Folder"
    echo "3. Navigate to: MQL5 → Files"
    echo "4. Copy the full path"
    echo ""
    echo "Then create symlinks manually:"
    echo "  ln -s \"<MT5_FILES_PATH>/mt5-commands\" ./mt5-commands"
    echo "  ln -s \"<MT5_FILES_PATH>/mt5-responses\" ./mt5-responses"
    exit 1
fi

# Get project root (parent of mt5-bridge)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/mt5-commands"
RESPONSES_DIR="$PROJECT_ROOT/mt5-responses"

# Create directories in MT5 Files folder
mkdir -p "$MT5_FILES_DIR/mt5-commands"
mkdir -p "$MT5_FILES_DIR/mt5-responses"

# Remove existing symlinks/directories if they exist
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
ln -s "$MT5_FILES_DIR/mt5-commands" "$COMMANDS_DIR"
ln -s "$MT5_FILES_DIR/mt5-responses" "$RESPONSES_DIR"

echo "✅ Symlinks created:"
echo "   $COMMANDS_DIR -> $MT5_FILES_DIR/mt5-commands"
echo "   $RESPONSES_DIR -> $MT5_FILES_DIR/mt5-responses"
echo ""
echo "📝 The bridge will now write to MT5 Files folder, and EA can read from it!"

