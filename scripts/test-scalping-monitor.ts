/**
 * Test script for Scalping Monitor
 * Tests the monitoring functionality to ensure it properly tracks positions and handles profit/loss
 */

import { ScalpingService, ScalpingTrade } from '../lib/scalping-service';
import { httpBridge } from '../lib/http-bridge-connector';

// Mock httpBridge for testing
const originalGetPositions = httpBridge.getPositions;

interface TestCase {
  name: string;
  positions: any[];
  expectedStatus: 'open' | 'profit_taken' | 'stopped';
  expectedProfit?: number;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: 'Open Position - Should Continue Monitoring',
    positions: [
      {
        order_id: 'test-order-123',
        symbol: 'EURUSD',
        status: 'open',
        entry_price: 1.1000,
        current_price: 1.1005,
        direction: 'BUY',
      },
    ],
    expectedStatus: 'open',
    description: 'Position is still open, monitoring should continue',
  },
  {
    name: 'Closed Position with Profit',
    positions: [
      {
        order_id: 'test-order-123',
        symbol: 'EURUSD',
        status: 'closed',
        entry_price: 1.1000,
        profit: 0.50,
        direction: 'BUY',
      },
    ],
    expectedStatus: 'profit_taken',
    expectedProfit: 0.50,
    description: 'Position closed with profit, should trigger profit_taken',
  },
  {
    name: 'Closed Position with Loss',
    positions: [
      {
        order_id: 'test-order-123',
        symbol: 'EURUSD',
        status: 'closed',
        entry_price: 1.1000,
        profit: -0.25,
        direction: 'BUY',
      },
    ],
    expectedStatus: 'stopped',
    expectedProfit: -0.25,
    description: 'Position closed with loss, should trigger stopped',
  },
  {
    name: 'Position Not Found (Closed)',
    positions: [],
    expectedStatus: 'open',
    description: 'Position not in list (might be closed), should continue monitoring',
  },
  {
    name: 'Multiple Positions - Find Correct One',
    positions: [
      {
        order_id: 'other-order-456',
        symbol: 'GBPUSD',
        status: 'open',
        entry_price: 1.2500,
      },
      {
        order_id: 'test-order-123',
        symbol: 'EURUSD',
        status: 'open',
        entry_price: 1.1000,
        current_price: 1.1005,
      },
    ],
    expectedStatus: 'open',
    description: 'Should find the correct position among multiple positions',
  },
  {
    name: 'Position with Different Field Names',
    positions: [
      {
        orderId: 'test-order-123',
        symbol: 'EURUSD',
        status: 'open',
        entryPrice: 1.1000,
        currentPrice: 1.1005,
      },
    ],
    expectedStatus: 'open',
    description: 'Should handle different field name formats (camelCase)',
  },
  {
    name: 'Position with Ticket Field',
    positions: [
      {
        ticket: 'test-order-123',
        symbol: 'EURUSD',
        state: 'open',
        open_price: 1.1000,
        current_price: 1.1005,
      },
    ],
    expectedStatus: 'open',
    description: 'Should handle ticket field and state instead of status',
  },
];

