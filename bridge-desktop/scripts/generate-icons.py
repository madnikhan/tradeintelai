#!/usr/bin/env python3
"""Generate minimal Tauri icon set (PNG + ICO + ICNS placeholder)."""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, size: int, rgb: tuple[int, int, int]) -> None:
    r, g, b = rgb
    raw = b""
    for _ in range(size):
        raw += b"\x00" + bytes([r, g, b, 255] * size)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", compressed)
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(data)


def write_ico(path: Path) -> None:
    # Single 32x32 PNG embedded in ICO is non-trivial; write minimal BMP-based ICO
    size = 32
    bmp = bytearray()
    # BITMAPINFOHEADER
    bmp += struct.pack("<I", 40)
    bmp += struct.pack("<iiHHIIiiII", size, size * 2, 1, 32, 0, size * size * 4, 0, 0, 0, 0)
    for y in range(size - 1, -1, -1):
        for _ in range(size):
            bmp += bytes([0x06, 0xB6, 0xD4, 255])  # cyan BGRA
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, 22 + len(bmp), 0)
    path.write_bytes(header + entry + bmp)


def write_icns(out: Path) -> None:
    """Build a valid .icns from PNGs (macOS iconutil)."""
    import shutil
    import subprocess

    iconset = out / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()

    mapping = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for name, sz in mapping:
        write_png(iconset / name, sz, (6, 182, 212))

    icns_path = out / "icon.icns"
    try:
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(icns_path)],
            check=True,
            capture_output=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        # Non-macOS CI: keep a placeholder; bundle targets may supply real icns later
        icns_path.write_bytes((out / "128x128.png").read_bytes())
    finally:
        shutil.rmtree(iconset, ignore_errors=True)


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    color = (6, 182, 212)
    for name, sz in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)]:
        write_png(out / name, sz, color)
    write_png(out / "icon.png", 256, color)
    write_ico(out / "icon.ico")
    write_icns(out)
    print(f"Generated icons in {out}")


if __name__ == "__main__":
    main()
