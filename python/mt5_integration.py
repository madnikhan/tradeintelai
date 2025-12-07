import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime
import os

class RealMT5Connector:
    def __init__(self):
        self.connected = False
        
    def connect_to_mt5(self, account_id, password, server):
        """
        Connect to REAL MetaTrader 5 terminal
        """
        try:
            # Initialize MT5 connection
            if not mt5.initialize():
                print("MT5 initialization failed")
                return False
                
            # Login to the account
            authorized = mt5.login(
                login=int(account_id),
                password=password,
                server=server
            )
            
            if authorized:
                print(f"✅ Connected to REAL MT5 account: {account_id}")
                self.connected = True
                
                # Get account info
                account_info = mt5.account_info()
                print(f"Account Balance: {account_info.balance}")
                print(f"Account Equity: {account_info.equity}")
                
                return True
            else:
                print(f"❌ MT5 login failed: {mt5.last_error()}")
                return False
                
        except Exception as e:
            print(f"MT5 connection error: {e}")
            return False
    
    def get_real_account_info(self):
        """
        Get REAL account information from MT5
        """
        if not self.connected:
            return None
            
        try:
            account_info = mt5.account_info()
            return {
                'balance': account_info.balance,
                'equity': account_info.equity,
                'margin': account_info.margin,
                'free_margin': account_info.margin_free,
                'leverage': account_info.leverage,
                'currency': account_info.currency
            }
        except Exception as e:
            print(f"Error getting account info: {e}")
            return None
    
    def get_real_market_data(self, symbol):
        """
        Get REAL market data from MT5
        """
        if not self.connected:
            return None
            
        try:
            # Get current tick data
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                print(f"Symbol {symbol} not found")
                return None
                
            return {
                'symbol': symbol,
                'bid': tick.bid,
                'ask': tick.ask,
                'last': tick.last,
                'volume': tick.volume,
                'time': tick.time,
                'spread': tick.ask - tick.bid
            }
        except Exception as e:
            print(f"Error getting market data: {e}")
            return None
    
    def execute_real_trade(self, trade_data):
        """
        Execute REAL trade on MT5
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected to MT5'}
            
        try:
            symbol = trade_data['symbol']
            order_type = trade_data['type']
            volume = trade_data['volume']
            stop_loss = trade_data.get('stop_loss', 0.0)
            take_profit = trade_data.get('take_profit', 0.0)
            
            # Map order types to MT5 constants
            if order_type == 'BUY':
                action = mt5.TRADE_ACTION_DEAL
                type_val = mt5.ORDER_TYPE_BUY
                price = mt5.symbol_info_tick(symbol).ask
            elif order_type == 'SELL':
                action = mt5.TRADE_ACTION_DEAL
                type_val = mt5.ORDER_TYPE_SELL
                price = mt5.symbol_info_tick(symbol).bid
            else:
                return {'success': False, 'error': 'Invalid order type'}
            
            # Prepare the request
            request = {
                "action": action,
                "symbol": symbol,
                "volume": volume,
                "type": type_val,
                "price": price,
                "sl": stop_loss,
                "tp": take_profit,
                "deviation": 10,
                "magic": 12345,
                "comment": "From AI Trading System",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            # Send the trade request
            result = mt5.order_send(request)
            
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                return {
                    'success': True,
                    'order_id': result.order,
                    'deal_id': result.deal,
                    'volume': result.volume,
                    'price': result.price,
                    'message': 'Trade executed successfully'
                }
            else:
                return {
                    'success': False,
                    'error': f"Trade failed: {result.retcode} - {self.get_error_description(result.retcode)}"
                }
                
        except Exception as e:
            print(f"Trade execution error: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_error_description(self, error_code):
        """
        Get human-readable error description
        """
        error_descriptions = {
            10004: "Requote",
            10006: "Request rejected",
            10007: "Request canceled by trader",
            10008: "Order placed",
            10009: "Request completed",
            10010: "Only part of the request was completed",
            10011: "Request processing error",
            10012: "Request canceled by timeout",
            10013: "Invalid request",
            10014: "Invalid volume in the request",
            10015: "Invalid price in the request",
            10016: "Invalid stops in the request",
            10017: "Trade is disabled",
            10018: "Market is closed",
            10019: "There is not enough money to complete the request",
            10020: "Prices changed",
            10021: "There are no quotes to process the request",
            10022: "Invalid order expiration date in the request",
            10023: "Order state changed",
            10024: "Too frequent requests",
            10025: "No changes in request",
            10026: "Autotrading disabled by server",
            10027: "Autotrading disabled by client terminal",
            10028: "Request locked for processing",
            10029: "Order or position frozen"
        }
        return error_descriptions.get(error_code, f"Unknown error: {error_code}")
    
    def get_open_positions(self):
        """
        Get REAL open positions from MT5
        """
        if not self.connected:
            return []
            
        try:
            positions = mt5.positions_get()
            if positions is None:
                return []
                
            return [
                {
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'open_price': pos.price_open,
                    'current_price': pos.price_current,
                    'sl': pos.sl,
                    'tp': pos.tp,
                    'profit': pos.profit,
                    'swap': pos.swap
                }
                for pos in positions
            ]
        except Exception as e:
            print(f"Error getting positions: {e}")
            return []
    
    def disconnect(self):
        """
        Disconnect from MT5
        """
        if self.connected:
            mt5.shutdown()
            self.connected = False
            print("Disconnected from MT5")

# Global instance
real_mt5 = RealMT5Connector()
