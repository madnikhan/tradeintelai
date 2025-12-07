# 🚀 Multi-Bridge Quick Start (50+ Accounts)

## Answer: **YES, it will execute on both simultaneously!**

With the new multi-bridge system, you can execute trades on **all 50 accounts simultaneously**.

## 🏗️ How It Works

```
Frontend (Port 3000)
    ↓
Bridge Router (Port 8080) - Single entry point
    ↓
Multi-Bridge Manager (Port 8079) - Routes to correct bridge
    ↓
    ├─→ Bridge 1 (Port 8081) → MT5 Terminal 1 → Account 1
    ├─→ Bridge 2 (Port 8082) → MT5 Terminal 2 → Account 2
    ├─→ Bridge 3 (Port 8083) → MT5 Terminal 3 → Account 3
    └─→ ... (up to 50+ bridges)
```

## ⚡ Quick Setup

### 1. Start Multi-Bridge System

```bash
npm run multi-bridge
```

Or manually:
```bash
./start-multi-bridge.sh
```

This starts:
- **Manager API** on port 8079 (manages all bridges)
- **Router** on port 8080 (frontend connects here)

### 2. Add Your Accounts

```bash
# Add account 123456
curl -X POST http://localhost:8079/account/123456/add

# Add account 789012
curl -X POST http://localhost:8079/account/789012/add

# Add 50 accounts (example)
for i in {123456..123505}; do
  curl -X POST http://localhost:8079/account/$i/add
done
```

### 3. Setup Each MT5 Terminal

For **each account**, you need:

1. **MT5 Terminal** - Login to the account
2. **EA Attachment** - Attach `MT5FileBridgeEA.mq5` to a chart
3. **EA Configuration** - Set directories:
   - Commands: `mt5-commands-{ACCOUNT_LOGIN}`
   - Responses: `mt5-responses-{ACCOUNT_LOGIN}`

### 4. Start All Bridges

```bash
# Start all bridges
curl -X POST http://localhost:8079/start
```

## 🎯 Trade Execution

When you execute a trade from the frontend:

1. **Frontend** sends request to Router (port 8080) with `account_login`
2. **Router** looks up which bridge handles that account
3. **Router** forwards request to the correct bridge (e.g., port 8081)
4. **Bridge** writes command file to account-specific directory
5. **EA** in that MT5 terminal reads and executes
6. **Response** flows back through the same path

### Simultaneous Execution

If you have 2 accounts selected:
- Trade executes on **Account 1** via Bridge 1 (port 8081)
- Trade executes on **Account 2** via Bridge 2 (port 8082)
- **Both execute at the same time** (parallel execution)

## 📊 Check Status

```bash
# Get status of all bridges
curl http://localhost:8079/status

# Response shows:
# - Total accounts
# - Running bridges
# - Health status of each
```

## ⚙️ Configuration

Each account gets:
- **Unique port** (8081, 8082, 8083, ...)
- **Unique directories** (`mt5-commands-{login}`, `mt5-responses-{login}`)
- **Own bridge process** (managed by Multi-Bridge Manager)

## 🔧 Requirements

For 50 accounts, you need:
- **50 MT5 terminal instances** (one per account)
- **50 EA instances** (one attached to each terminal)
- **Sufficient system resources** (CPU, memory, file descriptors)

## 📝 Example: Adding 2 Accounts

```bash
# 1. Start multi-bridge
npm run multi-bridge

# 2. Add accounts
curl -X POST http://localhost:8079/account/123456/add
curl -X POST http://localhost:8079/account/789012/add

# 3. Start bridges
curl -X POST http://localhost:8079/start

# 4. Check status
curl http://localhost:8079/status
```

## ✅ Verification

1. **Manager Status**: `curl http://localhost:8079/status`
2. **Router Health**: `curl http://localhost:8080/health`
3. **Individual Bridge**: `curl http://localhost:8081/health` (for account 123456)

## 🎯 Frontend Integration

The frontend **automatically** uses multi-account execution when multiple accounts are configured:

```typescript
// In TradePanel.tsx - automatically detects multiple accounts
const tradingAccounts = accountManager.getTradingAccounts();

if (tradingAccounts.length > 1) {
  // Executes on ALL accounts simultaneously
  await MultiAccountExecutor.executeOnMultipleAccounts({...});
}
```

## 🛑 Stopping

```bash
# Stop all bridges
pkill -f multi-bridge-manager.py
pkill -f bridge-router.py

# Or via API
curl -X POST http://localhost:8079/stop
```

---

**Result**: ✅ **YES, trades execute on ALL accounts simultaneously!**

See `MULTI_BRIDGE_SETUP.md` for detailed configuration.

