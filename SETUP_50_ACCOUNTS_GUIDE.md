# 🚀 Complete Guide: Setting Up 50 Trading Accounts on One Laptop

## Overview

This guide explains how to set up and manage 50 MT5 trading accounts using the multi-bridge system on a single laptop.

## ⚠️ Important Considerations

### System Requirements
- **CPU**: Multi-core processor (8+ cores recommended)
- **RAM**: 16GB+ (each MT5 terminal uses ~200-500MB)
- **Storage**: 10GB+ free space
- **OS**: macOS (using Wine) or Linux
- **Network**: Stable internet connection

### Resource Usage Estimate
- **50 MT5 Terminals**: ~10-25GB RAM
- **50 Bridge Processes**: ~500MB-1GB RAM
- **50 EA Instances**: Minimal (part of MT5)
- **Total**: ~15-30GB RAM recommended

## 🏗️ Architecture

```
Your Laptop
├── Multi-Bridge Manager (Port 8079) - Manages all bridges
├── Bridge Router (Port 8080) - Routes requests
├── Bridge 1 (Port 8081) → MT5 Terminal 1 → Account 1
├── Bridge 2 (Port 8082) → MT5 Terminal 2 → Account 2
├── ...
└── Bridge 50 (Port 8130) → MT5 Terminal 50 → Account 50
```

**Note:** Multi-bridge manager now starts bridges at **port 8081+** so the router can use **8080**. Register each login in Firestore `mt5Accounts` and grant colleagues `members/{uid}` with role `trader` for shared execution.

## 📋 Step-by-Step Setup

### Step 1: Prepare Account List

Create a file with all 50 account logins:

```bash
# Create accounts file
cat > mt5-bridge/accounts.txt << EOF
123456
123457
123458
... (add all 50 account logins)
123505
EOF
```

Or use a script to generate:

```bash
# Generate account list (example)
for i in {123456..123505}; do
  echo $i >> mt5-bridge/accounts.txt
done
```

### Step 2: Start Multi-Bridge Manager

```bash
cd mt5-bridge
python3 multi-bridge-manager.py
```

This starts:
- Manager API on port 8079
- Bridge Router on port 8080

**Keep this running in a terminal or run as a service.**

### Step 3: Add All Accounts

```bash
# Add all accounts from file
while read account; do
  curl -X POST http://localhost:8079/account/$account/add
  sleep 0.5  # Small delay to avoid overwhelming the system
done < accounts.txt
```

Or add them all at once:

```bash
# Add accounts 123456-123505
for i in {123456..123505}; do
  curl -X POST http://localhost:8079/account/$i/add
  sleep 0.5
done
```

### Step 4: Setup MT5 Terminals (One Per Account)

For **each of the 50 accounts**, you need to:

#### 4.1 Install MT5 Terminal (if not already installed)

```bash
# Install Wine (if not installed)
brew install wine-stable

# Download MT5 installer
# Install MT5 via Wine
```

#### 4.2 Create Separate Wine Prefixes (Recommended)

To avoid conflicts, create separate Wine prefixes for each account:

```bash
# Create Wine prefix for account 123456
WINEPREFIX=~/.wine-mt5-123456 winecfg

# Install MT5 in this prefix
WINEPREFIX=~/.wine-mt5-123456 wine /path/to/mt5setup.exe
```

**OR** use a single Wine prefix and run multiple MT5 instances (simpler but less isolated).

#### 4.3 Login to Each Account

1. Launch MT5 terminal for account 123456
2. Login with credentials
3. Keep terminal running
4. Repeat for all 50 accounts

**Tip**: Use a script to launch all terminals:

```bash
#!/bin/bash
# launch-all-mt5.sh

accounts=(123456 123457 123458 ... 123505)

for account in "${accounts[@]}"; do
  WINEPREFIX=~/.wine-mt5-$account wine /path/to/terminal64.exe &
  sleep 2  # Delay between launches
done
```

### Step 5: Attach EA to Each Terminal

For **each MT5 terminal**:

