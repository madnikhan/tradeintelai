# EA Setup Checklist - How to Verify It's Running

## ❌ What I See in Your Screenshot

You have the **Strategy Tester** open, which is for **backtesting**, not live trading.

## ✅ What You Need for Live Trading

The EA must be **attached to a chart**, not run in Strategy Tester.

---

## 🔍 How to Check if EA is Running Correctly

### Step 1: Attach EA to Chart (Not Strategy Tester)

1. **Close Strategy Tester** (if open)
2. **Open any chart** (e.g., EURUSD H1 or H4)
3. **In Navigator panel** (left side):
   - Find "Expert Advisors" → "MT5FileBridgeEA"
   - **Drag it onto the chart**
4. **Configure EA settings**:
   - `COMMANDS_DIR`: `mt5-commands` (default)
   - `RESPONSES_DIR`: `mt5-responses` (default)
   - `POLL_INTERVAL_MS`: `500` (default)
   - `MAGIC_NUMBER`: `12345` (default)
5. **Enable checkboxes**:
   - ✅ "Allow live trading"
   - ✅ "Allow DLL imports"
6. **Click OK**

---

### Step 2: Check EA Status

**Look for these indicators:**

#### ✅ EA is Running (Good Signs):
1. **Chart shows EA name** in top-right corner:
   - Should see: `MT5FileBridgeEA` with a smiley face 😊

2. **Toolbox → Experts tab** shows:
   ```
   === AI Trading System MT5 File Bridge ===
   ✅ File Bridge EA initialized
   📁 Commands directory: ...\MQL5\Files\mt5-commands\
   📁 Responses directory: ...\MQL5\Files\mt5-responses\
   Account: XXXXX
   Balance: $XXXXX
   Server: ...
   ```

3. **No errors** in Experts tab

#### ❌ EA is NOT Running (Bad Signs):
- Chart shows EA name with a sad face ☹️
- Errors in Experts tab
- No initialization messages
- EA name not visible on chart

---

### Step 3: Test Communication

1. **Check if EA processes commands**:
   - Look in **Toolbox → Experts tab**
   - Should see messages like:
     ```
     📨 Processing command: account_...
     📤 Response written: response_...
     ```

2. **Check bridge logs** (terminal):
   - Should see: `📥 Received account info response: ...`
   - Should NOT see: `⏱️ Timeout waiting for...`

---

## 🎯 Quick Verification

### In MT5:
1. **View → Toolbox** (or press Ctrl+T)
2. **Click "Experts" tab**
3. **Look for**:
   - ✅ `✅ File Bridge EA initialized`
   - ✅ `📁 Commands directory: ...`
   - ✅ Processing messages when bridge sends commands

### In Bridge Logs:
- ✅ `📥 Received account info response: ...`
- ❌ No timeout warnings

---

## ⚠️ Common Mistakes

1. **Running in Strategy Tester** ❌
   - Strategy Tester is for backtesting only
   - EA won't process live file commands here

2. **EA not attached to chart** ❌
   - Must drag EA onto a chart
   - Just compiling isn't enough

3. **"Allow live trading" disabled** ❌
   - EA won't process commands if disabled

4. **Wrong directories** ❌
   - EA and bridge must use same directories
   - Check paths match

---

## ✅ Correct Setup

```
Chart (EURUSD H1) 
  └─ MT5FileBridgeEA attached
      └─ Shows 😊 in top-right
      └─ Logs show initialization
      └─ Processes commands from mt5-commands/
      └─ Writes responses to mt5-responses/
```

---

## 🔧 If EA Shows Errors

1. **Check Experts tab** for error messages
2. **Verify EA is compiled** (no compilation errors)
3. **Check "Allow DLL imports"** is enabled
4. **Restart MT5** if needed
5. **Re-attach EA** to chart

---

## 📊 What Success Looks Like

**MT5 Experts Tab:**
```
=== AI Trading System MT5 File Bridge ===
✅ File Bridge EA initialized
📁 Commands directory: C:\Users\...\MQL5\Files\mt5-commands\
📁 Responses directory: C:\Users\...\MQL5\Files\mt5-responses\
Account: 52556154
Balance: $6300200.00
Server: ICMarketsSC-Demo
📨 Processing command: account_1763156754983.json
📤 Response written: response_1763156754983.json
```

**Bridge Logs:**
```
📤 Sent account info request: account_1763156754983.json
📥 Received account info response: response_1763156754983.json
```

**Dashboard:**
- ConnectionTester shows: `✅ Connected to MT5 HTTP Bridge`
- Account balance updates (real MT5 balance, not mock)

