# Trade Intel AI — Production Deployment Guide

This project uses a **split architecture**: the Next.js app runs in the cloud; the MT5 bridge runs on a dedicated machine with MetaTrader 5.

## Architecture

```
┌─────────────────────────────┐     HTTPS + Firebase Auth      ┌──────────────────────────┐
│  Vercel / Cloud             │ ◄────────────────────────────► │  Users (browser)         │
│  - Next.js UI               │                                └──────────────────────────┘
│  - Authenticated API proxies│
│  - Gemini / OpenAI / data proxies │
└──────────────┬──────────────┘
               │  (optional tunnel: ngrok / Cloudflare)
               ▼
┌─────────────────────────────┐
│  Private host (your Mac/VM) │
│  - wine-mt5-connector :8080   │
│  - MT5 + MT5FileBridgeEA      │
└─────────────────────────────┘
```

**Do not** deploy trade execution (`/api/ic-markets/trade`) to serverless without a bridge — it requires the local file bridge and MT5 terminal.

---

## Phase 1: Deploy Next.js to Vercel

### Required environment variables

| Variable | Where | Required |
|----------|-------|----------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Vercel (JSON string) | **Yes** — production API auth |
| `NEXT_PUBLIC_FIREBASE_*` | Vercel | **Yes** — client Firebase config |
| `AI_PROVIDER` | Vercel / local | Optional — default `auto` (Gemini first, OpenAI fallback) |
| `GEMINI_API_KEY` | Vercel | Optional — server-only. Verify: `npm run verify:gemini` |
| `GEMINI_MODEL_TEXT` | Vercel / local | Optional — default `gemini-2.0-flash` |
| `GEMINI_MODEL_VISION` | Vercel / local | Optional — default `gemini-2.0-flash` |
| `OPENAI_API_KEY` | Vercel | Optional — server-only. Verify: `npm run verify:openai` |
| `OPENAI_MODEL_TEXT` | Vercel / local | Optional — default `gpt-4o-mini` |
| `OPENAI_MODEL_VISION` | Vercel / local | Optional — default `gpt-4o` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Local dev | Optional — path to `firebase-service-account.json` instead of inline JSON |
| `FINNHUB_API_KEY` (or `_1..N`) | Vercel | For economic/news proxies |
| `TWELVE_DATA_API_KEY` | Vercel | Price fallback |
| `NEWSDATA_API_KEY` | Vercel | News proxy |
| `STRIPE_SECRET_KEY` | Vercel | **Yes** for paid SaaS |
| `STRIPE_WEBHOOK_SECRET` | Vercel | **Yes** — webhook signing |
| `STRIPE_PRICE_ID` | Vercel | $50/month recurring price |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | Client Checkout |
| `NEXT_PUBLIC_APP_URL` | Vercel | e.g. `https://your-app.vercel.app` |
| `NODE_ENV` | Vercel | Set to `production` automatically |

### Do NOT set in production

- `ALLOW_UNAUTHENTICATED` — removed; will not bypass auth
- `NEXT_PUBLIC_GEMINI_API_KEY` — exposes billing key to browsers
- `NEXT_PUBLIC_OPENAI_API_KEY` — exposes billing key to browsers

### Deploy steps

```bash
npm run build
vercel deploy --prod
```

### Firestore security rules

Deploy rules in Firebase Console (or add `firestore.rules` to repo). Minimum:

- Users can only read/write their own `analysis/{userId}` and trade history paths
- Deny all public write access

---

## Phase 2: Run MT5 bridge on a private host

### On the bridge machine

1. Install MT5, attach `MT5FileBridgeEA.mq5` to a chart (Algo Trading enabled).
2. Configure paths: `./mt5-bridge/configure-paths.sh`
3. Start bridge: `./mt5-bridge/start-wine-bridge.sh` (port **8080**)
4. Expose via tunnel (if UI is on Vercel):
   - Cloudflare: `./start-cloudflare.sh`
   - ngrok: `./start-ngrok-all.sh`

### Connect the cloud UI to the bridge

Open the dashboard with the tunnel URL:

```
https://your-app.vercel.app/dashboard?bridge_url=https://your-tunnel.trycloudflare.com
```

Or set `NEXT_PUBLIC_BRIDGE_URL` in Vercel to the stable tunnel URL.

---

## API security (implemented)

- All `/api/*` routes require Firebase Bearer token in **production** (middleware + route handlers).
- `/api/test/*` returns **404** in production.
- Trade routes (`/api/ic-markets/*`) require authentication — they still need a reachable bridge from the **user's network** or a server-side bridge proxy (future).

---

## What works on Vercel without a bridge

- Sign-in, dashboard UI, AI analysis (data proxies + GPT)
- Firestore trade history and analysis storage
- Economic indicators, RSS/COT proxies (authenticated)

## What requires the private bridge

- Live MT5 prices, account balance, positions
- Trade execution and scalping
- Historical data from MT5

---

## Health checks

| Check | Endpoint |
|-------|----------|
| Next.js app | `GET /` |
| Bridge (local) | `GET http://localhost:8080/health` |
| Auth | Any `/api/proxy/finnhub` with `Authorization: Bearer <firebase-id-token>` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 on all API calls | Sign in; ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is set on Vercel |
| Bridge unreachable from Vercel | Use tunnel + `?bridge_url=`; MT5 cannot run on Vercel |
| Gemini errors | Set `GEMINI_API_KEY` (not public env var). Run `npm run verify:gemini` |
| Test routes 404 in prod | Expected — use local dev for `/api/test/*` |

See also: [mt5-bridge/README.md](mt5-bridge/README.md), [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)
