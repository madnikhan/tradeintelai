# ✅ Symlinks Setup Complete!

## 🎯 What Was Done

1. **Found MT5's actual location**: 
   - MT5 uses a custom Wine prefix: `/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/`
   - Not the default `~/.wine` location!

2. **Created symlinks**:
   - `mt5-commands` → MT5 Files/mt5-commands
   - `mt5-responses` → MT5 Files/mt5-responses

3. **Bridge restarted** and pointing to correct location

---

## ⚠️ Current Status

**Symlinks**: ✅ Created  
**Bridge**: ✅ Running  
**EA Connection**: ⚠️ Not responding yet

---

## 🔍 Why Still Mock Data?

The EA might not be processing commands because:

1. **EA not attached to chart**: Must be on a chart (not Strategy Tester)
2. **EA not running**: Check MT5 → Toolbox → Experts tab
3. **EA polling delay**: EA checks every 500ms, might take a moment

---

## ✅ Verify EA is Running

**In MT5**:
1. Check if EA is attached to a chart
   - Chart should show EA name with 😊 icon
2. Check Toolbox → Experts tab
   - Should see: `✅ File Bridge EA initialized`
   - Should see: `📁 Commands directory: ...`
3. Look for processing messages:
   - `📨 Processing command: account_...`
   - `📤 Response written: response_...`

---

## 🧪 Test Connection

1. **Send a test command**:
   ```bash
   curl http://localhost:8080/account
   ```

2. **Check if EA processes it**:
   - In MT5: Toolbox → Experts tab
   - Should see processing messages

3. **Check response files**:
   ```bash
   ls -lt "/Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-responses/"
   ```

---

## 🎯 Next Steps

1. **Verify EA is attached to chart** (not Strategy Tester)
2. **Check EA logs** in MT5 → Toolbox → Experts
3. **Wait a few seconds** after sending command (EA polls every 500ms)
4. **Check response directory** for response files

Once EA starts processing, you'll get **real MT5 data** instead of mock data!

---

## 📝 Symlink Details

**Commands symlink**:
```
mt5-commands -> /Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-commands
```

**Responses symlink**:
```
mt5-responses -> /Users/muhammadmadni/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/mt5-responses
```

Both are correctly pointing to MT5's Files directory!

