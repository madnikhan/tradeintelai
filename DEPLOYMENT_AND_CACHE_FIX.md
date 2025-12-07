# 🔧 Fix: Deployment + iPhone Cache

## ⚠️ Two Issues Found

1. **Deployment is from OLD commit** (`9679df1`) - missing ngrok fixes
2. **iPhone cache** - might be serving old JavaScript files

## ✅ Solution 1: Create NEW Deployment (CRITICAL)

Your current deployment is from commit `9679df1`, but the ngrok header fixes are in commits `af3e297`, `1ff6bd5`, `900dfc0`, etc.

### Steps:

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click project: `tradeintelai`

2. **Create NEW Deployment:**
   - Click **"Deployments"** tab
   - Click **"Create Deployment"** button (top right)
   - ⚠️ **DO NOT** click "Redeploy" on old deployment
   - ✅ **DO** click "Create Deployment"

3. **Select Latest Commit:**
   - **Branch**: `main`
   - **Commit**: Select the **LATEST** commit
     - Should be: `695f908` or `af3e297` or `1ff6bd5`
     - **NOT**: `9679df1` (old, missing fixes)
   - Click **"Deploy"**

4. **Wait for Build:**
   - Watch build logs
   - Should complete successfully
   - Wait 1-2 minutes

## ✅ Solution 2: Clear iPhone Cache

After the new deployment is live, clear cache on iPhone:

### Option A: Hard Refresh (Fastest)

1. **Open Safari on iPhone**
2. **Visit:** `https://tradeintelai.vercel.app/dashboard`
3. **Pull down to refresh** (swipe down from top)
4. **Do this 2-3 times** to force reload

### Option B: Clear Safari Cache

1. **Go to iPhone Settings**
2. **Scroll down → Tap "Safari"**
3. **Tap "Clear History and Website Data"**
4. **Confirm: "Clear History and Data"**
5. **Reopen the app**

### Option C: Reinstall PWA (If Installed as App)

1. **Find app icon** on iPhone home screen
2. **Long press the icon**
3. **Tap "Remove App"** or the "X"
4. **Confirm deletion**
5. **Open Safari**
6. **Visit:** `https://tradeintelai.vercel.app`
7. **Tap Share button** (square with arrow)
8. **Scroll down → "Add to Home Screen"**
9. **Tap "Add"**
10. **Open the newly installed app**

## 🔍 Verify It's Working

After both steps:

1. **Open app on iPhone**
2. **Check System Status**
3. **MT5 Bridge should show GREEN** ✅

## 📋 Quick Checklist

- [ ] Created NEW deployment (not redeploy)
- [ ] Selected latest commit (`695f908` or newer)
- [ ] Deployment completed successfully
- [ ] Cleared iPhone cache OR reinstalled PWA
- [ ] Tested from iPhone - bridge shows GREEN ✅

## 🆘 Still Not Working?

### Check 1: Verify Deployment Commit

1. Go to Vercel Dashboard → Deployments
2. Click on the latest deployment
3. Check the commit hash
4. Should be `695f908` or newer
5. If it's `9679df1` or older, create a NEW deployment

### Check 2: Verify ngrok is Running

```bash
# Check ngrok process
ps aux | grep ngrok

# Check ngrok URL
curl http://127.0.0.1:4040/api/tunnels | python3 -m json.tool | grep public_url
```

### Check 3: Test Bridge Directly

```bash
# Test bridge via ngrok
curl -H "ngrok-skip-browser-warning: true" https://d171414461e5.ngrok-free.app/health
```

### Check 4: Verify Environment Variable

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Check: `NEXT_PUBLIC_BRIDGE_URL`
3. Value: `https://d171414461e5.ngrok-free.app`
4. Make sure it's set for **Production**

## 💡 Why This Happened

- **Old Deployment**: Vercel auto-deployed from an old commit before the ngrok fixes were pushed
- **iPhone Cache**: Safari/PWA caches JavaScript files aggressively, so even after redeploy, the old code might still be cached

## ✅ After Fix

Once you:
1. ✅ Deploy from latest commit
2. ✅ Clear iPhone cache

The bridge should connect immediately! 🎉

