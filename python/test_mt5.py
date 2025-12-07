"""
Test script for RealMT5Connector
Run this to test the MT5 connection
"""

import os
import sys
from mt5_integration import RealMT5Connector

# Get credentials from environment or use defaults
account_id = os.getenv('IC_MARKETS_ACCOUNT_ID', 'y52556154')
password = os.getenv('IC_MARKETS_PASSWORD', '0@ComXX0wUDUyB')
server = os.getenv('IC_MARKETS_SERVER', 'ICMarketsSC-Demo')

def main():
    print("🧪 Testing RealMT5Connector...")
    print(f"Account ID: {account_id}")
    print(f"Server: {server}")
    print("-" * 50)
    
    # Create connector instance
    connector = RealMT5Connector()
    
    # Test connection
    print("\n1. Testing Connection...")
    if connector.connect_to_mt5(account_id, password, server):
        print("✅ Connection successful!")
        
        # Test account info
        print("\n2. Getting Account Info...")
        account_info = connector.get_real_account_info()
        if account_info:
            print(f"✅ Account Info Retrieved:")
            print(f"   Balance: {account_info['balance']} {account_info['currency']}")
            print(f"   Equity: {account_info['equity']} {account_info['currency']}")
            print(f"   Free Margin: {account_info['free_margin']} {account_info['currency']}")
            print(f"   Leverage: 1:{account_info['leverage']}")
        else:
            print("❌ Failed to get account info")
        
        # Test market data
        print("\n3. Getting Market Data (EURUSD)...")
        market_data = connector.get_real_market_data('EURUSD')
        if market_data:
            print(f"✅ Market Data Retrieved:")
            print(f"   Symbol: {market_data['symbol']}")
            print(f"   Bid: {market_data['bid']}")
            print(f"   Ask: {market_data['ask']}")
            print(f"   Spread: {market_data['spread']}")
        else:
            print("❌ Failed to get market data")
        
        # Test open positions
        print("\n4. Getting Open Positions...")
        positions = connector.get_open_positions()
        print(f"✅ Found {len(positions)} open positions")
        for pos in positions:
            print(f"   {pos['symbol']} {pos['type']} - Volume: {pos['volume']}, Profit: {pos['profit']}")
        
        # Disconnect
        print("\n5. Disconnecting...")
        connector.disconnect()
        print("✅ Disconnected successfully")
        
    else:
        print("❌ Connection failed!")
        print("\nTroubleshooting:")
        print("1. Make sure MetaTrader 5 terminal is running")
        print("2. Check your account credentials")
        print("3. Verify the server name is correct")
        print("4. Ensure MT5 terminal is logged in")
        return False
    
    print("\n" + "=" * 50)
    print("✅ All tests completed!")
    return True

if __name__ == "__main__":
    try:
        main()
    except ImportError as e:
        print("❌ Error: MetaTrader5 library not installed")
        print("   Install with: pip install MetaTrader5")
        print("   Note: Requires Windows or Wine on Linux/Mac")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

