# 🔄 Clear Cache Instructions for iPhone

## ⚠️ Problem: App Shows Old Version After Redeploy

After redeploying Vercel, your iPhone might still be using cached JavaScript files, so it's still trying to connect to the old bridge URL.

## ✅ Solution: Clear Cache on iPhone

### Method 1: Hard Refresh (Easiest)

1. **Open the app in Safari on iPhone**
2. **Tap and hold the refresh button** (circular arrow icon)
3. **Select "Reload Without Content Blockers"** or just wait for the menu
4. **Or swipe down to refresh** multiple times

### Method 2: Clear Safari Cache (If PWA Installed)

1. **Go to iPhone Settings**
2. **Scroll down and tap "Safari"**
3. **Tap "Clear History and Website Data"**
4. **Confirm by tapping "Clear History and Data"**
5. **Reopen the app**

### Method 3: Uninstall and Reinstall PWA (If Installed as App)

1. **Find the app icon** on your iPhone home screen
2. **Long press the icon**
3. **Tap "Remove App"** or the "X" button
4. **Confirm deletion**
5. **Go back to Safari**
6. **Visit:** `https://tradeintelai.vercel.app`
7. **Tap the Share button** (square with arrow)
8. **Scroll down and tap "Add to Home Screen"**
9. **Tap "Add"**
10. **Open the newly installed app**

### Method 4: Force Reload via Settings (Most Thorough)

1. **Open Safari on iPhone**
2. **Visit:** `https://tradeintelai.vercel.app/dashboard`
3. **Tap the "aA" button** in the address bar (left side)
4. **Tap "Website Settings"**
5. **Tap "Clear History and Website Data"**
6. **Go back to the website**
7. **Hard refresh:** Pull down to refresh multiple times

## 🔍 Verify New Version is Loaded

After clearing cache, check:

1. **Open browser console** (if possible on iPhone):
   - Open Safari
   - Go to Settings → Advanced → Web Inspector (enable)
   - Connect iPhone to Mac
   - Open Safari on Mac → Develop → [Your iPhone] → [Website]

2. **Check the bridge URL in console:**
   ```javascript
   // In browser console, run:
   console.log(process.env.NEXT_PUBLIC_BRIDGE_URL);
   // Should show: https://d171414461e5.ngrok-free.app
   ```

3. **Or check Network tab:**
   - Look for requests to `/health` endpoint
   - Should be going to: `https://d171414461e5.ngrok-free.app/health`

## 🚀 Quick Test

After clearing cache:

1. **Open the app**
2. **Check System Status**
3. **MT5 Bridge should show GREEN** ✅

## 💡 Pro Tip: Add Version Check

To prevent this in the future, we can add a version check that forces cache refresh when a new version is deployed.

## 🆘 Still Not Working?

If clearing cache doesn't work:

1. **Check ngrok is still running:**
   ```bash
   ps aux | grep ngrok
   ```

2. **Verify ngrok URL hasn't changed:**
   ```bash
   curl http://127.0.0.1:4040/api/tunnels | python3 -m json.tool | grep public_url
   ```

3. **Test bridge directly:**
   ```bash
   curl -H "ngrok-skip-browser-warning: true" https://d171414461e5.ngrok-free.app/health
   ```

4. **Check Vercel deployment logs** for any errors

5. **Verify environment variable** is set correctly in Vercel

