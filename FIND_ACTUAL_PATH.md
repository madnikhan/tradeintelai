# 🔍 Finding the Actual MT5 Files Path

The path `C:\Program Files\MetaTrader 5\MQL5\Files` doesn't exist on your Mac filesystem. Let's find where it actually is.

---

## 🎯 Method 1: Use Finder (Easiest)

1. **In MT5**: Right-click on the `Files` folder (in the MQL5 directory)
2. **Select**: "Reveal in Finder" or "Show in Finder" (or equivalent)
3. **In Finder**: The folder will open, showing the actual Mac path
4. **Copy the path**: 
   - Right-click the folder in Finder
   - Hold Option key
   - Select "Copy [Folder Name] as Pathname"
   - Or drag the folder to Terminal to see the path

---

## 🎯 Method 2: Check Wine Prefix

MT5 might be using a different Wine prefix. Check:

```bash
# Check current Wine prefix
echo $WINEPREFIX

# If empty, default is ~/.wine
# But MT5 might use a different one
```

---

## 🎯 Method 3: Find All MT5 Installations

```bash
# Find all terminal.exe files (MT5 executable)
find ~ -name "terminal.exe" 2>/dev/null | grep -i metatrader

# Find all MQL5 directories
find ~ -type d -name "MQL5" 2>/dev/null | grep -i metatrader

# Find all Files directories in MQL5
find ~ -type d -path "*/MQL5/Files" 2>/dev/null
```

---

## 🎯 Method 4: Check MT5 Data Folder Setting

In MT5:
1. Go to `Tools → Options → Expert Advisors`
2. Look for "Data Folder" or "Files" path
3. That shows where MT5 actually stores files

---

## 🎯 Method 5: Check from MT5 EA Logs

If you have the EA running, check the logs:
1. In MT5: `View → Toolbox → Experts` tab
2. Look for the initialization message:
   ```
   📁 Commands directory: ...
   📁 Responses directory: ...
   ```
3. That shows the actual path the EA is using!

---

## ✅ Once You Find the Path

Once you have the actual Mac path (from Finder or logs), run:

```bash
cd /Users/muhammadmadni/trading/tradeintelai

# Replace <ACTUAL_PATH> with the path you found
MT5_FILES_PATH="<ACTUAL_PATH>"

# Create directories
mkdir -p "$MT5_FILES_PATH/mt5-commands"
mkdir -p "$MT5_FILES_PATH/mt5-responses"

# Remove old
rm -rf mt5-commands mt5-responses

# Create symlinks
ln -s "$MT5_FILES_PATH/mt5-commands" ./mt5-commands
ln -s "$MT5_FILES_PATH/mt5-responses" ./mt5-responses

# Verify
ls -la mt5-commands mt5-responses
```

---

## 🆘 Quick Check: Is EA Running?

If the EA is already attached to a chart, check the Experts tab in MT5. The initialization message shows the exact path!

**Look for this in MT5 → Toolbox → Experts tab:**
```
📁 Commands directory: C:\Users\...\MQL5\Files\mt5-commands\
```

That's the path we need (convert C:\ to ~/.wine/drive_c/).

