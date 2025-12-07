# 🔧 MT5 EA File Access Fix

**Issue:** EA is attached and initialized, but not processing command files

**Root Cause:** EA was not using `FILE_COMMON` flag for file operations

**Fix Applied:** Added `FILE_COMMON` flag to all file operations

---

## ✅ **Changes Made:**

1. **FileFindFirst** - Added `FILE_COMMON` flag
2. **FileFindNext** - Added `FILE_COMMON` flag  
3. **FileOpen** (read) - Added `FILE_COMMON` flag
4. **FileOpen** (write) - Added `FILE_COMMON` flag
5. **FileDelete** - Added `FILE_COMMON` flag
6. **CreateDirectory** - Added `FILE_COMMON` flag

---

## 🔍 **Why This Fixes It:**

In MQL5, when accessing files in the `MQL5/Files/` directory (common files), you need to use the `FILE_COMMON` flag. Without it, the EA might be looking in the wrong location or not finding files at all.

**Before:**
```mql5
FileFindFirst(COMMANDS_DIR + "\\*.json", first_file, 0);
FileOpen(filepath, FILE_READ|FILE_TXT|FILE_ANSI);
```

**After:**
```mql5
FileFindFirst(COMMANDS_DIR + "\\*.json", first_file, FILE_COMMON);
FileOpen(filepath, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
```

---

## 📋 **Next Steps:**

1. **Recompile EA:**
   - Open `MT5FileBridgeEA.mq5` in MetaEditor
   - Press F7 to compile
   - Check for errors (should be none)

2. **Reattach EA:**
   - Remove old EA from chart
   - Attach newly compiled EA
   - Verify initialization logs

3. **Test:**
   - Check EA logs for: `📨 Processing command: account_...`
   - Check bridge logs for successful responses
   - Test account endpoint: `curl http://localhost:8080/account`

---

## ✅ **Expected Result:**

After recompiling and reattaching EA:
- EA should find and process command files
- Response files should be created
- Account balance should load in dashboard
- Trading should be allowed

