# 🔧 Bridge Status & Connection Guide

## Current Status:
- ✅ **Bridge is running** (PID: 87127)
- ✅ **Health endpoint responding**: `{"status": "running"}`
- ✅ **Port 8080**: Listening correctly

## Quick Fix:

### If Dashboard Shows "Disconnected":

1. **Refresh the dashboard** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)

2. **Click the refresh button (↻)** next to "Disconnected" status

3. **Check browser console** (F12) for connection errors

4. **Verify bridge is running:**
   ```bash
   curl http://localhost:8080/health
   ```
   Should return: `{"status": "running", "mt5_connected": false}`

### If Bridge is Not Running:

```bash
cd /Users/muhammadmadni/trading/tradeintelai/mt5-bridge
pkill -f wine-mt5-connector.py
python3 wine-mt5-connector.py > bridge.log 2>&1 &
```

### Check Bridge Logs:

```bash
tail -f mt5-bridge/bridge.log
```

## Connection Test:

The dashboard will now:
- Test connection on page load
- Auto-retry every 10 seconds if disconnected
- Show "MT5 Connected" when bridge responds

## Expected Behavior:

- **Green dot + "MT5 Connected"** = Bridge is working
- **Red dot + "Disconnected"** = Bridge not responding
- **Gray dot + "Connecting..."** = Testing connection
