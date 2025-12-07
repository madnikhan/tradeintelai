# 🔍 Comprehensive System Audit - MT5 Balance Not Loading

**Date:** 2025-12-06  
**Issue:** Dashboard shows $0.00 balance, EA not processing command files

---

## 📊 **Current Status:**

### ✅ **What's Working:**
1. ✅ Python Bridge - Running (Port 8080)
2. ✅ Command Files Created - Files exist in `mt5-commands/` directory
3. ✅ EA Initialized - EA attached and running
4. ✅ EA Can Read Account - Balance: $95.55 (from EA logs)
5. ✅ Timer Running - Scanning every 500ms
6. ✅ "Allow Algo Trading" Enabled

### ❌ **What's NOT Working:**
1. ❌ **EA Not Finding Files** - `FileFindFirst` returns `INVALID_HANDLE`
2. ❌ **No File Processing** - "Processed 0 commands"
3. ❌ **No Response Files** - No responses created
4. ❌ **Dashboard Shows $0.00** - Can't get data from MT5

---

## 🔍 **Root Cause Analysis:**

### **1. Path Mismatch (Wine + FILE_COMMON):**

**Python Bridge writes to:**
```
/Users/.../Library/Application Support/net.metaquotes.wine.metatrader5/
drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands/
```

**EA sees (TERMINAL_DATA_PATH):**
```
C:\Program Files\MetaTrader 5\MQL5\Files\mt5-commands\
```

**EA might be looking (FILE_COMMON + TERMINAL_COMMONDATA_PATH):**
```
C:\users\user\AppData\Roaming\MetaQuotes\Terminal\Common\MQL5\Files\mt5-commands\
```

**Problem:** `FILE_COMMON` flag in MQL5 might point to `TERMINAL_COMMONDATA_PATH` instead of `TERMINAL_DATA_PATH` in Wine environments.

### **2. FileFindFirst Limitation:**

`FileFindFirst` with `FILE_COMMON` may not support subdirectories in Wine:
- Pattern: `mt5-commands/*.json` → Returns `INVALID_HANDLE`
- Pattern: `*.json` (root) → Might work, but files are in subdirectory

### **3. Wine Path Translation:**

Wine translates Windows paths to macOS paths, but:
- `FILE_COMMON` might use a different translation
- Subdirectory access might be broken
- Path separators (`\` vs `/`) might cause issues

---

## ✅ **Fixes Applied:**

### **1. Enhanced File Search (6 Methods):**
- Method 1: `mt5-commands/*.json` with `FILE_COMMON`
- Method 2: `mt5-commands\*.json` with `FILE_COMMON`
- Method 3: `mt5-commands/*.json` without `FILE_COMMON`
- Method 4: `mt5-commands\*.json` without `FILE_COMMON`
- Method 5: Root search by prefix (`account_*.json`, etc.) with `FILE_COMMON`
- Method 6: Root search without `FILE_COMMON`

### **2. Enhanced File Opening (5 Methods):**
- Multiple path formats when opening files
- Tries with/without `FILE_COMMON`
- Tries forward/backward slashes

### **3. Direct File Access Test:**
- Added initialization test to verify file access
- Tests known file patterns
- Logs which method works

### **4. Enhanced Debugging:**
- Logs both `TERMINAL_DATA_PATH` and `TERMINAL_COMMONDATA_PATH`
- Shows which search patterns were tried
- Tests direct file access on failure

---

## 🎯 **Next Steps:**

### **1. Recompile and Test:**
```bash
# Recompile EA in MetaEditor (F7)
# Reattach to chart
# Check EA logs for file access test results
```

### **2. Check EA Logs:**
Look for:
- `✅ File access test PASSED` - Shows which method works
- `✅ FileFindFirst succeeded!` - Shows files were found
- `🔍 Testing direct file access...` - Shows fallback test

### **3. If Still Not Working:**

**Option A: Move Files to Root**
- Change Python bridge to write files to root `Files/` directory
- Update EA to search root instead of subdirectory

**Option B: Use Absolute Paths**
- Use `TerminalInfoString(TERMINAL_DATA_PATH)` to construct absolute paths
- Bypass `FILE_COMMON` entirely

**Option C: Use Different Communication Method**
- Consider using shared memory or named pipes
- Or use MT5's built-in HTTP/WebSocket support

---

## 📋 **Verification Checklist:**

- [ ] EA compiled successfully (0 errors, 0 warnings)
- [ ] EA attached to chart
- [ ] "Allow Algo Trading" enabled
- [ ] EA logs show file access test results
- [ ] Command files exist in `mt5-commands/` directory
- [ ] EA logs show "FileFindFirst succeeded" or "Testing direct file access"
- [ ] Response files created in `mt5-responses/` directory
- [ ] Dashboard shows real balance ($95.55)

---

## 🔧 **Debugging Commands:**

```bash
# Check if files exist
ls -lt "/Users/.../Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands/"

# Test bridge
curl http://localhost:8080/account

# Check bridge logs
tail -f mt5-bridge/bridge.log
```

---

## 🎯 **Expected Outcome:**

After applying fixes:
1. EA finds command files using one of the 6 methods
2. EA processes commands and creates responses
3. Python bridge reads responses
4. Dashboard displays real MT5 balance
5. Trading is enabled
