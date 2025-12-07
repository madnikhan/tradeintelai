# 🚀 ngrok Quick Start for MT5 Bridge

## 📋 Prerequisites

1. **ngrok installed:**
   ```bash
   # Mac
   brew install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **MT5 Bridge running:**
   ```bash
   npm run bridge
   # Bridge should be running on port 8080
   ```

## 🎯 Quick Setup

### Step 1: Start ngrok Tunnel

**Option A: Use the setup script**
```bash
./setup-ngrok-bridge.sh
```

**Option B: Manual**
```bash
ngrok http 8080
```

### Step 2: Copy the HTTPS URL

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:8080
```

Copy the HTTPS URL: `https://abc123.ngrok.io`

### Step 3: Update Vercel Environment Variable

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: `tradeintelai`
3. Go to **Settings** → **Environment Variables**
4. Add/Update:
   ```
   NEXT_PUBGE_URL=https://abc123.ngrok.io
   ```
   (Replace with your actual ngrok URL)

5. **Redeploy** your application

### Step 4: Test from Phone

1. Open your app on your phone (from anywhere!)
2. The app should now connect to your local MT5 bridge via ngrok
3. ✅ Mobile access working!

## 🔧 Advanced: Permanent URL (ngrok Pro)

If you have ngrok Pro, you can use a fixed domain:

```bash
ngrok http 8080 --domain=your-custom-domain.ngrok.io
```

Then set:
```
NEXT_PUBLIC_BRIDGE_URL=https://your-custom-domain.ngrok.io
```

## ⚠️ Important Notes

1. **Keep ngrok running:** The tunnel closes when you stop ngrok
2. **Free tier limitations:**
   - URL changes on restart
   - Session timeout after 2 hours
   - Limited bandwidth
3. **Security:** The ngrok URL is public. Anyone with the URL can access your bridge
   - Consider adding authentication to your bridge
   - Don't share the URL publicly

## 🛑 Stopping ngrok

Press `Ctrl+C` in the terminal where ngrok is running.

## 🔄 Restarting

If ngrok restarts, you'll get a new URL. Update the Vercel environment variable with the new URL and redeploy.

## 📱 Testing

1. Start bridge: `npm run bridge`
2. Start ngrok: `ngrok http 8080`
3. Copy HTTPS URL
4. Update Vercel env var
5. Redeploy
6. Test from phone!

## 🆘 Troubleshooting

**ngrok not connecting:**
- ✅ Check bridge is running: `lsof -ti:8080`
- ✅ Check ngrok is running: `ps aux | grep ngrok`
- ✅ Verify port 8080 is correct

**Phone can't connect:**
- ✅ Check Vercel env var is set correctly
- ✅ Check Vercel deployment is updated
- ✅ Verify ngrok URL is HTTPS (not HTTP)
- ✅ Check ngrok is still running

**Connection timeout:**
- ✅ Bridge might have stopped - restart it
- ✅ ngrok might have restarted - get new URL
- ✅ Check firewall isn't blocking

