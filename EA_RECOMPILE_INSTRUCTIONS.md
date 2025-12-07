# EA Recompile Instructions - Fix Trade Sync Timeout

## Problem
The EA is timing out when fetching closed positions because the old code is too slow (O(n²) algorithm).

## Solution
I've optimized the `GetClosedPositionsJSON()` function to be much faster. You need to recompile the EA in MT5.

## Steps to Fix

### 1. Open MetaEditor
- In MT5, press **F4** or go to **Tools → MetaQuotes Language Editor**

### 2. Open the EA File
- In MetaEditor, navigate to: **Experts → MT5FileBridgeEA.mq5**
- Or open: `mt5-bridge/MT5FileBridgeEA.mq5` from your project

### 3. Compile the EA
- Press **F7** or click the **Compile** button
- Wait for compilation to complete
- Check for any errors in the "Errors" tab (should be none)

### 4. Reattach EA to Chart
- Go back to MT5
- **Remove** the old EA from your chart:
  - Right-click on the chart → **Expert Advisors → Remove**
- **Attach** the newly compiled EA:
  - In Navigator panel, find **Expert Advisors → MT5FileBridgeEA**
  - Drag it onto your EURUSD H4 chart
  - Click **OK** in the settings dialog

### 5. Verify EA is Running
- Check the **Experts** tab in Toolbox (bottom panel)
- You should see: "✅ File Bridge EA initialized"
- The EA should show a green smiley face in the top-right of the chart

### 6. Test Trade Sync
- Go to your dashboard
- Click **"Sync Trades"** button
- Check the browser console (F12) for detailed logs
- Check MT5 Experts log for messages like:
  - "📋 Getting closed positions..."
  - "📋 Starting closed positions scan..."
  - "✅ Found X closed positions"

## What Changed

The optimized code:
- ✅ Processes only the last 2000 deals (instead of all)
- ✅ Uses efficient single-pass algorithm (O(n) instead of O(n²))
- ✅ Adds progress logging
- ✅ Should complete in < 5 seconds instead of timing out

## If Still Timing Out

If the EA still times out after recompiling:

1. **Check EA Logs**: Look in MT5 Experts tab for error messages
2. **Check Bridge Logs**: `tail -f mt5-bridge/bridge.log`
3. **Verify EA is Running**: Make sure green smiley face is visible on chart
4. **Try Manual Test**: In MT5, check if you can see trade history manually:
   - Go to **Toolbox → History** tab
   - Verify you can see your closed trades there

## Expected Behavior After Fix

- EA should respond to closed-positions requests within 5 seconds
- Dashboard should show your 6 trades with correct P/L
- Daily P/L, Monthly P/L, and Unrealized P/L should display correctly

