#!/bin/bash
# Launch all MT5 terminals for 50 accounts
# Adjust paths and account list as needed

set -e

ACCOUNTS_FILE="accounts.txt"
MT5_PATH="${MT5_PATH:-/path/to/terminal64.exe}"  # Set via environment or edit here
WINE_PREFIX_BASE="${HOME}/.wine-mt5"
DELAY=3  # Delay between launches (seconds)

echo "🚀 Launching MT5 terminals for all accounts..."

# Check if accounts file exists
if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo "❌ Accounts file not found: $ACCOUNTS_FILE"
  echo "   Run setup-50-accounts.sh first"
  exit 1
fi

# Check if MT5 path is set
if [ ! -f "$MT5_PATH" ] && [ "$MT5_PATH" != "/path/to/terminal64.exe" ]; then
  echo "⚠️  MT5 path not found: $MT5_PATH"
  echo "   Set MT5_PATH environment variable:"
  echo "   export MT5_PATH=/path/to/terminal64.exe"
  echo ""
  echo "   Or edit this script and set MT5_PATH"
  exit 1
fi

# Count accounts
NUM_ACCOUNTS=$(wc -l < "$ACCOUNTS_FILE")
echo "📋 Found $NUM_ACCOUNTS accounts"

# Launch each terminal
launched=0
failed=0

while read account; do
  echo "🚀 Launching MT5 for account $account..."
  
  # Create Wine prefix if it doesn't exist
  WINE_PREFIX="$WINE_PREFIX_BASE-$account"
  if [ ! -d "$WINE_PREFIX" ]; then
    echo "  📁 Creating Wine prefix: $WINE_PREFIX"
    WINEPREFIX="$WINE_PREFIX" winecfg > /dev/null 2>&1 || true
  fi
  
  # Launch MT5
  if WINEPREFIX="$WINE_PREFIX" wine "$MT5_PATH" > /dev/null 2>&1 &; then
    echo "  ✅ Launched account $account (PID: $!)"
    ((launched++))
  else
    echo "  ❌ Failed to launch account $account"
    ((failed++))
  fi
  
  # Delay between launches
  sleep $DELAY
  
done < "$ACCOUNTS_FILE"

echo ""
echo "✅ Launched $launched terminals (failed: $failed)"
echo ""
echo "Next steps:"
echo "1. Login to each MT5 terminal"
echo "2. Attach MT5FileBridgeEA.mq5 to a chart"
echo "3. Configure EA directories:"
echo "   - COMMANDS_DIR: mt5-commands-{ACCOUNT_LOGIN}"
echo "   - RESPONSES_DIR: mt5-responses-{ACCOUNT_LOGIN}"
echo "4. Enable 'Allow live trading'"

