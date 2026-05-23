#!/bin/bash
# Health check script for all accounts

MANAGER_URL="http://localhost:8079"
ACCOUNTS_FILE="accounts.txt"

echo "🏥 Health Check for All Accounts"
echo "================================"
echo ""

# Check if manager is running
if ! curl -s "$MANAGER_URL/status" > /dev/null 2>&1; then
  echo "❌ Multi-Bridge Manager is not running!"
  exit 1
fi

# Get status
STATUS=$(curl -s "$MANAGER_URL/status")
RUNNING=$(echo "$STATUS" | grep -o '"running":[0-9]*' | grep -o '[0-9]*' || echo "0")
TOTAL=$(echo "$STATUS" | grep -o '"total_accounts":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "📊 Overall Status:"
echo "   Total Accounts: $TOTAL"
echo "   Running Bridges: $RUNNING"
echo ""

# Check each account
if [ -f "$ACCOUNTS_FILE" ]; then
  echo "🔍 Individual Account Status:"
  echo ""
  
  account_num=1
  healthy=0
  unhealthy=0
  
  while read account; do
    port=$((8080 + account_num))
    
    # Get bridge info from manager
    bridge_info=$(curl -s "$MANAGER_URL/account/$account" 2>/dev/null || echo "{}")
    bridge_status=$(echo "$bridge_info" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    # Health check
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
      health="✅ Healthy"
      ((healthy++))
    else
      health="❌ Unhealthy"
      ((unhealthy++))
    fi
    
    printf "  Account %-10s Port %-5s Status: %-10s %s\n" "$account" "$port" "$bridge_status" "$health"
    
    ((account_num++))
  done < "$ACCOUNTS_FILE"
  
  echo ""
  echo "📈 Summary:"
  echo "   Healthy: $healthy"
  echo "   Unhealthy: $unhealthy"
else
  echo "⚠️  Accounts file not found: $ACCOUNTS_FILE"
fi

echo ""
echo "💡 Tips:"
echo "   - Check logs: tail -f multi-bridge-manager.log"
echo "   - Restart bridge: curl -X POST $MANAGER_URL/account/{LOGIN}/restart"
echo "   - View full status: curl $MANAGER_URL/status | jq"

