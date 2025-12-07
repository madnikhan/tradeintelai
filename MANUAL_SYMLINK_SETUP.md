# 🔗 Manual Symlink Setup Guide

Since automatic detection didn't work, let's set this up manually.

## 📍 You have the path: `C:\Program Files\MetaTrader 5\MQL5\Files`

---

## 🔄 Step 1: Convert Windows Path to Mac Path

**Windows path**: `C:\Program Files\MetaTrader 5\MQL5\Files`

**Mac/Wine path**: `~/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Files`

**Full Mac path**: `/Users/muhammadmadni/.wine/drive_c/Program Files/MetaTrader 5/MQL5/Files`

---

## ✅ Step 2: Verify the Path Exists

Open Terminal and run:

```bash
ls -la ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files
```

**If it exists**: You'll see a list of files/folders  
**If it doesn't exist**: You'll see "No such file or directory"

---

## 🎯 Step 3: Create Symlinks

**If the path exists**, run these commands:

```bash
cd /Users/muhammadmadni/trading/tradeintelai

# Create directories in MT5 Files folder
mkdir -p ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-commands
mkdir -p ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-responses

# Remove old directories
rm -rf mt5-commands mt5-responses

# Create symlinks
ln -s ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-commands ./mt5-commands
ln -s ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Files/mt5-responses ./mt5-responses

# Verify
ls -la mt5-commands mt5-responses
```

You should see arrows (`->`) indicating symlinks.

---

## 🔍 Step 4: If Path Doesn't Exist

If the path doesn't exist at that location, MT5 might be using a different data folder.

### Option A: Check AppData Location

MT5's data folder is usually in AppData, not Program Files. Try:

```bash
# Find all MQL5/Files directories
find ~/.wine -type d -path "*/MQL5/Files" 2>/dev/null

# Or check AppData
ls -la ~/.wine/drive_c/users/*/AppData/Roaming/MetaQuotes/Terminal/*/MQL5/Files 2>/dev/null
```

### Option B: Use Finder

1. In MT5, right-click on the Files folder
2. Select "Open in Finder" (or equivalent)
3. Copy the path from Finder's address bar
4. Use that path in the symlink commands above

### Option C: Check MT5 Settings

In MT5:
1. Go to `Tools → Options → Expert Advisors`
2. Check the "Data Folder" path
3. That's where the Files folder should be

---

## ✅ Step 5: Verify Setup

After creating symlinks:

```bash
# Check symlinks
ls -la mt5-commands mt5-responses

# Should show:
# mt5-commands -> /Users/.../.wine/.../MQL5/Files/mt5-commands
# mt5-responses -> /Users/.../.wine/.../MQL5/Files/mt5-responses
```

---

## 🚀 Step 6: Restart Bridge

```bash
# Stop bridge
kill $(lsof -ti :8080)

# Start bridge
./mt5-bridge/start-wine-bridge.sh
```

---

## 🧪 Step 7: Test Connection

```bash
# Test account endpoint
curl http://localhost:8080/account

# Should return real MT5 data (not mock)
```

---

## ❓ Still Having Issues?

If the path still doesn't work:

1. **Check if MT5 is actually running in Wine**:
   ```bash
   ps aux | grep -i metatrader
   ```

2. **Check Wine prefix**:
   ```bash
   echo $WINEPREFIX
   ```
   (If empty, default is `~/.wine`)

3. **Try finding MT5 installation**:
   ```bash
   find ~/.wine -name "terminal.exe" 2>/dev/null
   ```

4. **Share the output** and I'll help you find the correct path!

