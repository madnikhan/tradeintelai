/**
 * AUDIT SCRIPT: Diagnostic tool to understand why no strong signals are being generated
 * 
 * This script will:
 * 1. Test the scoring system with real market data
 * 2. Show breakdown of all score components
 * 3. Identify bottlenecks preventing 70+ scores
 * 4. Check if data is loading correctly
 */

import { aiTradingEngine } from '../lib/ai-trading-engine';
import { TRADING_RULES } from '../config/trading-rules';
import { TradingHoursFilter } from '../lib/trading-hours';

interface ScoreBreakdown {
  symbol: string;
  overallScore: number;
  confidence: number;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  cotConfidence?: number;
  regimeConfidence?: number;
  tradingHoursQuality: string;
  recommendation: string;
  issues: string[];
  maxPossibleScore: number;
}

async function auditScoringSystem() {
  console.log('🔍 AUDITING SCORING SYSTEM...\n');
  console.log('='.repeat(80));
  
  const testPairs = TRADING_RULES.TRADING_PAIRS.slice(0, 5); // Test first 5 pairs
  const results: ScoreBreakdown[] = [];
  
  // Check current trading hours
  const tradingHours = TradingHoursFilter.analyze();
  console.log(`\n⏰ Current Trading Hours: ${tradingHours.currentSession}`);
  console.log(`   Quality: ${tradingHours.quality}`);
  console.log(`   Is Optimal: ${tradingHours.isOptimalTime}`);
  console.log(`   Multiplier: ${TradingHoursFilter.getTimeMultiplier()}\n`);
  
  for (const pair of testPairs) {
    console.log(`\n📊 Analyzing ${pair}...`);
    console.log('-'.repeat(80));
    
    try {
      const symbol = pair.replace('/', '');
      const analysis = await aiTradingEngine.analyzeMarket(symbol, []);
      
      const issues: string[] = [];
      let maxPossibleScore = 0;
      
      // Calculate theoretical maximum
      maxPossibleScore = 
        (analysis.technicalScore || 50) * 0.5 +
        (analysis.fundamentalScore || 50) * 0.2 +
        (analysis.sentimentScore || 50) * 0.1 +
        (analysis.cotAnalysis?.confidence || 50) * 0.1 +
        ((analysis.regimeAnalysis?.confidence || 50) / 100) * 10;
      
      // Check for issues
      if (analysis.technicalScore < 40 || analysis.technicalScore > 60) {
        issues.push(`Technical score is ${analysis.technicalScore} (neutral range)`);
      }
      if (analysis.fundamentalScore < 40 || analysis.fundamentalScore > 60) {
        issues.push(`Fundamental score is ${analysis.fundamentalScore} (neutral range)`);
      }
      if (analysis.sentimentScore < 40 || analysis.sentimentScore > 60) {
        issues.push(`Sentiment score is ${analysis.sentimentScore} (neutral range)`);
      }
      if (analysis.cotAnalysis?.confidence && analysis.cotAnalysis.confidence < 40) {
        issues.push(`COT confidence is low: ${analysis.cotAnalysis.confidence}%`);
      }
      if (analysis.regimeAnalysis?.confidence && analysis.regimeAnalysis.confidence < 40) {
        issues.push(`Regime confidence is low: ${analysis.regimeAnalysis.confidence}%`);
      }
      if (analysis.newsImpact?.shouldAvoidTrading) {
        issues.push('⚠️ News impact forcing HOLD (score = 50)');
      }
      if (analysis.regimeAnalysis?.suggestedStrategy === 'AVOID') {
        issues.push('⚠️ Regime detection forcing HOLD (score = 50)');
      }
      if (!tradingHours.isOptimalTime && tradingHours.quality === 'POOR') {
        issues.push('⚠️ Poor trading hours forcing HOLD (score = 50)');
      }
      if (tradingHours.quality !== 'PRIME') {
        const multiplier = TradingHoursFilter.getTimeMultiplier(symbol);
        issues.push(`⚠️ Trading hours multiplier: ${multiplier}x (reducing score)`);
      }
      
      // Check if data loaded
      if (!analysis.detailedReasoning?.technical || analysis.detailedReasoning.technical.length === 0) {
        issues.push('❌ No technical analysis data - historical data may not have loaded');
      }
      
      results.push({
        symbol: pair,
        overallScore: analysis.overallScore,
        confidence: analysis.confidence,
        technicalScore: analysis.technicalScore,
        fundamentalScore: analysis.fundamentalScore,
        sentimentScore: analysis.sentimentScore,
        cotConfidence: analysis.cotAnalysis?.confidence,
        regimeConfidence: analysis.regimeAnalysis?.confidence,
        tradingHoursQuality: analysis.tradingHours?.quality || 'UNKNOWN',
        recommendation: analysis.recommendation,
        issues,
        maxPossibleScore: Math.round(maxPossibleScore),
      });
      
      // Print detailed breakdown
      console.log(`   Overall Score: ${analysis.overallScore}/100`);
      console.log(`   Confidence: ${analysis.confidence}%`);
      console.log(`   Recommendation: ${analysis.recommendation}`);
      console.log(`   Technical: ${analysis.technicalScore} (50% weight)`);
      console.log(`   Fundamental: ${analysis.fundamentalScore} (20% weight)`);
      console.log(`   Sentiment: ${analysis.sentimentScore} (10% weight)`);
      console.log(`   COT Confidence: ${analysis.cotAnalysis?.confidence || 'N/A'}% (10% weight)`);
      console.log(`   Regime Confidence: ${analysis.regimeAnalysis?.confidence || 'N/A'}% (10% weight)`);
      console.log(`   Trading Hours: ${analysis.tradingHours?.quality || 'UNKNOWN'}`);
      
      if (analysis.newsImpact?.shouldAvoidTrading) {
        console.log(`   ⚠️ NEWS IMPACT: Forcing HOLD`);
      }
      
      if (issues.length > 0) {
        console.log(`   Issues found: ${issues.length}`);
        issues.forEach(issue => console.log(`     - ${issue}`));
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error analyzing ${pair}:`, error);
      results.push({
        symbol: pair,
        overallScore: 0,
        confidence: 0,
        technicalScore: 0,
        fundamentalScore: 0,
        sentimentScore: 0,
        tradingHoursQuality: 'ERROR',
        recommendation: 'ERROR',
        issues: [`Error: ${error instanceof Error ? error.message : String(error)}`],
        maxPossibleScore: 0,
      });
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📈 AUDIT SUMMARY');
  console.log('='.repeat(80));
  
  const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
  const maxScore = Math.max(...results.map(r => r.overallScore));
  const minScore = Math.min(...results.map(r => r.overallScore));
  const scoresAbove70 = results.filter(r => r.overallScore >= 70).length;
  const scoresAbove60 = results.filter(r => r.overallScore >= 60).length;
  
  console.log(`\n📊 Score Statistics:`);
  console.log(`   Average Score: ${avgScore.toFixed(1)}/100`);
  console.log(`   Highest Score: ${maxScore}/100`);
  console.log(`   Lowest Score: ${minScore}/100`);
  console.log(`   Scores ≥ 70: ${scoresAbove70}/${results.length} (${(scoresAbove70/results.length*100).toFixed(1)}%)`);
  console.log(`   Scores ≥ 60: ${scoresAbove60}/${results.length} (${(scoresAbove60/results.length*100).toFixed(1)}%)`);
  
  console.log(`\n🔍 Common Issues:`);
  const allIssues = results.flatMap(r => r.issues);
  const issueCounts = new Map<string, number>();
  allIssues.forEach(issue => {
    const key = issue.split(':')[0]; // Get issue type
    issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
  });
  Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`   ${issue}: ${count} occurrences`);
    });
  
  console.log(`\n💡 Recommendations:`);
  
  if (avgScore < 55) {
    console.log(`   ⚠️ Average score is very low (${avgScore.toFixed(1)}). Possible causes:`);
    console.log(`      - Historical data not loading correctly`);
    console.log(`      - API keys missing or invalid`);
    console.log(`      - Market conditions are genuinely neutral`);
    console.log(`      - Trading hours multiplier reducing scores`);
  }
  
  if (scoresAbove70 === 0) {
    console.log(`   ⚠️ NO SCORES ABOVE 70! This explains why no strong signals are found.`);
    console.log(`      - Consider lowering threshold to 65+ score, 55%+ confidence`);
    console.log(`      - Or check if data providers are working correctly`);
    console.log(`      - Review trading hours impact on scores`);
  }
  
  if (maxScore < 70) {
    console.log(`   ⚠️ Maximum score is ${maxScore}, which is below the 70 threshold.`);
    console.log(`      - The scoring system may be too conservative`);
    console.log(`      - Consider adjusting weights or thresholds`);
  }
  
  // Show top opportunities
  const sortedResults = [...results].sort((a, b) => b.overallScore - a.overallScore);
  console.log(`\n🏆 Top Opportunities (even if below 70):`);
  sortedResults.slice(0, 3).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.symbol}: ${r.overallScore}/100 (${r.confidence}% confidence) - ${r.recommendation}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

// Run the audit
auditScoringSystem().catch(console.error);

