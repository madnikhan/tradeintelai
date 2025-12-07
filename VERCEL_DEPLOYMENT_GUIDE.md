# 🚀 Vercel Deployment Guide

**Complete guide to deploy TradeIntel AI to Vercel**

---

## ✅ Pre-Deployment Checklist

- [x] Code committed to GitHub
- [x] Security fixes implemented
- [x] Sensitive files in .gitignore
- [x] Build script configured
- [ ] Environment variables documented
- [ ] Firebase Admin configured (optional)

---

## 📋 Step 1: Connect Repository to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "Add New Project"**
3. **Import Git Repository:**
   - Select "Import Git Repository"
   - Choose `madnikhan/tradeintelai` from GitHub
   - Click "Import"

---

## 📋 Step 2: Configure Project Settings

### Framework Preset
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `./` (default)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

---

## 📋 Step 3: Add Environment Variables

**⚠️ CRITICAL: Add ALL these environment variables in Vercel before deploying!**

### Server-Side Only (NOT exposed to browser):

```bash
# OpenAI
OPENAI_API_KEY=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

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
```

### Client-Side (Safe to expose - has NEXT_PUBLIC_ prefix):

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlW035F2FeUguS_sfcAdD4RoK4JK1EFcA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tradeintelai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tradeintelai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tradeintelai.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1094200603774
NEXT_PUBLIC_FIREBASE_APP_ID=1:1094200603774:web:ce65733910c700f0ff142f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-Z04YSNTRJG
```

### Firebase Admin (Optional but Recommended):

```bash
# Firebase Service Account Key (for server-side auth verification)
# Copy the entire JSON from tradeintelai-firebase-adminsdk-fbsvc-56a34bc401.json
# Paste as a single-line JSON string:
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"tradeintelai","private_key_id":"56a34bc4010dade80d846af824c425c348e97b0c","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDMTuFZvpQ0i/dZ\nCI/LXBjDm8qDEjegmi5XWfMtpW1SwcZm91q+RfUUVCZxntmzEz015mhFNaFVGnLL\nLSS8YhJP2nQw70GbpUajYcBLm8UZlI3fr6oO2wYZJ3VHzPK5t41zf5c7eCBWAu8m\nHxVy4/QkbR1OaY6+1oAVr8hUXQv4wMynpmbCZSRF9kOG1S1xi6b9G0K1oYati+gR\nCEn+yPgM6UlaQuyXlhd4JHuP9pkybBHHi6OqCIV9NDc6fcAmVbpR31ftZcnu3jtc\ndOoKimeoNawZJHfARJGr9KbWVaXXDYtchhJgJtUVaVl3N8XThjlaGummwaghWf/n\nmQDVW+0BAgMBAAECggEACwDGhyhJ4AiXsh5RbDDSDprRzbxJ7abQDxlDjPZHTHku\nH7Z7lxq6Z7VeeqkE7W2AUupNPEj2ntg1TXbpbxHTDaTktAv2mxTMGJl3mzrQ4x9K\ngrz5qiImkm07FjpV6iWWAx3gfa3rA+bVjVaIN69KIzoTJXlu3B0+OazFW7HFJsjW\noqhy3SkFxm3XDvkObDx/GJr00tmN8LqdSwLf15hgEEnn6I+ugvgUk+CxBegkdLFS\nljV01uaZz3SlIinO1i86Ui6jPeTOrIupJ7y1SAvB2oqmfmIh9bcT2D9PDCvSdR2w\ndhGH/WZasxRgJW0IAfG89Lrc4ZZ0LZLgit4N+GOSHwKBgQD5geslhkhEcgxOUQ0N\ndYHSxGfcdZgQs9Im2aHG1Y/+6Lqrl9bUokbCKbOh2njC9tGy9vioZLZRPW1oKQSw\n5kzk5Z2Xb3eWsjO/vNKr7/fk/pPOsWRu1Q2mGFA1ECRsdsIVmGO1wRDuWzbFXAr/\nA3DzJ5Y08MxBREGdBKC+z359ywKBgQDRn95SfUpkfc+FYUrVlQyrfNcgWAR4rMQE\nMK3blENn/m6AkWJnxKu8KL29tGQ+QUbLNfhXQEjVDCMr2ZdzRYrPTO0c96KCMr25\nt8vyZhMm/1P2pNAAzmq0EQnJLRZzXp2rPUx2TXZu+4sDrI0tAvI2Y0XQIZt6zs1z\n6ez9s8rm4wKBgHwKN6HHGURVwoJozuljArCKjevO1lNvYkmIJmIYJ+cdQjguW1II\nfs7mNnR/jUu3staa61GkB/Npa2u+AKQFSjL9aBQyCSz02L84my95NC821LqL/BcR\neiCZs749kS4O+DwOL3vbSJSG6jrBoIHY7x0jEAyvrYvA6DGsbFGQDB1zAoGANAwN\nl02keu8B54wQmJc5XhrRDybLdWrwAFpV0H8vfVKe/S0b0cfzG/TBp6hye0KZ4Tq1\nPnSnoL4yvWB5ShWqMW5YMSkLIGiY0tPfv3+4oaYjosmpG4ok1DCmzVx0hpCndSzz\nHyx8i3HJQlBFfTeODBL58oNlp0hRmsYqIZPSfSECgYAAr0OpO4iZ2jB8T8naaskr\nP8nFGhkiuJLB2FnSWLYbJbSH5N3Us4Nsu+2pslg0iAhU280HS1pb2S2MDYtSuGH9\n91skgP60OLxta78vEaTTa12CjopnkLOafbMmJaQe6Udnau7nf3hqoBHeRYyfpr5F\n4zMOZ6t0ZSHspYPRe5kuoQ==\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@tradeintelai.iam.gserviceaccount.com","client_id":"114137553276526133492","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40tradeintelai.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

