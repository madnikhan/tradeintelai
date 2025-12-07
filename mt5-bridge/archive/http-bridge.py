#!/usr/bin/env python3
import json
import time
import logging
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import threading

# Add parent directory to path to import MT5 connector
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

# Try to import real MT5 connector
try:
    from mt5_integration import RealMT5Connector
    MT5_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("✅ MetaTrader5 library available - using REAL MT5 connection")
except ImportError:
    MT5_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️  MetaTrader5 library not available - using MOCK data")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize MT5 connector if available
mt5_connector = None
if MT5_AVAILABLE:
    try:
        account_id = os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154')
        password = os.getenv('IC_MARKETS_PASSWORD', '0@ComXX0wUDUyB')
        server = os.getenv('IC_MARKETS_SERVER', 'ICMarketsSC-Demo')
        
        mt5_connector = RealMT5Connector()
        connected = mt5_connector.connect_to_mt5(account_id, password, server)
        if connected:
            logger.info("✅ Connected to REAL IC Markets MT5 account")
        else:
            logger.warning("⚠️  Failed to connect to MT5 - using mock data")
            MT5_AVAILABLE = False
    except Exception as e:
        logger.error(f"❌ Error initializing MT5 connector: {e}")
        MT5_AVAILABLE = False

class MT5HTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                "status": "running",
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path.startswith('/price/'):
            symbol = self.path.split('/')[-1]
            self.send_price(symbol)
            
        elif self.path == '/account':
            self.send_account_info()
            
        elif self.path == '/positions':
            self.send_positions()
            
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/trade':
            self.execute_trade()
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_price(self, symbol):
        """Send symbol price"""
        try:
            # Try to get REAL price from MT5
            if MT5_AVAILABLE and mt5_connector:
                try:
                    market_data = mt5_connector.get_real_market_data(symbol.upper())
                    if market_data:
                        response = {
                            "success": True,
                            "symbol": symbol.upper(),
                            "bid": market_data.get("bid", 0),
                            "ask": market_data.get("ask", 0),
                            "spread": market_data.get("spread", 0),
                            "timestamp": datetime.now().isoformat(),
                            "source": "REAL_MT5"
                        }
                        self.send_json_response(200, response)
                        logger.info(f"📊 REAL price data sent for {symbol} from MT5")
                        return
                except Exception as e:
                    logger.warning(f"Failed to get real price from MT5: {e}, using mock data")
            
            # Fallback to mock data
            mock_prices = {
                "EURUSD": {"bid": 1.0850, "ask": 1.0852, "spread": 0.0002},
                "GBPUSD": {"bid": 1.2650, "ask": 1.2652, "spread": 0.0002},
                "USDJPY": {"bid": 148.50, "ask": 148.52, "spread": 0.02},
                "USDCHF": {"bid": 0.8680, "ask": 0.8682, "spread": 0.0002},
                "AUDUSD": {"bid": 0.6520, "ask": 0.6522, "spread": 0.0002}
            }
            
            price_data = mock_prices.get(symbol.upper(), {"bid": 1.0, "ask": 1.0, "spread": 0.0})
            
            response = {
                "success": True,
                "symbol": symbol.upper(),
                "bid": price_data["bid"],
                "ask": price_data["ask"],
                "spread": price_data["spread"],
                "timestamp": datetime.now().isoformat(),
                "source": "MOCK"
            }
            
            self.send_json_response(200, response)
            logger.info(f"📊 Mock price data sent for {symbol}")
            
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def send_account_info(self):
        """Send account information"""
        try:
            # Try to get REAL account info from MT5
            if MT5_AVAILABLE and mt5_connector:
                try:
                    account_info = mt5_connector.get_real_account_info()
                    if account_info:
                        response = {
                            "success": True,
                            "balance": account_info.get("balance", 0),
                            "equity": account_info.get("equity", 0),
                            "margin": account_info.get("margin", 0),
                            "free_margin": account_info.get("free_margin", 0),
                            "currency": account_info.get("currency", "USD"),
                            "leverage": account_info.get("leverage", 100),
                            "server": "ICMarketsMT5-Demo",
                            "login": os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154'),
                            "timestamp": datetime.now().isoformat(),
                            "source": "REAL_MT5"
                        }
                        self.send_json_response(200, response)
                        logger.info("📈 REAL account info sent from MT5")
                        return
                except Exception as e:
                    logger.warning(f"Failed to get real account info from MT5: {e}, using mock data")
            
            # Fallback to mock data
            response = {
                "success": True,
                "balance": 100000.00,
                "equity": 100000.00,
                "margin": 0.00,
                "free_margin": 100000.00,
                "currency": "USD",
                "leverage": 100,
                "server": "ICMarketsMT5-Demo",
                "login": 12345678,
                "timestamp": datetime.now().isoformat(),
                "source": "MOCK"
            }
            
            self.send_json_response(200, response)
            logger.info("📈 Mock account info sent")
            
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def send_positions(self):
        """Send open positions"""
        try:
            response = {
                "success": True,
                "positions": [],
                "timestamp": datetime.now().isoformat()
            }
            
            self.send_json_response(200, response)
            
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def execute_trade(self):
        """Execute a trade"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            trade_data = json.loads(post_data.decode('utf-8'))
            
            logger.info(f"🎯 Executing trade: {trade_data}")
            
            # Try to execute REAL trade on MT5
            if MT5_AVAILABLE and mt5_connector:
                try:
                    trade_result = mt5_connector.execute_real_trade({
                        'symbol': trade_data.get('symbol'),
                        'type': trade_data.get('action'),
                        'volume': trade_data.get('volume'),
                        'stop_loss': trade_data.get('sl'),
                        'take_profit': trade_data.get('tp')
                    })
                    
                    if trade_result.get('success'):
                        response = {
                            "success": True,
                            "order_id": trade_result.get('order_id', f"MT5-{int(time.time())}"),
                            "deal_id": trade_result.get('deal_id'),
                            "symbol": trade_data.get("symbol"),
                            "action": trade_data.get("action"),
                            "volume": trade_result.get('volume', trade_data.get('volume')),
                            "sl": trade_data.get("sl"),
                            "tp": trade_data.get("tp"),
                            "price": trade_result.get('price', 0),
                            "message": trade_result.get('message', 'Trade executed successfully'),
                            "timestamp": datetime.now().isoformat(),
                            "source": "REAL_MT5"
                        }
                        self.send_json_response(200, response)
                        logger.info("✅ REAL trade executed successfully on MT5")
                        return
                    else:
                        # Trade failed on MT5
                        response = {
                            "success": False,
                            "error": trade_result.get('error', 'Trade execution failed'),
                            "timestamp": datetime.now().isoformat(),
                            "source": "REAL_MT5"
                        }
                        self.send_json_response(500, response)
                        logger.error(f"❌ REAL trade execution failed: {trade_result.get('error')}")
                        return
                except Exception as e:
                    logger.warning(f"Failed to execute real trade on MT5: {e}, using mock execution")
            
            # Fallback to mock trade execution
            response = {
                "success": True,
                "order_id": f"MT5-{int(time.time())}",
                "symbol": trade_data.get("symbol"),
                "action": trade_data.get("action"),
                "volume": trade_data.get("volume"),
                "sl": trade_data.get("sl"),
                "tp": trade_data.get("tp"),
                "price": 1.0850,  # Mock execution price
                "message": "Trade executed successfully (MOCK)",
                "timestamp": datetime.now().isoformat(),
                "source": "MOCK"
            }
            self.send_json_response(200, response)
            logger.info("✅ Mock trade executed successfully")
                
        except Exception as e:
            logger.error(f"Error executing trade: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def send_json_response(self, status_code, data):
        """Send JSON response with CORS headers"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info("%s - %s", self.address_string(), format % args)

