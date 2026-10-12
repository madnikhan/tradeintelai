#!/usr/bin/env python3
"""
TradeIntel Auto Pilot daemon — 24/7 scan + auto-execute on MT5 forex.
Run: python3 mt5-bridge/auto-trader-daemon.py
Env: MT5_BRIDGE_ROOT, AUTO_PILOT_CONFIG_PATH, AUTO_PILOT_LICENSE_URL, AUTO_PILOT_API_TOKEN
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from auto_trader_executor import AutoPilotExecutor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [auto-pilot] %(levelname)s %(message)s',
)
logger = logging.getLogger('auto-pilot')

BRIDGE_ROOT = Path(os.environ.get('MT5_BRIDGE_ROOT', Path(__file__).resolve().parent))
DATA_DIR = BRIDGE_ROOT / 'data'
CONFIG_PATH = Path(os.environ.get('AUTO_PILOT_CONFIG_PATH', DATA_DIR / 'auto-pilot-config.json'))
STATUS_PATH = Path(os.environ.get('AUTO_PILOT_STATUS_PATH', DATA_DIR / 'auto-pilot-status.json'))
WORKER_SCRIPT = BRIDGE_ROOT / 'auto-trader-worker.ts'
PROJECT_ROOT = BRIDGE_ROOT.parent

PRESET_SCAN_SEC = {
    'scalp': 60,
    'trend': 300,
    'conservative': 900,
}

PRESET_MIN_CONF = {
    'scalp': 70,
    'trend': 65,
    'conservative': 75,
}

PRESET_USE_VISION = {
    'scalp': False,
    'trend': True,
    'conservative': True,
}

DEFAULT_CONFIG: Dict[str, Any] = {
    'enabled': False,
    'preset': 'trend',
    'pairs': ['EURUSD', 'GBPUSD', 'USDJPY'],
    'riskPercentPerTrade': 1.0,
    'minConfidence': 65,
    'session': 'all',
    'dryRun': True,
    'killSwitches': {
        'maxDailyLossUsd': 100,
        'maxOpenTrades': 3,
        'maxTradesPerDay': 10,
        'tradingHoursOnly': True,
        'demoOnlyUntilReady': True,
    },
}

CREDENTIALS_PATH = DATA_DIR / 'bridge-credentials.json'
MIN_EXECUTE_CONFIDENCE = 50


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_bridge_credentials() -> Optional[Dict[str, Any]]:
    if not CREDENTIALS_PATH.exists():
        return None
    try:
        with open(CREDENTIALS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _api_base_and_token() -> tuple[str, Optional[str]]:
    """Prefer AUTO_PILOT_API_TOKEN (Firebase ID); else bridge pairing token."""
    token = os.environ.get('AUTO_PILOT_API_TOKEN', '').strip() or None
    base = os.environ.get(
        'TRADEINTEL_API_BASE',
        os.environ.get('TRADEINTEL_APP_URL', 'https://tradeintelai.vercel.app'),
    ).rstrip('/')
    if token:
        return base, token
    creds = _load_bridge_credentials()
    if creds and creds.get('token'):
        return (creds.get('appUrl') or base).rstrip('/'), creds['token']
    return base, None


def sync_config_from_cloud() -> bool:
    """Pull Firestore Auto Pilot config → local JSON (bridge or Firebase token)."""
    base, token = _api_base_and_token()
    if not token:
        logger.info('No bridge/API token — skipping cloud config sync')
        return False
    try:
        req = urllib.request.Request(
            f'{base}/api/auto-pilot/config',
            headers={
                'Accept': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='GET',
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        remote = data.get('config')
        if not isinstance(remote, dict):
            logger.warning('Cloud config missing config object')
            return False
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(remote, f, indent=2)
        logger.info('Synced Auto Pilot config from cloud → %s', CONFIG_PATH)
        return True
    except Exception as e:
        logger.warning('Cloud config sync failed: %s', e)
        return False


def load_config() -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding='utf-8') as f:
                merged = {**DEFAULT_CONFIG, **json.load(f)}
                merged['killSwitches'] = {
                    **DEFAULT_CONFIG['killSwitches'],
                    **merged.get('killSwitches', {}),
                }
                return merged
        except Exception as e:
            logger.warning('Config load failed: %s', e)
    return dict(DEFAULT_CONFIG)


def validate_trade_geometry(
    side: str, entry: float, sl: float, tp: float
) -> Optional[str]:
    if entry <= 0 or sl <= 0 or tp <= 0:
        return 'Invalid entry/SL/TP (must be > 0)'
    if side == 'BUY':
        if sl >= entry:
            return 'BUY stop loss must be below entry'
        if tp <= entry:
            return 'BUY take profit must be above entry'
    else:
        if sl <= entry:
            return 'SELL stop loss must be above entry'
        if tp >= entry:
            return 'SELL take profit must be below entry'
    risk = abs(entry - sl)
    reward = abs(tp - entry)
    if risk <= 0:
        return 'Stop distance is zero'
    if reward / risk < 1.0:
        return f'Reward:risk {reward / risk:.2f} below 1.0'
    return None


def save_status(status: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    status['heartbeatAt'] = _now_iso()
    with open(STATUS_PATH, 'w', encoding='utf-8') as f:
        json.dump(status, f, indent=2)


def check_license() -> bool:
    base, token = _api_base_and_token()
    license_base = os.environ.get('AUTO_PILOT_LICENSE_URL', base).rstrip('/')
    if not token:
        logger.warning('No API/bridge token — license check skipped (dev only)')
        return os.environ.get('AUTO_PILOT_SKIP_LICENSE') == '1'
    try:
        req = urllib.request.Request(
            f'{license_base}/api/auto-pilot/license',
            data=json.dumps({'daemon': True}).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            return bool(data.get('valid'))
    except Exception as e:
        logger.error('License check failed: %s', e)
        return False


def post_heartbeat(status: Dict[str, Any]) -> None:
    base, token = _api_base_and_token()
    if not token:
        return
    try:
        req = urllib.request.Request(
            f'{base}/api/auto-pilot/heartbeat',
            data=json.dumps(status).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='POST',
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        logger.debug('Heartbeat post failed: %s', e)


def run_analysis(
    symbol: str, *, mode: str = 'trade', use_vision: bool = False
) -> Optional[Dict[str, Any]]:
    """Local tsx worker when repo present; else cloud analyze API."""
    vision_flag = '--vision' if use_vision else '--no-vision'
    if (PROJECT_ROOT / 'package.json').exists() and WORKER_SCRIPT.exists():
        cmd = [
            'npx', 'tsx', str(WORKER_SCRIPT), symbol,
            f'--mode={mode}', vision_flag, '--json',
        ]
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=180,
            )
            if proc.returncode != 0:
                logger.warning('Worker failed %s: %s', symbol, proc.stderr[:500])
                return None
            line = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ''
            return json.loads(line)
        except subprocess.TimeoutExpired:
            logger.warning('Worker timeout for %s', symbol)
            return None
        except Exception as e:
            logger.warning('Worker error %s: %s', symbol, e)
            return None

    return run_analysis_cloud(symbol, mode=mode, use_vision=use_vision)


def run_analysis_cloud(
    symbol: str, *, mode: str = 'trade', use_vision: bool = False
) -> Optional[Dict[str, Any]]:
    base, token = _api_base_and_token()
    if not token:
        logger.warning('No API/bridge token — cannot call cloud analyze')
        return None
    try:
        req = urllib.request.Request(
            f'{base}/api/auto-pilot/analyze',
            data=json.dumps({
                'symbol': symbol,
                'mode': mode,
                'useVision': use_vision,
            }).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        logger.warning('Cloud analyze failed %s: %s', symbol, e)
        return None

def direction_from_recommendation(rec: str) -> Optional[str]:
    u = (rec or '').upper()
    if 'BUY' in u:
        return 'BUY'
    if 'SELL' in u:
        return 'SELL'
    return None


def register_watchdog(
    ticket: str,
    symbol: str,
    direction: str,
    entry: float,
    sl: float,
    tp: float,
    profile: str,
    analysis_id: Optional[str] = None,
) -> None:
    try:
        from bridge_watchdog import get_watchdog
        wd = get_watchdog(lambda: None)
        payload: Dict[str, Any] = {
            'ticket': ticket,
            'symbol': symbol,
            'direction': direction,
            'entryPrice': entry,
            'stopLoss': sl,
            'takeProfit': tp,
            'profile': profile,
            'source': 'auto_pilot',
        }
        if analysis_id:
            payload['analysisId'] = analysis_id
        wd.register_watch(payload)
    except Exception as e:
        logger.warning('Watchdog register failed: %s', e)


def start_watchdog_thread(bridge_port: int) -> None:
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            'wine_connector', BRIDGE_ROOT / 'wine-mt5-connector.py'
        )
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, 'get_mt5_connector'):
                from bridge_watchdog import get_watchdog
                get_watchdog(mod.get_mt5_connector)
                logger.info('Watchdog started with bridge connector')
    except Exception as e:
        logger.warning('Could not start watchdog: %s', e)


def kill_switch_blocked(
    config: Dict[str, Any],
    executor: AutoPilotExecutor,
    trades_today: int,
    daily_pnl: float,
) -> Optional[str]:
    ks = config.get('killSwitches', {})
    positions = executor.get_open_positions()
    if len(positions) >= int(ks.get('maxOpenTrades', 3)):
        return f'Max open trades ({len(positions)})'
    if trades_today >= int(ks.get('maxTradesPerDay', 10)):
        return 'Max trades per day reached'
    if daily_pnl <= -abs(float(ks.get('maxDailyLossUsd', 100))):
        return f'Daily loss limit hit (${daily_pnl:.2f})'
    if ks.get('demoOnlyUntilReady') and not executor.is_demo_account():
        if os.environ.get('AUTO_PILOT_ALLOW_LIVE') != '1':
            return 'Live Auto Pilot locked — set AUTO_PILOT_ALLOW_LIVE=1 after demo goals met'
    return None


def main() -> int:
    sync_config_from_cloud()
    config = load_config()
    if not config.get('enabled', False):
        logger.info('Auto Pilot disabled in config (enable in dashboard and re-sync)')
        return 0

    bridge_port = int(os.environ.get('MT5_BRIDGE_PORT', '8080'))
    dry_run = bool(config.get('dryRun', True))
    preset = str(config.get('preset', 'trend'))
    scan_sec = PRESET_SCAN_SEC.get(preset, 300)
    min_conf = max(
        MIN_EXECUTE_CONFIDENCE,
        int(config.get('minConfidence', PRESET_MIN_CONF.get(preset, 65))),
    )
    use_vision = bool(
        config.get('useVision', PRESET_USE_VISION.get(preset, False))
    )
    # Trade-strength gates for Auto Pilot (scan only when scalp / no vision)
    analysis_mode = 'scan' if preset == 'scalp' and not use_vision else 'trade'
    pairs: List[str] = config.get('pairs') or DEFAULT_CONFIG['pairs']
    watch_profile = 'scalp' if preset == 'scalp' else 'default'

    executor = AutoPilotExecutor(bridge_port=bridge_port, dry_run=dry_run)
    if not executor.connect():
        logger.error('Cannot connect to MT5 / bridge — exiting')
        return 1

    start_watchdog_thread(bridge_port)

    status: Dict[str, Any] = {
        'running': True,
        'dryRun': dry_run,
        'preset': preset,
        'lastScanAt': None,
        'lastTradeAt': None,
        'tradesToday': 0,
        'dailyPnlUsd': 0.0,
        'openPositions': 0,
        'scanningPairs': pairs,
        'lastError': None,
        'blockedReason': None,
        'licenseValid': False,
        'platform': executor.platform,
        'analysisMode': analysis_mode,
        'useVision': use_vision,
    }

    trades_today = 0
    daily_pnl = 0.0
    last_license_check = 0.0
    last_config_sync = time.time()

    logger.info(
        'Auto Pilot started preset=%s mode=%s vision=%s dry_run=%s pairs=%s platform=%s',
        preset, analysis_mode, use_vision, dry_run, pairs, executor.platform,
    )

    try:
        while True:
            if time.time() - last_config_sync > 300:
                sync_config_from_cloud()
                last_config_sync = time.time()

            config = load_config()
            if not config.get('enabled', False):
                logger.info('Auto Pilot disabled — stopping loop')
                break

            dry_run = bool(config.get('dryRun', dry_run))
            executor.dry_run = dry_run
            preset = str(config.get('preset', preset))
            scan_sec = PRESET_SCAN_SEC.get(preset, scan_sec)
            min_conf = max(
                MIN_EXECUTE_CONFIDENCE,
                int(config.get('minConfidence', min_conf)),
            )
            use_vision = bool(
                config.get('useVision', PRESET_USE_VISION.get(preset, False))
            )
            analysis_mode = 'scan' if preset == 'scalp' and not use_vision else 'trade'
            pairs = config.get('pairs') or pairs
            watch_profile = 'scalp' if preset == 'scalp' else 'default'
            status['analysisMode'] = analysis_mode
            status['useVision'] = use_vision

            if time.time() - last_license_check > 3600:
                status['licenseValid'] = check_license()
                last_license_check = time.time()
                if not status['licenseValid'] and os.environ.get('AUTO_PILOT_SKIP_LICENSE') != '1':
                    status['blockedReason'] = 'Invalid or expired license'
                    save_status(status)
                    post_heartbeat(status)
                    time.sleep(60)
                    continue

            block = kill_switch_blocked(config, executor, trades_today, daily_pnl)
            status['blockedReason'] = block
            status['openPositions'] = len(executor.get_open_positions())
            status['tradesToday'] = trades_today
            status['dailyPnlUsd'] = daily_pnl
            save_status(status)
            post_heartbeat(status)

            if block:
                logger.info('Kill switch: %s', block)
                time.sleep(scan_sec)
                continue

            status['lastScanAt'] = _now_iso()
            for symbol in pairs:
                sym = symbol.replace('/', '').upper()
                analysis = run_analysis(sym, mode=analysis_mode, use_vision=use_vision)
                if not analysis or not analysis.get('ok', True):
                    continue
                if not analysis.get('executionPermitted'):
                    logger.debug('%s blocked: %s', sym, analysis.get('executionBlockedBy'))
                    continue
                conf = float(analysis.get('confidence', 0))
                if conf < min_conf:
                    logger.debug('%s confidence %s < %s', sym, conf, min_conf)
                    continue

                direction = direction_from_recommendation(analysis.get('recommendation', ''))
                if not direction:
                    continue

                volume = float(analysis.get('suggestedPositionSize') or 0)
                if volume <= 0:
                    logger.warning('%s invalid position size — skip', sym)
                    continue
                sl = float(analysis.get('suggestedStopLoss') or 0)
                tp = float(analysis.get('suggestedTakeProfit') or 0)
                entry = float(
                    analysis.get('entryPrice')
                    or analysis.get('currentPrice')
                    or 0
                )
                if entry <= 0:
                    # Prefer mid of SL/TP as rough check; executor fills at market
                    entry = (sl + tp) / 2 if sl > 0 and tp > 0 else 0
                geom_err = validate_trade_geometry(direction, entry, sl, tp) if entry > 0 else (
                    'Missing SL/TP' if sl <= 0 or tp <= 0 else None
                )
                if geom_err:
                    logger.warning('%s geometry rejected: %s', sym, geom_err)
                    continue

                result = executor.place_trade(sym, direction, volume, sl, tp)
                if result.get('success'):
                    if not result.get('dry_run'):
                        trades_today += 1
                        status['tradesToday'] = trades_today
                        status['lastTradeAt'] = _now_iso()
                        ticket = str(result.get('order_id') or result.get('deal_id') or '')
                        if ticket:
                            register_watchdog(
                                ticket, sym, direction,
                                float(result.get('price') or entry), sl, tp,
                                watch_profile,
                                analysis.get('analysisId'),
                            )
                    else:
                        logger.info('Dry-run would trade %s %s %s (not counted)', sym, direction, volume)
                    logger.info('Trade %s %s %s -> %s', sym, direction, volume, result)
                else:
                    status['lastError'] = result.get('error')
                    logger.warning('Trade failed %s: %s', sym, result.get('error'))

            save_status(status)
            post_heartbeat(status)
            time.sleep(scan_sec)

    except KeyboardInterrupt:
        logger.info('Auto Pilot stopped by user')
    finally:
        status['running'] = False
        save_status(status)
        executor.disconnect()

    return 0


if __name__ == '__main__':
    sys.exit(main())
