#!/usr/bin/env python3
"""
TradeIntel AI — Colleague MT5 Bridge Setup
Run on the PC where MetaTrader 5 is installed.
"""

import os
import platform
import socket
import subprocess
import sys
from pathlib import Path

BRIDGE_PORT = int(os.environ.get("MT5_BRIDGE_PORT", "8080"))
ROOT = Path(__file__).resolve().parent.parent


def check_port(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def main() -> int:
    print("=" * 60)
    print("TradeIntel AI — MT5 Bridge Setup")
    print("=" * 60)
    print(f"Platform: {platform.system()} {platform.release()}")
    print(f"Python: {sys.version.split()[0]}")
    print(f"Bridge root: {ROOT}")
    print()

    if sys.version_info < (3, 10):
        print("ERROR: Python 3.10+ required")
        return 1

    if not check_port(BRIDGE_PORT):
        print(f"WARNING: Port {BRIDGE_PORT} is already in use.")
        print("Stop other bridge processes or set MT5_BRIDGE_PORT.")
    else:
        print(f"OK: Port {BRIDGE_PORT} is available")

    connector = ROOT / "wine-mt5-connector.py"
    ea = ROOT / "MT5FileBridgeEA.mq5"
    if not connector.exists():
        print(f"ERROR: Missing {connector}")
        return 1
    if not ea.exists():
        print(f"ERROR: Missing {ea}")
        return 1

    print()
    print("--- MT5 EA setup ---")
    print("1. Copy MT5FileBridgeEA.mq5 to MT5 Experts folder")
    print("2. Compile in MetaEditor (F7)")
    print("3. Attach EA to a chart; enable Algo Trading")
    print()

    configure = ROOT / "configure-paths.sh"
    if platform.system() != "Windows" and configure.exists():
        print("Running configure-paths.sh …")
        subprocess.run(["bash", str(configure)], cwd=ROOT, check=False)

    print()
    print("--- Starting HTTP bridge ---")
    print(f"Listening on http://localhost:{BRIDGE_PORT}")
    print("Expose with Cloudflare Tunnel or ngrok, then in dashboard:")
    print("  Settings → bridge URL, or ?bridge_url=https://YOUR-TUNNEL")
    print()

    env = os.environ.copy()
    env["MT5_BRIDGE_PORT"] = str(BRIDGE_PORT)
    os.chdir(ROOT)
    return subprocess.call([sys.executable, str(connector)], env=env)


if __name__ == "__main__":
    raise SystemExit(main())
