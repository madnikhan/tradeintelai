# 🔒 Firestore Security Rules with Firebase Authentication

**Updated security rules for authenticated users**

---

## 🚀 Quick Setup

1. Go to [Firebase Console](https://console.firebase.google.com/project/tradeintelai/firestore/rules)
2. Replace with the rules below
3. Click **"Publish"**

---

## 🔐 Production-Ready Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the data
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Helper function to extract userId from document path
    // Format: {userId}_{accountLogin} or just {userId}
    function extractUserId(docPath) {
      // Document path format: "user_xxx_12345" or "user_xxx"
      // Extract the userId part (before the last underscore if account login exists)
      let parts = docPath.split('_');
      // If it's just userId, return it
      // If it's userId_accountLogin, return userId part
      // For now, we'll check if the document path starts with auth.uid
      return docPath;
    }
    
    // Trades collection - users can only access their own trades
    match /trades/{document=**} {
      // Allow if:
      // 1. User is authenticated
      // 2. Document path starts with their user ID
      allow read, write: if isAuthenticated() && 
        (resource == null || 
         resource.id.matches('^' + request.auth.uid + '.*') ||
         request.resource.id.matches('^' + request.auth.uid + '.*'));
    }
    
    // Analysis collection - users can only access their own analysis
    match /analysis/{document=**} {
      allow read, write: if isAuthenticated() && 
        (resource == null || 
         resource.id.matches('^' + request.auth.uid + '.*') ||
         request.resource.id.matches('^' + request.auth.uid + '.*'));
    }
    
    // Analytics collection - users can only access their own analytics
    match /analytics/{document=**} {
      allow read, write: if isAuthenticated() && 
        (resource == null || 
         resource.id.matches('^' + request.auth.uid + '.*') ||
         request.resource.id.matches('^' + request.auth.uid + '.*'));
    }
    
    // Market data - public read, authenticated write
    match /market_data/{document=**} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // ML training data - users can only access their own
    match /ml_training/{document=**} {
      allow read, write: if isAuthenticated() && 
        (resource == null || 
         resource.id.matches('^' + request.auth.uid + '.*') ||
         request.resource.id.matches('^' + request.auth.uid + '.*'));
    }
    
    // Logs - users can only access their own logs
    match /logs/{document=**} {
      allow read, write: if isAuthenticated() && 
        (resource == null || 
         resource.id.matches('^' + request.auth.uid + '.*') ||
         request.resource.id.matches('^' + request.auth.uid + '.*'));
    }
  }
}
```

---

## 🔧 Simplified Rules (Easier to Debug)

If the above rules are too complex, use this simpler version:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Trades collection - authenticated users only
    match /trades/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Analysis collection - authenticated users only
    match /analysis/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Analytics collection - authenticated users only
    match /analytics/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Market data - public read, authenticated write
    match /market_data/{document=**} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // ML training data - authenticated users only
    match /ml_training/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Logs - authenticated users only
    match /logs/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}
```

**Note:** This simplified version requires updating the data structure to use `{userId}` as the first collection level instead of `{userId}_{accountLogin}`. The current implementation uses `{userId}_{accountLogin}` format.

---

## 🔄 Migration Path

### **Option 1: Update Data Structure (Recommended)**

Change Firestore structure to:
```
trades/
  └── {userId}/
      └── {accountLogin}/
          └── trades/
              └── {tradeId}
```

This makes security rules simpler and more secure.

### **Option 2: Keep Current Structure**

Use the first set of rules that check if document ID starts with `auth.uid`.

---

## ⚠️ Temporary Rules (For Testing)

While setting up authentication, you can use these temporary rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY: Allow all reads and writes for authenticated users
    // ⚠️ WARNING: Change these before production!
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ Important:** These rules allow any authenticated user to access any data. Use only for testing!

---

## ✅ Verification

After updating rules:

1. **Sign in** to your app
2. **Check browser console** - should see no permission errors
3. **Try saving a trade** - should work
4. **Check Firebase Console** - verify data is saved

---

## 🔐 Best Practices

1. **Always require authentication** - `request.auth != null`
2. **Check user ownership** - `request.auth.uid == userId`
3. **Validate data** - Check required fields, data types
4. **Test thoroughly** - Test with different users
5. **Monitor access** - Check Firebase Console logs

---

## 📝 Next Steps

1. ✅ Enable Firebase Authentication
2. ✅ Update security rules
3. ✅ Test authentication flow
4. ✅ Verify data isolation
5. ✅ Monitor for errors

---

**After enabling authentication, update the security rules to match your data structure!**

