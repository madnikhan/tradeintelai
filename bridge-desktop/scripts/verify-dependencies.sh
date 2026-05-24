#!/usr/bin/env bash
# Verify bundled Python and cloudflared exist and run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/src-tauri/resources"
OS="$(uname -s)"

python_bin=""
cloudflared_bin=""

case "$OS" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    python_bin="$RES/python/python.exe"
    cloudflared_bin="$RES/cloudflared/cloudflared.exe"
    ;;
  *)
    python_bin="$RES/python/bin/python3"
    if [ ! -x "$python_bin" ]; then
      python_bin="$RES/python/bin/python"
    fi
    cloudflared_bin="$RES/cloudflared/cloudflared"
    ;;
esac

if [ ! -f "$python_bin" ]; then
  echo "Missing bundled Python at $python_bin" >&2
  exit 1
fi

if [ ! -f "$cloudflared_bin" ]; then
  echo "Missing bundled cloudflared at $cloudflared_bin" >&2
  exit 1
fi

"$python_bin" --version
"$cloudflared_bin" --version
"$python_bin" -c "import json, http.server, logging, os, socketserver, time; print('bridge stdlib ok')"

echo "Dependency verification passed"
