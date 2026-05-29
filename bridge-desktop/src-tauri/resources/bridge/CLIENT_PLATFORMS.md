# TradeIntel AI — Client Platform Guide

This guide explains which platforms support the MT5 bridge and how mobile users can connect.

## Supported platforms

### Windows (recommended)

Native support. Best experience for clients and colleagues.

1. Download **TradeIntel Bridge** desktop app from the dashboard (`/onboarding` or Settings).
2. Install on the PC where **MetaTrader 5 Desktop** is installed.
3. Open the app → **Copy EA to Experts** → compile in MetaEditor (F7) → attach to chart.
4. Enable **Algo Trading** in MT5.
5. Click **Connect dashboard** in the app (tunnel is automatic).

**Requirements:** Windows 10+, MT5 Desktop. Python and cloudflared are bundled in the desktop app.

**Advanced (ZIP):** Manual bridge zip still available for power users; requires separate Python and tunnel setup.

### macOS / Linux (via Wine)

Supported but more setup. MT5 must run under Wine with the same file-bridge layout.

1. Download **TradeIntel Bridge** `.dmg` from the dashboard (desktop app bundles Python + cloudflared).
2. Install to **Applications** (see install troubleshooting below if macOS blocks the app).
3. Open the app → **Copy EA to Experts** → compile → attach → **Connect dashboard**.

**macOS install troubleshooting (if you see "damaged and can't be opened")**

This is **not** a corrupt download. macOS Gatekeeper blocks unsigned apps downloaded from the browser.

1. Mount the `.dmg` and drag **TradeIntel Bridge** to **Applications**
2. Clear quarantine on the **installed app** (not only the DMG):

```bash
xattr -dr com.apple.quarantine "/Applications/TradeIntel Bridge.app"
```

Or: **Right-click** the app in Applications → **Open** (first launch only).

**Apple Silicon only:** Current CI builds `aarch64` DMG (M1/M2/M3). Intel Macs need a separate x64 build.

**Advanced (ZIP):** Manual scripts zip still available; requires separate Python and tunnel setup.

- Use `colleague/start_colleague_bridge.sh` or `start-wine-bridge.sh` from the zip.
- See `colleague/COLLEAGUE_SETUP.md` in the zip.

### Windows install troubleshooting (SmartScreen)

If Windows shows **"Windows protected your PC"**, click **More info** → **Run anyway**. The MSI is unsigned until a code-signing certificate is added.

---

### Docker (advanced)

Optional Docker setup under `mt5-bridge/docker/` for running MT5 + bridge in containers on Mac/Linux hosts. Still desktop MT5 + EA, not mobile.

---

## NOT supported: MT5 mobile app (Android / iPhone)

The TradeIntel bridge uses:

```
Dashboard (browser) → HTTPS tunnel → Python bridge → JSON files → MT5 Expert Advisor → MT5 Desktop
```

The **MT5 mobile apps cannot**:

- Run Expert Advisors (EAs)
- Expose the `MQL5/Files` folder the bridge uses
- Host the Python bridge software

**Trading from the MT5 iPhone/Android app alone is not compatible with TradeIntel bridge/trading.**

---

## Mobile users: how to connect

Mobile users can use TradeIntel from their **phone browser**, but the bridge must run elsewhere:

| Setup | Description |
|-------|-------------|
| **Windows VPS (recommended)** | Rent a Windows VPS, install MT5 Desktop + bridge, keep it running 24/7. Open TradeIntel on your phone; dashboard connects via HTTPS tunnel to the VPS. |
| **Home PC always on** | Same as VPS, but bridge runs on a home Windows PC with a tunnel (Cloudflare/ngrok). |
| **Mobile MT5 only** | Not supported for bridge/trading. Analysis-only use would require a separate product mode (not available today). |

### Mobile flow

```
Phone browser → tradeintelai.vercel.app/dashboard
                      ↓ HTTPS
              Cloudflare/ngrok tunnel
                      ↓
         Windows PC/VPS (Python bridge :8080)
                      ↓
              MT5 Desktop + EA
```

### Mobile algo trading (alerts + approve)

Supported via the TradeIntel **PWA** (Add to Home Screen) + home PC bridge:

| Feature | How |
|---------|-----|
| **Trade execution alerts** | Settings → Connect **Telegram** bot (private DM) + optional public channel |
| **Push notifications** | Settings → Enable push (requires Firebase VAPID key on server) |
| **Alert Mode** | Settings → Alert Mode — keeps dashboard open on PC, scans every 5 min for executable signals |
| **Tap to approve** | Open dashboard link with `?approve=1&symbol=EURUSD` from push/Telegram |

**Checklist:** PC on → Bridge v1.0.1 → MT5 EA connected → phone Home Screen → Telegram linked → Alert Mode (optional)

---

## Quick reference

| Question | Answer |
|----------|--------|
| Does the Python bridge work on Windows? | **Yes** — primary platform |
| Can my client use MT5 on iPhone? | **Not for the bridge** — use phone browser + Windows VPS/PC |
| Telegram trade alerts? | **Yes** — link bot in Settings; channel for broadcast signals |
| Must MT5 and bridge be on the same machine? | **Yes** — shared filesystem for file IPC |
| Can Vercel host the bridge? | **No** — bridge runs on client/colleague PC or VPS |

For step-by-step install, see `colleague/COLLEAGUE_SETUP.md` inside the bridge zip.
