#!/usr/bin/env python3
"""
Bridge Router
Routes requests to the correct bridge instance based on account login
Acts as a single entry point for the frontend, routing to appropriate bridges
"""

import json
import logging
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BridgeRouter:
    """Routes requests to appropriate bridge instances"""
    
    def __init__(self, manager_api_url: str = 'http://localhost:8079'):
        self.manager_api_url = manager_api_url
        self.account_ports: dict = {}  # Cache of account_login -> port mappings
        self.default_port = 8080  # Fallback if account not found
    
    def get_bridge_port(self, account_login: int = None) -> int:
        """Get the port for a specific account's bridge"""
        if account_login is None:
            return self.default_port
        
        # Check cache first
        if account_login in self.account_ports:
            return self.account_ports[account_login]
        
        # Query manager API
        try:
            response = requests.get(f'{self.manager_api_url}/account/{account_login}', timeout=2)
            if response.status_code == 200:
                data = response.json()
                port = data.get('port')
                if port:
                    self.account_ports[account_login] = port
                    return port
        except Exception as e:
            logger.warning(f"Could not get port for account {account_login}: {e}")
        
        # Fallback to default
        return self.default_port
    
    def route_request(self, account_login: int = None, path: str = '/', method: str = 'GET', body: dict = None) -> dict:
        """Route a request to the appropriate bridge"""
        port = self.get_bridge_port(account_login)
        url = f'http://localhost:{port}{path}'
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=body, timeout=10)
            else:
                return {'success': False, 'error': f'Unsupported method: {method}'}
            
            return response.json() if response.headers.get('content-type', '').startswith('application/json') else {'success': False, 'error': 'Invalid response'}
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error routing to bridge on port {port}: {e}")
            return {'success': False, 'error': f'Bridge unreachable: {str(e)}'}


class RouterHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for bridge router"""
    
    router: Optional[BridgeRouter] = None
    
    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        # Extract account_login from query or path
        account_login = None
        if 'account_login' in query:
            try:
                account_login = int(query['account_login'][0])
            except:
                pass
        
        # Route to appropriate bridge
        result = self.router.route_request(account_login, path, 'GET')
        self.send_json_response(200, result)
    
    def do_POST(self):
        """Handle POST requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body_data = self.rfile.read(content_length)
        
        try:
            body = json.loads(body_data.decode('utf-8')) if body_data else {}
        except:
            body = {}
        
        # Extract account_login from body or path
        account_login = body.get('account_login') or body.get('accountLogin')
        if account_login:
            try:
                account_login = int(account_login)
            except:
                account_login = None
        
        # Route to appropriate bridge
        result = self.router.route_request(account_login, path, 'POST', body)
        self.send_json_response(200, result)
    
    def send_json_response(self, status_code: int, data: dict):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"{self.address_string()} - {format % args}")


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main():
    """Main entry point"""
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='Bridge Router for MT5')
    parser.add_argument('--port', type=int, default=8080, help='Router port (frontend connects here)')
    parser.add_argument('--manager', type=str, default='http://localhost:8079', help='Manager API URL')
    parser.add_argument('--host', type=str, default=None, help='Host to bind to (default: localhost for local, 0.0.0.0 for network)')
    
    args = parser.parse_args()
    
    # Determine host: use 0.0.0.0 if BRIDGE_ALLOW_NETWORK env var is set, otherwise localhost
    host = args.host or (os.getenv('BRIDGE_ALLOW_NETWORK', '').lower() in ('true', '1', 'yes') and '0.0.0.0' or 'localhost')
    
    logger.info("🚀 Starting Bridge Router...")
    
    # Create router
    router = BridgeRouter(args.manager)
    RouterHTTPHandler.router = router
    
    # Start router server
    server = ThreadingHTTPServer((host, args.port), RouterHTTPHandler)
    if host == '0.0.0.0':
        logger.info(f"📡 Bridge Router running on http://0.0.0.0:{args.port} (accessible from network)")
        logger.info(f"🌐 Access from other devices: http://YOUR_IP:{args.port}")
    else:
        logger.info(f"📡 Bridge Router running on http://localhost:{args.port} (local only)")
    logger.info(f"🔗 Connected to Manager API: {args.manager}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n🛑 Shutting down router...")


if __name__ == '__main__':
    main()

