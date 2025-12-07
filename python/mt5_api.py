"""
Python API wrapper for MT5 connector
This script can be called from Next.js API routes via subprocess
Returns JSON output for easy parsing
"""

import json
import sys
import os

try:
    from mt5_integration import RealMT5Connector
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print(json.dumps({
        'success': False,
        'error': 'MetaTrader5 library not available',
        'message': 'Install with: pip install MetaTrader5 (requires Windows)'
    }))
    sys.exit(1)


def connect_mt5(account_id, password, server):
    """Connect to MT5 and return JSON result"""
    connector = RealMT5Connector()
    
    if connector.connect_to_mt5(account_id, password, server):
        account_info = connector.get_real_account_info()
        return {
            'success': True,
            'connected': True,
            'message': f'Connected to MT5 account {account_id}',
            'accountInfo': account_info
        }
    else:
        return {
            'success': False,
            'connected': False,
            'error': 'Failed to connect to MT5',
            'message': 'Check credentials and ensure MT5 terminal is running'
        }


def get_market_data(symbol):
    """Get market data and return JSON result"""
    connector = RealMT5Connector()
    
    # Get credentials from environment
    account_id = os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154')
    password = os.getenv('IC_MARKETS_PASSWORD', '0@ComXX0wUDUyB')
    server = os.getenv('IC_MARKETS_SERVER', 'ICMarketsSC-Demo')
    
    if not connector.connect_to_mt5(account_id, password, server):
        return {
            'success': False,
            'error': 'Not connected to MT5'
        }
    
    market_data = connector.get_real_market_data(symbol)
    
    if market_data:
        return {
            'success': True,
            **market_data
        }
    else:
        return {
            'success': False,
            'error': f'Failed to get market data for {symbol}'
        }


def execute_trade(trade_data):
    """Execute trade and return JSON result"""
    connector = RealMT5Connector()
    
    # Get credentials from environment
    account_id = os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154')
    password = os.getenv('IC_MARKETS_PASSWORD', '0@ComXX0wUDUyB')
    server = os.getenv('IC_MARKETS_SERVER', 'ICMarketsSC-Demo')
    
    if not connector.connect_to_mt5(account_id, password, server):
        return {
            'success': False,
            'error': 'Not connected to MT5'
        }
    
    result = connector.execute_real_trade(trade_data)
    return result


def get_positions():
    """Get open positions and return JSON result"""
    connector = RealMT5Connector()
    
    # Get credentials from environment
    account_id = os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154')
    password = os.getenv('IC_MARKETS_PASSWORD', '0@ComXX0wUDUyB')
    server = os.getenv('IC_MARKETS_SERVER', 'ICMarketsSC-Demo')
    
    if not connector.connect_to_mt5(account_id, password, server):
        return {
            'success': False,
            'error': 'Not connected to MT5',
            'positions': []
        }
    
    positions = connector.get_open_positions()
    return {
        'success': True,
        'positions': positions,
        'count': len(positions)
    }


def main():
    """Main entry point - parse command line arguments"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Missing command argument'
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'connect':
            if len(sys.argv) < 5:
                print(json.dumps({
                    'success': False,
                    'error': 'Missing arguments: connect <account_id> <password> <server>'
                }))
                sys.exit(1)
            
            account_id = sys.argv[2]
            password = sys.argv[3]
            server = sys.argv[4]
            
            result = connect_mt5(account_id, password, server)
            print(json.dumps(result))
            
        elif command == 'market-data':
            if len(sys.argv) < 3:
                print(json.dumps({
                    'success': False,
                    'error': 'Missing argument: market-data <symbol>'
                }))
                sys.exit(1)
            
            symbol = sys.argv[2]
            result = get_market_data(symbol)
            print(json.dumps(result))
            
        elif command == 'trade':
            if len(sys.argv) < 3:
                print(json.dumps({
                    'success': False,
                    'error': 'Missing argument: trade <json_trade_data>'
                }))
                sys.exit(1)
            
            trade_data = json.loads(sys.argv[2])
            result = execute_trade(trade_data)
            print(json.dumps(result))
            
        elif command == 'positions':
            result = get_positions()
            print(json.dumps(result))
            
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown command: {command}',
                'available_commands': ['connect', 'market-data', 'trade', 'positions']
            }))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()

