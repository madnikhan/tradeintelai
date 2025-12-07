# 🔄 Firestore Multi-Account Data Management

**How Firestore handles data when switching between different trading accounts**

---

## 📊 Current Implementation

### **Account-Specific Data Isolation**

When you switch trading accounts, Firestore automatically separates data using account-specific document IDs:

```
Format: {userId}_{accountLogin}

Example:
- User: user_1234567890_abc
- Account 1 (Login: 52556154): user_1234567890_abc_52556154
- Account 2 (Login: 98765432): user_1234567890_abc_98765432
```

---

## 🔍 How It Works

### **1. Data Structure in Firestore**

```
trades/
  ├── {userId}_{accountLogin1}/
  │   └── trades/
  │       ├── trade_1
  │       ├── trade_2
  │       └── ...
  │
  └── {userId}_{accountLogin2}/
      └── trades/
          ├── trade_1
          ├── trade_2
          └── ...

analysis/
  ├── {userId}_{accountLogin1}/
  │   └── results/
  │       ├── analysis_EURUSD_123
  │       └── ...
  │
  └── {userId}_{accountLogin2}/
      └── results/
          └── ...

analytics/
  ├── {userId}_{accountLogin1}/
  │   └── snapshots/
  │       └── ...
  │
  └── {userId}_{accountLogin2}/
      └── snapshots/
          └── ...
```

### **2. Account Detection**

The system automatically detects the current active account from:
- **AccountManager**: Gets the active account login
- **MT5 Bridge**: Uses the account login from MT5 connection

### **3. Automatic Switching**

When you switch accounts:
1. ✅ **New trades** → Saved to new account's collection
2. ✅ **New analysis** → Saved to new account's collection
3. ✅ **Performance metrics** → Calculated per account
4. ✅ **No data mixing** → Each account's data is isolated

---

## 🎯 Benefits

### **✅ Complete Data Isolation**
- Each trading account has its own data
- No mixing between accounts
- Easy to track performance per account

### **✅ Automatic Account Detection**
- No manual configuration needed
- Uses MT5 account login automatically
- Works seamlessly when switching accounts

### **✅ Backward Compatible**
- Existing data (without account login) still works
- Falls back to userId if account not detected
- Migration happens automatically

---

## 📝 Example Scenarios

### **Scenario 1: Switching from Demo to Live Account**

**Before (Demo Account - Login: 12345):**
```
trades/user_abc_12345/trades/
  ├── trade_1 (Demo)
  └── trade_2 (Demo)
```

**After (Live Account - Login: 67890):**
```
trades/user_abc_67890/trades/
  ├── trade_1 (Live)
  └── trade_2 (Live)
```

**Result:** ✅ Demo and Live data are completely separate

---

### **Scenario 2: Multiple Live Accounts**

**Account 1 (Login: 11111):**
```
trades/user_abc_11111/trades/
  └── [Account 1 trades]
```

**Account 2 (Login: 22222):**
```
trades/user_abc_22222/trades/
  └── [Account 2 trades]
```

**Result:** ✅ Each account's data is isolated

---

## 🔧 Technical Details

### **Account Context Functions**

```typescript
// Get account-specific document ID
getAccountDocumentId()
// Returns: "user_1234567890_abc_52556154"

// Get account collection ID
getAccountCollectionId()
// Returns: "account_52556154"

// Check if account context available
hasAccountContext()
// Returns: true if account login detected
```

### **Data Storage**

All Firestore operations use account-specific IDs:
- ✅ `saveTradeToFirestore()` → Uses account document ID
- ✅ `saveAnalysisToFirestore()` → Uses account document ID
- ✅ `calculatePerformanceMetrics()` → Filters by account
- ✅ `getTradesFromFirestore()` → Gets account-specific trades

---

## ⚠️ Important Notes

### **1. Account Login Required**
- System needs MT5 account login to isolate data
- If account login not available, falls back to userId only
- All data under same userId will be mixed (backward compatibility)

### **2. Account Switching**
- When switching accounts, new data goes to new account's collection
- Old account's data remains in Firestore (not deleted)
- You can access any account's data by switching back

### **3. Data Migration**
- Existing data (without account login) stays under userId
- New data (with account login) goes to account-specific collection
- Both coexist (backward compatible)

---

## 🎯 Best Practices

### **✅ Do:**
- Keep MT5 connected when trading (for account detection)
- Use AccountSelector to switch accounts properly
- Check account login in MT5 before trading

### **❌ Don't:**
- Manually edit Firestore document IDs
- Switch accounts while trades are being saved
- Delete account data manually (use UI instead)

---

## 🔍 Verifying Account Isolation

### **Check Firestore Console:**

1. Go to [Firebase Console](https://console.firebase.google.com/project/tradeintelai/firestore/data)
2. Navigate to `trades` collection
3. You should see separate documents for each account:
   - `user_xxx_52556154` (Account 1)
   - `user_xxx_98765432` (Account 2)

### **Check Browser Console:**

```javascript
// Get current account context
import { getAccountInfo } from '@/lib/firebase/account-context';
console.log(getAccountInfo());
// Output: { userId: "...", accountLogin: "52556154", documentId: "...", collectionId: "..." }
```

---

## 📊 Summary

| Feature | Behavior |
|---------|----------|
| **Account Switching** | ✅ Automatic data isolation |
| **Data Storage** | ✅ Per-account collections |
| **Backward Compatible** | ✅ Works with old data |
| **Account Detection** | ✅ Automatic from MT5 |
| **Data Mixing** | ❌ Never (isolated) |

---

## ✅ Conclusion

**Firestore automatically handles multi-account data isolation!**

- ✅ Each account's data is stored separately
- ✅ Switching accounts = automatic data isolation
- ✅ No manual configuration needed
- ✅ Backward compatible with existing data

**Just switch accounts normally - Firestore handles the rest!** 🎯

