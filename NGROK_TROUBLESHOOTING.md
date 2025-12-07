# 🔧 ngrok Troubleshooting Guide

## ✅ Fixed: ngrok Free Tier Browser Warning

**Problem:** ngrok free tier shows a browser warning page that blocks API requests.

**Solution:** Added `ngrok-skip-browser-warning: true` header to all bridge requests.

## 📋 Verification Checklist

### 1. Verify ngrok is Running
```bash
# Check ngrok process
ps aux | grep ngrok

# Check ngrok web interface
open http://127.0.0.1:4040
```

### 2. Verify Bridge is Running
```bash
# Check bridge process
lsof -ti:8080

# Test bridge directly
curl http://localhost:8080/health
```

### 3. Verify ngrok URL
```bash
# Get ngrok URL
curl http://127.0.0.1:4040/api/tunnels | python3 -m json.tool | grep public_url
```

### 4. Test ngrok URL
```bash
# Test with header (should work)
curl -H "ngrok-skip-browser-warning: true" https://your-ngrok-url.ngrok-free.app/health

# Should return: {"status": "running", "mt5_connected": false}
```

### 5. Verify Vercel Environment Variable
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Check: `NEXT_PUBLIC_BRIDGE_URL=https://your-ngrok-url.ngrok-free.app`
3. Make sure it's set for **Production** environment
4. **Redeploy** after updating

## 🐛 Common Issues

### Issue: Bridge Status Shows Red/Offline

**Possible Causes:**
1. ❌ ngrok URL not set in Vercel
2. ❌ ngrok tunnel stopped
3. ❌ Bridge stopped
4. ❌ Wrong ngrok URL in Vercel
5. ❌ CORS issues (should be fixed with headers)

**Solutions:**
1. ✅ Check Vercel env var is set correctly
2. ✅ Restart ngrok: `ngrok http 8080`
3. ✅ Restart bridge: `npm run bridge`
4. ✅ Update Vercel env var with new ngrok URL
5. ✅ Redeploy Vercel app

### Issue: Connection Timeout

**Possible Causes:**
1. ❌ Bridge not running
2. ❌ ngrok tunnel down
3. ❌ Firewall blocking
4. ❌ Network issues

**Solutions:**
1. ✅ Check bridge: `curl http://localhost:8080/health`
2. ✅ Check ngrok: `curl http://127.0.0.1:4040/api/tunnels`
3. ✅ Restart both if needed

### Issue: CORS Errors

**Status:** ✅ Fixed - Bridge has CORS headers enabled

If you still see CORS errors:
1. Check bridge logs for CORS headers
2. Verify bridge is sending `Access-Control-Allow-Origin: *`

## 🔍 Debugging Steps

### Step 1: Test Locally
```bash
# Test bridge directly
curl http://localhost:8080/health

# Test via ngrok
curl -H "ngrok-skip-browser-warning: true" https://your-ngrok-url.ngrok-free.app/health
```

### Step 2: Check Browser Console
1. Open app on phone
2. Open browser dev tools (if possible) or check network tab
3. Look for failed requests to `/health` endpoint
4. Check error messages

### Step 3: Check Vercel Logs
1. Go to Vercel Dashboard → Deployments
2. Click on latest deployment
3. Check "Functions" tab for errors
4. Check "Logs" for runtime errors

### Step 4: Verify Environment Variable
```bash
# In Vercel Dashboard, verify:
NEXT_PUBLIC_BRIDGE_URL=https://d171414461e5.ngrok-free.app
```

## ✅ Success Indicators

When everything is working:
- ✅ Bridge status shows **green light** in SystemStatus
- ✅ Account balance loads
- ✅ Trades can be executed
- ✅ No CORS errors in console
- ✅ No timeout errors

## 🆘 Still Not Working?

1. **Check ngrok URL changed:**
   - Free tier URLs change on restart
   - Update Vercel env var with new URL
   - Redeploy

2. **Check bridge is accessible:**
   ```bash
   curl -H "ngrok-skip-browser-warning: true" https://your-ngrok-url.ngrok-free.app/health
   ```

3. **Check Vercel deployment:**
   - Make sure latest code is deployed
   - Check deployment logs for errors

4. **Try local network access:**
   - Use your computer's IP instead of ngrok
   - See `MT5_BRIDGE_MOBILE_ACCESS.md` for details

