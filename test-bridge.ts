// Test script for HTTP Bridge Connector
// Run with: npx ts-node test-bridge.ts
// Note: This requires the HTTP bridge server to be running on port 8080

import { httpBridge } from './lib/http-bridge-connector';

async function testBridge() {
  console.log('🧪 Testing HTTP Bridge Connection...');
  console.log('');
  
  // Test connection
  console.log('1. Testing Connection...');
  const connected = await httpBridge.connect();
  console.log('   Connection:', connected ? '✅ Connected' : '❌ Failed');
  console.log('');
  
  if (connected) {
    // Test account info
    console.log('2. Testing Account Info...');
    const accountInfo = await httpBridge.getAccountInfo();
    console.log('   Account Info:', accountInfo.success ? '✅ Success' : '❌ Failed');
    if (accountInfo.success) {
      console.log('   Balance:', accountInfo.balance);
      console.log('   Equity:', accountInfo.equity);
      console.log('   Free Margin:', accountInfo.free_margin || accountInfo.freeMargin);
    } else {
      console.log('   Error:', accountInfo.error);
    }
    console.log('');
    
    // Test market data
    console.log('3. Testing Market Data (EURUSD)...');
    const marketData = await httpBridge.getMarketData('EURUSD');
    console.log('   Market Data:', marketData.success ? '✅ Success' : '❌ Failed');
    if (marketData.success) {
      console.log('   EUR/USD Bid:', marketData.bid, 'Ask:', marketData.ask);
      console.log('   Spread:', marketData.spread);
    } else {
      console.log('   Error:', marketData.error);
    }
    console.log('');
    
    // Test trade execution
    console.log('4. Testing Trade Execution...');
    const tradeResult = await httpBridge.executeTrade({
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 0.01,
      stopLoss: 1.0800,
      takeProfit: 1.0900
    });
    console.log('   Trade Execution:', tradeResult.success ? '✅ Success' : '❌ Failed');
    if (tradeResult.success) {
      console.log('   Order ID:', tradeResult.order_id);
      console.log('   Message:', tradeResult.message);
    } else {
      console.log('   Error:', tradeResult.error);
    }
    console.log('');
    
    // Test positions
    console.log('5. Testing Positions...');
    const positions = await httpBridge.getPositions();
    console.log('   Positions:', positions.success ? '✅ Success' : '❌ Failed');
    if (positions.success) {
      console.log('   Open Positions:', positions.positions?.length || 0);
    } else {
      console.log('   Error:', positions.error);
    }
    console.log('');
    
    console.log('✅ All tests completed!');
  } else {
    console.log('❌ Connection failed. Make sure the HTTP bridge server is running on port 8080');
    console.log('   Start it with: python3 http-bridge.py');
  }
}

testBridge().catch(console.error);

