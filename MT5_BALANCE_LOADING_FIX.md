# 🔧 MT5 Balance Loading Fix

**Issue:** Balance not showing from MT5 connected account

**Root Cause:**
- Balance check was too strict (`balance > 0`) which could reject valid 0 balances
- Error handling wasn't clear enough
- Need to ensure MT5 EA is properly returning balance data

**Fixes Applied:**

1. **Balance Validation** (`app/dashboard/page.tsx`):
   - Changed from `accountInfo.balance > 0` to `accountInfo.balance !== undefined && accountInfo.balance !== null`
   - Accepts 0 as valid balance (some accounts may have 0 balance)
   - Better error logging

2. **Removed Fake Balance Fallback**:
   - Removed default balance fallback
   - Only shows real MT5 balance
   - Shows 0 if MT5 not connected (not fake balance)

3. **Risk Calculator** (`lib/risk-calculator.ts`):
   - Only allows trading with real MT5 balance
   - Clear error message when balance not loaded

**Troubleshooting Steps:**

1. **Check MT5 EA is Running:**
   - EA must be attached to a chart
   - Check MT5 Experts tab for EA logs
   - Should see: `✅ Account Info: Balance=... Equity=...`

2. **Check Python Bridge:**
   - Bridge must be running: `python3 wine-mt5-connector.py`
   - Check bridge logs for account info requests
   - Should see: `📤 Sent account info request: account_...`

3. **Check File Communication:**
   - Commands: `MQL5/Files/mt5-commands/`
   - Responses: `MQL5/Files/mt5-responses/`
   - Files should be created/deleted automatically

4. **Check Dashboard Logs:**
   - Open browser console
   - Look for: `✅ Real MT5 balance loaded: ...`
   - Or: `⚠️ MT5 balance not loaded. Account info response: ...`

5. **Verify Account is Logged In:**
   - MT5 must be logged in to your account
   - Account must be active
   - Check MT5 terminal for connection status

**Expected Behavior:**
- Dashboard shows 0 balance initially
- When MT5 connects, balance updates to real value
- Trading blocked until real balance is loaded
- Clear error messages if connection fails

