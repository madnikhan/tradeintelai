/**
 * Test Script: Run Fresh AI Analysis for GBP/JPY
 * This will show the current AI recommendation with all improvements
 */

import { aiTradingEngine } from '../lib/ai-trading-engine';

async function testGBPJPYAnalysis() {
  console.log('🔍 Running Fresh AI Analysis for GBP/JPY...\n');
  console.log('='.repeat(70));
  
  try {
    // Get current price
    console.log('\n📊 Fetching current market price...');
    const priceResponse = await fetch('http://localhost:8080/price/GBPJPY');
    const priceData = await priceResponse.json();
    const currentPrice = {
      bid: priceData.bid || 0,
      ask: priceData.ask || 0,
      spread: priceData.spread || 0
    };
    console.log(`Current Price: ${currentPrice.bid} / ${currentPrice.ask}`);
    console.log(`Spread: ${currentPrice.spread}`);
    
    // Run AI analysis
    console.log('\n🤖 Running AI Analysis (this may take 10-20 seconds)...');
    console.log('   - Loading historical data...');
    console.log('   - Analyzing fundamentals (GBP & JPY)...');
    console.log('   - Calculating technical indicators (RSI, MACD, ADX, etc.)...');
    console.log('   - Checking sentiment and news...');
    console.log('   - Evaluating COT data...');
    console.log('   - Detecting market regime...\n');
    
    const analysis = await aiTradingEngine.analyzeMarket('GBPJPY', []);
    
    console.log('\n' + '='.repeat(70));
    console.log('📈 AI ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    console.log(`\n🎯 OVERALL ASSESSMENT:`);
    console.log(`   Score: ${analysis.overallScore}/100`);
    console.log(`   Recommendation: ${analysis.recommendation}`);
    console.log(`   Confidence: ${analysis.confidence}%`);
    console.log(`   Risk Level: ${analysis.riskLevel}`);
    
    // Confidence threshold check
    const MIN_SCORE = 70;
    const MIN_CONFIDENCE = 60;
    const canTrade = analysis.overallScore >= MIN_SCORE && 
                     analysis.confidence >= MIN_CONFIDENCE && 
                     analysis.recommendation !== 'HOLD';
    
    console.log(`\n✅ TRADE EXECUTION STATUS:`);
    if (canTrade) {
      console.log(`   ✅ SIGNAL STRONG ENOUGH TO TRADE`);
      console.log(`   ✅ Score: ${analysis.overallScore} >= ${MIN_SCORE} ✓`);
      console.log(`   ✅ Confidence: ${analysis.confidence}% >= ${MIN_CONFIDENCE}% ✓`);
      console.log(`   ✅ Recommendation: ${analysis.recommendation} (not HOLD) ✓`);
    } else {
      console.log(`   ⚠️  SIGNAL TOO WEAK - TRADING BLOCKED`);
      if (analysis.overallScore < MIN_SCORE) {
        console.log(`   ❌ Score: ${analysis.overallScore} < ${MIN_SCORE} (too low)`);
      }
      if (analysis.confidence < MIN_CONFIDENCE) {
        console.log(`   ❌ Confidence: ${analysis.confidence}% < ${MIN_CONFIDENCE}% (too low)`);
      }
      if (analysis.recommendation === 'HOLD') {
        console.log(`   ❌ Recommendation: HOLD (not a good time to trade)`);
      }
    }
    
    console.log(`\n📊 COMPONENT SCORES:`);
    console.log(`   Technical: ${analysis.technicalScore}/100`);
    console.log(`   Fundamental: ${analysis.fundamentalScore}/100`);
    console.log(`   Sentiment: ${analysis.sentimentScore}/100`);
    
    if (analysis.cotAnalysis) {
      console.log(`   COT: ${analysis.cotAnalysis.confidence}% (${analysis.cotAnalysis.sentiment})`);
    }
    
    if (analysis.regimeAnalysis) {
      console.log(`   Regime: ${analysis.regimeAnalysis.confidence}% (${analysis.regimeAnalysis.regime})`);
    }
    
    console.log(`\n💰 TRADE SETUP:`);
    console.log(`   Entry Price: ${currentPrice.bid} (current market)`);
    console.log(`   Stop Loss: ${analysis.suggestedStopLoss}`);
    console.log(`   Take Profit: ${analysis.suggestedTakeProfit}`);
    console.log(`   Position Size: ${analysis.suggestedPositionSize} lots`);
    
    // Calculate risk-reward
    const entry = currentPrice.bid;
    const stopLoss = analysis.suggestedStopLoss;
    const takeProfit = analysis.suggestedTakeProfit;
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    const riskReward = reward / risk;
    
    console.log(`   Risk-Reward Ratio: 1:${riskReward.toFixed(2)}`);
    
    console.log(`\n📝 REASONING:`);
    analysis.reasoning.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r}`);
    });
    
    if (analysis.detailedReasoning) {
      console.log(`\n🔍 DETAILED ANALYSIS:`);
      
      if (analysis.detailedReasoning.technical.length > 0) {
        console.log(`\n   Technical Indicators:`);
        analysis.detailedReasoning.technical.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r}`);
        });
      }
      
      if (analysis.detailedReasoning.fundamental.length > 0) {
        console.log(`\n   Fundamental Factors:`);
        analysis.detailedReasoning.fundamental.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r}`);
        });
      }
      
      if (analysis.detailedReasoning.sentiment.length > 0) {
        console.log(`\n   Market Sentiment:`);
        analysis.detailedReasoning.sentiment.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r}`);
        });
      }
      
      if (analysis.detailedReasoning.risk.length > 0) {
        console.log(`\n   Risk Assessment:`);
        analysis.detailedReasoning.risk.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r}`);
        });
      }
    }
    
    if (analysis.tradingHours) {
      console.log(`\n⏰ TRADING HOURS:`);
      console.log(`   Current Session: ${analysis.tradingHours.currentSession}`);
      console.log(`   Quality: ${analysis.tradingHours.quality}`);
      console.log(`   Is Optimal: ${analysis.tradingHours.isOptimalTime ? 'Yes' : 'No'}`);
      if (analysis.tradingHours.warningMessage) {
        console.log(`   ⚠️  ${analysis.tradingHours.warningMessage}`);
      }
    }
    
    if (analysis.regimeAnalysis) {
      console.log(`\n📊 MARKET REGIME:`);
      console.log(`   Regime: ${analysis.regimeAnalysis.regime}`);
      console.log(`   Strategy: ${analysis.regimeAnalysis.suggestedStrategy}`);
      console.log(`   Confidence: ${analysis.regimeAnalysis.confidence}%`);
    }
    
    if (analysis.cotAnalysis) {
      console.log(`\n📈 COT ANALYSIS:`);
      console.log(`   Recommendation: ${analysis.cotAnalysis.recommendation}`);
      console.log(`   Sentiment: ${analysis.cotAnalysis.sentiment}`);
      console.log(`   Confidence: ${analysis.cotAnalysis.confidence}%`);
    }
    
    console.log(`\n` + '='.repeat(70));
    console.log(`\n✅ Analysis Complete!`);
    console.log(`\n💡 Next Steps:`);
    if (canTrade) {
      console.log(`   1. Review the analysis above`);
      console.log(`   2. Check if stop loss and take profit are appropriate`);
      console.log(`   3. Execute trade if you agree with the recommendation`);
    } else {
      console.log(`   1. Wait for a stronger signal (score >= ${MIN_SCORE}, confidence >= ${MIN_CONFIDENCE}%)`);
      console.log(`   2. Re-analyze later when market conditions improve`);
      console.log(`   3. Consider other currency pairs with stronger signals`);
    }
    console.log(`\n`);
    
  } catch (error) {
    console.error('\n❌ Error running analysis:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Run the test
testGBPJPYAnalysis().catch(console.error);

