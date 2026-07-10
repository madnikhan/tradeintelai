#!/usr/bin/env bash
# Copy MT5 bridge files into Tauri resources, fetch deps, and generate icons
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
RES="$ROOT/src-tauri/resources"
BRIDGE="$RES/bridge"
ICONS="$ROOT/src-tauri/icons"
ASSETS="$ROOT/assets"
BUILD_DESKTOP="${BUILD_DESKTOP:-0}"

mkdir -p "$BRIDGE" "$RES/python" "$RES/cloudflared" "$ICONS"

MT5="$REPO/mt5-bridge"
for f in wine-mt5-connector.py mt5_paths.py bridge-watchdog.py MT5FileBridgeEA.mq5 TradeIntelAutoEA.mq5 configure-paths.sh start-wine-bridge.sh CLIENT_PLATFORMS.md auto-trader-daemon.py auto-trader-executor.py auto-trader-worker.ts; do
  if [ -f "$MT5/$f" ]; then
    cp "$MT5/$f" "$BRIDGE/"
  fi
done
mkdir -p "$BRIDGE/colleague" "$BRIDGE/windows"
cp "$MT5/colleague/COLLEAGUE_SETUP.md" "$BRIDGE/colleague/"
cp "$MT5/windows/README.md" "$BRIDGE/windows/" 2>/dev/null || true

echo "Bridge files copied to $BRIDGE"
rm -rf "$BRIDGE/mt5-commands"

# Icons from TradeIntel logo
if [ -f "$ASSETS/logo.png" ]; then
  echo "Generating icons from $ASSETS/logo.png"
  (cd "$ROOT" && npm run icons --silent)
elif [ ! -f "$ICONS/icon.ico" ]; then
  python3 "$ROOT/scripts/generate-icons.py" "$ICONS" 2>/dev/null || true
fi

if [ "$BUILD_DESKTOP" = "1" ]; then
  echo "Release build: fetching bundled Python and cloudflared..."
  rm -f "$RES/python/.keep" "$RES/cloudflared/.keep"
  bash "$ROOT/scripts/fetch-dependencies.sh"
  bash "$ROOT/scripts/verify-dependencies.sh"
else
  touch "$RES/python/.keep"
  touch "$RES/cloudflared/.keep"
  echo "Dev prepare: skipping dependency fetch (set BUILD_DESKTOP=1 for release bundle)"
fi

echo "Resources ready under $RES"
