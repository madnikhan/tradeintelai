#!/usr/bin/env bash
# Build tradeintel-bridge.zip for gated download (stored outside public/)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/private/downloads"
ZIP="$OUT/tradeintel-bridge.zip"
README="$ROOT/mt5-bridge/BRIDGE_README.txt"
mkdir -p "$OUT"

cat > "$README" <<'EOF'
TradeIntel AI — MT5 Bridge (Quick Start)
========================================

WINDOWS (recommended)
1. Install MetaTrader 5 Desktop and Python 3.10+ (python.org, add to PATH).
2. Copy MT5FileBridgeEA.mq5 into MT5 → File → Open Data Folder → MQL5/Experts, compile (F7).
3. Attach EA to a chart; enable Algo Trading.
4. Double-click colleague\start_colleague_bridge.bat  OR  windows\StartBridge.bat
5. Open http://localhost:8080/health — should show "running".
6. Expose port 8080 with Cloudflare Tunnel or ngrok (HTTPS URL).
7. In TradeIntel dashboard → Settings, save your tunnel URL.

MAC / LINUX
- Unzip the full package into a folder (e.g. ~/tradeintel-bridge).
- cd tradeintel-bridge   (must contain wine-mt5-connector.py)
- Run: chmod +x colleague/start_colleague_bridge.sh configure-paths.sh start-wine-bridge.sh
- Run: ./colleague/start_colleague_bridge.sh   (recommended)
  OR: ./configure-paths.sh then ./start-wine-bridge.sh
- Requires MT5 Desktop via Wine; Python 3.10–3.13 recommended (avoid 3.14 alpha if issues).

MOBILE (Android/iPhone MT5 app)
- The MT5 mobile app CANNOT run this bridge.
- Use a Windows PC or Windows VPS for the bridge; open TradeIntel in your phone browser.

See colleague/COLLEAGUE_SETUP.md and CLIENT_PLATFORMS.md for full details.
EOF

TMP=$(mktemp -d)
PKG="$TMP/tradeintel-bridge"
mkdir -p "$PKG/colleague" "$PKG/windows"
SRC="$ROOT/mt5-bridge"

cp "$SRC/wine-mt5-connector.py" "$PKG/"
cp "$SRC/MT5FileBridgeEA.mq5" "$PKG/"
cp "$SRC/configure-paths.sh" "$PKG/"
cp "$SRC/start-wine-bridge.sh" "$PKG/"
cp "$SRC/BRIDGE_README.txt" "$PKG/"
cp "$SRC/CLIENT_PLATFORMS.md" "$PKG/"
cp "$SRC/colleague/setup_colleague_bridge.py" "$PKG/colleague/"
cp "$SRC/colleague/start_colleague_bridge.sh" "$PKG/colleague/"
cp "$SRC/colleague/start_colleague_bridge.bat" "$PKG/colleague/"
cp "$SRC/colleague/COLLEAGUE_SETUP.md" "$PKG/colleague/"
cp "$SRC/windows/StartBridge.bat" "$PKG/windows/"
cp "$SRC/windows/StartBridge.ps1" "$PKG/windows/"
cp "$SRC/windows/README.md" "$PKG/windows/"

chmod +x "$PKG/configure-paths.sh" "$PKG/start-wine-bridge.sh" "$PKG/colleague/start_colleague_bridge.sh"

cd "$TMP"
rm -f "$ZIP"
zip -r "$ZIP" tradeintel-bridge > /dev/null
rm -rf "$TMP"

echo "Created $ZIP"