1. **Open a chart** (e.g., EURUSD H1)
2. **Attach `MT5FileBridgeEA.mq5`** to the chart
3. **Configure EA settings**:
   - `COMMANDS_DIR`: `mt5-commands-{ACCOUNT_LOGIN}`
   - `RESPONSES_DIR`: `mt5-responses-{ACCOUNT_LOGIN}`
   - `POLL_INTERVAL_MS`: 500
   - `MAGIC_NUMBER`: 12345 (or unique per account)
4. **Enable "Allow live trading"** in EA settings
5. **Click OK** to attach

**Example for Account 123456:**
- `COMMANDS_DIR`: `mt5-commands-123456`
- `RESPONSES_DIR`: `mt5-responses-123456`

### Step 6: Verify Directory Setup

The EA needs access to account-specific directories. Check that directories exist:

```bash
# Check if directories are created
ls -la ~/.wine*/drive_c/users/*/AppData/Roaming/MetaQuotes/Terminal/*/MQL5/Files/

# Or check project directory if using symlinks
ls -la mt5-bridge/mt5-commands-*/
ls -la mt5-bridge/mt5-responses-*/
```

If directories don't exist, create them:

```bash
# Create directories for all accounts
for i in {123456..123505}; do
  mkdir -p mt5-bridge/mt5-commands-$i
  mkdir -p mt5-bridge/mt5-responses-$i
done
```

### Step 7: Start All Bridges

```bash
# Start all bridges
curl -X POST http://localhost:8079/start
```

Or start individual bridges:

```bash
# Start bridge for specific account
curl -X POST http://localhost:8079/account/123456/start
```

### Step 8: Verify Setup

```bash
# Check status of all bridges
curl http://localhost:8079/status

# Expected output:
# {
#   "total_accounts": 50,
#   "running": 50,
#   "bridges": [
#     {"account_login": 123456, "port": 8081, "status": "running", ...},
#     ...
#   ]
# }
```

Test individual bridge:

```bash
# Test bridge for account 123456
curl http://localhost:8081/health

# Get account info
curl http://localhost:8081/account
```

## 🔧 Automation Scripts

### Script 1: Setup All Accounts

```bash
#!/bin/bash
# setup-all-accounts.sh

ACCOUNTS_FILE="mt5-bridge/accounts.txt"
MANAGER_URL="http://localhost:8079"

echo "🚀 Setting up all accounts..."

# Add all accounts
while read account; do
  echo "Adding account $account..."
  curl -X POST $MANAGER_URL/account/$account/add
  sleep 0.5
done < $ACCOUNTS_FILE

# Start all bridges
echo "Starting all bridges..."
curl -X POST $MANAGER_URL/start

# Wait a bit
sleep 5

# Check status
echo "Checking status..."
curl $MANAGER_URL/status | jq

echo "✅ Setup complete!"
```

### Script 2: Launch All MT5 Terminals

```bash
#!/bin/bash
# launch-all-mt5.sh

ACCOUNTS=(123456 123457 123458 ... 123505)  # Add all 50 accounts
MT5_PATH="/path/to/terminal64.exe"

for account in "${ACCOUNTS[@]}"; do
  echo "Launching MT5 for account $account..."
  WINEPREFIX=~/.wine-mt5-$account wine "$MT5_PATH" &
  sleep 3  # Delay between launches
done

echo "✅ All MT5 terminals launched!"
```

### Script 3: Health Check All Accounts

```bash
#!/bin/bash
# health-check-all.sh

MANAGER_URL="http://localhost:8079"

echo "🔍 Health check for all accounts..."

# Get status
STATUS=$(curl -s $MANAGER_URL/status)

# Parse and check each bridge
echo "$STATUS" | jq -r '.bridges[] | "\(.account_login): \(.status) - \(.health)"'

# Count running
RUNNING=$(echo "$STATUS" | jq '.running')
TOTAL=$(echo "$STATUS" | jq '.total_accounts')

echo "Running: $RUNNING / $TOTAL"
```

## 📊 Monitoring

### Check Bridge Status

```bash
# Get all bridge statuses
curl http://localhost:8079/status | jq

# Get specific account status
curl http://localhost:8079/account/123456 | jq
```

### Check Individual Bridge Health

```bash
# Health check for account 123456 (port 8081)
curl http://localhost:8081/health

# Get account info
curl http://localhost:8081/account
```

