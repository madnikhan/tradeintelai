# 🍷 Wine + MT5 File Path Issue on macOS

## 🎯 **Problem:**
Running MT5 via Wine on macOS can cause file path mismatches between:
- **Python Bridge** (writing files from macOS)
- **MT5 EA** (reading files from Wine/Windows environment)

## 🔍 **Root Cause:**

1. **Path Translation:**
   - Python bridge writes to: `/Users/.../Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands`
   - EA sees: `C:\Program Files\MetaTrader 5\MQL5\Files\mt5-commands` (Windows path)
   - Wine translates between these, but `FILE_COMMON` might not work correctly

2. **FILE_COMMON Behavior:**
   - In Wine, `FILE_COMMON` might point to `TERMINAL_COMMONDATA_PATH` instead of `TERMINAL_DATA_PATH`
   - Path separators (`\` vs `/`) might need special handling

3. **Two Possible Locations:**
   - `TERMINAL_DATA_PATH`: Terminal-specific data folder
   - `TERMINAL_COMMONDATA_PATH`: Common data folder (shared across terminals)

---

## ✅ **Solution Applied:**

### **1. Added Path Debugging:**
The EA now logs both `TERMINAL_DATA_PATH` and `TERMINAL_COMMONDATA_PATH` to help identify which path Wine is actually using.

### **2. Multiple File Search Methods:**
The EA tries 5 different approaches to find files, covering:
- Subdirectory with forward slash + FILE_COMMON
- Subdirectory with backslash + FILE_COMMON
- Subdirectory without FILE_COMMON
- Root directory search by file prefix
- Multiple path formats when opening files

### **3. Enhanced Error Logging:**
The EA now shows which paths it's trying, making it easier to diagnose Wine-specific issues.

---

## 📋 **Next Steps:**

1. **Recompile and Reattach EA:**
   ```bash
   # Open MT5FileBridgeEA.mq5 in MetaEditor
   # Press F7 to compile
   # Reattach to chart
   ```

2. **Check EA Logs:**
   Look for these messages in the EA logs:
   ```
   📁 TERMINAL_DATA_PATH: C:\Program Files\MetaTrader 5\
   📁 TERMINAL_COMMONDATA_PATH: C:\Users\...\AppData\Roaming\MetaQuotes\Terminal\Common\
   📁 Commands directory (DATA): ...
   📁 Commands directory (COMMON): ...
   ```

3. **Compare Paths:**
   - Check if the EA's logged path matches where Python bridge is writing
   - If they differ, we may need to adjust the Python bridge to write to the correct location

4. **Test:**
   ```bash
   curl http://localhost:8080/account
   ```

---

## 🔧 **If Paths Don't Match:**

If the EA logs show a different path than where the Python bridge is writing, we have two options:

### **Option A: Change Python Bridge Path**
Update `wine-mt5-connector.py` to write to the path the EA is actually using.

### **Option B: Use Symlinks**
Create symlinks so both can access the same directory:
```bash
# Find the actual MT5 Files directory from EA logs
# Then create symlinks in the Python bridge location
```

---

## 🎯 **Expected Result:**

After recompiling and checking logs:
- ✅ EA logs show the actual paths it's using
- ✅ We can verify if Python bridge and EA are using the same directory
- ✅ EA finds and processes command files
- ✅ Dashboard displays real MT5 balance

