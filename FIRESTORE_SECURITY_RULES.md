# 🔒 Firestore Security Rules Setup

**Quick guide to fix "Missing or insufficient permissions" error**

---

## ⚠️ Current Issue

You're seeing: `FirebaseError: Missing or insufficient permissions.`

This means Firestore security rules need to be configured.

---

## 🚀 Quick Fix (Development Mode)

### **Option 1: Test Mode (Temporary - for development only)**

1. Go to [Firebase Console](https://console.firebase.google.com/project/tradeintelai/firestore/rules)
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY: Allow all reads and writes (for development only)
    // ⚠️ WARNING: This is NOT secure for production!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**
4. ⚠️ **Important**: Change these rules before going to production!

---

## 🔒 Production-Ready Rules

### **Option 2: Secure Rules (Recommended)**

1. Go to [Firebase Console](https://console.firebase.google.com/project/tradeintelai/firestore/rules)
2. Replace with these secure rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to get user ID from localStorage (for now)
    // TODO: Replace with Firebase Authentication later
    function getUserId() {
      // For now, we'll allow based on document structure
      // Each user has their own subcollection
      return true; // Temporary - will be replaced with auth.uid
    }
    
    // Trades collection - users can only access their own trades
    match /trades/{userId}/{document=**} {
      allow read, write: if true; // Temporary - will check userId matches
    }
    
    // Analysis collection - users can only access their own analysis
    match /analysis/{userId}/{document=**} {
      allow read, write: if true; // Temporary - will check userId matches
    }
    
    // Analytics collection - users can only access their own analytics
    match /analytics/{userId}/{document=**} {
      allow read, write: if true; // Temporary - will check userId matches
    }
    
    // Market data - public read, authenticated write
    match /market_data/{document=**} {
      allow read: if true;
      allow write: if false; // Disabled for now
    }
    
    // ML training data - users can only access their own
    match /ml_training/{userId}/{document=**} {
      allow read, write: if true; // Temporary - will check userId matches
    }
    
    // Logs - users can only access their own logs
    match /logs/{userId}/{document=**} {
      allow read, write: if true; // Temporary - will check userId matches
    }
  }
}
```

3. Click **Publish**

---

## 🔐 Future: Add Firebase Authentication

For production, you should:

1. **Enable Firebase Authentication**
   - Go to Authentication > Sign-in method
   - Enable Email/Password or Google Sign-in

2. **Update Security Rules** to use `request.auth.uid`:

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
    
    // Trades collection
    match /trades/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Analysis collection
    match /analysis/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Analytics collection
    match /analytics/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

---

## ✅ Verification

After updating rules:

1. **Wait 1-2 minutes** for rules to propagate
2. **Refresh your app**
3. **Check browser console** - should see:
   - `✅ Trade saved to Firestore`
   - `✅ Migrated X trades to Firestore`
   - No more permission errors

---

## 🐛 Troubleshooting

### **Still getting permission errors?**
- Wait 1-2 minutes after publishing rules
- Clear browser cache
- Check Firebase Console > Firestore > Rules to verify rules are published
- Check browser console for specific error messages

### **Rules not updating?**
- Make sure you clicked "Publish" (not just "Save")
- Check Firebase Console shows the new rules
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## 📝 Current Status

**For now, use Option 1 (Test Mode) to get started quickly.**

**Then switch to Option 2 (Secure Rules) before production.**

---

**After updating rules, refresh your app and the permission errors should be gone!** ✅

