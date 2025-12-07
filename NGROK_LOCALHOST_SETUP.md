# 🚀 ngrok Localhost Setup Guide

## 💡 Why Use ngrok for Localhost?

Instead of deploying to Vercel, you can expose your local development server (`localhost:3000`) directly via ngrok. This is perfect for:
- ✅ Quick testing
- ✅ Bypassing Vercel deployment issues
- ✅ Instant updates (no rebuild needed)
- ✅ Testing with your local MT5 bridge

## 📋 Prerequisites

1. **ngrok installed** (you already have this for the MT5 bridge)
2. **Next.js dev server running** (`npm run dev`)
3. **MT5 bridge running** (on port 8080)

## 🔧 Setup Steps

### Step 1: Start Next.js Dev Server

```bash
cd /Users/muhammadmadni/trading/tradeintelai
npm run dev
```

This will start the server on `http://localhost:3000`

### Step 2: Start ngrok for Next.js

Open a **new terminal window** and run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### Step 3: Update Environment Variables

Since you're running locally, the app will use `.env.local` for environment variables.

**Make sure `.env.local` has:**
```bash
NEXT_PUBLIC_BRIDGE_URL=https://d171414461e5.ngrok-free.app
# (Your MT5 bridge ngrok URL)
```

The app will automatically use `http://localhost:8080` for the bridge if `NEXT_PUBLIC_BRIDGE_URL` is not set, but it's better to use the ngrok URL so it works from your phone.

### Step 4: Access from iPhone

1. **Open Safari on iPhone**
2. **Visit:** `https://abc123.ngrok-free.app` (your Next.js ngrok URL)
3. **The app should load!**

### Step 5: Skip ngrok Browser Warning

The ngrok free tier shows a browser warning. To skip it, you can:

**Option A: Use ngrok authtoken (Recommended)**
```bash
# Sign up for free ngrok account at https://dashboard.ngrok.com
# Get your authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

This removes the browser warning for authenticated users.

**Option B: Accept the warning**
- Click "Visit Site" on the ngrok warning page
- The app will load

## 🎯 Complete Setup Script

I'll create a script to start both services:

```bash
#!/bin/bash
# start-local-ngrok.sh

echo "🚀 Starting Next.js dev server..."
npm run dev &
DEV_PID=$!

echo "⏳ Waiting for server to start..."
sleep 5

echo "🌐 Starting ngrok tunnel..."
ngrok http 3000

# Cleanup on exit
trap "kill $DEV_PID" EXIT
```

## 📱 Using from iPhone

1. **Start Next.js:** `npm run dev`
2. **Start ngrok:** `ngrok http 3000`
3. **Copy the ngrok URL** (e.g., `https://abc123.ngrok-free.app`)
4. **Open on iPhone:** Visit the ngrok URL
5. **Add to Home Screen** (optional): Share → Add to Home Screen

## ⚙️ Configuration

### Update Bridge URL for Local Development

If you want the app to use your local MT5 bridge directly (without ngrok), you can:

**Option 1: Use localhost (only works on same network)**
```bash
# In .env.local
NEXT_PUBLIC_BRIDGE_URL=http://YOUR_MAC_IP:8080
```

**Option 2: Use MT5 bridge ngrok URL (works from anywhere)**
```bash
# In .env.local
NEXT_PUBGE_URL=https://d171414461e5.ngrok-free.app
```

## 🔄 Workflow

### Daily Development:
1. Start MT5 bridge: `npm run bridge` (or your bridge script)
2. Start ngrok for bridge: `ngrok http 8080` (if not already running)
3. Start Next.js: `npm run dev`
4. Start ngrok for Next.js: `ngrok http 3000`
5. Access from iPhone using Next.js ngrok URL

### Quick Testing:
- Make code changes
- Save file
- Next.js auto-reloads
- Refresh iPhone browser
- See changes instantly! ✅

## ⚠️ Important Notes

### ngrok Free Tier Limitations:
- **URL changes** when you restart ngrok
- **Browser warning** page (can be skipped with authtoken)
- **Connection limits** (40 connections/minute)
- **Session timeouts** (8 hours)

### ngrok Paid Tier Benefits:
- **Fixed domain** (e.g., `your-app.ngrok.io`)
- **No browser warning**
- **Higher limits**
- **Better performance**

## 🆚 ngrok vs Vercel

| Feature | ngrok (Localhost) | Vercel |
|---------|------------------|--------|
| Setup | Easy | Medium |
| Updates | Instant | Requires rebuild |
| Performance | Slower (free tier) | Fast |
| URL | Changes (free) | Fixed |
| Cost | Free/Paid | Free tier available |
| Best For | Development/Testing | Production |

## 🎯 Recommendation

**For Development/Testing:**
- ✅ Use ngrok for localhost
- ✅ Fast iteration
- ✅ Easy debugging

**For Production:**
- ✅ Use Vercel
- ✅ Better performance
- ✅ Fixed URL
- ✅ Auto-deployments

## 🚀 Quick Start

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Copy the ngrok URL and open on iPhone!
```

That's it! Your app is now accessible from your iPhone! 🎉

