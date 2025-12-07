#!/usr/bin/env python3
import zmq
import json
import time
from datetime import datetime

class MT5BridgeServer:
    def __init__(self, host="*", port=5555):
        self.host = host
        self.port = port
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REP)
        self.running = False
        
    def start(self):
        """Start the ZeroMQ server"""
        try:
            address = f"tcp://{self.host}:{self.port}"
            self.socket.bind(address)
            self.running = True
            print(f"🚀 ZeroMQ MT5 Bridge Server started on {address}")
            print("Waiting for MT5 Expert Advisor to connect...")
            
            while self.running:
                try:
                    # Wait for message from MT5
                    message = self.socket.recv_string()
                    print(f"📨 Received: {message}")
                    
                    # Process the message
                    response = self.process_message(message)
                    
                    # Send response back to MT5
                    self.socket.send_string(response)
                    print(f"📤 Sent: {response}")
                    
                except Exception as e:
                    print(f"Error processing message: {e}")
                    self.socket.send_string('{"error": "Processing failed"}')
                    
        except Exception as e:
            print(f"Server error: {e}")
        finally:
            self.stop()
    
    def process_message(self, message):
        """Process incoming messages from MT5"""
        try:
            data = json.loads(message)
            command = data.get("command")
            
            if command == "get_account_info":
                return self.get_account_info()
            elif command == "get_symbol_price":
                symbol = data.get("symbol", "EURUSD")
                return self.get_symbol_price(symbol)
            elif command == "execute_trade":
                return self.execute_trade(data)
            elif command == "get_positions":
                return self.get_positions()
            else:
                return json.dumps({"error": f"Unknown command: {command}"})
                
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid JSON"})
    
    def get_account_info(self):
        """Get account information (would connect to MT5 via EA)"""
        # This would be populated by the MT5 EA
        return json.dumps({
            "success": True,
            "balance": 100000.00,
            "equity": 100000.00,
            "margin": 0.00,
            "free_margin": 100000.00,
            "currency": "USD",
            "leverage": 100,
            "server": "ICMarketsMT5-Demo",
            "login": 12345678
        })
    
    def get_symbol_price(self, symbol):
        """Get symbol price (would come from MT5 EA)"""
        # Mock data - would be real from MT5
        mock_prices = {
            "EURUSD": {"bid": 1.0850, "ask": 1.0852, "spread": 0.0002},
            "GBPUSD": {"bid": 1.2650, "ask": 1.2652, "spread": 0.0002},
            "USDJPY": {"bid": 148.50, "ask": 148.52, "spread": 0.02},
        }
        
        price_data = mock_prices.get(symbol, {"bid": 1.0, "ask": 1.0, "spread": 0.0})
        return json.dumps({
            "success": True,
            "symbol": symbol,
            "bid": price_data["bid"],
            "ask": price_data["ask"],
            "spread": price_data["spread"],
            "timestamp": datetime.now().isoformat()
        })
    
    def execute_trade(self, trade_data):
        """Execute trade (would be sent to MT5 EA)"""
        print(f"🎯 Executing trade: {trade_data}")
        
        # Simulate trade execution
        success = True  # In real implementation, this would come from MT5
        
        if success:
            return json.dumps({
                "success": True,
                "order_id": f"MT5-{int(time.time())}",
                "volume": trade_data.get("volume", 0.01),
                "price": 1.0850,
                "message": "Trade executed via MT5",
                "timestamp": datetime.now().isoformat()
            })
        else:
            return json.dumps({
                "success": False,
                "error": "Trade execution failed in MT5"
            })
    
    def get_positions(self):
        """Get open positions (would come from MT5 EA)"""
        return json.dumps({
            "success": True,
            "positions": [
                # This would be populated by MT5 EA
            ]
        })
    
    def stop(self):
        """Stop the server"""
        self.running = False
        self.socket.close()
        self.context.term()
        print("🛑 ZeroMQ server stopped")

if __name__ == "__main__":
    server = MT5BridgeServer()
    try:
        server.start()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.stop()

