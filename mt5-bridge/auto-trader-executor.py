"""
MT5 execution helpers for Auto Pilot daemon.
Primary: MetaTrader5 Python API (Windows).
Fallback: HTTP bridge /trade or socket EA.
"""

from __future__ import annotations

import json
import logging
import platform
import socket
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MAGIC_NUMBER = 54321
SOCKET_HOST = '127.0.0.1'
SOCKET_PORT = 19532


class AutoPilotExecutor:
    def __init__(self, bridge_port: int = 8080, dry_run: bool = True):
        self.bridge_port = bridge_port
        self.dry_run = dry_run
        self.platform = self._detect_platform()
        self._mt5 = None

    def _detect_platform(self) -> str:
        if platform.system() == 'Windows':
            try:
                import MetaTrader5 as mt5  # noqa: F401
                return 'windows_mt5'
            except ImportError:
                logger.warning('MetaTrader5 package not installed on Windows')
        return 'file_bridge'

    def connect(self) -> bool:
        if self.platform != 'windows_mt5':
            return self._bridge_health()
        try:
            import MetaTrader5 as mt5
            if not mt5.initialize():
                logger.error('MT5 initialize failed: %s', mt5.last_error())
                return False
            self._mt5 = mt5
            info = mt5.account_info()
            if info is None:
                logger.error('MT5 account_info failed')
                return False
            logger.info('MT5 connected account=%s balance=%s', info.login, info.balance)
            return True
        except Exception as e:
            logger.error('MT5 connect error: %s', e)
            return False

    def disconnect(self) -> None:
        if self._mt5 is not None:
            try:
                self._mt5.shutdown()
            except Exception:
                pass
            self._mt5 = None

    def _bridge_health(self) -> bool:
        try:
            url = f'http://127.0.0.1:{self.bridge_port}/health?quick=1'
            with urllib.request.urlopen(url, timeout=3) as resp:
                return resp.status == 200
        except Exception as e:
            logger.warning('Bridge health check failed: %s', e)
            return False

    def get_open_positions(self) -> List[Dict[str, Any]]:
        if self.platform == 'windows_mt5' and self._mt5 is not None:
            positions = self._mt5.positions_get()
            if positions is None:
                return []
            return [
                {
                    'ticket': p.ticket,
                    'symbol': p.symbol,
                    'type': 'BUY' if p.type == 0 else 'SELL',
                    'volume': p.volume,
                    'profit': p.profit,
                }
                for p in positions
            ]
        try:
            url = f'http://127.0.0.1:{self.bridge_port}/positions'
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                return data.get('positions', []) if data.get('success') else []
        except Exception as e:
            logger.warning('get_open_positions failed: %s', e)
            return []

    def get_account_balance(self) -> float:
        if self.platform == 'windows_mt5' and self._mt5 is not None:
            info = self._mt5.account_info()
            return float(info.balance) if info else 0.0
        try:
            url = f'http://127.0.0.1:{self.bridge_port}/account'
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                return float(data.get('balance', 0))
        except Exception:
            return 0.0

    def is_demo_account(self) -> bool:
        if self.platform == 'windows_mt5' and self._mt5 is not None:
            info = self._mt5.account_info()
            if info is None:
                return True
            return bool(getattr(info, 'trade_mode', 0) == 0)
        try:
            url = f'http://127.0.0.1:{self.bridge_port}/account'
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                return str(data.get('account_type', 'demo')).lower() == 'demo'
        except Exception:
            return True

    def place_trade(
        self,
        symbol: str,
        direction: str,
        volume: float,
        stop_loss: float,
        take_profit: float,
    ) -> Dict[str, Any]:
        sym = symbol.replace('/', '').upper()
        if self.dry_run:
            logger.info(
                'DRY RUN %s %s vol=%s sl=%s tp=%s',
                direction, sym, volume, stop_loss, take_profit,
            )
            return {
                'success': True,
                'dry_run': True,
                'order_id': f'dry-{sym}',
                'message': 'Dry run — no order sent',
            }

        if self.platform == 'windows_mt5' and self._mt5 is not None:
            return self._place_mt5_native(sym, direction, volume, stop_loss, take_profit)

        socket_result = self._place_socket_ea(sym, direction, volume, stop_loss, take_profit)
        if socket_result.get('success'):
            return socket_result

        return self._place_bridge_http(sym, direction, volume, stop_loss, take_profit)

    def _place_mt5_native(
        self, symbol: str, direction: str, volume: float, sl: float, tp: float
    ) -> Dict[str, Any]:
        mt5 = self._mt5
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {'success': False, 'error': f'No tick for {symbol}'}
        is_buy = direction.upper() in ('BUY', 'STRONG_BUY')
        price = tick.ask if is_buy else tick.bid
        request = {
            'action': mt5.TRADE_ACTION_DEAL,
            'symbol': symbol,
            'volume': float(volume),
            'type': mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL,
            'price': price,
            'sl': float(sl) if sl else 0.0,
            'tp': float(tp) if tp else 0.0,
            'deviation': 20,
            'magic': MAGIC_NUMBER,
            'comment': 'TradeIntel AutoPilot',
            'type_time': mt5.ORDER_TIME_GTC,
            'type_filling': mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result is None:
            return {'success': False, 'error': str(mt5.last_error())}
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {'success': False, 'error': f'retcode={result.retcode}'}
        return {
            'success': True,
            'order_id': result.order,
            'deal_id': result.deal,
            'price': result.price,
        }

    def _place_bridge_http(
        self, symbol: str, direction: str, volume: float, sl: float, tp: float
    ) -> Dict[str, Any]:
        payload = {
            'symbol': symbol,
            'type': 'BUY' if direction.upper() in ('BUY', 'STRONG_BUY') else 'SELL',
            'volume': volume,
            'stop_loss': sl,
            'take_profit': tp,
            'magic': MAGIC_NUMBER,
            'comment': 'TradeIntel AutoPilot',
        }
        try:
            url = f'http://127.0.0.1:{self.bridge_port}/trade'
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode(),
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                return data
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else str(e)
            return {'success': False, 'error': body}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _place_socket_ea(
        self, symbol: str, direction: str, volume: float, sl: float, tp: float
    ) -> Dict[str, Any]:
        payload = {
            'action': 'OPEN',
            'symbol': symbol,
            'type': 'BUY' if direction.upper() in ('BUY', 'STRONG_BUY') else 'SELL',
            'volume': volume,
            'stop_loss': sl,
            'take_profit': tp,
            'magic': MAGIC_NUMBER,
        }
        try:
            with socket.create_connection((SOCKET_HOST, SOCKET_PORT), timeout=5) as sock:
                sock.sendall((json.dumps(payload) + '\n').encode())
                raw = sock.recv(4096).decode().strip()
                if not raw:
                    return {'success': False, 'error': 'Empty socket response'}
                return json.loads(raw)
        except Exception as e:
            return {'success': False, 'error': f'socket: {e}'}
