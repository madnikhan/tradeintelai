# MT5 EA Status Check

## Issue: Daily P/L showing $0.00 despite 4 open positions

### Current Status:
- ✅ Bridge is running and responding
- ✅ Command files are being created
- ❌ EA is NOT processing command files (no responses)

### Steps to Fix:

1. **Check if EA is Running in MT5:**
   - Open MT5
   - Look at the chart where you attached the EA
   - Check the "Experts" tab at the bottom
   - You should see "MT5FileBridgeEA" with a green smiley face (😊) or yellow clock (⏰)
   - If you see a red X (❌), the EA is not running

2. **Verify EA is Attached:**
   - Right-click on the chart
   - Select "Expert Advisors" → "MT5FileBridgeEA"
   - Make sure "Allow live trading" is checked
   - Make sure "Allow DLL imports" is checked (if needed)

3. **Check EA Logs:**
   - In MT5, go to the "Experts" tab at the bottom
   - Look for messages like:
     - "✅ File Bridge EA initialized"
     - "📁 Commands directory: ..."
     - "📨 Processing command: ..."
   - If you see error messages, note them down

4. **Recompile EA:**
   - In MT5, press F4 to open MetaEditor
   - Open `MT5FileBridgeEA.mq5`
   - Press F7 to compile
   - Make sure there are no errors
   - Close MetaEditor

5. **Reattach EA:**
   - Remove the EA from the chart (right-click → Expert Advisors → Remove)
   - Drag `MT5FileBridgeEA` from Navigator to the chart
   - Make sure "Allow live trading" is checked
   - Click OK

6. **Test Connection:**
   - After reattaching, wait 10 seconds
   - Check the "Experts" tab for any messages
   - Refresh your dashboard
   - Daily P/L should update

### Expected Behavior:
- EA should process command files within 1-2 seconds
- Response files should appear in `mt5-responses` folder
- Dashboard should show open positions and correct Daily P/L

### If Still Not Working:
1. Check MT5 terminal logs for errors
2. Verify file paths are correct
3. Make sure MT5 has write permissions to the Files folder
4. Try restarting MT5

