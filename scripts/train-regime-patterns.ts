/**
 * Script to train regime pattern database from historical data
 * 
 * Usage:
 *   npx tsx scripts/train-regime-patterns.ts
 * 
 * This script fetches historical data for major currency pairs and trains
 * the ML regime detector's pattern database.
 */

import { MLRegimeDetector } from '../lib/regime-detector-ml';
import { MT5PriceDataProvider } from '../lib/data-providers/mt5-price-data';
import { TwelveDataProvider } from '../lib/data-providers/twelve-data';
import { PriceData } from '../types/trading';

const MAJOR_PAIRS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCHF',
  'AUDUSD',
  'USDCAD',
  'NZDUSD',
];

const MINOR_PAIRS = [
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'EURAUD',
  'GBPAUD',
  'AUDJPY',
  'EURCAD',
  'GBPCAD',
  'AUDCAD',
];

async function fetchHistoricalData(symbol: string, count: number = 200): Promise<PriceData[]> {
  // Try MT5 first
  let data = await MT5PriceDataProvider.getHistoricalData(symbol, 'H1', count);
  
  // Fallback to TwelveData
  if (data.length === 0) {
    data = await TwelveDataProvider.getHistoricalData(symbol, '1h', count);
  }
  
  return data;
}

async function trainPatternDatabase() {
  console.log('🚀 Starting regime pattern database training...\n');
  
  // Get current stats
  const initialStats = MLRegimeDetector.getPatternDatabaseStats();
  console.log(`📊 Current database: ${initialStats.totalPatterns} patterns`);
  console.log(`   By regime:`, initialStats.patternsByRegime);
  console.log('');
  
  // Fetch historical data for all pairs
  const allPairs = [...MAJOR_PAIRS, ...MINOR_PAIRS];
  const historicalData: Array<{ symbol: string; data: PriceData[] }> = [];
  
  console.log(`📥 Fetching historical data for ${allPairs.length} pairs...`);
  for (const symbol of allPairs) {
    try {
      const data = await fetchHistoricalData(symbol, 200);
      if (data.length >= 52) {
        historicalData.push({ symbol, data });
        console.log(`   ✅ ${symbol}: ${data.length} candles`);
      } else {
        console.log(`   ⚠️  ${symbol}: Insufficient data (${data.length} candles, need 52+)`);
      }
    } catch (error) {
      console.error(`   ❌ ${symbol}: Failed to fetch data`, error);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Fetched data for ${historicalData.length} pairs\n`);
  
  if (historicalData.length === 0) {
    console.log('❌ No historical data available. Cannot train database.');
    return;
  }
  
  // Train the database
  console.log('🧠 Training pattern database...');
  const patternsAdded = await MLRegimeDetector.trainFromHistoricalData(
    historicalData,
    60 // Minimum confidence threshold
  );
  
  // Get final stats
  const finalStats = MLRegimeDetector.getPatternDatabaseStats();
  console.log('\n✅ Training complete!');
  console.log(`📊 Final database: ${finalStats.totalPatterns} patterns (+${patternsAdded} new)`);
  console.log(`   By regime:`, finalStats.patternsByRegime);
  
  if (finalStats.oldestPattern && finalStats.newestPattern) {
    const oldestDate = new Date(finalStats.oldestPattern).toLocaleDateString();
    const newestDate = new Date(finalStats.newestPattern).toLocaleDateString();
    console.log(`   Date range: ${oldestDate} to ${newestDate}`);
  }
  
  console.log('\n💡 The pattern database is now ready for use!');
  console.log('   Patterns will be automatically saved to localStorage.');
  console.log('   Pattern matching will activate once you have at least 10 patterns.');
}

// Run training
trainPatternDatabase().catch(error => {
  console.error('❌ Training failed:', error);
  process.exit(1);
});

