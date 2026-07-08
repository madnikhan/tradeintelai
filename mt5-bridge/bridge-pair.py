#!/usr/bin/env python3
"""Pair home bridge with TradeIntel account using 6-digit code from dashboard."""

import json
import os
import sys
import urllib.error
import urllib.request

from bridge_auth import save_credentials

BRIDGE_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BRIDGE_ROOT)


def main():
    if len(sys.argv) < 2:
        print('Usage: python bridge-pair.py <6-digit-code> [bridge-public-url]')
        print('Get code from dashboard → Settings → Pair home bridge')
        sys.exit(1)

    code = sys.argv[1].strip()
    bridge_url = sys.argv[2].strip() if len(sys.argv) > 2 else os.environ.get('BRIDGE_PUBLIC_URL', '')

    app_url = os.environ.get('TRADEINTEL_APP_URL', 'https://tradeintelai.vercel.app').rstrip('/')

    payload = json.dumps({
        'code': code,
        'bridgeUrl': bridge_url or None,
    }).encode('utf-8')

    req = urllib.request.Request(
        f'{app_url}/api/bridge/pair/redeem',
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/json'},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'Pairing failed HTTP {e.code}: {body}')
        sys.exit(1)

    uid = data.get('uid')
    bridge_token = data.get('bridgeToken')
    if not uid or not bridge_token:
        print('Pairing failed: no uid or bridgeToken in response')
        sys.exit(1)

    save_credentials(uid, bridge_token, app_url)
    print(f'✅ Paired successfully for user {uid[:8]}…')
    print(f'   Credentials saved to {BRIDGE_ROOT}/data/bridge-credentials.json')
    print('   Restart bridge or heartbeat will begin automatically.')
    if bridge_url:
        print(f'   Bridge URL: {bridge_url}')


if __name__ == '__main__':
    main()
