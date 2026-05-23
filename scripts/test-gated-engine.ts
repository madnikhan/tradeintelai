/**
 * Test Script for Gated Trading Engine
 * 
 * Tests the gated engine with real market data and compares results
 */

import { GatedTradingEngine } from '../lib/gated-trading-engine';
import { GatedEngineAdapter } from '../lib/gated-engine-adapter';
import { AITradingEngine } from '../lib/ai-trading-engine';

async function testGatedEngine() {
  console.log('🧪 Testing Gated Trading Engine\n');
  
  const symbols = ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD'];
  const gatedEngine = new GatedTradingEngine();
  const gatedAdapter = new GatedEngineAdapter();
  const oldEngine = new AITradingEngine();
  
  const results: {
    symbol: string;
    old: any;
    gated: any;
    differences: string[];
  }[] = [];
  
  for (const symbol of symbols) {
    console.log(`\n📊 Testing ${symbol}...`);
    
    try {
      // Test old engine
      console.log('  🔄 Running old engine...');
      const oldAnalysis = await oldEngine.analyzeMarket(symbol, []);
      
      // Test gated engine (via adapter)
      console.log('  🔄 Running gated engine...');
      const gatedAnalysis = await gatedAdapter.analyzeMarket(symbol, []);
      
      // Test raw gated analysis
      console.log('  🔄 Running raw gated analysis...');
      const rawGatedAnalysis = await gatedEngine.analyzeMarket(symbol, []);
      
      // Compare results
      const differences: string[] = [];
      
      if (oldAnalysis.recommendation !== gatedAnalysis.recommendation) {
        differences.push(`Recommendation: ${oldAnalysis.recommendation} → ${gatedAnalysis.recommendation}`);
      }
      
      if (Math.abs(oldAnalysis.confidence - gatedAnalysis.confidence) > 10) {
        differences.push(`Confidence: ${oldAnalysis.confidence}% → ${gatedAnalysis.confidence}%`);
      }
      
      if (oldAnalysis.recommendation === 'HOLD' && gatedAnalysis.recommendation !== 'HOLD') {
        differences.push(`⚠️ Old engine: HOLD, Gated engine: ${gatedAnalysis.recommendation}`);
      } else if (oldAnalysis.recommendation !== 'HOLD' && gatedAnalysis.recommendation === 'HOLD') {
        differences.push(`✅ Old engine: ${oldAnalysis.recommendation}, Gated engine: HOLD (blocked)`);
      }
      
      // Gate status
      if (gatedAnalysis.gateStatus) {
        console.log('  📋 Gate Status:');
        console.log(`    Gate 1 (Market Readable): ${gatedAnalysis.gateStatus.marketReadable ? '✅' : '❌'}`);
        console.log(`    Gate 2 (Directional Bias): ${gatedAnalysis.gateStatus.directionalBias} (${gatedAnalysis.gateStatus.biasStrength}%)`);
        if (gatedAnalysis.gateStatus.gptStructure) {
          console.log(`    Gate 3 (GPT Structure): ${gatedAnalysis.gateStatus.gptStructure.marketStructure} (${gatedAnalysis.gateStatus.gptStructure.alignment})`);
        }
        console.log(`    Gate 4 (Execution Permitted): ${gatedAnalysis.gateStatus.executionPermitted ? '✅' : '❌'}`);
        
        if (gatedAnalysis.gateStatus.expectancyData) {
          console.log(`    Expectancy: ${gatedAnalysis.gateStatus.expectancyData.estimatedExpectancy} pips/trade`);
        }
      }
      
      results.push({
        symbol,
        old: {
          recommendation: oldAnalysis.recommendation,
          confidence: oldAnalysis.confidence,
          overallScore: oldAnalysis.overallScore,
        },
        gated: {
          recommendation: gatedAnalysis.recommendation,
          confidence: gatedAnalysis.confidence,
          overallScore: gatedAnalysis.overallScore,
          gateStatus: gatedAnalysis.gateStatus,
        },
        differences,
      });
      
      console.log(`  ✅ ${symbol} analysis complete`);
    } catch (error) {
      console.error(`  ❌ Error testing ${symbol}:`, error);
    }
  }
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY\n');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    console.log(`\n${result.symbol}:`);
    console.log(`  Old Engine: ${result.old.recommendation} (${result.old.confidence}% confidence, score: ${result.old.overallScore})`);
    console.log(`  Gated Engine: ${result.gated.recommendation} (${result.gated.confidence}% confidence, score: ${result.gated.overallScore})`);
    
    if (result.differences.length > 0) {
      console.log(`  Differences:`);
      result.differences.forEach(diff => console.log(`    • ${diff}`));
    }
    
    if (result.gated.gateStatus) {
      console.log(`  Gate Status:`);
      console.log(`    Market Readable: ${result.gated.gateStatus.marketReadable ? '✅' : '❌'}`);
      console.log(`    Directional Bias: ${result.gated.gateStatus.directionalBias} (${result.gated.gateStatus.biasStrength}%)`);
      console.log(`    Execution Permitted: ${result.gated.gateStatus.executionPermitted ? '✅' : '❌'}`);
    }
  });
  
  // Statistics
  const oldHoldCount = results.filter(r => r.old.recommendation === 'HOLD').length;
  const gatedHoldCount = results.filter(r => r.gated.recommendation === 'HOLD').length;
  
  console.log('\n\n📈 STATISTICS\n');
  console.log('='.repeat(80));
  console.log(`HOLD Frequency:`);
  console.log(`  Old Engine: ${oldHoldCount}/${results.length} (${Math.round(oldHoldCount / results.length * 100)}%)`);
  console.log(`  Gated Engine: ${gatedHoldCount}/${results.length} (${Math.round(gatedHoldCount / results.length * 100)}%)`);
  console.log(`  Change: ${gatedHoldCount > oldHoldCount ? '+' : ''}${gatedHoldCount - oldHoldCount} (${gatedHoldCount > oldHoldCount ? 'more' : 'fewer'} HOLDs)`);
  
  const blockedCount = results.filter(r => 
    r.gated.gateStatus && !r.gated.gateStatus.executionPermitted && r.old.recommendation !== 'HOLD'
  ).length;
  
  console.log(`\nBlocked Trades:`);
  console.log(`  Trades blocked by gates: ${blockedCount}`);
  console.log(`  This is ${blockedCount > 0 ? '✅ GOOD' : '⚠️ Check if gates are working'} - gates should block uncertain trades`);
  
  console.log('\n✅ Test complete!\n');
}

// Run test if executed directly
if (require.main === module) {
  testGatedEngine().catch(console.error);
}

export { testGatedEngine };

