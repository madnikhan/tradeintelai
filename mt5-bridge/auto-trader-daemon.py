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

DEFAULT_CONFIG: Dict[str, Any] = {
    'enabled': True,
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def save_status(status: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    status['heartbeatAt'] = _now_iso()
    with open(STATUS_PATH, 'w', encoding='utf-8') as f:
        json.dump(status, f, indent=2)


def check_license() -> bool:
    token = os.environ.get('AUTO_PILOT_API_TOKEN', '').strip()
    base = os.environ.get(
        'AUTO_PILOT_LICENSE_URL',
        os.environ.get('TRADEINTEL_API_BASE', 'http://127.0.0.1:3000'),
    ).rstrip('/')
    if not token:
        logger.warning('AUTO_PILOT_API_TOKEN not set — license check skipped (dev only)')
        return os.environ.get('AUTO_PILOT_SKIP_LICENSE') == '1'
    try:
        req = urllib.request.Request(
            f'{base}/api/auto-pilot/license',
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
    token = os.environ.get('AUTO_PILOT_API_TOKEN', '').strip()
    base = os.environ.get(
        'TRADEINTEL_API_BASE',
        'http://127.0.0.1:3000',
    ).rstrip('/')
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


def run_analysis(symbol: str) -> Optional[Dict[str, Any]]:
    """Local tsx worker when repo present; else cloud analyze API."""
    if (PROJECT_ROOT / 'package.json').exists() and WORKER_SCRIPT.exists():
        cmd = ['npx', 'tsx', str(WORKER_SCRIPT), symbol, '--mode=scan', '--json']
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=120,
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

    return run_analysis_cloud(symbol)


def run_analysis_cloud(symbol: str) -> Optional[Dict[str, Any]]:
    token = os.environ.get('AUTO_PILOT_API_TOKEN', '').strip()
    base = os.environ.get('TRADEINTEL_API_BASE', 'https://tradeintelai.vercel.app').rstrip('/')
    if not token:
        logger.warning('No AUTO_PILOT_API_TOKEN — cannot call cloud analyze')
        return None
    try:
        req = urllib.request.Request(
            f'{base}/api/auto-pilot/analyze',
            data=json.dumps({'symbol': symbol, 'mode': 'scan'}).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
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
) -> None:
    try:
        from bridge_watchdog import get_watchdog
        wd = get_watchdog(lambda: None)
        wd.register_watch({
            'ticket': ticket,
            'symbol': symbol,
            'direction': direction,
            'entryPrice': entry,
            'stopLoss': sl,
            'takeProfit': tp,
            'profile': profile,
            'source': 'auto_pilot',
        })
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
    config = load_config()
    if not config.get('enabled', True):
        logger.info('Auto Pilot disabled in config')
        return 0

    bridge_port = int(os.environ.get('MT5_BRIDGE_PORT', '8080'))
    dry_run = bool(config.get('dryRun', True))
    preset = str(config.get('preset', 'trend'))
    scan_sec = PRESET_SCAN_SEC.get(preset, 300)
    min_conf = int(config.get('minConfidence', PRESET_MIN_CONF.get(preset, 65)))
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
    }

    trades_today = 0
    daily_pnl = 0.0
    last_license_check = 0.0

    logger.info(
        'Auto Pilot started preset=%s dry_run=%s pairs=%s platform=%s',
        preset, dry_run, pairs, executor.platform,
    )

    try:
        while True:
            config = load_config()
            if not config.get('enabled', True):
                logger.info('Auto Pilot disabled — stopping loop')
                break

            dry_run = bool(config.get('dryRun', dry_run))
            executor.dry_run = dry_run
            preset = str(config.get('preset', preset))
            scan_sec = PRESET_SCAN_SEC.get(preset, scan_sec)
            min_conf = int(config.get('minConfidence', min_conf))
            pairs = config.get('pairs') or pairs
            watch_profile = 'scalp' if preset == 'scalp' else 'default'

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
                analysis = run_analysis(sym)
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

                volume = float(analysis.get('suggestedPositionSize') or 0.01)
                if volume <= 0:
                    volume = 0.01
                sl = float(analysis.get('suggestedStopLoss') or 0)
                tp = float(analysis.get('suggestedTakeProfit') or 0)

                result = executor.place_trade(sym, direction, volume, sl, tp)
                if result.get('success'):
                    trades_today += 1
                    status['lastTradeAt'] = _now_iso()
                    status['tradesToday'] = trades_today
                    ticket = str(result.get('order_id') or result.get('deal_id') or '')
                    if ticket and not result.get('dry_run'):
                        register_watchdog(
                            ticket, sym, direction,
                            float(result.get('price') or 0), sl, tp, watch_profile,
                        )
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
