#!/usr/bin/env python3
import json
import time
import os
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MT5FileBridge:
    def __init__(self, watch_folder="./mt5-commands", response_folder="./mt5-responses"):
        self.watch_folder = watch_folder
        self.response_folder = response_folder
        self.running = False
        
        # Create folders if they don't exist
        os.makedirs(self.watch_folder, exist_ok=True)
        os.makedirs(self.response_folder, exist_ok=True)
        
        logger.info(f"MT5 File Bridge started")
        logger.info(f"Watching folder: {os.path.abspath(self.watch_folder)}")
        logger.info(f"Response folder: {os.path.abspath(self.response_folder)}")
    
    def start(self):
        """Start watching for commands"""
        self.running = True
        logger.info("🚀 MT5 File Bridge is running...")
        
        try:
            while self.running:
                self.check_for_commands()
                time.sleep(1)  # Check every second
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        except Exception as e:
            logger.error(f"Error: {e}")
        finally:
            self.stop()
    
    def check_for_commands(self):
        """Check for new command files"""
        try:
            for filename in os.listdir(self.watch_folder):
                if filename.startswith("command_") and filename.endswith(".json"):
                    filepath = os.path.join(self.watch_folder, filename)
                    self.process_command(filepath, filename)
        except Exception as e:
            logger.error(f"Error checking commands: {e}")
    
    def process_command(self, filepath, filename):
        """Process a command file"""
        try:
            # Read the command
            with open(filepath, 'r') as f:
                command_data = json.load(f)
            
            logger.info(f"📨 Processing command: {command_data.get('command', 'unknown')}")
            
            # Process different command types
            response = self.handle_command(command_data)
            
            # Write response
            response_id = filename.replace("command_", "response_")
            response_path = os.path.join(self.response_folder, response_id)
            
            with open(response_path, 'w') as f:
                json.dump(response, f, indent=2)
            
            # Remove the command file
            os.remove(filepath)
            
            logger.info(f"📤 Response sent: {response_id}")
            
        except Exception as e:
            logger.error(f"Error processing command {filename}: {e}")
            # Write error response
            self.write_error_response(filename, str(e))
    
    def handle_command(self, command_data):
        """Handle different command types"""
        command = command_data.get("command")
        
        if command == "get_account_info":
            return self.get_account_info()
        elif command == "get_symbol_price":
            symbol = command_data.get("symbol", "EURUSD")
            return self.get_symbol_price(symbol)
        elif command == "execute_trade":
            return self.execute_trade(command_data)
        elif command == "get_positions":
            return self.get_positions()
        else:
            return {"success": False, "error": f"Unknown command: {command}"}
    
    def get_account_info(self):
        """Get account information"""
        # This would connect to MT5 via DDE or other method
        # For now, return mock data
        return {
            "success": True,
            "balance": 100000.00,
            "equity": 100000.00,
            "margin": 0.00,
            "free_margin": 100000.00,
            "currency": "USD",
            "leverage": 100,
            "server": "ICMarketsMT5-Demo",
            "login": 12345678,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_symbol_price(self, symbol):
        """Get symbol price"""
        # Mock data - in real implementation, get from MT5
        mock_prices = {
            "EURUSD": {"bid": 1.0850, "ask": 1.0852, "spread": 0.0002},
            "GBPUSD": {"bid": 1.2650, "ask": 1.2652, "spread": 0.0002},
            "USDJPY": {"bid": 148.50, "ask": 148.52, "spread": 0.02},
            "USDCHF": {"bid": 0.8680, "ask": 0.8682, "spread": 0.0002},
            "AUDUSD": {"bid": 0.6520, "ask": 0.6522, "spread": 0.0002}
        }
        
        price_data = mock_prices.get(symbol, {"bid": 1.0, "ask": 1.0, "spread": 0.0})
        
        return {
            "success": True,
            "symbol": symbol,
            "bid": price_data["bid"],
            "ask": price_data["ask"],
            "spread": price_data["spread"],
            "timestamp": datetime.now().isoformat()
        }
    
    def execute_trade(self, trade_data):
        """Execute a trade"""
        logger.info(f"🎯 Executing trade: {trade_data}")
        
        # In real implementation, this would send to MT5
        # For now, simulate execution
        success = True
        
        if success:
            return {
                "success": True,
                "order_id": f"MT5-{int(time.time())}",
                "symbol": trade_data.get("symbol"),
                "action": trade_data.get("action"),
                "volume": trade_data.get("volume"),
                "sl": trade_data.get("sl"),
                "tp": trade_data.get("tp"),
                "price": 1.0850,  # Mock execution price
                "message": "Trade executed successfully",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Trade execution failed",
                "timestamp": datetime.now().isoformat()
            }
    
    def get_positions(self):
        """Get open positions"""
        return {
            "success": True,
            "positions": [],
            "timestamp": datetime.now().isoformat()
        }
    
    def write_error_response(self, filename, error_message):
        """Write error response"""
        try:
            response_id = filename.replace("command_", "response_")
            response_path = os.path.join(self.response_folder, response_id)
            
            with open(response_path, 'w') as f:
                json.dump({
                    "success": False,
                    "error": error_message,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write error response: {e}")
    
    def stop(self):
        """Stop the bridge"""
        self.running = False
        logger.info("🛑 MT5 File Bridge stopped")

if __name__ == "__main__":
    bridge = MT5FileBridge()
    try:
        bridge.start()
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    finally:
        bridge.stop()

