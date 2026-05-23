#!/usr/bin/env python3
"""
Multi-Bridge Manager
Manages multiple MT5 bridge instances for up to 50+ accounts
Each bridge instance connects to one MT5 terminal/account
"""

import json
import logging
import os
import subprocess
import time
from typing import Dict, List, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import threading

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BridgeInstance:
    """Represents a single bridge instance for one MT5 account"""
    def __init__(self, account_login: int, port: int, commands_dir: str, responses_dir: str):
        self.account_login = account_login
        self.port = port
        self.commands_dir = commands_dir
        self.responses_dir = responses_dir
        self.process: Optional[subprocess.Popen] = None
        self.status = 'stopped'  # stopped, starting, running, error
        self.last_health_check = None
        self.health_status = 'unknown'
    
    def start(self):
        """Start the bridge instance"""
        if self.process and self.process.poll() is None:
            logger.warning(f"Bridge for account {self.account_login} already running")
            return
        
        try:
            # Start bridge process
            env = os.environ.copy()
            env['MT5_ACCOUNT_LOGIN'] = str(self.account_login)
            env['MT5_BRIDGE_PORT'] = str(self.port)
            env['MT5_COMMANDS_DIR'] = self.commands_dir
            env['MT5_RESPONSES_DIR'] = self.responses_dir
            
            # Start the bridge script
            self.process = subprocess.Popen(
                ['python3', 'wine-mt5-connector.py'],
                cwd=os.path.dirname(__file__),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.status = 'starting'
            logger.info(f"🚀 Started bridge for account {self.account_login} on port {self.port}")
            
            # Wait a bit and check if it started successfully
            time.sleep(2)
            if self.process.poll() is None:
                self.status = 'running'
            else:
                self.status = 'error'
                logger.error(f"❌ Bridge for account {self.account_login} failed to start")
        
        except Exception as e:
            logger.error(f"Error starting bridge for account {self.account_login}: {e}")
            self.status = 'error'
    
    def stop(self):
        """Stop the bridge instance"""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
                logger.info(f"🛑 Stopped bridge for account {self.account_login}")
            except subprocess.TimeoutExpired:
                self.process.kill()
                logger.warning(f"Force killed bridge for account {self.account_login}")
            except Exception as e:
                logger.error(f"Error stopping bridge for account {self.account_login}: {e}")
            finally:
                self.process = None
                self.status = 'stopped'
    
    def is_running(self) -> bool:
        """Check if bridge is running"""
        if self.process and self.process.poll() is None:
            return True
        return False
    
    def get_status(self) -> dict:
        """Get status of this bridge instance"""
        return {
            'account_login': self.account_login,
            'port': self.port,
            'status': self.status,
            'running': self.is_running(),
            'health': self.health_status,
            'last_check': self.last_health_check.isoformat() if self.last_health_check else None
        }


class MultiBridgeManager:
    """Manages multiple bridge instances for multiple MT5 accounts"""
    
    def __init__(self, config_file: str = 'bridge-config.json'):
        self.config_file = config_file
        self.bridges: Dict[int, BridgeInstance] = {}
        self.base_port = 8081
        self.config = self.load_config()
        self.health_check_thread: Optional[threading.Thread] = None
        self.running = False
    
    def load_config(self) -> dict:
        """Load bridge configuration from file"""
        config_path = os.path.join(os.path.dirname(__file__), self.config_file)
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        
        # Default config
        return {
            'accounts': [],
            'base_port': 8081,
            'commands_base_dir': 'mt5-commands',
            'responses_base_dir': 'mt5-responses'
        }
    
    def save_config(self):
        """Save bridge configuration to file"""
        config_path = os.path.join(os.path.dirname(__file__), self.config_file)
        try:
            with open(config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    def add_account(self, account_login: int, commands_dir: str = None, responses_dir: str = None):
        """Add a new account to manage"""
        if account_login in self.bridges:
            logger.warning(f"Account {account_login} already exists")
            return
        
        # Find next available port
        used_ports = [b.port for b in self.bridges.values()]
        port = self.base_port
        while port in used_ports:
            port += 1
        
        # Use account-specific directories if not provided
        if not commands_dir:
            commands_dir = f"{self.config['commands_base_dir']}-{account_login}"
        if not responses_dir:
            responses_dir = f"{self.config['responses_base_dir']}-{account_login}"
        
        bridge = BridgeInstance(account_login, port, commands_dir, responses_dir)
        self.bridges[account_login] = bridge
        
        # Save to config
        if account_login not in [acc['login'] for acc in self.config.get('accounts', [])]:
            self.config.setdefault('accounts', []).append({
                'login': account_login,
                'port': port,
                'commands_dir': commands_dir,
                'responses_dir': responses_dir
            })
            self.save_config()
        
        logger.info(f"✅ Added account {account_login} (port {port})")
    
    def remove_account(self, account_login: int):
        """Remove an account"""
        if account_login in self.bridges:
            self.bridges[account_login].stop()
            del self.bridges[account_login]
            
            # Remove from config
            self.config['accounts'] = [acc for acc in self.config.get('accounts', []) if acc['login'] != account_login]
            self.save_config()
            
            logger.info(f"✅ Removed account {account_login}")
    
    def start_all(self):
        """Start all bridge instances"""
        logger.info(f"🚀 Starting {len(self.bridges)} bridge instances...")
        for bridge in self.bridges.values():
            bridge.start()
            time.sleep(0.5)  # Stagger starts
        
        self.running = True
        self.start_health_check()
        logger.info("✅ All bridges started")
    
    def stop_all(self):
        """Stop all bridge instances"""
        logger.info("🛑 Stopping all bridges...")
        self.running = False
        
        if self.health_check_thread:
            self.health_check_thread.join(timeout=2)
        
        for bridge in self.bridges.values():
            bridge.stop()
        
        logger.info("✅ All bridges stopped")
    
    def start_account(self, account_login: int):
        """Start bridge for specific account"""
        if account_login in self.bridges:
            self.bridges[account_login].start()
        else:
            logger.error(f"Account {account_login} not found")
    
    def stop_account(self, account_login: int):
        """Stop bridge for specific account"""
        if account_login in self.bridges:
            self.bridges[account_login].stop()
        else:
            logger.error(f"Account {account_login} not found")
    
    def get_bridge_port(self, account_login: int) -> Optional[int]:
        """Get the port for a specific account's bridge"""
        if account_login in self.bridges:
            return self.bridges[account_login].port
        return None
    
    def get_all_status(self) -> dict:
        """Get status of all bridges"""
        return {
            'total_accounts': len(self.bridges),
            'running': sum(1 for b in self.bridges.values() if b.is_running()),
            'bridges': [bridge.get_status() for bridge in self.bridges.values()]
        }
    
    def start_health_check(self):
        """Start health check thread"""
        def health_check_loop():
            import requests
            while self.running:
                for bridge in self.bridges.values():
                    if bridge.is_running():
                        try:
                            response = requests.get(f'http://localhost:{bridge.port}/health', timeout=2)
                            bridge.health_status = 'healthy' if response.status_code == 200 else 'unhealthy'
                        except:
                            bridge.health_status = 'unreachable'
                        bridge.last_health_check = time.time()
                time.sleep(10)  # Check every 10 seconds
        
        self.health_check_thread = threading.Thread(target=health_check_loop, daemon=True)
        self.health_check_thread.start()


class MultiBridgeHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for multi-bridge manager API"""
    
    manager: Optional[MultiBridgeManager] = None
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/status':
            self.send_json_response(200, self.manager.get_all_status() if self.manager else {})
        elif self.path.startswith('/account/'):
            # Get account-specific bridge info
            try:
                account_login = int(self.path.split('/')[-1])
                port = self.manager.get_bridge_port(account_login) if self.manager else None
                if port:
                    self.send_json_response(200, {'account_login': account_login, 'port': port})
                else:
                    self.send_json_response(404, {'error': 'Account not found'})
            except:
                self.send_json_response(400, {'error': 'Invalid account login'})
        else:
            self.send_json_response(404, {'error': 'Not found'})
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/start':
            if self.manager:
                self.manager.start_all()
                self.send_json_response(200, {'status': 'started'})
            else:
                self.send_json_response(500, {'error': 'Manager not initialized'})
        elif self.path == '/stop':
            if self.manager:
                self.manager.stop_all()
                self.send_json_response(200, {'status': 'stopped'})
            else:
                self.send_json_response(500, {'error': 'Manager not initialized'})
        elif self.path.startswith('/account/'):
            # Add/remove account
            try:
                parts = self.path.split('/')
                action = parts[-1]  # add, remove, start, stop
                account_login = int(parts[-2])
                
                if action == 'add':
                    self.manager.add_account(account_login)
                    self.send_json_response(200, {'status': 'added'})
                elif action == 'remove':
                    self.manager.remove_account(account_login)
                    self.send_json_response(200, {'status': 'removed'})
                elif action == 'start':
                    self.manager.start_account(account_login)
                    self.send_json_response(200, {'status': 'started'})
                elif action == 'stop':
                    self.manager.stop_account(account_login)
                    self.send_json_response(200, {'status': 'stopped'})
                else:
                    self.send_json_response(400, {'error': 'Invalid action'})
            except Exception as e:
                self.send_json_response(400, {'error': str(e)})
        else:
            self.send_json_response(404, {'error': 'Not found'})
    
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
    
    parser = argparse.ArgumentParser(description='Multi-Bridge Manager for MT5')
    parser.add_argument('--port', type=int, default=8079, help='Manager API port')
    parser.add_argument('--config', type=str, default='bridge-config.json', help='Config file')
    parser.add_argument('--accounts', type=str, nargs='+', help='Account logins to start (space-separated)')
    
    args = parser.parse_args()
    
    logger.info("🚀 Starting Multi-Bridge Manager...")
    
    # Create manager
    manager = MultiBridgeManager(args.config)
    MultiBridgeHTTPHandler.manager = manager
    
    # Add accounts from command line if provided
    if args.accounts:
        for account_str in args.accounts:
            try:
                account_login = int(account_str)
                manager.add_account(account_login)
            except ValueError:
                logger.error(f"Invalid account login: {account_str}")
    
    # Start all bridges
    manager.start_all()
    
    # Start manager API server
    server = ThreadingHTTPServer(('localhost', args.port), MultiBridgeHTTPHandler)
    logger.info(f"📡 Multi-Bridge Manager API running on http://localhost:{args.port}")
    logger.info(f"📊 Managing {len(manager.bridges)} accounts")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n🛑 Shutting down...")
        manager.stop_all()
        server.shutdown()


if __name__ == '__main__':
    main()

