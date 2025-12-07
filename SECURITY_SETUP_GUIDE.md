# 🔒 Security Setup Guide

**Complete guide to secure your application before deployment**

---

## ⚠️ CRITICAL: Before Deployment

Your application has been updated with security fixes, but you **MUST** complete these steps before deploying to production.

---

## 📋 Step 1: Environment Variables Setup

### Create `.env.local` (if not exists)

```bash
# Server-side only API keys (NOT exposed to browser)
# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# Finnhub (can have multiple keys for rotation)
FINNHUB_API_KEY_1=d4pkc3pr01qjpnavsjngd4pkc3pr01qjpnavsjo0
FINNHUB_API_KEY_2=d4pkcj1r01qjpnavsmq0d4pkcj1r01qjpnavsmqg
FINNHUB_API_KEY_3=d4pkd6pr01qjpnavsqb0d4pkc3pr01qjpnavsqbg
FINNHUB_API_KEY_4=d4pkdrhr01qjpnavsu6gd4pkc3pr01qjpnavsu70

# TwelveData
TWELVE_DATA_API_KEY_1=e51a952f311147e19de6cb729936add5
TWELVE_DATA_API_KEY_2=d25f429a780d435a887ab21403700370
TWELVE_DATA_API_KEY_3=4f7e8be5b74c42f583922c41b982f020
TWELVE_DATA_API_KEY_4=cccc38c956524d919402e893da9790c4

# NewsData
NEWSDATA_API_KEY_1=pub_2bfe5fe8fe9d4ad690fcad0b8500b11a
NEWSDATA_API_KEY_2=pub_f5dbdab0e54b466fa90d6e504dc48c71
NEWSDATA_API_KEY_3=pub_8c719184afce42209bf42c29b4c7d0b0
NEWSDATA_API_KEY_4=pub_83484b6b08bc8707da09ad664ca86a492aad9

# Fixer.io
FIXER_API_KEY_1=c8998d52162967494b23d56bd756c0fb
FIXER_API_KEY_2=3e64d3879a618932999f1733b145059b
FIXER_API_KEY_3=79b72abfb2b336c725ab0fd13a88e43a
FIXER_API_KEY_4=39115fef7dad604a933f669e32ff9fe9

# Alpha Vantage
ALPHA_VANTAGE_API_KEY_1=W1URSCEOYIWOEKSK
ALPHA_VANTAGE_API_KEY_2=KWU63M40DZZ781LT
ALPHA_VANTAGE_API_KEY_3=TMX48FBYYEUFI62Z
ALPHA_VANTAGE_API_KEY_4=DMGRQXNWR21XBZX3

# Firebase (client-side - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlW035F2FeUguS_sfcAdD4RoK4JK1EFcA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tradeintelai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tradeintelai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tradeintelai.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1094200603774
NEXT_PUBLIC_FIREBASE_APP_ID=1:1094200603774:web:ce65733910c700f0ff142f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-Z04YSNTRJG

# Firebase Admin (for server-side auth verification - OPTIONAL for production)
# Get from Firebase Console > Project Settings > Service Accounts
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

### ⚠️ Important Notes:

1. **NEVER commit `.env.local` to git** (already in `.gitignore`)
2. **Remove `NEXT_PUBLIC_` prefix** from server-side keys (OpenAI, API keys)
3. **Keep `NEXT_PUBLIC_` prefix** only for Firebase config (safe to expose)
4. **For production deployment**, set these in your hosting platform's environment variables

---

## 📋 Step 2: Install Firebase Admin (Production Only)

For production, install Firebase Admin SDK for proper token verification:

```bash
npm install firebase-admin
```

Then set `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable with your service account JSON.

**Get Service Account Key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Copy the JSON and set as `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

**Note:** For development, the app will work without Firebase Admin (with basic token validation).

---

## 📋 Step 3: Remove Hardcoded Keys

The file `config/api-keys.ts` still contains hardcoded keys. 

**Action Required:**
1. **Backup your keys** (copy them to `.env.local` first)
2. **Delete or rename** `config/api-keys.ts` to `config/api-keys.ts.backup`
3. **Update imports** in files that use it (see below)

**Files that need updating:**
- `lib/data-providers/finnhub.ts`
- `lib/data-providers/newsdata.ts`
- `lib/data-providers/twelve-data.ts`
- `lib/data-providers/alpha-vantage.ts`
- `components/OpportunityScanner.tsx`

**Option:** Keep `config/api-keys.ts` for now but mark it as deprecated. The new server-side API routes will use environment variables.

---

## 📋 Step 4: Update Data Providers (Optional)

The data providers (`lib/data-providers/*.ts`) currently use `apiKeyManager` from `config/api-keys.ts`.

**Two Options:**

### Option A: Keep Current Structure (Easier)
- Data providers continue to work as-is
- They can be called server-side (from API routes or server components)
- Client-side code should call the new `/api/proxy/*` routes instead

### Option B: Update to Use API Routes (Recommended)
- Update data providers to call `/api/proxy/*` routes
- Requires authentication tokens
- More secure but requires more changes

**For now, Option A is fine** - the critical security fixes are in place.

---

## 📋 Step 5: Test Authentication

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Sign in to your app** (required for OpenAI features)

3. **Test OpenAI API:**
   - Go to AI Trading Dashboard
   - Click "Start AI Analysis"
   - Should work if authenticated, fail with "Unauthorized" if not

4. **Check browser console** for any auth errors

---

## 📋 Step 6: Production Deployment Checklist

Before deploying to production:

- [ ] All API keys moved to environment variables
- [ ] `.env.local` is NOT committed to git
- [ ] Environment variables set in hosting platform (Vercel, etc.)
- [ ] Firebase Admin installed (for production)
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` set in production
- [ ] Test authentication in production
- [ ] Test API routes with authentication
- [ ] Review Firestore security rules
- [ ] Enable HTTPS only
- [ ] Set up monitoring and alerting

---

## 🔐 What's Been Secured

✅ **OpenAI API Key** - Now server-side only, requires authentication  
✅ **API Routes** - All external API routes require Firebase Auth  
✅ **Authentication Middleware** - Created and integrated  
✅ **Server-Side API Key Manager** - Reads from environment variables  

---

## ⚠️ What Still Needs Attention

🟡 **Hardcoded Keys** - `config/api-keys.ts` still exists (backup your keys first!)  
🟡 **Data Providers** - Still use old API key manager (works but not ideal)  
🟡 **Rate Limiting** - Not yet implemented (see SECURITY_FIXES_IMPLEMENTATION.md)  
🟡 **Firebase Admin** - Optional for dev, required for production  

---

## 🚀 Next Steps

1. **Complete environment variable setup** (Step 1)
2. **Test authentication** (Step 5)
3. **Deploy to staging** and test
4. **Implement rate limiting** (optional but recommended)
5. **Deploy to production** after all tests pass

---

## 📚 Additional Resources

- `SECURITY_AUDIT_REPORT.md` - Full security assessment
- `SECURITY_FIXES_IMPLEMENTATION.md` - Detailed implementation guide
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Firebase Admin Setup](https://firebase.google.com/docs/admin/setup)

---

**⚠️ DO NOT DEPLOY TO PRODUCTION UNTIL STEP 1 IS COMPLETE**

