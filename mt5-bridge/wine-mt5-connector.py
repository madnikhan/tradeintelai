#!/usr/bin/env python3

import json
import time
import logging
import os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

from mt5_paths import resolve_mt5_files_base, normalize_mt5_files_dir

try:
    from bridge_auth import validate_authorization_header, auth_required
    from bridge_watchdog import get_watchdog
    from bridge_agent import start_bridge_agent
    BRIDGE_WATCH_ENABLED = True
except ImportError:
    BRIDGE_WATCH_ENABLED = False
    auth_required = lambda: False  # type: ignore
    validate_authorization_header = lambda h: (True, '')  # type: ignore

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WineMT5Connector:
    def __init__(self):
        commands_dir_name = os.environ.get('MT5_COMMANDS_DIR', 'mt5-commands')
        responses_dir_name = os.environ.get('MT5_RESPONSES_DIR', 'mt5-responses')

        override = os.environ.get('MT5_FILES_DIR')
        self.mql5_files_base = resolve_mt5_files_base(override)
        self.using_mt5_files_override = bool(override and self.mql5_files_base)

        if self.mql5_files_base:
            self.mt5_commands_dir = os.path.join(self.mql5_files_base, commands_dir_name)
            self.mt5_responses_dir = os.path.join(self.mql5_files_base, responses_dir_name)
            logger.info(f"📁 Using MT5 MQL5/Files: {self.mql5_files_base}")
        else:
            bridge_root = os.environ.get('MT5_BRIDGE_ROOT') or os.path.dirname(os.path.abspath(__file__))
            self.mt5_commands_dir = os.path.join(bridge_root, commands_dir_name)
            self.mt5_responses_dir = os.path.join(bridge_root, responses_dir_name)
            self.mql5_files_base = None
            logger.warning(f"⚠️  Could not find MT5 Files directory. Using bridge folder: {bridge_root}")
            logger.warning("⚠️  In MT5: File → Open Data Folder → MQL5 → Files, paste that path in TradeIntel Bridge Advanced")

        self.setup_directories()

    def health_info(self):
        """Diagnostic fields for /health responses."""
        return {
            "commands_dir": self.mt5_commands_dir,
            "responses_dir": self.mt5_responses_dir,
            "mql5_files_dir": self.mql5_files_base,
            "using_mt5_files_override": self.using_mt5_files_override,
        }
        
    def setup_directories(self):
        """Create directories for MT5 communication"""
        os.makedirs(self.mt5_commands_dir, exist_ok=True)
        os.makedirs(self.mt5_responses_dir, exist_ok=True)
        logger.info(f"📁 Commands directory: {self.mt5_commands_dir}")
        logger.info(f"📁 Responses directory: {self.mt5_responses_dir}")
        
    def get_account_info(self):
        """Get account info - REAL DATA ONLY, no fallback"""
        return self.get_live_account_info()
    
    def get_symbol_price(self, symbol):
        """Get symbol price - REAL DATA ONLY, no fallback"""
        return self.get_live_symbol_price(symbol)
    
    def get_historical_data(self, symbol, timeframe='H1', count=100):
        """Get historical price data from MT5 via file communication"""
        # Write a command file requesting historical data
        timestamp = int(time.time() * 1000)  # Use milliseconds for better uniqueness
        command_id = f"historical_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            # Write command
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "get_historical_data",
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "count": count,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent historical data request for {symbol} ({timeframe}, {count} bars): {command_id}")
            
            # Wait for response (max 15 seconds, check every 200ms)
            max_wait = 150  # 150 * 0.1 = 15 seconds
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received historical data response: {response_id}")
                            
                            # Check if response has real MT5 data
                            if response.get('source') == 'REAL_MT5' or response.get('success'):
                                # Clean up files
                                try:
                                    if os.path.exists(command_path):
                                        os.remove(command_path)
                                    if os.path.exists(response_path):
                                        os.remove(response_path)
                                except:
                                    pass
                                return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in response file: {e}")
                        break
                    except Exception as e:
                        logger.error(f"Error reading response file: {e}")
                        break
                
                time.sleep(0.1)  # Wait 100ms before checking again
            
            # Timeout - clean up and return error
            logger.warning(f"⏱️ Timeout waiting for historical data response: {response_id}")
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
                if os.path.exists(response_path):
                    os.remove(response_path)
            except:
                pass
            
            return {
                "success": False,
                "error": "Timeout waiting for MT5 response",
                "symbol": symbol,
                "timeframe": timeframe,
                "count": count
            }
            
        except Exception as e:
            logger.error(f"Error getting historical data for {symbol}: {e}")
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
                if os.path.exists(response_path):
                    os.remove(response_path)
            except:
                pass
            return {
                "success": False,
                "error": f"Failed to get historical data: {e}",
                "symbol": symbol,
                "timeframe": timeframe,
                "count": count
            }
    
    def execute_trade(self, trade_data):
        """Execute trade via file-based communication with MT5"""
        logger.info(f"🎯 Sending trade to MT5: {trade_data}")
        
        # Write trade command for MT5 EA to pick up
        timestamp = int(time.time() * 1000)  # Use milliseconds for better uniqueness
        command_id = f"trade_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "execute_trade",
                    "data": trade_data,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📨 Trade command written: {command_path}")
            
            # Wait for MT5 response (max 15 seconds for trade execution)
            max_wait = 150  # 150 * 0.1 = 15 seconds
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received trade response: {response_id}")
                            
                            # Clean up files
                            try:
                                if os.path.exists(command_path):
                                    os.remove(command_path)
                                if os.path.exists(response_path):
                                    os.remove(response_path)
                            except:
                                pass
                            
                            # Return the response from MT5
                            return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in response file: {e}")
                        break
                    except Exception as e:
                        logger.error(f"Error reading response: {e}")
                        break
                
                time.sleep(0.1)
            
            # Clean up command file if no response
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
            except:
                pass
            
            logger.warning(f"⏱️ Timeout waiting for trade response (waited 15s)")
            # Return error if no response
            return {
                "success": False,
                "error": "Trade command sent but no response from MT5 EA. Make sure MT5FileBridgeEA is running.",
                "timestamp": datetime.now().isoformat(),
                "note": "Check MT5 terminal for EA status"
            }
            
        except Exception as e:
            logger.error(f"Error sending trade to MT5: {e}")
            return {
                "success": False,
                "error": f"Failed to send trade to MT5: {e}",
                "timestamp": datetime.now().isoformat()
            }
    
    def check_mt5_connection(self):
        """Check if MT5 is connected and responding"""
        # Try to get account info - if we get real data, MT5 is connected
        try:
            # Write a quick test command
            test_timestamp = int(time.time() * 1000)
            test_command_id = f"account_{test_timestamp}.json"
            test_command_path = os.path.join(self.mt5_commands_dir, test_command_id)
            test_response_id = f"response_{test_timestamp}.json"
            test_response_path = os.path.join(self.mt5_responses_dir, test_response_id)
            
            # Write test command
            with open(test_command_path, 'w') as f:
                json.dump({
                    "command": "get_account_info",
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            # Wait briefly for response (2 seconds)
            for _ in range(20):  # 20 * 0.1 = 2 seconds
                if os.path.exists(test_response_path):
                    try:
                        with open(test_response_path, 'r') as f:
                            response = json.load(f)
                            # Clean up test files
                            try:
                                if os.path.exists(test_command_path):
                                    os.remove(test_command_path)
                                if os.path.exists(test_response_path):
                                    os.remove(test_response_path)
                            except:
                                pass
                            
                            # Check if response has real MT5 data
                            if response.get('source') == 'REAL_MT5':
                                return True
                    except:
                        pass
                time.sleep(0.1)
            
            # Clean up test command if no response
            try:
                if os.path.exists(test_command_path):
                    os.remove(test_command_path)
            except:
                pass
                
        except Exception as e:
            logger.debug(f"Error checking MT5 connection: {e}")
        
        return False  # Default to false if no response
    
    def get_live_account_info(self):
        """Get live account info from MT5 via file communication"""
        # Write a command file requesting account info
        timestamp = int(time.time() * 1000)  # Use milliseconds for better uniqueness
        command_id = f"account_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            # Write command
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "get_account_info",
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent account info request: {command_id}")
            
            # Wait for response (max 10 seconds, check every 200ms)
            max_wait = 100  # 100 * 0.1 = 10 seconds
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received account info response: {response_id}")
                            
                            # Check if response has real MT5 data
                            if response.get('source') == 'REAL_MT5' or response.get('success'):
                                # Clean up files
                                try:
                                    if os.path.exists(command_path):
                                        os.remove(command_path)
                                    if os.path.exists(response_path):
                                        os.remove(response_path)
                                except:
                                    pass
                                return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in response file: {e}")
                        break
                    except Exception as e:
                        logger.error(f"Error reading response: {e}")
                        break
                
                time.sleep(0.1)
            
            # Clean up command file if no response
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
            except:
                pass
            
            logger.warning(f"⏱️ Timeout waiting for account info response (waited 10s)")
            # NO MOCK DATA - Return error
            return {
                "success": False,
                "error": "MT5 EA not responding. Attach EA to a chart and enable 'Allow live trading'.",
                "balance": 0,
                "equity": 0,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting live account info: {e}")
            return {
                "success": False,
                "error": f"Failed to get account info: {e}",
                "balance": 0,
                "equity": 0,
                "timestamp": datetime.now().isoformat()
            }
    
    def get_live_symbol_price(self, symbol):
        """Get live symbol price from MT5 via file communication"""
        # Write a command file requesting symbol price
        timestamp = int(time.time() * 1000)  # Use milliseconds for better uniqueness
        command_id = f"price_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            # Write command
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "get_symbol_price",
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent price request for {symbol}: {command_id}")
            
            # Wait for response (max 10 seconds, check every 200ms)
            max_wait = 100  # 100 * 0.1 = 10 seconds
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received price response: {response_id}")
                            
                            # Check if response has real MT5 data
                            if response.get('source') == 'REAL_MT5' or response.get('success'):
                                # Clean up files
                                try:
                                    if os.path.exists(command_path):
                                        os.remove(command_path)
                                    if os.path.exists(response_path):
                                        os.remove(response_path)
                                except:
                                    pass
                                return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in response file: {e}")
                        break
                    except Exception as e:
                        logger.error(f"Error reading response: {e}")
                        break
                
                time.sleep(0.1)
            
            # Clean up command file if no response
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
            except:
                pass
            
            logger.warning(f"⏱️ Timeout waiting for price response (waited 10s)")
            # NO MOCK DATA - Return error
            return {
                "success": False,
                "error": "MT5 EA not responding. Attach EA to a chart and enable 'Allow live trading'.",
                "symbol": symbol,
                "bid": 0,
                "ask": 0,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting live symbol price: {e}")
            return {
                "success": False,
                "error": f"Failed to get price: {e}",
                "symbol": symbol,
                "bid": 0,
                "ask": 0,
                "timestamp": datetime.now().isoformat()
            }
    
    def get_open_positions(self):
        """Get open positions from MT5 via file communication"""
        timestamp = int(time.time() * 1000)
        command_id = f"positions_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "get_positions",
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent open positions request: {command_id}")
            
            # Wait for response (max 10 seconds)
            max_wait = 100
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received open positions response: {response_id}")
                            
                            try:
                                os.remove(command_path)
                                os.remove(response_path)
                            except:
                                pass
                            
                            return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse open positions response: {e}")
                        break
                
                time.sleep(0.1)
            
            logger.warning(f"⏱️ Timeout waiting for open positions response")
            try:
                os.remove(command_path)
            except:
                pass
            
            return {
                "success": False,
                "error": "Timeout waiting for MT5 response",
                "positions": []
            }
            
        except Exception as e:
            logger.error(f"Error getting open positions: {e}")
            return {
                "success": False,
                "error": f"Failed to get open positions: {e}",
                "positions": []
            }

    def close_position(self, ticket: int):
        """Close a position by ticket via file-based communication with MT5"""
        command_id = f"close_position_{int(time.time() * 1000)}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{int(time.time() * 1000)}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "close_position",
                    "ticket": str(ticket),
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent close position request: {command_id} (ticket: {ticket})")
            
            # Wait for response (max 10 seconds)
            max_wait = 100
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received close position response: {response_id}")
                            
                            # Clean up files
                            try:
                                os.remove(command_path)
                                os.remove(response_path)
                            except:
                                pass
                            
                            return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse close position response: {e}")
                        break
                
                time.sleep(0.1)
            
            # Timeout
            logger.warning(f"⏱️ Timeout waiting for close position response (waited 10s)")
            try:
                os.remove(command_path)
            except:
                pass
            
            return {
                "success": False,
                "error": "Timeout waiting for MT5 response"
            }
        except Exception as e:
            logger.error(f"Error closing position: {e}")
            try:
                if os.path.exists(command_path):
                    os.remove(command_path)
            except:
                pass
            return {
                "success": False,
                "error": f"Failed to close position: {e}",
            }

    def get_closed_positions(self):
        """Get closed positions (trade history) from MT5 via file communication"""
        timestamp = int(time.time() * 1000)
        command_id = f"closed_positions_{timestamp}.json"
        command_path = os.path.join(self.mt5_commands_dir, command_id)
        response_id = f"response_{timestamp}.json"
        response_path = os.path.join(self.mt5_responses_dir, response_id)
        
        try:
            with open(command_path, 'w') as f:
                json.dump({
                    "command": "get_closed_positions",
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"📤 Sent closed positions request: {command_id}")
            
            # Wait for response (max 20 seconds - closed positions can take longer with many deals)
            max_wait = 200
            for i in range(max_wait):
                if os.path.exists(response_path):
                    try:
                        with open(response_path, 'r') as f:
                            response = json.load(f)
                            logger.info(f"📥 Received closed positions response: {response_id}")
                            
                            # Log response summary for debugging
                            if response.get("success") and response.get("positions"):
                                logger.info(f"✅ Found {len(response.get('positions', []))} closed positions")
                            
                            # Clean up files
                            try:
                                os.remove(command_path)
                                os.remove(response_path)
                            except:
                                pass
                            
                            return response
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse closed positions response: {e}")
                        break
                
                time.sleep(0.1)
            
            # Timeout
            logger.warning(f"⏱️ Timeout waiting for closed positions response (waited 20s)")
            try:
                os.remove(command_path)
            except:
                pass
            
            return {
                "success": False,
                "error": "Timeout waiting for MT5 response",
                "positions": []
            }
            
        except Exception as e:
            logger.error(f"Error getting closed positions: {e}")
            return {
                "success": False,
                "error": f"Failed to get closed positions: {e}",
                "positions": []
            }

    # MOCK DATA REMOVED - All data must come from real MT5 connection

# Create a shared MT5 connector instance (singleton pattern)
_shared_mt5_connector = None
_connector_lock = False

def get_mt5_connector():
    global _shared_mt5_connector, _connector_lock
    if _shared_mt5_connector is None and not _connector_lock:
        try:
            _connector_lock = True
            logger.info("🔧 Initializing MT5 connector...")
            _shared_mt5_connector = WineMT5Connector()
            logger.info("✅ MT5 connector initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize MT5 connector: {e}")
            _connector_lock = False
            raise
        finally:
            _connector_lock = False
    return _shared_mt5_connector

class WineMT5HTTPHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def _path_only(self):
        return self.path.split('?')[0]

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            return {}
        post_data = self.rfile.read(content_length)
        return json.loads(post_data.decode('utf-8'))

    def _require_auth(self) -> bool:
        if not BRIDGE_WATCH_ENABLED or not auth_required():
            return True
        ok, err = validate_authorization_header(self.headers.get('Authorization'))
        if not ok:
            self.send_json_response(401, {'success': False, 'error': err})
            return False
        return True

    def _get_watchdog(self):
        return get_watchdog(get_mt5_connector)
    
    def get_mt5_connector(self):
        """Lazy load MT5 connector only when needed"""
        return get_mt5_connector()
    
    def do_GET(self):
        # Health check should be instant - no MT5 calls, no connector initialization, no blocking
        if self.path == '/health' or self.path.startswith('/health?'):
            try:
                quick = 'quick=1' in self.path
                mt5_check = 'mt5=1' in self.path
                mt5_connected = False
                health_extra = {}

                if not quick:
                    try:
                        mt5 = self.get_mt5_connector()
                        health_extra = mt5.health_info()
                        if mt5_check:
                            mt5_connected = mt5.check_mt5_connection()
                        else:
                            account_info = mt5.get_account_info()
                            if account_info.get('success') and account_info.get('source') == 'REAL_MT5':
                                mt5_connected = True
                    except Exception:
                        pass
                else:
                    try:
                        mt5 = self.get_mt5_connector()
                        health_extra = mt5.health_info()
                    except Exception:
                        pass

                payload = {
                    "status": "running",
                    "mt5_connected": mt5_connected,
                    **health_extra,
                }
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Cache-Control')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                response = json.dumps(payload).encode('utf-8')
                self.wfile.write(response)
                self.wfile.flush()
                return
            except Exception as e:
                logger.error(f"Error in health check: {e}")
                try:
                    self.send_error(500, "Health check failed")
                except:
                    pass
                return
        
        try:
            # Get MT5 connector only when needed (not for health check)
            mt5 = self.get_mt5_connector()
            
            if self.path.startswith('/price/'):
                symbol = self.path.split('/')[-1]
                price_data = mt5.get_symbol_price(symbol)
                self.send_json_response(200, price_data)
            elif self.path.startswith('/historical/'):
                # Parse /historical/{symbol}?timeframe=H1&count=100
                parts = self.path.split('/')
                symbol = parts[-1].split('?')[0] if len(parts) > 2 else ''
                
                # Parse query parameters
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(self.path)
                params = parse_qs(parsed.query)
                timeframe = params.get('timeframe', ['H1'])[0]
                count = int(params.get('count', ['100'])[0])
                
                if not symbol:
                    self.send_json_response(400, {"success": False, "error": "Symbol required"})
                else:
                    historical_data = mt5.get_historical_data(symbol, timeframe, count)
                    self.send_json_response(200, historical_data)
            elif self.path == '/account':
                account_info = mt5.get_account_info()
                self.send_json_response(200, account_info)
            elif self.path == '/positions' or self.path == '/open-positions':
                open_positions = mt5.get_open_positions()
                self.send_json_response(200, open_positions)
            elif self.path == '/closed-positions' or self.path == '/history':
                closed_positions = mt5.get_closed_positions()
                self.send_json_response(200, closed_positions)
            elif self.path == '/all-trades':
                # Get both open and closed positions
                open_positions = mt5.get_open_positions()
                closed_positions = mt5.get_closed_positions()
                
                all_trades = {
                    "success": True,
                    "source": "REAL_MT5",
                    "open": open_positions.get("positions", []) if open_positions.get("success") else [],
                    "closed": closed_positions.get("positions", []) if closed_positions.get("success") else [],
                    "total_open": len(open_positions.get("positions", [])),
                    "total_closed": len(closed_positions.get("positions", [])),
                }
                self.send_json_response(200, all_trades)
            elif BRIDGE_WATCH_ENABLED and self._path_only() == '/watch/status':
                if not self._require_auth():
                    return
                wd = self._get_watchdog()
                self.send_json_response(200, {
                    'success': True,
                    'watches': wd.list_watches(),
                    'config': wd.get_config(),
                })
            elif BRIDGE_WATCH_ENABLED and self._path_only() == '/watch/config':
                if not self._require_auth():
                    return
                wd = self._get_watchdog()
                self.send_json_response(200, {'success': True, 'config': wd.get_config()})
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            logger.error(f"Error handling GET request {self.path}: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def do_POST(self):
        path = self._path_only()
        if path == '/trade':
            if not self._require_auth():
                return
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                trade_data = json.loads(post_data.decode('utf-8'))
                
                # FIX: Ensure reasonable lot sizes
                volume = trade_data.get('volume', 0.01)
                if volume > 10:  # Maximum 10 lots for safety
                    volume = 10
                elif volume < 0.01:  # Minimum 0.01 lots
                    volume = 0.01
                    
                trade_data['volume'] = round(volume, 2)
                
                mt5 = self.get_mt5_connector()
                trade_result = mt5.execute_trade(trade_data)
                self.send_json_response(200, trade_result)
            except Exception as e:
                logger.error(f"Error in POST /trade: {e}")
                self.send_json_response(500, {"success": False, "error": str(e)})
        elif path.startswith('/close-position/'):
            if not self._require_auth():
                return
            try:
                # Extract ticket from path: /close-position/{ticket}
                ticket_str = path.split('/')[-1]
                try:
                    ticket = int(ticket_str)
                except ValueError:
                    self.send_json_response(400, {"success": False, "error": "Invalid ticket format"})
                    return
                
                mt5 = self.get_mt5_connector()
                close_result = mt5.close_position(ticket)
                self.send_json_response(200, close_result)
            except Exception as e:
                logger.error(f"Error in POST /close-position: {e}")
                self.send_json_response(500, {"success": False, "error": str(e)})
        elif BRIDGE_WATCH_ENABLED and path == '/watch/register':
            if not self._require_auth():
                return
            try:
                body = self._read_json_body()
                wd = self._get_watchdog()
                watch = wd.register_watch(body)
                self.send_json_response(200, {'success': True, 'watch': watch})
            except Exception as e:
                logger.error('Error in POST /watch/register: %s', e)
                self.send_json_response(400, {'success': False, 'error': str(e)})
        elif BRIDGE_WATCH_ENABLED and path == '/watch/config':
            if not self._require_auth():
                return
            try:
                body = self._read_json_body()
                wd = self._get_watchdog()
                config = wd.update_config(body)
                self.send_json_response(200, {'success': True, 'config': config})
            except Exception as e:
                logger.error('Error in POST /watch/config: %s', e)
                self.send_json_response(400, {'success': False, 'error': str(e)})
        else:
            self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        path = self._path_only()
        if BRIDGE_WATCH_ENABLED and path.startswith('/watch/'):
            if not self._require_auth():
                return
            ticket = path.split('/')[-1]
            if ticket in ('watch', 'register', 'config', 'status'):
                self.send_error(404, 'Ticket required')
                return
            wd = self._get_watchdog()
            removed = wd.unregister_watch(ticket)
            self.send_json_response(200, {'success': removed, 'ticket': ticket})
            return
        self.send_error(404, "Endpoint not found")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Cache-Control')
        self.end_headers()
    
    def send_json_response(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Cache-Control')
            self.end_headers()
            response_data = json.dumps(data).encode('utf-8')
            self.wfile.write(response_data)
            self.wfile.flush()
        except Exception as e:
            logger.error(f"Error sending JSON response: {e}")
            # Try to send error response
            try:
                self.send_response(500)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Error: {str(e)}".encode())
            except:
                pass
    
    def log_message(self, format, *args):
        logger.info("%s - %s", self.address_string(), format % args)

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Threaded HTTP server to handle multiple concurrent requests"""
    daemon_threads = True

def main():
    # Support custom port via environment variable (for multi-bridge)
    port = int(os.environ.get('MT5_BRIDGE_PORT', '8080'))
    account_login = os.environ.get('MT5_ACCOUNT_LOGIN', 'default')
    
    logger.info("🚀 Starting Wine-Compatible MT5 HTTP Bridge")
    logger.info(f"💡 Account: {account_login}")
    logger.info(f"📡 Port: {port}")
    logger.info("💡 This bridge works with MT5 running on Wine")
    logger.info("📁 Using file-based communication with MT5 Expert Advisor")
    logger.info("🧵 Using threaded server for concurrent requests")
    
    # Kill any existing process on the port (only if not managed by multi-bridge)
    if port == 8080:  # Only kill for default port to avoid conflicts
        import subprocess
        try:
            result = subprocess.run(['lsof', f'-ti:{port}'], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    try:
                        subprocess.run(['kill', pid], check=False)
                        logger.info(f"🔪 Killed existing process on port {port}: {pid}")
                    except:
                        pass
                time.sleep(1)
        except:
            pass
    
    server = ThreadingHTTPServer(('localhost', port), WineMT5HTTPHandler)

    if BRIDGE_WATCH_ENABLED:
        try:
            wd = get_watchdog(get_mt5_connector)
            wd.start()
            start_bridge_agent(get_mt5_connector)
            logger.info('✅ Bridge watchdog + agent started')
        except Exception as e:
            logger.warning('⚠️  Bridge watchdog failed to start: %s', e)
    
    try:
        logger.info(f"📡 Server running on http://localhost:{port}")
        logger.info("✅ Bridge is ready to accept connections")
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Server error: {e}")
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()

