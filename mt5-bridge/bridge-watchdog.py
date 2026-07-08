"""
Server-side position watchdog + Islamic swap-close scheduler.
Runs in a background thread alongside wine-mt5-connector.py.
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

BRIDGE_ROOT = os.environ.get('MT5_BRIDGE_ROOT') or os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BRIDGE_ROOT, 'data')
WATCHES_PATH = os.path.join(DATA_DIR, 'active-watches.json')
CONFIG_PATH = os.path.join(DATA_DIR, 'bridge-watch.json')

DEFAULT_CONFIG = {
    'enabled': True,
    'smartExitEnabled': True,
    'pollIntervalMs': 8000,
    'maxHoldMs': 8 * 60 * 60 * 1000,
    'stallNearTpMs': 2 * 60 * 60 * 1000,
    'stallTpFraction': 0.15,
    'givebackFraction': 0.5,
    'lossExtension': 1.5,
    'assistTpClose': False,
    'assistTpPips': 3,
    'swap': {
        'enabled': True,
        'swapTimeGMT': 0,
        'closeBeforeHours': 2,
        'autoCloseEnabled': True,
        'warnBeforeHours': 3,
    },
}

SCALP_OVERRIDES = {
    'maxHoldMs': 30 * 60 * 1000,
    'stallNearTpMs': 15 * 60 * 1000,
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _normalize_symbol(s: str) -> str:
    return (s or '').replace('/', '').upper()


def _load_json(path: str, default: Any) -> Any:
    if not os.path.exists(path):
        return default
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: str, data: Any) -> None:
    _ensure_data_dir()
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


class BridgeWatchdog:
    def __init__(self, mt5_connector_factory: Callable[[], Any]):
        self._connector_factory = mt5_connector_factory
        self._lock = threading.Lock()
        self._watches: Dict[str, dict] = {}
        self._config: dict = {**DEFAULT_CONFIG}
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._last_swap_close_date: Optional[str] = None
        self._load_state()

    def _load_state(self):
        self._watches = _load_json(WATCHES_PATH, {})
        saved = _load_json(CONFIG_PATH, {})
        self._config = {**DEFAULT_CONFIG, **saved}
        if 'swap' in saved and isinstance(saved['swap'], dict):
            self._config['swap'] = {**DEFAULT_CONFIG['swap'], **saved['swap']}

    def _persist_watches(self):
        _save_json(WATCHES_PATH, self._watches)

    def _persist_config(self):
        _save_json(CONFIG_PATH, self._config)

    def get_config(self) -> dict:
        with self._lock:
            return json.loads(json.dumps(self._config))

    def update_config(self, partial: dict) -> dict:
        with self._lock:
            for k, v in partial.items():
                if k == 'swap' and isinstance(v, dict):
                    self._config['swap'] = {**self._config.get('swap', {}), **v}
                else:
                    self._config[k] = v
            self._persist_config()
            return self.get_config()

    def list_watches(self) -> List[dict]:
        with self._lock:
            return list(self._watches.values())

    def register_watch(self, payload: dict) -> dict:
        ticket = str(payload.get('ticket') or payload.get('orderId') or '')
        if not ticket:
            raise ValueError('ticket required')

        watch = {
            'ticket': ticket,
            'symbol': _normalize_symbol(payload.get('symbol', '')),
            'direction': payload.get('direction', 'BUY'),
            'entryPrice': float(payload.get('entryPrice') or payload.get('entry') or 0),
            'stopLoss': float(payload.get('stopLoss') or payload.get('sl') or 0),
            'takeProfit': float(payload.get('takeProfit') or payload.get('tp') or 0),
            'analysisId': payload.get('analysisId'),
            'profile': payload.get('profile', 'default'),
            'takeProfitDollars': payload.get('takeProfitDollars'),
            'openedAt': payload.get('openedAt') or datetime.now(timezone.utc).isoformat(),
            'status': 'watching',
            'lastProfit': 0,
            'peakProfit': 0,
            'lastDistanceToTpPercent': 0,
            'lastCheckAt': None,
        }

        with self._lock:
            self._watches[ticket] = watch
            self._persist_watches()

        logger.info('Watchdog: registered watch ticket=%s symbol=%s', ticket, watch['symbol'])
        return watch

    def unregister_watch(self, ticket: str) -> bool:
        with self._lock:
            if ticket in self._watches:
                del self._watches[ticket]
                self._persist_watches()
                return True
            return False

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run_loop, name='bridge-watchdog', daemon=True)
        self._thread.start()
        logger.info('Watchdog: background thread started')

    def stop(self):
        self._stop.set()

    def _watch_cfg(self, watch: dict) -> dict:
        cfg = {**self._config}
        if watch.get('profile') == 'scalp':
            cfg.update(SCALP_OVERRIDES)
        return cfg

    def _distance_to_tp_percent(self, current: float, entry: float, tp: float, direction: str) -> float:
        total = abs(tp - entry)
        if total <= 0:
            return 100.0
        moved = current - entry if direction == 'BUY' else entry - current
        return max(0.0, min(100.0, (moved / total) * 100.0))

    def _pip_size(self, symbol: str) -> float:
        s = _normalize_symbol(symbol)
        if 'JPY' in s and not s.startswith('XAU'):
            return 0.01
        return 0.0001

    def _match_position(self, open_positions: List[dict], watch: dict) -> Optional[dict]:
        ticket = watch['ticket']
        symbol = watch['symbol']
        for p in open_positions:
            pt = str(p.get('order_id') or p.get('orderId') or p.get('ticket') or p.get('id') or '')
            if pt and pt == ticket:
                return p
            psym = _normalize_symbol(p.get('symbol', ''))
            if psym == symbol:
                entry = float(p.get('entry_price') or p.get('entryPrice') or p.get('open_price') or 0)
                if entry and abs(entry - watch['entryPrice']) < 0.0005:
                    return p
        return None

    def _evaluate_smart_exit(self, watch: dict, current: float, profit: float, cfg: dict) -> Optional[str]:
        if not cfg.get('smartExitEnabled', True):
            return None

        opened = watch.get('openedAt', '')
        try:
            opened_dt = datetime.fromisoformat(opened.replace('Z', '+00:00'))
            hold_ms = (datetime.now(timezone.utc) - opened_dt.astimezone(timezone.utc)).total_seconds() * 1000
        except (ValueError, TypeError):
            hold_ms = 0

        if hold_ms >= cfg.get('maxHoldMs', DEFAULT_CONFIG['maxHoldMs']):
            return f'Max hold time exceeded ({int(hold_ms / 3600000)}h)'

        entry = watch['entryPrice']
        sl = watch['stopLoss']
        risk_dist = abs(entry - sl)
        if risk_dist > 0:
            adverse = entry - current if watch['direction'] == 'BUY' else current - entry
            if adverse >= risk_dist * cfg.get('lossExtension', 1.5):
                return f'Loss extended beyond {cfg.get("lossExtension")}x planned risk'

        peak = watch.get('peakProfit', 0)
        giveback = cfg.get('givebackFraction', 0.5)
        if peak > 0 and profit < peak * (1 - giveback):
            return f'Gave back {int(giveback * 100)}% of peak open profit'

        stall_ms = cfg.get('stallNearTpMs', DEFAULT_CONFIG['stallNearTpMs'])
        stall_frac = cfg.get('stallTpFraction', 0.15)
        dist_pct = watch.get('lastDistanceToTpPercent', 0)
        if hold_ms >= stall_ms and dist_pct >= (1 - stall_frac) * 100:
            return f'Stalled near take profit for {int(hold_ms / 3600000)}h'

        return None

    def _close_ticket(self, ticket: str, reason: str) -> bool:
        try:
            mt5 = self._connector_factory()
            result = mt5.close_position(int(ticket) if ticket.isdigit() else ticket)
            if result.get('success'):
                logger.info('Watchdog: closed ticket=%s reason=%s', ticket, reason)
                return True
            logger.warning('Watchdog: close failed ticket=%s %s', ticket, result)
        except Exception as e:
            logger.error('Watchdog: close error ticket=%s %s', ticket, e)
        return False

    def _close_all_positions(self, reason: str) -> int:
        try:
            mt5 = self._connector_factory()
            resp = mt5.get_open_positions()
            positions = resp.get('positions', []) if resp.get('success') else []
            closed = 0
            for p in positions:
                ticket = p.get('ticket') or p.get('order_id') or p.get('position_id')
                if ticket and self._close_ticket(str(ticket), reason):
                    closed += 1
            return closed
        except Exception as e:
            logger.error('Watchdog: close all failed %s', e)
            return 0

    def _check_swap_close(self):
        swap = self._config.get('swap', {})
        if not swap.get('enabled') or not swap.get('autoCloseEnabled'):
            return

        now = datetime.now(timezone.utc)
        utc_minutes = now.hour * 60 + now.minute
        swap_hour = int(swap.get('swapTimeGMT', 0))
        close_before = int(swap.get('closeBeforeHours', 2))
        close_minutes = swap_hour * 60 - close_before * 60
        if close_minutes < 0:
            close_minutes += 24 * 60

        today = now.strftime('%Y-%m-%d')
        if utc_minutes >= close_minutes and self._last_swap_close_date != today:
            logger.info('Watchdog: Islamic swap-close window — closing all positions')
            n = self._close_all_positions('Islamic swap-close (before overnight swap)')
            self._last_swap_close_date = today
            logger.info('Watchdog: swap-close closed %s position(s)', n)

    def _poll_once(self):
        if not self._config.get('enabled', True):
            return

        self._check_swap_close()

        with self._lock:
            tickets = list(self._watches.keys())

        if not tickets:
            return

        try:
            mt5 = self._connector_factory()
            resp = mt5.get_open_positions()
            open_list = resp.get('positions', []) if resp.get('success') else []
        except Exception as e:
            logger.warning('Watchdog: get_open_positions failed %s', e)
            return

        for ticket in tickets:
            with self._lock:
                watch = self._watches.get(ticket)
            if not watch or watch.get('status') != 'watching':
                continue

            pos = self._match_position(open_list, watch)
            now_iso = datetime.now(timezone.utc).isoformat()

            if not pos:
                with self._lock:
                    if ticket in self._watches:
                        self._watches[ticket]['status'] = 'closed_external'
                        self._watches[ticket]['exitReason'] = 'Position closed externally'
                        self._watches[ticket]['closedAt'] = now_iso
                        del self._watches[ticket]
                        self._persist_watches()
                continue

            profit = float(pos.get('profit') or pos.get('profitLoss') or pos.get('pl') or 0)
            current = float(
                pos.get('current_price') or pos.get('currentPrice') or pos.get('price') or pos.get('bid') or watch['entryPrice']
            )
            dist_pct = self._distance_to_tp_percent(current, watch['entryPrice'], watch['takeProfit'], watch['direction'])
            cfg = self._watch_cfg(watch)

            with self._lock:
                w = self._watches.get(ticket)
                if not w:
                    continue
                w['lastProfit'] = profit
                w['peakProfit'] = max(w.get('peakProfit', 0), profit)
                w['lastDistanceToTpPercent'] = dist_pct
                w['lastCheckAt'] = now_iso

            tp_dollars = watch.get('takeProfitDollars')
            if tp_dollars is not None and profit >= float(tp_dollars):
                if self._close_ticket(ticket, f'Scalp profit target (${tp_dollars}) reached'):
                    with self._lock:
                        self._watches.pop(ticket, None)
                        self._persist_watches()
                    continue

            if profit >= 0 and dist_pct >= 99.5:
                with self._lock:
                    if ticket in self._watches:
                        self._watches[ticket]['status'] = 'tp_hit'
                        del self._watches[ticket]
                        self._persist_watches()
                continue

            if cfg.get('assistTpClose') and dist_pct >= 95:
                pip = self._pip_size(watch['symbol'])
                dist_pips = abs(watch['takeProfit'] - current) / pip if pip else 999
                if dist_pips <= cfg.get('assistTpPips', 3):
                    if self._close_ticket(ticket, 'App-assisted close near take profit'):
                        with self._lock:
                            self._watches.pop(ticket, None)
                            self._persist_watches()
                        continue

            reason = self._evaluate_smart_exit(watch, current, profit, cfg)
            if reason and self._close_ticket(ticket, reason):
                with self._lock:
                    if ticket in self._watches:
                        self._watches[ticket]['status'] = 'exited_smart'
                        self._watches[ticket]['exitReason'] = reason
                        del self._watches[ticket]
                        self._persist_watches()

    def _run_loop(self):
        while not self._stop.is_set():
            try:
                self._poll_once()
            except Exception as e:
                logger.error('Watchdog loop error: %s', e)
            interval = max(3, int(self._config.get('pollIntervalMs', 8000) / 1000))
            self._stop.wait(interval)


_watchdog_instance: Optional[BridgeWatchdog] = None


def get_watchdog(mt5_connector_factory: Callable[[], Any]) -> BridgeWatchdog:
    global _watchdog_instance
    if _watchdog_instance is None:
        _watchdog_instance = BridgeWatchdog(mt5_connector_factory)
    return _watchdog_instance
