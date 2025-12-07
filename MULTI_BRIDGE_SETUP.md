# Multi-Bridge Setup for 50+ Accounts

## 🏗️ Architecture

The multi-bridge system consists of three components:

1. **Multi-Bridge Manager** (Port 8079)
   - Manages up to 50+ bridge instances
   - Each bridge connects to one MT5 terminal/account
   - Handles starting/stopping bridges
   - Health monitoring

2. **Bridge Router** (Port 8080)
   - Single entry point for frontend
   - Routes requests to correct bridge based on account_login
   - Transparent to frontend (no code changes needed)

3. **Individual Bridge Instances** (Ports 8081-8130+)
   - One bridge per MT5 account
   - Each bridge connects to one MT5 terminal
   - Handles file-based communication with MT5 EA

## 🚀 Quick Start

### 1. Start Multi-Bridge Manager

```bash
./start-multi-bridge.sh
```

This starts:
- Manager API on port 8079
- Bridge Router on port 8080 (optional)

### 2. Add Accounts

Add accounts via API or config file:

**Via API:**
```bash
# Add account 123456
curl -X POST http://localhost:8079/account/123456/add

# Add account 789012
curl -X POST http://localhost:8079/account/789012/add
```

**Via Config File:**
Edit `mt5-bridge/bridge-config.json`:
```json
{
  "accounts": [
    {"login": 123456, "port": 8081, "commands_dir": "mt5-commands-123456", "responses_dir": "mt5-responses-123456"},
    {"login": 789012, "port": 8082, "commands_dir": "mt5-commands-789012", "responses_dir": "mt5-responses-789012"}
  ],
  "base_port": 8080,
  "commands_base_dir": "mt5-commands",
  "responses_base_dir": "mt5-responses"
}
```

### 3. Start Individual Bridges

Bridges start automatically when you add accounts, or manually:

```bash
# Start bridge for account 123456
curl -X POST http://localhost:8079/account/123456/start

# Start all bridges
curl -X POST http://localhost:8079/start
```

## 📋 Setup Each MT5 Account

For each account, you need:

1. **MT5 Terminal Instance**
   - Install MT5 terminal
   - Login to the account
   - Keep terminal running

2. **EA Attachment**
   - Attach `MT5FileBridgeEA.mq5` to a chart
   - Configure EA to use account-specific directories:
     - Commands: `mt5-commands-{ACCOUNT_LOGIN}`
     - Responses: `mt5-responses-{ACCOUNT_LOGIN}`

3. **Directory Setup**
   - Create symlinks or configure EA to use correct directories
   - Each account needs separate command/response directories

## 🔧 Configuration

### Bridge Config (`bridge-config.json`)

```json
{
  "accounts": [
    {
      "login": 123456,
      "port": 8081,
      "commands_dir": "mt5-commands-123456",
      "responses_dir": "mt5-responses-123456"
    }
  ],
  "base_port": 8080,
  "commands_base_dir": "mt5-commands",
  "responses_base_dir": "mt5-responses"
}
```

### EA Configuration

In each MT5 terminal, configure the EA with account-specific directories:

```
COMMANDS_DIR = "mt5-commands-123456"  // Use account login
RESPONSES_DIR = "mt5-responses-123456"
```

## 📡 API Endpoints

### Manager API (Port 8079)

- `GET /status` - Get status of all bridges
- `GET /account/{login}` - Get bridge info for account
- `POST /start` - Start all bridges
- `POST /stop` - Stop all bridges
- `POST /account/{login}/add` - Add account
- `POST /account/{login}/remove` - Remove account
- `POST /account/{login}/start` - Start bridge for account
- `POST /account/{login}/stop` - Stop bridge for account

### Router API (Port 8080)

The router forwards all requests to the appropriate bridge based on `account_login` parameter.

- `GET /health?account_login=123456` - Health check
- `GET /account?account_login=123456` - Account info
- `POST /trade` - Execute trade (include `account_login` in body)

## 🎯 Frontend Integration

The frontend connects to the Router (port 8080) and includes `account_login` in requests:

```typescript
// Trade execution with account routing
await httpBridge.executeTrade({
  symbol: 'EURUSD',
  type: 'BUY',
  volume: 0.01,
  accountLogin: 123456  // Router routes to correct bridge
});
```

## 📊 Monitoring

### Check Status

```bash
# Get all bridge statuses
curl http://localhost:8079/status

# Response:
{
  "total_accounts": 2,
  "running": 2,
  "bridges": [
    {
      "account_login": 123456,
      "port": 8081,
      "status": "running",
      "running": true,
      "health": "healthy"
    }
  ]
}
```

### Logs

- Manager: `mt5-bridge/multi-bridge-manager.log`
- Router: `mt5-bridge/bridge-router.log`
- Individual bridges: Check process output

## ⚠️ Important Notes

1. **Port Range**: Each account needs a unique port (8081-8130+ for 50 accounts)
2. **Directory Isolation**: Each account must use separate command/response directories
3. **EA Configuration**: Each EA must be configured for its account's directories
4. **Resource Usage**: 50 bridges = 50 Python processes (ensure sufficient resources)
5. **Network**: All bridges run on localhost, router handles external access

## 🔄 Scaling to 50+ Accounts

1. **Add accounts in batches** (e.g., 10 at a time)
2. **Monitor resource usage** (CPU, memory, file descriptors)
3. **Use separate MT5 terminals** (one per account)
4. **Configure EA directories** correctly for each account
5. **Test connectivity** before adding more accounts

## 🛑 Stopping

```bash
# Stop all bridges
pkill -f multi-bridge-manager.py
pkill -f bridge-router.py

# Or via API
curl -X POST http://localhost:8079/stop
```

## 🐛 Troubleshooting

### Bridge won't start
- Check if port is already in use
- Verify MT5 terminal is running
- Check EA is attached and configured correctly

### Trades not executing
- Verify bridge is running: `curl http://localhost:8079/status`
- Check EA logs in MT5
- Verify account_login matches in request

### Port conflicts
- Change base_port in config
- Ensure ports 8079-8130+ are available