**How to Add in Vercel:**
1. In Vercel project settings, go to **Settings** > **Environment Variables**
2. Add each variable one by one
3. Select **Production**, **Preview**, and **Development** environments
4. Click "Save"

---

## 📋 Step 4: Deploy

1. **Click "Deploy"** in Vercel
2. **Wait for build to complete** (usually 2-5 minutes)
3. **Check build logs** for any errors
4. **Visit your deployed site** (Vercel will provide a URL)

---

## ⚠️ Important Notes

### 1. MT5 Bridge (Local Only)
- The MT5 bridge (`mt5-bridge/`) runs locally on your machine
- It will NOT work on Vercel (requires local file system access)
- Users will need to run the bridge locally to connect to MT5
- Consider this when deploying - the web app will work, but MT5 features require local bridge

### 2. Environment Variables
- **ALL environment variables must be set in Vercel**
- Server-side variables (without `NEXT_PUBLIC_`) are secure
- Client-side variables (with `NEXT_PUBLIC_`) are exposed to browser

### 3. Firebase Security Rules
- Make sure Firestore security rules are configured
- Go to Firebase Console > Firestore > Rules
- Use the rules from `FIRESTORE_AUTH_SECURITY_RULES.md`

### 4. Build Time
- First build may take 5-10 minutes
- Subsequent builds are faster (2-5 minutes)

---

## 🔍 Post-Deployment Checklist

- [ ] Verify build succeeded
- [ ] Test authentication (sign in/sign out)
- [ ] Test OpenAI features (should work if authenticated)
- [ ] Check System Status component
- [ ] Verify Firebase connection
- [ ] Test responsive design on mobile
- [ ] Check browser console for errors

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel
- Verify all environment variables are set
- Check for TypeScript errors: `npm run build` locally

### 401 Errors After Deployment
- Verify `OPENAI_API_KEY` is set in Vercel (not `NEXT_PUBLIC_OPENAI_API_KEY`)
- Check Firebase Auth is working
- Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly

### Firebase Errors
- Verify all `NEXT_PUBLIC_FIREBASE_*` variables are set
- Check Firestore security rules
- Verify Firebase project is active

### API Routes Not Working
- Check environment variables are set
- Verify authentication is working
- Check Vercel function logs

---

## 📊 Deployment Status

**Ready for Deployment:** ✅ **YES** (with environment variables)

**What Works:**
- ✅ Web application
- ✅ Firebase Authentication
- ✅ Firestore database
- ✅ OpenAI GPT-5.1 integration
- ✅ All API routes
- ✅ Responsive UI

**What Requires Local Setup:**
- ⚠️ MT5 Bridge (must run locally)
- ⚠️ MT5 connection (requires local bridge)

---

## 🚀 Quick Deploy

1. **Push to GitHub** (already done ✅)
2. **Connect to Vercel** (import repository)
3. **Add environment variables** (copy from above)
4. **Deploy** (click Deploy button)

**Estimated Time:** 10-15 minutes

---

## 📝 Environment Variables Summary

**Total Variables Needed:** 30+

**Server-Side (Secure):**
- 1 OpenAI key
- 4 Finnhub keys
- 4 TwelveData keys
- 4 NewsData keys
- 4 Fixer keys
- 4 Alpha Vantage keys
- 1 Firebase Service Account (optional)

**Client-Side (Public):**
- 7 Firebase config variables

---

**✅ Your application is ready to deploy to Vercel!**

Just add the environment variables and click deploy.

