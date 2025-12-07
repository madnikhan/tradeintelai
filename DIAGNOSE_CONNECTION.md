# 🔍 Why Mock Data? - Connection Diagnosis

## ❌ Current Problem

**Bridge Status**: Running ✅  
**EA Status**: Not Connected ❌  
**Result**: Mock data (timeout after 10 seconds)

---

## 🔍 Root Cause

The bridge is **timing out** because:

1. **Path Mismatch**:
   - Bridge writes to: `/Users/muhammadmadni/trading/tradeintelai/mt5-commands/`
   - EA reads from: `~/.wine/.../MQL5/Files/mt5-commands/` (inside Wine)
   - **These are different directories!**

2. **EA Not Running**:
   - EA must be **attached to a chart** (not Strategy Tester)
   - EA must have "Allow live trading" enabled

---

## ✅ Solution: Connect the Paths

### Option 1: Create Symlinks (Recommended)

1. **Find MT5 Files Directory**:
   - Open MT5 terminal
   - Go to: `File → Open Data Folder`
   - Navigate to: `MQL5 → Files`
   - Copy the full path (e.g., `/Users/.../.wine/.../MQL5/Files`)

2. **Create Symlinks**:
   ```bash
   # Remove existing directories
   rm -rf mt5-commands mt5-responses
   
   # Create directories in MT5 Files folder
   mkdir -p "<MT5_FILES_PATH>/mt5-commands"
   mkdir -p "<MT5_FILES_PATH>/mt5-responses"
   
   # Create symlinks
   ln -s "<MT5_FILES_PATH>/mt5-commands" ./mt5-commands
   ln -s "<MT5_FILES_PATH>/mt5-responses" ./mt5-responses
   ```

3. **Or use the helper script**:
   ```bash
   ./mt5-bridge/configure-paths.sh
   ```
   (Paste the MT5 Files path when prompted)

### Option 2: Use Interactive Script

```bash
./mt5-bridge/configure-paths.sh
```

---

## ✅ Verify EA is Running

1. **In MT5**:
   - Close Strategy Tester
   - Open any chart (EURUSD H1)
   - Drag `MT5FileBridgeEA` from Navigator onto chart
   - Enable "Allow live trading" ✅
   - Enable "Allow DLL imports" ✅
   - Click OK

2. **Check EA Status**:
   - Chart should show EA name with 😊 icon
   - Toolbox → Experts tab should show:
     ```
     ✅ File Bridge EA initialized
     📁 Commands directory: ...
     📁 Responses directory: ...
     ```

---

## 🧪 Test Connection

After fixing paths and attaching EA:

1. **Check Bridge Logs**:
   ```bash
   tail -f /tmp/bridge.log
   ```
   Should see: `📥 Received account info response: ...` (not timeout)

2. **Test from Terminal**:
   ```bash
   curl http://localhost:8080/account
   ```
   Should return real MT5 data (not mock)

3. **Test from Dashboard**:
   - Open: http://localhost:3000/dashboard
   - ConnectionTester should show: `✅ Connected to MT5 HTTP Bridge`
   - Account balance should show your real MT5 balance

---

## 📊 Current Status Check

Run this to see what's happening:

```bash
# Check if bridge is writing commands
ls -lt mt5-commands/ | head -3

# Check if EA is responding
ls -lt mt5-responses/ | head -3

# Check bridge logs
tail -20 /tmp/bridge.log | grep -E "(timeout|response|command)"
```

---

## 🎯 Expected Flow (When Working)

1. Bridge writes: `mt5-commands/account_1234567890.json`
2. EA reads command (within 500ms)
3. EA processes and writes: `mt5-responses/response_1234567890.json`
4. Bridge reads response (within 10 seconds)
5. Bridge returns real MT5 data to dashboard

**Current**: Step 2 fails → Timeout → Mock data

---

## 🚨 Quick Fix Checklist

- [ ] Find MT5 Files directory path
- [ ] Create symlinks (or use `configure-paths.sh`)
- [ ] Attach EA to chart (not Strategy Tester)
- [ ] Enable "Allow live trading" in EA
- [ ] Restart bridge: `kill $(lsof -ti :8080) && ./mt5-bridge/start-wine-bridge.sh`
- [ ] Test: `curl http://localhost:8080/account`
- [ ] Verify: Should see real balance, not $100,000

