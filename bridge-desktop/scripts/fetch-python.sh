#!/usr/bin/env bash
# Download and unpack embedded Python 3.12 for the current OS/arch
set -euo pipefail

OUT="${1:?output directory}"
mkdir -p "$OUT"
PY_VER="3.12.7"
PBS_RELEASE="20241016"

OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Fetching Python ${PY_VER} for ${OS}/${ARCH} into ${OUT}"

fetch_pbs() {
  local target="$1"
  local url="https://github.com/indygreg/python-build-standalone/releases/download/${PBS_RELEASE}/cpython-${PY_VER}+${PBS_RELEASE}-${target}-install_only.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  curl -fsSL "$url" -o "$tmp/python.tar.gz"
  tar -xzf "$tmp/python.tar.gz" -C "$tmp"
  cp -R "$tmp/python/"* "$OUT/"
  rm -rf "$tmp"
}

case "$OS" in
  Darwin)
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
      fetch_pbs "aarch64-apple-darwin"
    else
      fetch_pbs "x86_64-apple-darwin"
    fi
    echo "macOS Python unpacked to $OUT"
    ;;
  Linux)
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      fetch_pbs "aarch64-unknown-linux-gnu"
    else
      fetch_pbs "x86_64-unknown-linux-gnu"
    fi
    echo "Linux Python unpacked to $OUT"
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    URL="https://www.python.org/ftp/python/${PY_VER}/python-${PY_VER}-embed-amd64.zip"
    TMP="$(mktemp -d)"
    curl -fsSL "$URL" -o "$TMP/python.zip"
    unzip -q "$TMP/python.zip" -d "$OUT"
    rm -rf "$TMP"
    # Enable stdlib imports in embeddable Python
    PTH="${OUT}/python312._pth"
    if [ -f "$PTH" ]; then
      if ! grep -q '^import site$' "$PTH"; then
        printf '\nimport site\n' >> "$PTH"
      fi
    fi
    echo "Windows embeddable Python unpacked to $OUT"
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

# Verify
case "$OS" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    "$OUT/python.exe" --version
    ;;
  *)
    if [ -x "$OUT/bin/python3" ]; then
      "$OUT/bin/python3" --version
    elif [ -x "$OUT/bin/python" ]; then
      "$OUT/bin/python" --version
    else
      echo "Python binary not found after fetch" >&2
      exit 1
    fi
    ;;
esac
