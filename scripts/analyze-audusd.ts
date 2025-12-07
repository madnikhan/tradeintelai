/**
 * Quick Analysis: AUD/USD
 * Check if it's worth trading right now
 */

import { aiTradingEngine } from '../lib/ai-trading-engine';
import { TradingHoursFilter } from '../lib/trading-hours';

async function analyzeAUDUSD() {
  console.log('🔍 Analyzing AUD/USD for Trading Opportunity...\n');
  console.log('='.repeat(70));
  
  try {
    // Check trading hours
    const tradingHours = TradingHoursFilter.analyze('AUDUSD');
    console.log(`\n⏰ Trading Hours: ${tradingHours.currentSession} (${tradingHours.quality})`);
    
    // Run AI analysis
    console.log('\n🤖 Running AI Analysis...');
    console.log('   - Loading historical data...');
    console.log('   - Analyzing fundamentals (AUD + USD)...');
    console.log('   - Calculating technical indicators...');
    console.log('   - Checking sentiment and news...');
    console.log('   - Evaluating COT data...');
    console.log('   - Detecting market regime...\n');
    
    const analysis = await aiTradingEngine.analyzeMarket('AUDUSD', []);
    
    console.log('\n' + '='.repeat(70));
    console.log('📈 AUD/USD ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    // Overall assessment
    console.log(`\n🎯 OVERALL ASSESSMENT:`);
    console.log(`   Recommendation: ${analysis.recommendation}`);
    console.log(`   Score: ${analysis.overallScore}/100`);
    console.log(`   Confidence: ${analysis.confidence}%`);
    console.log(`   Risk Level: ${analysis.riskLevel}`);
    
    // Component scores
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
    
    // Trade setup
    console.log(`\n💰 TRADE SETUP:`);
    console.log(`   Stop Loss: ${analysis.suggestedStopLoss}`);
    console.log(`   Take Profit: ${analysis.suggestedTakeProfit}`);
    console.log(`   Position Size: ${analysis.suggestedPositionSize} lots`);
    
    // Calculate risk-reward (if we have valid prices)
    if (analysis.suggestedStopLoss > 0 && analysis.suggestedTakeProfit > 0) {
      // Estimate entry price from stop loss and take profit
      const entry = (analysis.suggestedStopLoss + analysis.suggestedTakeProfit) / 2;
      const stopLoss = analysis.suggestedStopLoss;
      const takeProfit = analysis.suggestedTakeProfit;
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);
      if (risk > 0) {
        const riskReward = reward / risk;
        console.log(`   Estimated Risk-Reward Ratio: 1:${riskReward.toFixed(2)}`);
      }
    }
    
    // Trading thresholds
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
      console.log(`   ⚠️  SIGNAL TOO WEAK - TRADING NOT RECOMMENDED`);
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
    
    // Detailed reasoning
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
    
    // Final recommendation
    console.log(`\n` + '='.repeat(70));
    console.log('🎯 FINAL RECOMMENDATION');
    console.log('='.repeat(70));
    
    if (canTrade) {
      console.log(`\n✅ YES - AUD/USD is worth trading!`);
      console.log(`\n   Reasons:`);
      console.log(`   • Strong signal (${analysis.overallScore}/100 score)`);
      console.log(`   • High confidence (${analysis.confidence}%)`);
      console.log(`   • Clear recommendation: ${analysis.recommendation}`);
      console.log(`\n   Next Steps:`);
      console.log(`   1. Review the analysis above`);
      console.log(`   2. Check current market price in MT5`);
      console.log(`   3. Verify stop loss and take profit levels`);
      console.log(`   4. Ensure you're only risking 2% of your account`);
      console.log(`   5. Execute the trade if you agree with the analysis`);
    } else {
      console.log(`\n❌ NO - AUD/USD is NOT worth trading right now`);
      console.log(`\n   Reasons:`);
      if (analysis.overallScore < MIN_SCORE) {
        console.log(`   • Score too low: ${analysis.overallScore}/100 (minimum: ${MIN_SCORE})`);
      }
      if (analysis.confidence < MIN_CONFIDENCE) {
        console.log(`   • Confidence too low: ${analysis.confidence}% (minimum: ${MIN_CONFIDENCE}%)`);
      }
      if (analysis.recommendation === 'HOLD') {
        console.log(`   • AI recommends HOLD - not a good time to trade`);
      }
      console.log(`\n   Recommendation:`);
      console.log(`   • Wait for a stronger signal`);
      console.log(`   • Re-analyze later when market conditions improve`);
      console.log(`   • Consider other currency pairs with stronger signals`);
      console.log(`   • Use the Opportunity Scanner in the dashboard to find better opportunities`);
    }
    
    console.log(`\n`);
    
  } catch (error) {
    console.error('\n❌ Error analyzing AUD/USD:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Run the analysis
analyzeAUDUSD().catch(console.error);

