# 🔍 MT5 Balance Loading Troubleshooting Guide

**Goal:** Show REAL balance from MT5 connected account (not fake/default balance)

---

## ✅ **What I Fixed:**

1. **Removed Fake Balance Fallback:**
   - No default balance used
   - Only shows real MT5 balance
   - Shows 0 if MT5 not connected

2. **Fixed Balance Validation:**
   - Changed from `balance > 0` to `balance !== undefined && balance !== null && !isNaN(balance)`
   - Now accepts 0 as valid balance (some accounts may have 0 balance)

3. **Better Error Logging:**
   - More detailed error messages
   - Logs account info response for debugging

---

## 🔧 **Troubleshooting Steps:**

### **Step 1: Check MT5 EA is Running**

1. Open MT5 Terminal
2. Open any chart (e.g., EURUSD H1)
3. Drag `MT5FileBridgeEA.mq5` onto the chart
4. Enable "Allow live trading" checkbox
5. Click OK

**Check EA Logs:**
- Go to MT5 → View → Toolbox → Experts tab
- Should see: `✅ File Bridge EA initialized`
- Should see: `Account: [your login]`
- Should see: `Balance: $[your balance]`

---

### **Step 2: Check Python Bridge is Running**

```bash
cd mt5-bridge
python3 wine-mt5-connector.py
```

**Check Bridge Logs:**
- Should see: `📤 Sent account info request: account_...`
- Should see: `📥 Received account info response: response_...`
- Should see account balance in response

---

### **Step 3: Check File Communication**

**Commands Directory:**
- Path: `MQL5/Files/mt5-commands/`
- Should see: `account_[timestamp].json` files being created/deleted

**Responses Directory:**
- Path: `MQL5/Files/mt5-responses/`
- Should see: `response_[timestamp].json` files being created/deleted

**If files not being created:**
- Check EA is attached to chart
- Check EA logs for errors
- Check file permissions

---

### **Step 4: Check Dashboard Logs**

1. Open browser console (F12)
2. Look for balance loading messages:
   - `✅ Real MT5 balance loaded: [balance] Equity: [equity] Login: [login]`
   - `⚠️ MT5 balance not loaded. Account info response: {...}`
   - `❌ Failed to fetch account balance from MT5: [error]`

---

### **Step 5: Verify Account is Logged In**

1. Check MT5 terminal shows "Connected" status
2. Check account number matches your account
3. Check balance shows in MT5 terminal
4. Verify account is active (not suspended)

---

## 🐛 **Common Issues:**

### **Issue 1: Balance Shows 0**

**Possible Causes:**
- MT5 EA not attached to chart
- Python bridge not running
- Account not logged in
- File paths incorrect

**Solution:**
1. Attach EA to chart
2. Start Python bridge
3. Check EA and bridge logs
4. Verify account is logged in

---

### **Issue 2: "MT5 EA not responding"**

**Possible Causes:**
- EA not attached to chart
- EA not enabled
- File communication broken

**Solution:**
1. Reattach EA to chart
2. Enable "Allow live trading"
3. Check EA logs for errors
4. Verify file directories exist

---

### **Issue 3: Balance Not Updating**

**Possible Causes:**
- Bridge not polling frequently enough
- EA not processing commands
- Response files not being read

**Solution:**
1. Check bridge is running
2. Check EA logs for command processing
3. Verify response files are being created
4. Check dashboard refresh interval

---

## 📋 **Verification Checklist:**

- [ ] MT5 EA attached to chart
- [ ] EA shows "smiley face" in top-right
- [ ] EA logs show initialization
- [ ] Python bridge running
- [ ] Bridge logs show requests/responses
- [ ] File directories exist
- [ ] Command/response files being created
- [ ] Dashboard shows real balance
- [ ] Browser console shows success logs

---

## 🎯 **Expected Behavior:**

1. **Dashboard Starts:**
   - Shows balance: $0.00 (or loading)
   - Trading blocked until balance loaded

2. **MT5 Connects:**
   - Balance updates to real value
   - Equity updates to real value
   - Trading allowed (if balance > 0)

3. **Balance Updates:**
   - Updates every 60 seconds
   - Shows real-time balance from MT5
   - No fake/default balance used

---

## 🔍 **Debug Commands:**

```bash
# Check if bridge is running
curl http://localhost:8080/health

# Test account info endpoint
curl http://localhost:8080/account

# Check EA logs in MT5
# View → Toolbox → Experts tab

# Check Python bridge logs
# Look in terminal where bridge is running
```

---

## ✅ **Success Indicators:**

- Dashboard shows real MT5 balance
- Balance updates automatically
- Trading allowed when balance loaded
- No fake/default balance shown
- Clear error messages if connection fails

---

**If balance still not showing, check:**
1. EA logs for account info processing
2. Bridge logs for request/response
3. Browser console for error messages
4. File directories for command/response files

