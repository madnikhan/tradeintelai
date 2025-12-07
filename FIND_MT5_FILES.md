# 🔍 Finding Your MT5 Files Folder

## 📍 You showed me: `C:\Program Files\MetaTrader 5\MQL5\Experts`

**This is the Experts folder, but we need the Files folder!**

---

## ✅ Correct Steps to Find Files Folder

### In MT5 Terminal:

1. **Click**: `File → Open Data Folder`
2. **Navigate UP one level** from Experts:
   - You're at: `MQL5\Experts`
   - Go to: `MQL5\Files` (click "Files" in the folder list)
3. **Copy the full path** shown in the address bar
   - Should look like: `C:\Users\YourName\AppData\Roaming\MetaQuotes\Terminal\XXXXX\MQL5\Files`
   - OR: `C:\Program Files\MetaTrader 5\MQL5\Files`

---

## 🔄 Converting Windows Path to Mac Path

If MT5 shows: `C:\Users\YourName\AppData\Roaming\MetaQuotes\Terminal\XXXXX\MQL5\Files`

On Mac (Wine), it's: `~/.wine/drive_c/Users/YourName/AppData/Roaming/MetaQuotes/Terminal/XXXXX/MQL5/Files`

If MT5 shows: `C:\Program Files\MetaTrader 5\MQL5\Files`

On Mac (Wine), it's: `~/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Files`

---

## 🚀 Quick Setup (Once You Have the Path)

Replace `<YOUR_PATH>` with the actual path from MT5:

```bash
cd /Users/muhammadmadni/trading/tradeintelai

# Remove old directories
rm -rf mt5-commands mt5-responses

# Create directories in MT5 Files folder
mkdir -p "<YOUR_PATH>/mt5-commands"
mkdir -p "<YOUR_PATH>/mt5-responses"

# Create symlinks
ln -s "<YOUR_PATH>/mt5-commands" ./mt5-commands
ln -s "<YOUR_PATH>/mt5-responses" ./mt5-responses

# Verify
ls -la mt5-commands mt5-responses
```

---

## 📝 What to Look For

When you open "Open Data Folder" in MT5:
- Look for a folder called **"Files"** (not "Experts")
- The path should end with: `...\MQL5\Files`
- Copy that entire path

---

## 🆘 Alternative: Use the Interactive Script

```bash
./mt5-bridge/configure-paths.sh
```

Then paste the path when prompted (the full path ending in `\MQL5\Files`).