### View Logs

```bash
# Manager logs
tail -f mt5-bridge/multi-bridge-manager.log

# Router logs
tail -f mt5-bridge/bridge-router.log

# Individual bridge logs (check process output)
```

## 🎯 Trade Execution

### Single Account

```bash
curl -X POST http://localhost:8080/trade \
  -H "Content-Type: application/json" \
  -d '{
    "account_login": 123456,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.01,
    "stopLoss": 1.0800,
    "takeProfit": 1.0900
  }'
```

### Multiple Accounts (via Frontend)

The frontend automatically handles multi-account execution:

```typescript
// Frontend code (already implemented)
const tradingAccounts = accountManager.getTradingAccounts();

// Execute on all selected accounts
for (const account of tradingAccounts) {
  await executeTrade({
    accountLogin: account.login,
    symbol: 'EURUSD',
    type: 'BUY',
    volume: 0.01
  });
}
```

## ⚙️ Configuration File

Create `mt5-bridge/bridge-config.json`:

```json
{
  "accounts": [
    {"login": 123456, "port": 8081, "commands_dir": "mt5-commands-123456", "responses_dir": "mt5-responses-123456"},
    {"login": 123457, "port": 8082, "commands_dir": "mt5-commands-123457", "responses_dir": "mt5-responses-123457"},
    ... (add all 50 accounts)
  ],
  "base_port": 8080,
  "commands_base_dir": "mt5-commands",
  "responses_base_dir": "mt5-responses"
}
```

## 🛠️ Troubleshooting

### Problem: Bridge won't start

**Solution:**
```bash
# Check if port is in use
lsof -i :8081

# Kill process if needed
kill -9 <PID>

# Restart bridge
curl -X POST http://localhost:8079/account/123456/start
```

### Problem: EA not responding

**Solution:**
1. Check EA is attached to chart
2. Verify "Allow live trading" is enabled
3. Check EA logs in MT5 terminal
4. Verify directory paths in EA settings
5. Check file permissions

### Problem: Too many processes

**Solution:**
- Reduce number of accounts
- Use process limits: `ulimit -u 1000`
- Monitor system resources: `htop` or `top`

### Problem: Port conflicts

**Solution:**
- Change base_port in config
- Ensure ports 8079-8130+ are available
- Check firewall settings

### Problem: Memory issues

**Solution:**
- Close unnecessary applications
- Reduce MT5 chart windows
- Use lighter MT5 theme
- Consider running on multiple machines

## 🔄 Maintenance

### Restart All Bridges

```bash
# Stop all
curl -X POST http://localhost:8079/stop

# Start all
curl -X POST http://localhost:8079/start
```

### Restart Specific Account

```bash
# Stop
curl -X POST http://localhost:8079/account/123456/stop

# Start
curl -X POST http://localhost:8079/account/123456/start
```

### Remove Account

```bash
curl -X POST http://localhost:8079/account/123456/remove
```

## 📝 Best Practices

1. **Start Small**: Test with 2-3 accounts first
2. **Monitor Resources**: Watch CPU, RAM, and disk usage
3. **Use Scripts**: Automate repetitive tasks
4. **Regular Health Checks**: Monitor bridge status regularly
5. **Backup Config**: Save `bridge-config.json`
6. **Log Management**: Rotate logs to prevent disk fill
7. **Error Handling**: Implement retry logic for failed trades

## 🚀 Quick Start Checklist

- [ ] Install Wine and MT5
- [ ] Start Multi-Bridge Manager
- [ ] Add all 50 accounts
- [ ] Launch 50 MT5 terminals
- [ ] Login to all accounts
- [ ] Attach EA to all terminals
- [ ] Configure EA directories
- [ ] Start all bridges
- [ ] Verify all bridges are running
- [ ] Test trade execution
- [ ] Set up monitoring
- [ ] Create automation scripts

## 📞 Support

If you encounter issues:
1. Check logs: `mt5-bridge/*.log`
2. Verify EA is running in MT5
3. Check bridge status: `curl http://localhost:8079/status`
4. Test individual bridge: `curl http://localhost:8081/health`

---

**Last Updated**: December 2025
**Status**: ✅ Complete setup guide for 50 accounts

