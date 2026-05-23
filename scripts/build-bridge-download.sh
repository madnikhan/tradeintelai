#!/usr/bin/env bash
# Build tradeintel-bridge.zip for gated download
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/downloads"
ZIP="$OUT/tradeintel-bridge.zip"
mkdir -p "$OUT"
cd "$ROOT/mt5-bridge"
zip -r "$ZIP" \
  wine-mt5-connector.py \
  MT5FileBridgeEA.mq5 \
  configure-paths.sh \
  start-wine-bridge.sh \
  colleague/setup_colleague_bridge.py \
  colleague/start_colleague_bridge.sh \
  colleague/start_colleague_bridge.bat \
  colleague/COLLEAGUE_SETUP.md \
  -x "*.pyc" "__pycache__/*"
echo "Created $ZIP"
