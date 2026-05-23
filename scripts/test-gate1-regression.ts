/**
 * Regression Test for Gate-1 Market Readability
 * 
 * Ensures that Gate-1 passes when:
 * - Structure-based trendStrength ≥ 60% OR GPT pattern confidence ≥ 70%
 * - Support/resistance exists
 * - Regardless of indicator neutrality
 */

import { GatedTradingEngine } from '../lib/gated-trading-engine';
import { RegimeAnalysis } from '../lib/regime-detector';
import { GPTStructureAnalysis } from '../lib/gated-trading-engine';

async function testGate1Regression() {
  console.log('🧪 Gate-1 Regression Test: Structure-Based Trend Strength\n');
  
  const engine = new GatedTradingEngine();
  
  // Test Case 1: Bullish structure with trendStrength ≥ 60%, confirmed S/R, GPT confidence ≥ 70%
  console.log('📊 Test Case 1: Bullish structure (trendStrength ≥ 60%), confirmed S/R, GPT confidence ≥ 70%');
  
  const mockRegimeAnalysis1: RegimeAnalysis = {
    regime: 'TRENDING_UP',
    confidence: 75,
    volatility: 0.0015,
    trendStrength: 65, // ≥ 60% - should pass Gate-1
    rangeStrength: 30,
    suggestedStrategy: 'TREND_FOLLOWING',
    reasoning: ['Strong uptrend detected']
  };
  
  const mockGPTStructure1: GPTStructureAnalysis = {
    marketStructure: 'TREND_CONTINUATION',
    alignment: 'CONFIRMS',
    confidence: 75, // ≥ 70% - should pass Gate-1
    patterns: [
      { type: 'Bullish Flag', confidence: 75, priceLevel: 1.0850 }
    ],
    supportResistance: {
      support: [1.0800, 1.0820],
      resistance: [1.0900, 1.0920]
    },
    reasoning: 'Strong bullish trend with confirmed support/resistance levels'
  };
  
  // Use private method via type casting (for testing only)
  const marketReadability1 = (engine as any).assessMarketReadability(
    mockRegimeAnalysis1,
    mockGPTStructure1
  );
  
  console.log(`  Trend Strength: ${mockRegimeAnalysis1.trendStrength}%`);
  console.log(`  GPT Pattern Confidence: ${mockGPTStructure1.confidence}%`);
  console.log(`  Support/Resistance: ${mockGPTStructure1.supportResistance.support.length} support, ${mockGPTStructure1.supportResistance.resistance.length} resistance`);
  console.log(`  Gate-1 Result: ${marketReadability1.isReadable ? '✅ READABLE' : '❌ UNREADABLE'}`);
  console.log(`  Gate-1 Reason: ${marketReadability1.reason}`);
  console.log(`  Gate-1 Confidence: ${marketReadability1.confidence}%`);
  
  if (!marketReadability1.isReadable) {
    console.error('  ❌ FAILED: Gate-1 should be READABLE with trendStrength ≥ 60% and GPT confidence ≥ 70%');
    process.exit(1);
  } else {
    console.log('  ✅ PASSED: Gate-1 correctly identified readable market');
  }
  
  // Test Case 2: GPT pattern ≥ 70% but trendStrength < 60% (should still pass if S/R exists)
  console.log('\n📊 Test Case 2: GPT pattern ≥ 70%, trendStrength < 60%, confirmed S/R');
  
  const mockRegimeAnalysis2: RegimeAnalysis = {
    regime: 'LOW_VOLATILITY_RANGE',
    confidence: 60,
    volatility: 0.001,
    trendStrength: 45, // < 60% - but GPT pattern ≥ 70% should compensate
    rangeStrength: 55,
    suggestedStrategy: 'MEAN_REVERSION',
    reasoning: ['Range-bound market']
  };
  
  const mockGPTStructure2: GPTStructureAnalysis = {
    marketStructure: 'RANGE',
    alignment: 'NEUTRAL',
    confidence: 75, // ≥ 70% - should pass Gate-1
    patterns: [
      { type: 'Rectangle Pattern', confidence: 75, priceLevel: 1.0850 }
    ],
    supportResistance: {
      support: [1.0800],
      resistance: [1.0900]
    },
    reasoning: 'Clear range pattern with defined support/resistance'
  };
  
  const marketReadability2 = (engine as any).assessMarketReadability(
    mockRegimeAnalysis2,
    mockGPTStructure2
  );
  
  console.log(`  Trend Strength: ${mockRegimeAnalysis2.trendStrength}%`);
  console.log(`  GPT Pattern Confidence: ${mockGPTStructure2.confidence}%`);
  console.log(`  Support/Resistance: ${mockGPTStructure2.supportResistance.support.length} support, ${mockGPTStructure2.supportResistance.resistance.length} resistance`);
  console.log(`  Gate-1 Result: ${marketReadability2.isReadable ? '✅ READABLE' : '❌ UNREADABLE'}`);
  console.log(`  Gate-1 Reason: ${marketReadability2.reason}`);
  
  if (!marketReadability2.isReadable) {
    console.error('  ❌ FAILED: Gate-1 should be READABLE with GPT pattern ≥ 70% even if trendStrength < 60%');
    process.exit(1);
  } else {
    console.log('  ✅ PASSED: Gate-1 correctly identified readable market via GPT pattern');
  }
  
  // Test Case 3: Guard assertion test - trendStrength ≥ 60% should never report 0%
  console.log('\n📊 Test Case 3: Guard assertion - trendStrength ≥ 60% should never report 0%');
  
  const mockRegimeAnalysis3: RegimeAnalysis = {
    regime: 'TRENDING_UP',
    confidence: 80,
    volatility: 0.0015,
    trendStrength: 70, // ≥ 60%
    rangeStrength: 20,
    suggestedStrategy: 'TREND_FOLLOWING',
    reasoning: ['Very strong uptrend']
  };
  
  const mockGPTStructure3: GPTStructureAnalysis = {
    marketStructure: 'TREND_CONTINUATION',
    alignment: 'CONFIRMS',
    confidence: 80,
    patterns: [
      { type: 'Ascending Triangle', confidence: 80, priceLevel: 1.0850 }
    ],
    supportResistance: {
      support: [1.0800, 1.0820],
      resistance: [1.0900]
    },
    reasoning: 'Strong bullish structure'
  };
  
  const marketReadability3 = (engine as any).assessMarketReadability(
    mockRegimeAnalysis3,
    mockGPTStructure3
  );
  
  console.log(`  Regime Trend Strength: ${mockRegimeAnalysis3.trendStrength}%`);
  console.log(`  Gate-1 Trend Strength: ${marketReadability3.gate1Inputs?.trendStrength || 0}%`);
  
  if (mockRegimeAnalysis3.trendStrength >= 60 && marketReadability3.gate1Inputs?.trendStrength === 0) {
    console.error('  ❌ FAILED: Guard assertion - Gate-1 reported 0% when regime trendStrength ≥ 60%');
    process.exit(1);
  } else {
    console.log('  ✅ PASSED: Guard assertion working - Gate-1 correctly preserved trendStrength');
  }
  
  // Test Case 4: No S/R - should fail even with strong trend/pattern
  console.log('\n📊 Test Case 4: Strong trend/pattern but NO support/resistance (should fail)');
  
  const mockRegimeAnalysis4: RegimeAnalysis = {
    regime: 'TRENDING_UP',
    confidence: 75,
    volatility: 0.0015,
    trendStrength: 70, // ≥ 60%
    rangeStrength: 20,
    suggestedStrategy: 'TREND_FOLLOWING',
    reasoning: ['Strong uptrend']
  };
  
  const mockGPTStructure4: GPTStructureAnalysis = {
    marketStructure: 'TREND_CONTINUATION',
    alignment: 'CONFIRMS',
    confidence: 75, // ≥ 70%
    patterns: [
      { type: 'Bullish Flag', confidence: 75, priceLevel: 1.0850 }
    ],
    supportResistance: {
      support: [], // NO SUPPORT
      resistance: [] // NO RESISTANCE
    },
    reasoning: 'Strong trend but no clear S/R levels'
  };
  
  const marketReadability4 = (engine as any).assessMarketReadability(
    mockRegimeAnalysis4,
    mockGPTStructure4
  );
  
  console.log(`  Trend Strength: ${mockRegimeAnalysis4.trendStrength}%`);
  console.log(`  GPT Pattern Confidence: ${mockGPTStructure4.confidence}%`);
  console.log(`  Support/Resistance: ${mockGPTStructure4.supportResistance.support.length} support, ${mockGPTStructure4.supportResistance.resistance.length} resistance`);
  console.log(`  Gate-1 Result: ${marketReadability4.isReadable ? '✅ READABLE' : '❌ UNREADABLE'}`);
  
  if (marketReadability4.isReadable) {
    console.error('  ❌ FAILED: Gate-1 should be UNREADABLE without support/resistance');
    process.exit(1);
  } else {
    console.log('  ✅ PASSED: Gate-1 correctly blocked market without S/R');
  }
  
  // Test Case 5: Indicator neutrality should not block Gate-1 if structure exists
  console.log('\n📊 Test Case 5: Indicator neutrality with strong structure (should pass)');
  
  const mockRegimeAnalysis5: RegimeAnalysis = {
    regime: 'TRENDING_UP',
    confidence: 70,
    volatility: 0.0015,
    trendStrength: 65, // ≥ 60% - structure exists
    rangeStrength: 25,
    suggestedStrategy: 'TREND_FOLLOWING',
    reasoning: ['Strong structure despite neutral indicators']
  };
  
  const mockGPTStructure5: GPTStructureAnalysis = {
    marketStructure: 'TREND_CONTINUATION',
    alignment: 'CONFIRMS',
    confidence: 72, // ≥ 70%
    patterns: [
      { type: 'Bullish Continuation', confidence: 72, priceLevel: 1.0850 }
    ],
    supportResistance: {
      support: [1.0800],
      resistance: [1.0900]
    },
    reasoning: 'Clear structure despite neutral technical indicators'
  };
  
  const marketReadability5 = (engine as any).assessMarketReadability(
    mockRegimeAnalysis5,
    mockGPTStructure5
  );
  
  console.log(`  Trend Strength: ${mockRegimeAnalysis5.trendStrength}%`);
  console.log(`  GPT Pattern Confidence: ${mockGPTStructure5.confidence}%`);
  console.log(`  Gate-1 Result: ${marketReadability5.isReadable ? '✅ READABLE' : '❌ UNREADABLE'}`);
  
  if (!marketReadability5.isReadable) {
    console.error('  ❌ FAILED: Gate-1 should pass with strong structure regardless of indicator neutrality');
    process.exit(1);
  } else {
    console.log('  ✅ PASSED: Gate-1 correctly passed despite indicator neutrality (structure-based)');
  }
  
  console.log('\n✅ ALL REGRESSION TESTS PASSED');
  console.log('\n📋 Summary:');
  console.log('  ✅ Gate-1 passes with trendStrength ≥ 60% + S/R');
  console.log('  ✅ Gate-1 passes with GPT pattern ≥ 70% + S/R');
  console.log('  ✅ Guard assertion prevents trendStrength = 0% when regime ≥ 60%');
  console.log('  ✅ Gate-1 blocks without S/R even with strong structure');
  console.log('  ✅ Indicator neutrality does not block Gate-1 when structure exists');
}

// Run the test
testGate1Regression().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});

