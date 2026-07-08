"""
Bridge API bearer token storage and validation.
Token is issued at pairing time; plain token stored locally on home laptop only.
"""

import hashlib
import json
import os
import secrets
from typing import Optional, Tuple

BRIDGE_ROOT = os.environ.get('MT5_BRIDGE_ROOT') or os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BRIDGE_ROOT, 'data', 'bridge-credentials.json')


def _ensure_data_dir():
    os.makedirs(os.path.dirname(CREDENTIALS_PATH), exist_ok=True)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def save_credentials(uid: str, token: str, app_url: Optional[str] = None) -> None:
    _ensure_data_dir()
    payload = {
        'uid': uid,
        'token': token,
        'tokenHash': hash_token(token),
        'appUrl': app_url or os.environ.get('TRADEINTEL_APP_URL', 'https://tradeintelai.vercel.app'),
    }
    with open(CREDENTIALS_PATH, 'w') as f:
        json.dump(payload, f, indent=2)


def load_credentials() -> Optional[dict]:
    if not os.path.exists(CREDENTIALS_PATH):
        return None
    try:
        with open(CREDENTIALS_PATH, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def get_stored_token() -> Optional[str]:
    creds = load_credentials()
    return creds.get('token') if creds else None


def auth_required() -> bool:
    """When BRIDGE_AUTH_DISABLED=1, skip token checks (local dev only)."""
    if os.environ.get('BRIDGE_AUTH_DISABLED', '').lower() in ('1', 'true', 'yes'):
        return False
    return bool(load_credentials() or os.environ.get('BRIDGE_API_TOKEN'))


def validate_authorization_header(auth_header: Optional[str]) -> Tuple[bool, str]:
    if not auth_required():
        return True, ''

    if not auth_header or not auth_header.startswith('Bearer '):
        return False, 'Missing or invalid Authorization header'

    token = auth_header[7:].strip()
    env_token = os.environ.get('BRIDGE_API_TOKEN')
    if env_token and secrets.compare_digest(token, env_token):
        return True, ''

    creds = load_credentials()
    if creds and creds.get('token') and secrets.compare_digest(token, creds['token']):
        return True, ''

    return False, 'Invalid bridge API token'
