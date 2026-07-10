# VPS setup for Auto Pilot

Auto Pilot requires a **always-on Windows host** with MT5 and the TradeIntel Bridge daemon. This is the equivalent of running Sniper on NinjaTrader 24/7.

## Recommended: Windows VPS

1. **Provider**: Forex VPS (e.g. near your broker's DC), AWS EC2 Windows, or dedicated PC.
2. **Specs**: 2 vCPU, 4 GB RAM minimum; Windows Server 2019+ or Windows 10/11.
3. **Install**:
   - MetaTrader 5 (broker terminal)
   - TradeIntel Bridge desktop app
   - Python 3.12+ with `MetaTrader5` package (`pip install MetaTrader5`) for native execution
4. **MT5**: Enable **Algo Trading**, attach EA, allow live trading.
5. **Bridge**: Start Auto Pilot from desktop app; verify `auto-pilot.log` shows scans.

## Platform support

| Environment | Auto Pilot | Copilot (manual) |
|-------------|------------|------------------|
| Windows VPS + MT5 | Full (native API) | Full |
| Windows PC always on | Full | Full |
| Mac + Wine MT5 | Degraded (socket EA / file bridge) | Supported |
| Dashboard only (no local host) | **Not supported** | Limited |

## Mac users

Use **Copilot mode** on the web dashboard for manual trading. For production full-auto, use a **Windows VPS** and connect your live MT5 account there.

## Firewall

- Outbound HTTPS to `tradeintelai.vercel.app` (license, cloud analyze)
- Local only: bridge `8080`, socket EA `19532`

## Pairing with dashboard

1. Optional: **Connect dashboard** in Bridge Desktop for remote Copilot monitoring.
2. Auto Pilot does **not** require Cloudflare tunnel for trading.
3. Set `AUTO_PILOT_API_TOKEN` to a fresh Firebase ID token (or implement token refresh in a future release).

## Demo before live

Complete **Demo Success Goals** on the Performance tab before disabling dry run or setting `AUTO_PILOT_ALLOW_LIVE=1`.
