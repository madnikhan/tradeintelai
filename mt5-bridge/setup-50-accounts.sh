#!/bin/bash
# Setup script for 50 trading accounts
# This script automates the setup process

set -e

MANAGER_URL="http://localhost:8079"
ACCOUNTS_FILE="accounts.txt"
BASE_ACCOUNT=123456
NUM_ACCOUNTS=50

echo "🚀 Setting up $NUM_ACCOUNTS trading accounts..."

# Step 1: Generate account list
echo "📝 Generating account list..."
> $ACCOUNTS_FILE
for i in $(seq 0 $((NUM_ACCOUNTS - 1))); do
  account=$((BASE_ACCOUNT + i))
  echo $account >> $ACCOUNTS_FILE
done
echo "✅ Generated $NUM_ACCOUNTS accounts in $ACCOUNTS_FILE"

# Step 2: Check if manager is running
echo "🔍 Checking if Multi-Bridge Manager is running..."
if ! curl -s "$MANAGER_URL/status" > /dev/null 2>&1; then
  echo "❌ Multi-Bridge Manager is not running!"
  echo "   Please start it first:"
  echo "   cd mt5-bridge && python3 multi-bridge-manager.py &"
  exit 1
fi
echo "✅ Multi-Bridge Manager is running"

# Step 3: Add all accounts
echo "➕ Adding all accounts to manager..."
added=0
failed=0

while read account; do
  if curl -s -X POST "$MANAGER_URL/account/$account/add" > /dev/null 2>&1; then
    echo "  ✅ Added account $account"
    ((added++))
  else
    echo "  ❌ Failed to add account $account"
    ((failed++))
  fi
  sleep 0.3  # Small delay to avoid overwhelming
done < $ACCOUNTS_FILE

echo "✅ Added $added accounts (failed: $failed)"

# Step 4: Create directories
echo "📁 Creating directories for all accounts..."
while read account; do
  mkdir -p "mt5-commands-$account"
  mkdir -p "mt5-responses-$account"
done < $ACCOUNTS_FILE
echo "✅ Created directories"

# Step 5: Start all bridges
echo "🚀 Starting all bridges..."
if curl -s -X POST "$MANAGER_URL/start" > /dev/null 2>&1; then
  echo "✅ Started all bridges"
else
  echo "❌ Failed to start bridges"
  exit 1
fi

# Step 6: Wait for bridges to start
echo "⏳ Waiting for bridges to initialize..."
sleep 5

# Step 7: Check status
echo "📊 Checking bridge status..."
STATUS=$(curl -s "$MANAGER_URL/status")
RUNNING=$(echo "$STATUS" | grep -o '"running":[0-9]*' | grep -o '[0-9]*' || echo "0")
TOTAL=$(echo "$STATUS" | grep -o '"total_accounts":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "✅ Status: $RUNNING / $TOTAL bridges running"

# Step 8: Health check sample
echo "🏥 Performing health check on sample accounts..."
sample_accounts=$(head -5 $ACCOUNTS_FILE)
for account in $sample_accounts; do
  port=$((8080 + $(grep -n "^$account$" $ACCOUNTS_FILE | cut -d: -f1)))
  if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
    echo "  ✅ Account $account (port $port) is healthy"
  else
    echo "  ⚠️  Account $account (port $port) health check failed"
  fi
done

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Launch MT5 terminals for each account"
echo "2. Login to each account"
echo "3. Attach MT5FileBridgeEA.mq5 to a chart in each terminal"
echo "4. Configure EA with account-specific directories:"
echo "   - COMMANDS_DIR: mt5-commands-{ACCOUNT_LOGIN}"
echo "   - RESPONSES_DIR: mt5-responses-{ACCOUNT_LOGIN}"
echo "5. Enable 'Allow live trading' in EA settings"
echo ""
echo "Check status: curl $MANAGER_URL/status"
echo "View logs: tail -f multi-bridge-manager.log"

