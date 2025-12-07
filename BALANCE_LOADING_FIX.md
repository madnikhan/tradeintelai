# ✅ Balance Loading Fix

**Issue:** Trading blocked with "MT5 balance not loaded" error

**Root Cause:** 
- Balance was initialized to 0
- When MT5 bridge is not connected, balance stays at 0
- Risk calculator blocks trading when balance <= 0

**Fixes Applied:**

1. **Default Demo Balance** (`config/trading-rules.ts`):
   - Changed `DEMO_BALANCE: 0` to `DEMO_BALANCE: 100000`
   - Provides fallback balance when MT5 not connected

2. **Initial Account State** (`app/dashboard/page.tsx`):
   - Changed `emptyAccount.balance: 0` to `emptyAccount.balance: TRADING_RULES.DEMO_BALANCE`
   - Dashboard starts with default balance instead of 0

3. **Balance Loading Logic** (`app/dashboard/page.tsx`):
   - Added fallback to use default demo balance if MT5 fetch fails
   - Better error handling and logging
   - Validates balance > 0 before using MT5 data

4. **Risk Calculator** (`lib/risk-calculator.ts`):
   - Uses default balance from TradingModeManager if MT5 balance not available
   - Allows trading in demo mode with default balance
   - Better error messages

**Result:**
- Trading no longer blocked when MT5 not connected (demo mode)
- Default balance used as fallback
- Real MT5 balance still loaded when available
- Better user experience

**Testing:**
1. Start dashboard without MT5 bridge → Should show default demo balance
2. Connect MT5 bridge → Should load real balance
3. Trading should be allowed in both cases (demo mode)

