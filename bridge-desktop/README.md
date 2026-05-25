# TradeIntel Bridge Desktop

Cross-platform desktop app (Tauri) that bundles everything clients need:

- **Python 3.12** (embedded in the installer)
- **cloudflared** (secure tunnel — no brew/winget)
- MT5 HTTP bridge + EA files
- **Connect dashboard** one-click flow
- System tray status (Connected / Disconnected)

Installers: **MSI** (Windows), **DMG** (macOS), **deb / AppImage** (Linux)

## Client setup (3 steps)

1. **Install** TradeIntel Bridge from the dashboard download
2. **MT5 EA** — Copy EA → compile (F7) → attach to chart → Algo Trading on
3. **Connect dashboard** — one click in the app

No separate Python, cloudflared, or tunnel URL setup required.

## Development

Requirements:

- Node.js 20+
- Rust stable (`rustup`)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
cd bridge-desktop
npm install
npm run prepare:resources    # dev: bridge files only
npm run tauri dev
```

For local testing with bundled deps (same as production installer):

```bash
npm run prepare:resources:release
npm run tauri dev
```

## Production build

```bash
cd bridge-desktop
npm run icons                          # from assets/logo.png
npm run prepare:resources:release      # fetch Python + cloudflared
npm run build:desktop
```

Installers appear under `src-tauri/target/release/bundle/`.

Copy to the web app for gated download:

```bash
mkdir -p ../private/downloads/bridge-desktop
cp src-tauri/target/release/bundle/msi/*.msi ../private/downloads/bridge-desktop/
cp src-tauri/target/release/bundle/dmg/*.dmg ../private/downloads/bridge-desktop/
cp src-tauri/target/release/bundle/appimage/*.AppImage ../private/downloads/bridge-desktop/
```

## CI

GitHub Actions workflow `.github/workflows/bridge-desktop.yml` builds on Windows, macOS, and Linux with bundled dependencies.

## Tray status

| State | Meaning |
|-------|---------|
| Stopped | Bridge process not running |
| Running — MT5 disconnected | HTTP bridge up; EA not attached |
| Connected | `/health` reports `mt5_connected: true` |
| Error | Process exited or failed to start |

## Notes

- **Windows** is the primary target (native MT5).
- **Mac/Linux** require MT5 Desktop via Wine; the app still manages the bridge.
- MT5 **mobile apps cannot** run the EA — use a PC/VPS for the bridge.
- Expected installer size: ~80–120 MB (includes Python + cloudflared).

## Install troubleshooting

### macOS — &quot;damaged and can&apos;t be opened&quot;

This is **Gatekeeper**, not a corrupt DMG. The app is downloaded unsigned from the dashboard.

1. Mount the `.dmg` → drag **TradeIntel Bridge** to **Applications**
2. Clear quarantine on the **installed app**:

```bash
xattr -dr com.apple.quarantine "/Applications/TradeIntel Bridge.app"
```

Or **Right-click** the app → **Open** (first launch).

**Apple Silicon (M1/M2/M3)** only for the current GitHub release (`aarch64.dmg`). Intel Macs need an x64 build.

Open the app from **Applications**, not from inside the DMG.

### Windows — SmartScreen

Click **More info** → **Run anyway** if Windows blocks the unsigned MSI.

### Linux — AppImage

```bash
chmod +x tradeintel-bridge*.AppImage
./tradeintel-bridge*.AppImage
```
