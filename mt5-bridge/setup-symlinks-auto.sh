#!/bin/bash
# Auto-detect and set up MT5 Files symlinks

echo "🔍 Auto-detecting MT5 Files directory..."
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/mt5-commands"
RESPONSES_DIR="$PROJECT_ROOT/mt5-responses"

# Try common locations
POSSIBLE_PATHS=(
    "$HOME/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Files"
    "$HOME/.wine/drive_c/Program Files (x86)/MetaTrader 5/MQL5/Files"
    "$HOME/.wine/drive_c/users/$USER/AppData/Roaming/MetaQuotes/Terminal"
    "$HOME/.wine/drive_c/Users/$USER/AppData/Roaming/MetaQuotes/Terminal"
)

MT5_FILES_PATH=""

# Search for MQL5/Files in common locations
for base_path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$base_path" ]; then
        # If it's the Terminal directory, look for subdirectories
        if [[ "$base_path" == *"Terminal"* ]]; then
            for terminal_dir in "$base_path"/*; do
                if [ -d "$terminal_dir" ]; then
                    files_path="$terminal_dir/MQL5/Files"
                    if [ -d "$files_path" ]; then
                        MT5_FILES_PATH="$files_path"
                        break 2
                    fi
                fi
            done
        else
            # Direct path
            if [ -d "$base_path" ]; then
                MT5_FILES_PATH="$base_path"
                break
            fi
        fi
    fi
done

# If not found, try find command
if [ -z "$MT5_FILES_PATH" ]; then
    echo "Searching more broadly..."
    MT5_FILES_PATH=$(find ~/.wine -type d -path "*/MQL5/Files" 2>/dev/null | head -1)
fi

if [ -z "$MT5_FILES_PATH" ]; then
    echo "❌ Could not find MT5 Files directory automatically"
    echo ""
    echo "Please provide the path manually:"
    echo "1. In MT5: File → Open Data Folder"
    echo "2. Navigate to: MQL5 → Files"
    echo "3. Copy the path from address bar"
    echo ""
    echo "Then run:"
    echo "  ./mt5-bridge/configure-paths.sh"
    echo ""
    echo "Or create symlinks manually:"
    echo "  ln -s \"<MT5_FILES_PATH>/mt5-commands\" ./mt5-commands"
    echo "  ln -s \"<MT5_FILES_PATH>/mt5-responses\" ./mt5-responses"
    exit 1
fi

echo "✅ Found MT5 Files directory: $MT5_FILES_PATH"
echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p "$MT5_FILES_PATH/mt5-commands"
mkdir -p "$MT5_FILES_PATH/mt5-responses"
echo "✅ Directories created"
echo ""

# Remove existing
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
echo "✅ Symlinks created!"
echo ""
echo "Verification:"
ls -la "$COMMANDS_DIR" "$RESPONSES_DIR"
echo ""
echo "📝 The bridge will now write to: $MT5_FILES_PATH"
echo "📝 And the EA will read from the same location!"
echo ""
echo "Next steps:"
echo "1. Make sure MT5FileBridgeEA is attached to a chart in MT5"
echo "2. Restart the bridge: kill \$(lsof -ti :8080) && ./mt5-bridge/start-wine-bridge.sh"
echo "3. Test: curl http://localhost:8080/account"

