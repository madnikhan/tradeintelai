# 🔧 Vercel Environment Variable Fix

## ⚠️ Critical: Environment Variables Require Redeploy

**Problem:** You updated `NEXT_PUBLIC_BRIDGE_URL` in Vercel, but the bridge still shows offline.

**Root Cause:** Vercel environment variables are only loaded at **BUILD TIME**, not runtime. The running app still has the old value.

## ✅ Solution: Redeploy Your App

### Method 1: Manual Redeploy (Fastest)

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click your project: `tradeintelai`

2. **Go to Deployments Tab:**
   - Click "Deployments" in the top menu
   - Find the latest deployment

3. **Redeploy:**
   - Click the "..." menu (three dots) on the latest deployment
   - Click "Redeploy"
   - ✅ Done! Wait 1-2 minutes for deployment

### Method 2: Trigger via Git Push

I've just pushed a commit that will trigger auto-deploy. Wait 1-2 minutes.

### Method 3: Create New Deployment

1. Go to Vercel Dashboard → Deployments
2. Click "Create Deployment"
3. Select branch: `main`
4. Select latest commit
5. Click "Deploy"

## 🔍 Verify Environment Variable

**Before redeploying, verify the env var is set:**

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Check: `NEXT_PUBLIC_BRIDGE_URL`
3. Value should be: `https://d171414461e5.ngrok-free.app`
4. Make sure it's set for **Production** environment

## ✅ After Redeploy

1. Wait for deployment to complete (1-2 minutes)
2. Open your app on phone: `https://tradeintelai.vercel.app`
3. Check System Status
4. MT5 Bridge should show **GREEN** ✅

## 🐛 Still Not Working?

### Check 1: Verify ngrok is Running
```bash
# Check ngrok process
ps aux | grep ngrok

# Check ngrok URL
curl http://127.0.0.1:4040/api/tunnels | python3 -m json.tool | grep public_url
```

### Check 2: Test Bridge via ngrok
```bash
# Run test script
node test-ngrok-bridge.js

# Or manually test
curl -H "ngrok-skip-browser-warning: true" https://d171414461e5.ngrok-free.app/health
```

### Check 3: Check Browser Console
1. Open app on phone
2. Open browser dev tools (if possible)
3. Check Network tab for failed requests
4. Look for errors in Console tab

### Check 4: Verify Deployment
1. Go to Vercel Dashboard → Deployments
2. Check latest deployment logs
3. Look for any build errors
4. Verify environment variables are listed in build logs

## 📋 Quick Checklist

- [ ] ngrok is running: `ps aux | grep ngrok`
- [ ] Bridge is running: `lsof -ti:8080`
- [ ] ngrok URL is correct: `https://d171414461e5.ngrok-free.app`
- [ ] Vercel env var is set: `NEXT_PUBLIC_BRIDGE_URL=https://d171414461e5.ngrok-free.app`
- [ ] Vercel app is redeployed (after env var change)
- [ ] Test from phone after redeploy

## 💡 Pro Tip

**To avoid this in the future:**
- Set environment variables BEFORE first deployment
- Or use Vercel CLI: `vercel env add NEXT_PUBLIC_BRIDGE_URL`
- Then deploy: `vercel --prod`

