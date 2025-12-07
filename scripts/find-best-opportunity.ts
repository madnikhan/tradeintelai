/**
 * Find Best Trading Opportunity
 * Analyzes all currency pairs to find the strongest signal
 */

import { aiTradingEngine } from '../lib/ai-trading-engine';
import { TRADING_RULES } from '../config/trading-rules';

interface Opportunity {
  symbol: string;
  score: number;
  confidence: number;
  recommendation: string;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  riskLevel: string;
}

async function findBestOpportunity() {
  console.log('🔍 Analyzing ALL Currency Pairs for Best Opportunity...\n');
  console.log('='.repeat(70));
  
  const opportunities: Opportunity[] = [];
  const pairs = TRADING_RULES.TRADING_PAIRS;
  
  console.log(`\n📊 Analyzing ${pairs.length} currency pairs...\n`);
  
  // Analyze each pair
  for (const pair of pairs) {
    try {
      const symbol = pair.replace('/', ''); // Convert EUR/USD to EURUSD
      console.log(`Analyzing ${pair}...`);
      
      const analysis = await aiTradingEngine.analyzeMarket(symbol, []);
      
      opportunities.push({
        symbol: pair,
        score: analysis.overallScore,
        confidence: analysis.confidence,
        recommendation: analysis.recommendation,
        technicalScore: analysis.technicalScore,
        fundamentalScore: analysis.fundamentalScore,
        sentimentScore: analysis.sentimentScore,
        riskLevel: analysis.riskLevel,
      });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error analyzing ${pair}:`, error);
    }
  }
  
  // Filter and sort opportunities
  const MIN_SCORE = 70;
  const MIN_CONFIDENCE = 60;
  
  const validOpportunities = opportunities.filter(opp => 
    opp.score >= MIN_SCORE && 
    opp.confidence >= MIN_CONFIDENCE &&
    opp.recommendation !== 'HOLD'
  );
  
  // Sort by score * confidence (combined strength)
  validOpportunities.sort((a, b) => {
    const aStrength = a.score * (a.confidence / 100);
    const bStrength = b.score * (b.confidence / 100);
    return bStrength - aStrength;
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('📈 BEST TRADING OPPORTUNITIES');
  console.log('='.repeat(70));
  
  if (validOpportunities.length === 0) {
    console.log('\n⚠️  NO STRONG OPPORTUNITIES FOUND');
    console.log('   All pairs are below minimum thresholds:');
    console.log(`   - Minimum Score: ${MIN_SCORE}/100`);
    console.log(`   - Minimum Confidence: ${MIN_CONFIDENCE}%`);
    console.log('\n💡 Recommendation: WAIT for better market conditions');
    console.log('   Do NOT force trades to recover losses!');
  } else {
    console.log(`\n✅ Found ${validOpportunities.length} strong opportunities:\n`);
    
    validOpportunities.slice(0, 5).forEach((opp, index) => {
      const strength = (opp.score * (opp.confidence / 100)).toFixed(1);
      console.log(`${index + 1}. ${opp.symbol}`);
      console.log(`   Recommendation: ${opp.recommendation}`);
      console.log(`   Score: ${opp.score}/100 | Confidence: ${opp.confidence}%`);
      console.log(`   Combined Strength: ${strength}`);
      console.log(`   Technical: ${opp.technicalScore} | Fundamental: ${opp.fundamentalScore} | Sentiment: ${opp.sentimentScore}`);
      console.log(`   Risk Level: ${opp.riskLevel}`);
      console.log('');
    });
    
    const best = validOpportunities[0];
    console.log('='.repeat(70));
    console.log('🎯 TOP RECOMMENDATION');
    console.log('='.repeat(70));
    console.log(`\nPair: ${best.symbol}`);
    console.log(`Recommendation: ${best.recommendation}`);
    console.log(`Score: ${best.score}/100`);
    console.log(`Confidence: ${best.confidence}%`);
    console.log(`Risk Level: ${best.riskLevel}`);
  }
  
  // Show all opportunities (even weak ones)
  console.log('\n' + '='.repeat(70));
  console.log('📊 ALL OPPORTUNITIES (Sorted by Strength)');
  console.log('='.repeat(70));
  
  opportunities.sort((a, b) => {
    const aStrength = a.score * (a.confidence / 100);
    const bStrength = b.score * (b.confidence / 100);
    return bStrength - aStrength;
  });
  
  opportunities.forEach((opp, index) => {
    const strength = (opp.score * (opp.confidence / 100)).toFixed(1);
    const status = opp.score >= MIN_SCORE && opp.confidence >= MIN_CONFIDENCE ? '✅' : '⚠️';
    console.log(`${status} ${index + 1}. ${opp.symbol.padEnd(10)} | ${opp.recommendation.padEnd(12)} | Score: ${opp.score.toString().padStart(3)} | Conf: ${opp.confidence.toString().padStart(3)}% | Strength: ${strength}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('⚠️  IMPORTANT WARNINGS');
  console.log('='.repeat(70));
  console.log('\n1. DO NOT REVENGE TRADE');
  console.log('   - Trading to "cover losses" is emotional trading');
  console.log('   - This leads to larger losses');
  console.log('   - Take a break if you feel emotional');
  
  console.log('\n2. RISK MANAGEMENT');
  console.log('   - Only risk 2% per trade (as configured)');
  console.log('   - $4.55 loss on $100 = 4.55% (already exceeded 2% limit)');
  console.log('   - Wait for a strong signal (70+ score, 60%+ confidence)');
  
  console.log('\n3. PROPER APPROACH');
  console.log('   - Analyze the market objectively');
  console.log('   - Wait for the BEST opportunity');
  console.log('   - Follow your trading plan');
  console.log('   - Accept losses as part of trading');
  
  console.log('\n');
}

// Run the analysis
findBestOpportunity().catch(console.error);

