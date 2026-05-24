# Colleague MT5 Bridge Setup

Connect your MetaTrader 5 account to TradeIntel AI (after subscribing).

## Prerequisites

- Active TradeIntel AI subscription
- MetaTrader 5 installed (Windows native, or Mac with Wine)
- Python 3.10+

## Quick start

1. **Download** the bridge zip from the dashboard (`/onboarding` → Download MT5 Bridge).

2. **Unzip** and open a terminal in the `mt5-bridge` folder.

3. **Run the installer:**

   ```bash
   # Mac / Linux
   chmod +x colleague/start_colleague_bridge.sh
   ./colleague/start_colleague_bridge.sh

   # Windows
   colleague\start_colleague_bridge.bat

   # Or directly
   python3 colleague/setup_colleague_bridge.py
   ```

4. **Install the EA** in MT5:
   - Copy `MT5FileBridgeEA.mq5` to `MQL5/Experts/`
   - Compile (F7), attach to a chart
   - Enable **Algo Trading**

5. **Expose port 8080** to the internet:
   - Cloudflare Tunnel: `./start-cloudflare.sh` (from project root)
   - Or ngrok: `ngrok http 8080`

6. **Connect the dashboard:**
   - Open: `https://YOUR-APP/dashboard?bridge_url=https://YOUR-TUNNEL`
   - Or save the tunnel URL in **Settings**

## Verify

```bash
curl http://localhost:8080/health
```

Should return `{"status":"running",...}`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 8080 in use | Stop other bridges; set `MT5_BRIDGE_PORT=8081` |
| Balance $0 | EA not attached or Algo Trading disabled |
| Dashboard can't reach bridge | Use HTTPS tunnel; Vercel cannot call `localhost` |
