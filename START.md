# 🚀 How to Start TradeIntel AI

## Quick Start (Two Terminal Windows)

### Terminal 1: Start the Bridge
```bash
npm run bridge
```
OR manually:
```bash
./start-bridge.sh
```

### Terminal 2: Start the Dashboard
```bash
npm run dev
```

Then open: http://localhost:3000/dashboard

---

## What Each Component Does

### 1. **MT5 HTTP Bridge** (Terminal 1)
- Python server that connects to MT5 via file-based communication
- Runs on `http://localhost:8080`
- Must be running for the dashboard to connect to MT5
- **Status**: Check if running with `curl http://localhost:8080/health`

### 2. **Next.js Dashboard** (Terminal 2)
- Web interface for trading
- Runs on `http://localhost:3000`
- Connects to the bridge to get MT5 data

---

## Verification

### Check Bridge Status:
```bash
curl http://localhost:8080/health
```
Should return: `{"status": "running", "mt5_connected": false}`

### Check Bridge Logs:
```bash
tail -f mt5-bridge/bridge.log
```

### Stop Bridge:
```bash
pkill -f wine-mt5-connector.py
```

---

## Troubleshooting

### Bridge Not Starting?
1. Check if port 8080 is already in use:
   ```bash
   lsof -i :8080
   ```
2. Kill existing process:
   ```bash
   pkill -f wine-mt5-connector.py
   ```
3. Check Python version:
   ```bash
   python3 --version
   ```
   Should be Python 3.8+

### Dashboard Shows "Disconnected"?
1. Make sure bridge is running (Terminal 1)
2. Check bridge logs: `tail -f mt5-bridge/bridge.log`
3. Verify bridge health: `curl http://localhost:8080/health`
4. Refresh dashboard (Cmd+Shift+R)

### EA Not Responding?
1. Make sure MT5 is running
2. Make sure EA is attached to a chart
3. Check "Allow Algo Trading" is enabled in MT5
4. Recompile EA in MetaEditor (F7)

---

## Full Startup Sequence

```bash
# Terminal 1
cd /Users/muhammadmadni/trading/tradeintelai
npm run bridge

# Terminal 2 (new terminal)
cd /Users/muhammadmadni/trading/tradeintelai
npm run dev

# Browser
open http://localhost:3000/dashboard
```