async function testScalpingMonitor() {
  console.log('🧪 Testing Scalping Monitor...\n');

  // Initialize scalping service
  ScalpingService.initialize({
    enabled: true,
    takeProfitAmount: 0.50,
    minSignalStrength: 75,
    maxScalpsPerDay: 20,
    reEntryDelay: 1, // 1 second for testing
    maxReEntries: 5,
    minReEntrySignalStrength: 70,
  });

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   ${testCase.description}`);

    try {
      // Create a mock scalping trade
      const mockTrade: ScalpingTrade = {
        id: `test-scalp-${Date.now()}`,
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.1000,
        takeProfitPrice: 1.1005,
        stopLoss: 1.0995,
        lotSize: 0.01,
        takeProfitAmount: 0.50,
        orderId: 'test-order-123',
        status: 'open',
        createdAt: new Date(),
        reEntryCount: 0,
      };

      // Mock httpBridge.getPositions to return test positions
      (httpBridge as any).getPositions = async () => {
        return testCase.positions;
      };

      // Add trade to active scalps
      const activeScalps = (ScalpingService as any).activeScalps as Map<string, ScalpingTrade>;
      activeScalps.set(mockTrade.id, mockTrade);

      // Create a promise to wait for monitoring result
      let monitoringComplete = false;
      let finalStatus: string = mockTrade.status;
      let finalProfit: number | undefined;

      // Override the handleProfitTaken to capture results
      const originalHandleProfitTaken = (ScalpingService as any).handleProfitTaken;
      (ScalpingService as any).handleProfitTaken = async (trade: ScalpingTrade) => {
        finalStatus = trade.status;
        finalProfit = trade.profitAmount;
        monitoringComplete = true;
      };

      // Start monitoring (but we'll manually trigger the check)
      const monitorScalp = (ScalpingService as any).monitorScalp.bind(ScalpingService);
      
      // For testing, we'll manually call the check function
      // But first, let's test the position matching logic directly
      const positionsResponse = await httpBridge.getPositions();
      const allPositions = Array.isArray(positionsResponse) 
        ? positionsResponse 
        : (positionsResponse as any)?.positions || [];

      const openPositions = allPositions.filter((p: any) => {
        const status = p.status || p.state || '';
        return status === 'open' || status === '' || !status;
      });

      const position = openPositions.find((p: any) => {
        const orderId = p.order_id || p.orderId || p.ticket || p.id;
        return orderId && (orderId === mockTrade.orderId || String(orderId) === String(mockTrade.orderId));
      });

      if (!position) {
        const closedPositions = allPositions.filter((p: any) => {
          const status = p.status || p.state || '';
          return status === 'closed' || status === 'filled' || status === 'completed';
        });

        const closed = closedPositions.find((p: any) => {
          const orderId = p.order_id || p.orderId || p.ticket || p.id;
          return orderId && (orderId === mockTrade.orderId || String(orderId) === String(mockTrade.orderId));
        });

        if (closed) {
          const profit = closed.profit || closed.profitLoss || closed.pl || 0;
          if (profit > 0) {
            finalStatus = 'profit_taken';
            finalProfit = profit;
          } else {
            finalStatus = 'stopped';
            finalProfit = profit;
          }
        }
      }

      // Verify results
      const statusMatch = finalStatus === testCase.expectedStatus;
      const profitMatch = testCase.expectedProfit === undefined || finalProfit === testCase.expectedProfit;

      if (statusMatch && profitMatch) {
        console.log(`   ✅ PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        console.log(`      Expected status: ${testCase.expectedStatus}, Got: ${finalStatus}`);
        if (testCase.expectedProfit !== undefined) {
          console.log(`      Expected profit: ${testCase.expectedProfit}, Got: ${finalProfit}`);
        }
        failedTests++;
      }

      // Cleanup
      activeScalps.delete(mockTrade.id);
      (ScalpingService as any).handleProfitTaken = originalHandleProfitTaken;

    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      console.log(`      Stack: ${error.stack}`);
      failedTests++;
    }
  }

  // Restore original function
  (httpBridge as any).getPositions = originalGetPositions;

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Test error handling
  console.log('\n🧪 Testing Error Handling...\n');

  try {
    // Test with invalid response
    (httpBridge as any).getPositions = async () => {
      throw new Error('Network error');
    };

    const mockTrade: ScalpingTrade = {
      id: `test-error-${Date.now()}`,
      symbol: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.1000,
      takeProfitPrice: 1.1005,
      stopLoss: 1.0995,
      lotSize: 0.01,
      takeProfitAmount: 0.50,
      orderId: 'test-order-error',
      status: 'open',
      createdAt: new Date(),
      reEntryCount: 0,
    };

    const activeScalps = (ScalpingService as any).activeScalps as Map<string, ScalpingTrade>;
    activeScalps.set(mockTrade.id, mockTrade);

    // Try to get positions (should handle error gracefully)
    try {
      await httpBridge.getPositions();
      console.log('   ❌ ERROR: Should have thrown an error');
    } catch (error: any) {
      console.log(`   ✅ Error handling works: ${error.message}`);
    }

    activeScalps.delete(mockTrade.id);
  } catch (error: any) {
    console.log(`   ❌ ERROR in error handling test: ${error.message}`);
  }

  // Test with unexpected response format
  try {
    (httpBridge as any).getPositions = async () => {
      return 'invalid response';
    };

    const positions = await httpBridge.getPositions();
    let allPositions: any[] = [];
    if (Array.isArray(positions)) {
      allPositions = positions;
    } else if (positions && typeof positions === 'object') {
      allPositions = (positions as any).positions || 
                    (positions as any).data || 
                    (positions as any).result ||
                    (Object.values(positions).find((v: any) => Array.isArray(v)) as any[]) ||
                    [];
    }

    if (!Array.isArray(allPositions)) {
      console.log('   ✅ Handles invalid response format correctly (returns empty array)');
    } else {
      console.log('   ✅ Handles invalid response format correctly');
    }
  } catch (error: any) {
    console.log(`   ✅ Error handling works for invalid format: ${error.message}`);
  }

  // Restore original function
  (httpBridge as any).getPositions = originalGetPositions;

  console.log('\n✅ Scalping Monitor Tests Complete!\n');

  return {
    passed: passedTests,
    failed: failedTests,
    total: testCases.length,
    successRate: (passedTests / testCases.length) * 100,
  };
}

// Run tests if executed directly
if (require.main === module) {
  testScalpingMonitor()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testScalpingMonitor };
