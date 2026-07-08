# Remote Bridge Setup

Execute trades from anywhere when your **home laptop** runs MT5 + TradeIntel Bridge.

## Architecture

- **Home laptop**: MT5, EA, `wine-mt5-connector.py` (watchdog + swap-close + heartbeat)
- **Tunnel**: Cloudflare or ngrok exposes port 8080
- **Dashboard** (phone/laptop): Firebase auth → reads bridge presence → calls tunnel URL

## Option A — Named tunnel (recommended)

1. Create a **Cloudflare named tunnel** or **ngrok reserved domain** pointing to `localhost:8080`
2. Save the fixed URL in **Settings → MT5 Bridge → Tunnel URL**
3. Pair once (below) — heartbeat keeps presence online

## Option B — Ephemeral quick tunnel

1. On home PC: `npm run bridge` then `npm run cloudflare`
2. Copy the **Bridge URL** from the script output
3. Pair with that URL — heartbeat auto-updates Firestore when URL changes on restart

## Pair home bridge

1. Sign in on dashboard → **Settings → MT5 Bridge → Generate pairing code**
2. On home laptop (with bridge running):

```bash
npm run bridge:pair 123456 https://your-tunnel.trycloudflare.com
```

3. Dashboard shows **Home bridge: online** within ~30 seconds

## What runs server-side (no browser needed)

| Feature | Where |
|---------|--------|
| Position smart exit | `bridge-watchdog.py` on laptop |
| Islamic swap-close | Same watchdog (default 22:00 GMT) |
| Presence heartbeat | `bridge-agent.py` → `/api/bridge/heartbeat` |
| Outcome sync | Browser poll (optional) + MT5 SL/TP at broker |

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_BRIDGE_WATCHDOG` | Vercel (default on) | Use server-side watch |
| `TRADEINTEL_APP_URL` | Home laptop | Heartbeat target (default production URL) |
| `BRIDGE_PUBLIC_URL` | Home laptop | Tunnel URL for heartbeat |
| `BRIDGE_AUTH_DISABLED=1` | Local dev only | Skip bridge bearer token |

## Security

- After pairing, `/trade`, `/close-position`, and `/watch/*` require `Authorization: Bearer <token>`
- Dashboard fetches token via `/api/bridge/credentials` (Firebase auth required)
- Do not share your tunnel URL publicly without pairing enabled

## Manual checklist

1. Home: bridge + MT5 + EA running
2. Pair with 6-digit code
3. Phone: sign in → Home bridge online
4. Execute 0.01 demo → close browser → verify watchdog logs on laptop
5. Islamic panel: enable swap-close → confirm config syncs to bridge
