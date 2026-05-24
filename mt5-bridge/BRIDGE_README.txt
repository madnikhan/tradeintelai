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
