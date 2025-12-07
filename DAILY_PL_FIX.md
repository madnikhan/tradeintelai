# Daily P/L Showing $0.00 - Diagnosis & Fix

## Current Issue:
- Daily P/L shows **+$0.00** despite having trades
- Open Trades shows **0** despite having open positions
- Position requests are **timing out** (10 second timeout)

## Root Cause:
The EA is **not processing position commands** (`positions_` and `closed_positions_`). 

**Evidence:**
- Last response: 11+ minutes ago
- Position requests timeout after 10 seconds
- Account info works (EA processes `account_` commands)
- Position commands are not being processed

## Why This Happens:
1. **EA may not be scanning for position commands** - The EA might only be processing `account_`, `price_`, and `trade_` commands
2. **EA may have stopped** - The EA might have stopped running on the chart
3. **Timer not working** - The `OnTimer()` fix may not be active if EA wasn't recompiled

## Solution:

### Step 1: Verify EA is Running
1. Open MT5
2. Check if EA is attached to a chart
3. Look for smiley face in top-right corner of chart
4. Check EA logs in MT5 (View → Toolbox → Experts tab)

### Step 2: Recompile EA (CRITICAL)
1. Press **F4** in MT5 (opens MetaEditor)
2. Open `MT5FileBridgeEA.mq5`
3. Press **F7** (Compile)
4. **MUST have 0 errors**
5. If errors, fix them

### Step 3: Reattach EA
1. Remove EA from chart (if attached)
2. Drag `MT5FileBridgeEA` to any chart
3. Check **"Allow live trading"** ✓
4. Click **OK**

### Step 4: Verify Position Commands Work
1. Check bridge logs: `tail -f mt5-bridge/bridge.log`
2. Look for: `📥 Received positions response` or `📥 Received closed positions response`
3. If you see timeouts, EA is not processing position commands

### Step 5: Check EA Code
The EA must process these command types:
- `account_` ✅ (working)
- `price_` ✅ (working)
- `trade_` ✅ (working)
- `positions_` ❌ (NOT working - this is the problem)
- `closed_positions_` ❌ (NOT working - this is the problem)

## Expected Result:
After fixing:
- Daily P/L should show actual profit/loss from open positions
- Open Trades should show correct count
- Position data should update every 60 seconds

## Debug Commands:

```bash
# Check EA status
python3 -c "
import os
from datetime import datetime
commands_dir = '/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands'
responses_dir = '/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-responses'
# ... (check command/response files)
"

# Test position endpoint
curl -s -m 5 http://localhost:8080/positions

# Check bridge logs
tail -f mt5-bridge/bridge.log
```

