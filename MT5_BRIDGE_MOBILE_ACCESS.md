# 📱 MT5 Bridge Mobile Access Guide

## 🔍 Current Architecture

**Problem:** The MT5 bridge runs locally on your computer (`http://localhost:8080`), but when you access the web app from a phone:
- ❌ Phone can't reach `localhost` (that's the phone's own localhost)
- ❌ Phone can't reach your computer's localhost from the internet
- ✅ Phone CAN reach your computer if on the same WiFi network

## 🎯 Solutions for Mobile Access

### Option 1: Local Network Access (Same WiFi) ⭐ Recommended for Home Use

**How it works:**
- Your computer and phone are on the same WiFi network
- Phone connects to your computer's local IP address
- Bridge URL: `http://YOUR_COMPUTER_IP:8080`

**Setup Steps:**

1. **Find your computer's local IP address:**

   **Mac:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Look for something like: 192.168.1.100
   ```

   **Windows:**
   ```cmd
   ipconfig
   # Look for IPv4 Address, something like: 192.168.1.100
   ```

2. **Update bridge configuration:**

   In Vercel Dashboard → Environment Variables, add:
   ```
   NEXT_PUBLIC_BRIDGE_URL=http://YOUR_COMPUTER_IP:8080
   ```
   
   Example:
   ```
   NEXT_PUBLIC_BRIDGE_URL=http://192.168.1.100:8080
   ```

3. **Configure firewall:**
   - Allow incoming connections on port 8080
   - Mac: System Preferences → Security → Firewall → Firewall Options → Add Python/Node
   - Windows: Windows Defender Firewall → Allow an app → Add Python

4. **Start bridge on all interfaces:**
   
   The bridge needs to listen on `0.0.0.0` instead of `localhost`:
   
   ```bash
   # Modify bridge-router.py or http-bridge.py to bind to 0.0.0.0
   # Change: server = HTTPServer(('localhost', 8080), ...)
   # To: server = HTTPServer(('0.0.0.0', 8080), ...)
   ```

**Pros:**
- ✅ Free
- ✅ Fast (local network)
- ✅ Secure (only accessible on your WiFi)

**Cons:**
- ❌ Only works on same WiFi network
- ❌ IP address may change (use static IP or update env var)

---

### Option 2: Tunneling Service (ngrok, localtunnel) ⭐ Recommended for Testing

**How it works:**
- Creates a public URL that tunnels to your local bridge
- Phone connects via the public URL
- Bridge URL: `https://your-tunnel-url.ngrok.io`

**Setup with ngrok:**

1. **Install ngrok:**
   ```bash
   # Mac
   brew install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Start your MT5 bridge:**
   ```bash
   npm run bridge
   # Bridge runs on localhost:8080
   ```

3. **Create tunnel:**
   ```bash
   ngrok http 8080
   # You'll get a URL like: https://abc123.ngrok.io
   ```

4. **Update Vercel environment variable:**
   ```
   NEXT_PUBLIC_BRIDGE_URL=https://abc123.ngrok.io
   ```

5. **For permanent URL (paid ngrok):**
   ```bash
   ngrok http 8080 --domain=your-custom-domain.ngrok.io
   ```

**Setup with localtunnel (free alternative):**

1. **Install localtunnel:**
   ```bash
   npm install -g localtunnel
   ```

2. **Create tunnel:**
   ```bash
   lt --port 8080
   # You'll get a URL like: https://random-name.loca.lt
   ```

3. **Update Vercel environment variable:**
   ```
   NEXT_PUBLIC_BRIDGE_URL=https://random-name.loca.lt
   ```

**Pros:**
- ✅ Works from anywhere (internet)
- ✅ Free (with limitations)
- ✅ Easy to set up

**Cons:**
- ❌ URL changes on restart (free tier)
- ❌ Slower than local network
- ❌ Requires keeping tunnel running

---

### Option 3: Cloud Bridge (VPS/Server) ⭐ Recommended for Production

**How it works:**
- Run MT5 bridge on a cloud server (VPS)
- Bridge URL: `http://your-server-ip:8080` or `https://bridge.yourdomain.com`

**Setup Steps:**

1. **Get a VPS:**
   - DigitalOcean, AWS EC2, Linode, etc.
   - Minimum: 1GB RAM, 1 CPU

2. **Install MT5 on VPS:**
   - Use Wine (Linux) or Windows Server
   - Install MT5
   - Set up bridge

3. **Configure domain (optional):**
   - Point `bridge.yourdomain.com` to VPS IP
   - Use HTTPS with Let's Encrypt

