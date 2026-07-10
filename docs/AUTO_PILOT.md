# Auto Pilot — Sniper-like full-auto MT5 forex

TradeIntel now supports **two modes**:

| Mode | Where | Behavior |
|------|--------|----------|
| **Copilot** | Dashboard Trade / Scan tabs | Gated analysis → Approve & Execute |
| **Auto Pilot** | Bridge Desktop daemon | 24/7 scan → auto-execute when Gate 4 passes |

## Quick start (Windows VPS recommended)

1. Subscribe at [tradeintelai.vercel.app](https://tradeintelai.vercel.app).
2. Install **TradeIntel Bridge** desktop app.
3. MT5: attach `MT5FileBridgeEA.mq5` (Copilot) or `TradeIntelAutoEA.mq5` (socket fallback on Mac).
4. Dashboard → **Auto Pilot** tab → configure preset, pairs, kill switches → **Save**.
5. Bridge Desktop → **Start Auto Pilot** (starts bridge if needed + daemon).
6. Keep **dry run** enabled until demo goals are met.

## Architecture

```
Dashboard (config/status) → Firestore
Bridge Desktop → auto-trader-daemon.py → gated analysis (local tsx or cloud API)
                → MT5 Python API (Windows) or bridge HTTP / socket EA
                → bridge-watchdog.py (position management)
```

Vercel is **not** in the execution hot path. Tunnel is optional for remote monitoring.

## Strategy presets

- **Scalp** — 60s scan, OHLC-only, 70% min confidence, scalp watchdog profile
- **Trend** — 5m scan, vision on candidates, 65% confidence
- **Conservative** — 15m scan, 75% confidence, max 2 open trades

## Kill switches

- Max daily loss ($)
- Max open trades / trades per day
- Demo-only lock until demo success goals met (`AUTO_PILOT_ALLOW_LIVE=1` to override on live)

## Config files

- Daemon config: `mt5-bridge/data/auto-pilot-config.json`
- Daemon status: `mt5-bridge/data/auto-pilot-status.json`
- Logs: `%LOCALAPPDATA%\TradeIntel Bridge\auto-pilot.log` (Windows)

## Environment (daemon)

| Variable | Purpose |
|----------|---------|
| `AUTO_PILOT_API_TOKEN` | Firebase ID token for license + cloud analyze |
| `TRADEINTEL_API_BASE` | Dashboard URL (default production Vercel) |
| `AUTO_PILOT_SKIP_LICENSE` | Dev only — skip subscription check |
| `AUTO_PILOT_ALLOW_LIVE` | Allow live account when demo lock enabled |
| `MT5_BRIDGE_PORT` | HTTP bridge port (default 8080) |

## Copilot vs Auto Pilot

See [VPS_SETUP.md](./VPS_SETUP.md) for hosting requirements.
