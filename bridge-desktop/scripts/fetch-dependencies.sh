#!/usr/bin/env bash
# Fetch all bundled runtime dependencies (Python + cloudflared)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/src-tauri/resources"

bash "$ROOT/scripts/fetch-python.sh" "$RES/python"
bash "$ROOT/scripts/fetch-cloudflared.sh" "$RES/cloudflared"

echo "All dependencies fetched into $RES"