4. **Update Vercel environment variable:**
   ```
   NEXT_PUBLIC_BRIDGE_URL=https://bridge.yourdomain.com
   ```

**Pros:**
- ✅ Always available
- ✅ Works from anywhere
- ✅ Professional setup
- ✅ Can use HTTPS

**Cons:**
- ❌ Costs money (~$5-20/month)
- ❌ More complex setup
- ❌ Requires VPS management

---

### Option 4: Hybrid Approach (Best of Both Worlds)

**How it works:**
- Use local network when on WiFi
- Use tunnel/cloud when away
- App detects network and switches automatically

**Implementation:**

```typescript
// config/bridge-config.ts
function getBridgeUrl() {
  // Check if on local network
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If accessing from localhost or local IP, use local bridge
    if (hostname === 'localhost' || hostname.startsWith('192.168.')) {
      return process.env.NEXT_PUBLIC_BRIDGE_URL_LOCAL || 'http://192.168.1.100:8080';
    }
  }
  
  // Otherwise use cloud/tunnel URL
  return process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://your-tunnel-url.ngrok.io';
}
```

---

## 🔧 Implementation Guide

### Step 1: Update Bridge to Listen on All Interfaces

**File: `mt5-bridge/bridge-router.py`**

Change:
```python
server = ThreadingHTTPServer(('localhost', args.port), RouterHTTPHandler)
```

To:
```python
server = ThreadingHTTPServer(('0.0.0.0', args.port), RouterHTTPHandler)
```

This allows connections from other devices on your network.

### Step 2: Update Bridge Configuration

**File: `config/bridge-config.ts`**

```typescript
export const BRIDGE_CONFIG = {
  // Use environment variable, fallback to localhost for development
  baseUrl: process.env.NEXT_PUBLIC_BRIDGE_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'http://YOUR_COMPUTER_IP:8080'),
  // ... rest of config
};
```

### Step 3: Set Environment Variables

**For Local Network Access:**
```
NEXT_PUBLIC_BRIDGE_URL=http://192.168.1.100:8080
```

**For Tunneling:**
```
NEXT_PUBLIC_BRIDGE_URL=https://your-tunnel.ngrok.io
```

**For Cloud:**
```
NEXT_PUBLIC_BRIDGE_URL=https://bridge.yourdomain.com
```

---

## 🛡️ Security Considerations

### Local Network Access
- ✅ Only accessible on your WiFi
- ⚠️ Anyone on your WiFi can access (use strong WiFi password)
- ⚠️ No encryption (HTTP only)

### Tunneling
- ⚠️ Public URL (anyone with URL can access)
- ✅ HTTPS available (encrypted)
- ⚠️ Use authentication if exposing publicly

### Cloud Bridge
- ✅ Can use HTTPS
- ✅ Can add authentication
- ✅ Can restrict by IP
- ⚠️ Requires proper security setup

---

## 📋 Quick Start: Local Network Access

1. **Find your IP:**
   ```bash
   # Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Update bridge to listen on 0.0.0.0:**
   - Edit `mt5-bridge/bridge-router.py`
   - Change `('localhost', 8080)` to `('0.0.0.0', 8080)`

3. **Set environment variable in Vercel:**
   ```
   NEXT_PUBLIC_BRIDGE_URL=http://YOUR_IP:8080
   ```

4. **Allow firewall:**
   - Mac: System Preferences → Security → Firewall
   - Windows: Windows Defender Firewall

5. **Test from phone:**
   - Connect phone to same WiFi
   - Open app on phone
   - Should connect to bridge!

---

## 🆘 Troubleshooting

**Phone can't connect:**
- ✅ Check computer and phone are on same WiFi
- ✅ Verify firewall allows port 8080
- ✅ Check bridge is listening on `0.0.0.0`, not `localhost`
- ✅ Verify IP address is correct

**Connection timeout:**
- ✅ Check bridge is running
- ✅ Verify port 8080 is not blocked
- ✅ Check IP address hasn't changed

**Works on computer but not phone:**
- ✅ Bridge is probably listening on `localhost` only
- ✅ Change to `0.0.0.0` to allow network connections

---

## 💡 Recommendation

**For Development/Testing:**
- Use **Local Network Access** (Option 1) - free, fast, secure on your WiFi

**For Production:**
- Use **Cloud Bridge** (Option 3) - always available, professional

**For Quick Testing:**
- Use **Tunneling** (Option 2) - easy setup, works from anywhere

