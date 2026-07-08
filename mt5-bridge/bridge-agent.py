"""
Bridge agent: heartbeat to TradeIntel cloud API so dashboard shows home bridge online.
Runs as background thread when bridge starts and credentials exist.
"""

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Optional

from bridge_auth import load_credentials

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SEC = int(os.environ.get('BRIDGE_HEARTBEAT_SEC', '30'))


def _resolve_tunnel_url() -> Optional[str]:
    explicit = os.environ.get('BRIDGE_PUBLIC_URL') or os.environ.get('NEXT_PUBLIC_BRIDGE_URL')
    if explicit:
        return explicit.rstrip('/')

    # ngrok local API
    try:
        req = urllib.request.Request('http://127.0.0.1:4040/api/tunnels')
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())
            for t in data.get('tunnels', []):
                url = t.get('public_url', '')
                if url.startswith('https://'):
                    return url.rstrip('/')
    except Exception:
        pass

    return None


def _fetch_health_mt5(bridge_local: str) -> tuple:
    try:
        req = urllib.request.Request(f'{bridge_local}/health?mt5=1')
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return bool(data.get('mt5_connected')), data.get('account_login')
    except Exception:
        return False, None


def send_heartbeat(mt5_connector_factory=None) -> bool:
    creds = load_credentials()
    if not creds or not creds.get('token'):
        return False

    app_url = (creds.get('appUrl') or os.environ.get('TRADEINTEL_APP_URL', 'https://tradeintelai.vercel.app')).rstrip('/')
    token = creds['token']
    bridge_local = f"http://127.0.0.1:{os.environ.get('MT5_BRIDGE_PORT', '8080')}"

    bridge_url = _resolve_tunnel_url() or creds.get('bridgeUrl')
    mt5_connected = False
    account_login = None

    if mt5_connector_factory:
        try:
            mt5 = mt5_connector_factory()
            info = mt5.get_account_info()
            if info.get('success'):
                mt5_connected = info.get('source') == 'REAL_MT5'
                account_login = info.get('login') or info.get('account_login')
        except Exception:
            pass
    else:
        mt5_connected, account_login = _fetch_health_mt5(bridge_local)

    tunnel_type = 'named' if os.environ.get('BRIDGE_TUNNEL_NAMED', '').lower() in ('1', 'true') else 'ephemeral'

    payload = json.dumps({
        'bridgeUrl': bridge_url,
        'mt5Connected': mt5_connected,
        'accountLogin': account_login,
        'tunnelType': tunnel_type,
        'bridgeVersion': '1.1.0',
    }).encode('utf-8')

    req = urllib.request.Request(
        f'{app_url}/api/bridge/heartbeat',
        data=payload,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                logger.debug('Bridge agent: heartbeat OK')
                return True
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        logger.warning('Bridge agent: heartbeat HTTP %s %s', e.code, body[:200])
    except Exception as e:
        logger.warning('Bridge agent: heartbeat failed %s', e)

    return False


class BridgeAgentThread:
    def __init__(self, mt5_connector_factory=None):
        self._factory = mt5_connector_factory
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        if not load_credentials():
            logger.info('Bridge agent: no credentials — pair with dashboard to enable remote presence')
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name='bridge-agent', daemon=True)
        self._thread.start()
        logger.info('Bridge agent: heartbeat thread started (every %ss)', HEARTBEAT_INTERVAL_SEC)

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.is_set():
            send_heartbeat(self._factory)
            self._stop.wait(HEARTBEAT_INTERVAL_SEC)


_agent: Optional[BridgeAgentThread] = None


def start_bridge_agent(mt5_connector_factory=None) -> BridgeAgentThread:
    global _agent
    if _agent is None:
        _agent = BridgeAgentThread(mt5_connector_factory)
    _agent.start()
    return _agent
