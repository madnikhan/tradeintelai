#!/usr/bin/env bash
# Download cloudflared binary for the current OS/arch into resources/cloudflared/
set -euo pipefail

OUT="${1:?output directory}"
mkdir -p "$OUT"

CF_VERSION="2026.5.0"
BASE_URL="https://github.com/cloudflare/cloudflared/releases/download/${CF_VERSION}"

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      if [ "$arch" = "arm64" ] || [ "$arch" = "aarch64" ]; then
        echo "darwin-arm64"
      else
        echo "darwin-amd64"
      fi
      ;;
    Linux)
      if [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then
        echo "linux-arm64"
      else
        echo "linux-amd64"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      echo "windows-amd64"
      ;;
    *)
      echo "unsupported" >&2
      exit 1
      ;;
  esac
}

PLATFORM="$(detect_platform)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching cloudflared ${CF_VERSION} for ${PLATFORM} into ${OUT}"

case "$PLATFORM" in
  windows-amd64)
    URL="${BASE_URL}/cloudflared-windows-amd64.exe"
    DEST="${OUT}/cloudflared.exe"
    curl -fsSL "$URL" -o "$DEST"
    ;;
  darwin-amd64)
    URL="${BASE_URL}/cloudflared-darwin-amd64.tgz"
    curl -fsSL "$URL" -o "$TMP/cloudflared.tgz"
    tar -xzf "$TMP/cloudflared.tgz" -C "$TMP"
    install -m 755 "$TMP/cloudflared" "${OUT}/cloudflared"
    ;;
  darwin-arm64)
    URL="${BASE_URL}/cloudflared-darwin-arm64.tgz"
    curl -fsSL "$URL" -o "$TMP/cloudflared.tgz"
    tar -xzf "$TMP/cloudflared.tgz" -C "$TMP"
    install -m 755 "$TMP/cloudflared" "${OUT}/cloudflared"
    ;;
  linux-amd64)
    URL="${BASE_URL}/cloudflared-linux-amd64"
    DEST="${OUT}/cloudflared"
    curl -fsSL "$URL" -o "$DEST"
    chmod +x "$DEST"
    ;;
  linux-arm64)
    URL="${BASE_URL}/cloudflared-linux-arm64"
    DEST="${OUT}/cloudflared"
    curl -fsSL "$URL" -o "$DEST"
    chmod +x "$DEST"
    ;;
  *)
    echo "Unsupported platform: $PLATFORM" >&2
    exit 1
    ;;
esac

if [ "$PLATFORM" = "windows-amd64" ]; then
  "$DEST" --version
else
  "${OUT}/cloudflared" --version
fi

echo "cloudflared ready"
