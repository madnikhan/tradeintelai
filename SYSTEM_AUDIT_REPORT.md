# 🔍 System Audit Report - MT5 Connection Issue

**Date:** November 28, 2025, 12:30 PM  
**Status:** ❌ **CRITICAL ISSUE FOUND**

---

## 📊 Audit Results

### ✅ **Working Components:**

1. **Bridge Process:** ✅ Running (PID: 48511)
2. **Bridge Health Endpoint:** ⚠️ Intermittent (sometimes responds, sometimes times out)
3. **Account Info:** ✅ Working (EA responds to account commands)
4. **File Paths:** ✅ Correct (symlinks working)
5. **Command Files:** ✅ Being created correctly

### ❌ **Critical Issues Found:**

#### **ISSUE #1: EA Only Scans on Price Ticks** 🔴
**Problem:** The EA uses `OnTick()` which only fires when price moves. If the market is quiet, the EA won't scan for commands!

**Evidence:**
- Last response: 11:30 AM
- Commands created: 12:26 PM (not processed)
- EA hasn't processed commands for ~1 hour

**Fix Applied:** Changed to use `OnTimer()` which fires every 500ms regardless of price movement.

---

#### **ISSUE #2: Position Commands Timing Out** 🔴
**Problem:** `get_positions` and `get_closed_positions` commands timeout (10 seconds), but `get_account_info` works.

**Possible Causes:**
1. EA crashes when processing positions
2. EA takes too long to process positions
3. EA not recognizing position commands

**Fix Applied:** 
- Fixed `PositionGetTicket()` → `PositionSelectByIndex()` + `PositionGetInteger(POSITION_TICKET)`
- Added error handling and logging
- Added debug prints

---

#### **ISSUE #3: Bridge Health Endpoint Intermittent** 🟡
**Problem:** Health endpoint sometimes times out, but bridge is running.

**Possible Cause:** Bridge might be busy processing other requests.

**Status:** Non-critical (account info still works)

---

## 🔧 **Fixes Applied:**

### 1. **EA Timer-Based Scanning** ✅
```mql5
// OLD: Only scanned on price ticks
void OnTick() {
   ScanForCommands();
}

// NEW: Scans every 500ms via timer
void OnTimer() {
   ScanForCommands();
}
```

### 2. **Fixed Position Functions** ✅
```mql5
// OLD: Incorrect
ulong ticket = PositionGetTicket(i);

// NEW: Correct
PositionSelectByIndex(i);
ulong ticket = PositionGetInteger(POSITION_TICKET);
```

### 3. **Added Debug Logging** ✅
- EA now prints what it's doing
- Check MT5 "Experts" tab for messages

---

## 📋 **Action Required:**

### **STEP 1: Recompile EA** (CRITICAL)
```
1. Open MT5
2. Press F4 (MetaEditor)
3. Open MT5FileBridgeEA.mq5
4. Press F7 (Compile)
5. Check for errors - MUST be 0 errors
6. Close MetaEditor
```

### **STEP 2: Reattach EA** (CRITICAL)
```
1. Remove EA from chart (if attached)
2. Drag MT5FileBridgeEA to any chart
3. Check "Allow live trading" ✓
4. Click OK
```

### **STEP 3: Verify EA is Running**
```
1. Check MT5 "Experts" tab
2. Look for:
   - "✅ File Bridge EA initialized"
   - "⏰ Timer set to scan every 500ms"
   - "📨 Processing command: ..."
3. If you see errors, note them down
```

### **STEP 4: Test Connection**
```
1. Wait 10 seconds after reattaching
2. Refresh dashboard
3. Check browser console
4. Daily P/L should update
```

---

## 🎯 **Expected Behavior After Fix:**

- ✅ EA scans for commands every 500ms (not just on price ticks)
- ✅ Position commands process within 1-2 seconds
- ✅ Response files appear immediately
- ✅ Dashboard shows 4 open positions
- ✅ Daily P/L shows -$4.45

---

## 📝 **Diagnostic Commands:**

```bash
# Check bridge status
curl http://localhost:8080/health

# Check latest command file
ls -lt ~/Library/Application\ Support/net.metaquotes.wine.metatrader5/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-commands/ | head -3

# Check latest response file
ls -lt ~/Library/Application\ Support/net.metaquotes.wine.metatrader5/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-responses/ | head -3

# Check bridge logs
tail -20 mt5-bridge/bridge.log
```

---

## ⚠️ **If Still Not Working:**

1. **Check MT5 Experts Tab:**
   - Look for error messages
   - Check if EA shows green smiley (running) or red X (error)

2. **Verify EA Settings:**
   - "Allow live trading" must be checked
   - "Allow DLL imports" may be needed
   - EA must be attached to a chart

3. **Check File Permissions:**
   - MT5 must have write access to Files folder
   - Commands/responses directories must exist

4. **Restart Everything:**
   - Close MT5 completely
   - Restart bridge: `pkill -f wine-mt5-connector.py && cd mt5-bridge && python3 wine-mt5-connector.py &`
   - Reopen MT5
   - Reattach EA

---

## 🎯 **Root Cause:**

**The EA was only scanning for commands when price moved (`OnTick()`). Since the market was quiet, it stopped processing commands. The fix uses a timer (`OnTimer()`) to scan every 500ms regardless of price movement.**
