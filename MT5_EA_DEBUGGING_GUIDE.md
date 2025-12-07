# 🔍 MT5 EA Debugging Guide

**Current Status:** EA initialized but not finding/processing command files

**EA Logs Show:**
- ✅ EA initialized successfully
- ✅ Timer set to scan every 500ms
- ❌ No debug messages about finding files
- ❌ "Processed 0 commands" when stopped

---

## 🔍 **What We Know:**

1. **EA is Running:**
   - Initialized at 18:29:22
   - Timer scanning every 500ms
   - Account info accessible (Balance: $95.55)

2. **Command Files ARE Being Created:**
   - `account_1765045982579.json` created at 18:33
   - Bridge is creating files correctly

3. **EA is NOT Finding Files:**
   - No "🔍 Found file" messages
   - No "✅ Processing command file" messages
   - FileFindFirst likely returning INVALID_HANDLE

---

## 🔧 **Debug Code Added:**

I've added debug logging that will show:
- When FileFindFirst succeeds: `✅ FileFindFirst succeeded! Found first file: ...`
- When no files found: `🔍 No command files found in: ...` (every 200 scans)

---

## 📋 **Next Steps:**

### **1. Recompile EA with Debug Code:**
- Open `MT5FileBridgeEA.mq5` in MetaEditor
- Press **F7** to compile
- Check for errors

### **2. Reattach EA:**
- Remove old EA from chart
- Attach newly compiled EA
- Enable "Allow live trading"

### **3. Watch EA Logs:**
After reattaching, you should see one of these:

**If files are found:**
```
✅ FileFindFirst succeeded! Found first file: account_...
🔍 Found file: account_...
✅ Processing command file: account_...
📨 Processing command: account_...
```

**If files are NOT found:**
```
🔍 No command files found in: mt5-commands (pattern: mt5-commands\*.json) - Scans: 1
🔍 Full path should be: C:\Program Files\MetaTrader 5\MQL5\Files\mt5-commands\
```

### **4. Test Account Endpoint:**
```bash
curl http://localhost:8080/account
```

This will create a new command file, and you should see the EA process it.

---

## 🎯 **What to Look For:**

1. **First scan (immediately after attach):**
   - Should see: `🔍 No command files found...` OR `✅ FileFindFirst succeeded!`

2. **After bridge creates command file:**
   - Should see: `✅ FileFindFirst succeeded!`
   - Should see: `🔍 Found file: account_...`
   - Should see: `✅ Processing command file: account_...`

3. **If still not working:**
   - Check the "Full path should be" message
   - Verify the path matches where files are actually created
   - Check if FILE_COMMON flag is working correctly

---

## ⚠️ **Important:**

The debug messages will tell us exactly what's happening:
- **If you see "No command files found"** → Path issue or FILE_COMMON not working
- **If you see "FileFindFirst succeeded" but no processing** → File pattern matching issue
- **If you see processing messages** → EA is working, check response files

**Please share the EA logs after recompiling and reattaching!**