class MT5HTTPBridge:
    def __init__(self, host='localhost', port=8080):
        self.host = host
        self.port = port
        self.server = None
        self.thread = None
        
    def start(self):
        """Start the HTTP server"""
        try:
            self.server = HTTPServer((self.host, self.port), MT5HTTPHandler)
            logger.info(f"🚀 MT5 HTTP Bridge started on http://{self.host}:{self.port}")
            logger.info("Endpoints:")
            logger.info("  GET  /health    - Health check")
            logger.info("  GET  /account   - Account information")
            logger.info("  GET  /price/:symbol - Symbol price")
            logger.info("  GET  /positions - Open positions")
            logger.info("  POST /trade     - Execute trade")
            
            self.server.serve_forever()
            
        except Exception as e:
            logger.error(f"Failed to start HTTP server: {e}")
        finally:
            self.stop()
    
    def start_in_thread(self):
        """Start the server in a separate thread"""
        self.thread = threading.Thread(target=self.start)
        self.thread.daemon = True
        self.thread.start()
    
    def stop(self):
        """Stop the HTTP server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            logger.info("🛑 MT5 HTTP Bridge stopped")

if __name__ == "__main__":
    bridge = MT5HTTPBridge()
    try:
        bridge.start()
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    finally:
        bridge.stop()
