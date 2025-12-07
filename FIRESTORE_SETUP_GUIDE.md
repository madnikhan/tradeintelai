# 🔥 Firebase Firestore Setup Guide

**Quick setup guide for Firestore integration**

---

## 📋 Prerequisites

1. **Firebase Account**: Create a free account at [firebase.google.com](https://firebase.google.com)
2. **Firebase Project**: Create a new project in Firebase Console

---

## 🚀 Setup Steps

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "tradeintelai")
4. Enable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Firestore

1. In Firebase Console, go to **Build** > **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll add security rules later)
4. Select a location (choose closest to your users)
5. Click "Enable"

### Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click **Web** icon (`</>`)
4. Register app with nickname (e.g., "TradeIntel AI Web")
5. Copy the `firebaseConfig` object

### Step 4: Add Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Firebase config:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

### Step 5: Set Up Security Rules

**⚠️ IMPORTANT: You must set up security rules or you'll get "Missing or insufficient permissions" errors!**

1. In Firebase Console, go to **Firestore Database** > **Rules**
2. Replace with these **temporary development rules** (for testing):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY: Allow all reads and writes (for development/testing)
    // ⚠️ WARNING: Change these before production!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **"Publish"**

**📝 Note:** For production, see `FIRESTORE_SECURITY_RULES.md` for secure rules with authentication.

### Step 6: Create Firestore Indexes (Optional)

For better query performance, create composite indexes:

1. Go to **Firestore Database** > **Indexes**
2. Click "Create Index"
3. Add these indexes:

**Index 1: Trades by Symbol and Status**
- Collection: `trades/{userId}/trades`
- Fields: `symbol` (Ascending), `status` (Ascending), `timestamp` (Descending)

**Index 2: Analysis by Symbol and Timestamp**
- Collection: `analysis/{userId}/results`
- Fields: `symbol` (Ascending), `timestamp` (Descending)

---

## ✅ Verification

After setup, the system will:

1. **Auto-migrate** existing localStorage data to Firestore on first load
2. **Dual-write** to both localStorage and Firestore (for redundancy)
3. **Read from Firestore** first, fallback to localStorage if needed

### Check if it's working:

1. Open browser console
2. Look for messages like:
   - `✅ Migrated X trades from localStorage to Firestore`
   - `✅ Trade saved to Firestore`
   - `✅ Analysis saved to Firestore`

3. Check Firebase Console:
   - Go to **Firestore Database**
   - You should see collections: `trades`, `analysis`, `analytics`

---

## 🔒 Security Notes

- **Authentication**: Currently using anonymous user IDs stored in localStorage
- **Future**: Consider adding Firebase Authentication for better security
- **Encryption**: Sensitive data (account numbers) should be encrypted before storing

---

## 📊 Cost Monitoring

Firebase Free Tier includes:
- 50K reads/day
- 20K writes/day
- 20K deletes/day
- 1GB storage

**Monitor usage** in Firebase Console > Usage and billing

---

## 🐛 Troubleshooting

### "Firebase not configured" warning
- Check `.env.local` file exists
- Verify all environment variables are set
- Restart Next.js dev server after adding env vars

### Migration not running
- Check browser console for errors
- Verify Firestore is enabled in Firebase Console
- Check security rules allow writes

### Data not syncing
- Check browser console for Firestore errors
- Verify network connection
- Check Firebase Console for quota limits

---

## 🎯 Next Steps

1. ✅ Setup complete - system will auto-migrate
2. 🔄 Monitor Firebase Console for data
3. 📊 Check analytics in Firebase Console
4. 🔐 Consider adding Firebase Authentication
5. 📈 Monitor usage and costs

---

**Setup Complete!** 🎉 The system will now automatically sync data to Firestore.

