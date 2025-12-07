import { NextRequest, NextResponse } from 'next/server';
import { COTDataProvider } from '@/lib/data-providers/cot-data';
import { COTAnalyzer } from '@/lib/cot-analyzer';
import { logger } from '@/lib/logger';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Test endpoint for COT parsers
 * Tests COT data fetching and analysis for all supported currencies
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {},
    errors: [],
  };

  const currencies = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
  const usdPairs = ['USDJPY', 'USDCAD', 'USDCHF'];
  const nonUsdPairs = ['EURUSD', 'GBPUSD', 'AUDUSD'];

  try {
    // Test 1: COT Data Fetching for Individual Currencies
    console.log('[TEST] Testing COT data fetching for currencies...');
    const currencyTests: any = {};

    for (const currency of currencies) {
      const currencyStart = Date.now();
      try {
        const cotData = await COTDataProvider.getCOTData(currency, 52);
        const currencyTime = Date.now() - currencyStart;

        currencyTests[currency] = {
          success: true,
          recordCount: cotData.length,
          executionTime: currencyTime,
          latestDate: cotData.length > 0 ? cotData[cotData.length - 1].date.toISOString() : null,
          sampleData: cotData.length > 0 ? {
            date: cotData[cotData.length - 1].date.toISOString(),
            netNonCommercial: cotData[cotData.length - 1].netNonCommercial,
            netCommercial: cotData[cotData.length - 1].netCommercial,
            openInterest: cotData[cotData.length - 1].openInterest,
          } : null,
        };
        console.log(`[TEST] ✅ ${currency}: ${cotData.length} records in ${currencyTime}ms`);
      } catch (error: any) {
        const currencyTime = Date.now() - currencyStart;
        currencyTests[currency] = {
          success: false,
          error: error.message,
          executionTime: currencyTime,
        };
        results.errors.push({ currency, error: error.message });
        console.error(`[TEST] ❌ ${currency} failed:`, error);
      }
    }

    results.tests.currencies = currencyTests;

    // Test 2: COT Analysis for Non-USD Pairs
    console.log('[TEST] Testing COT analysis for non-USD pairs...');
    const nonUsdTests: any = {};

    for (const pair of nonUsdPairs) {
      const pairStart = Date.now();
      try {
        const analysis = await COTAnalyzer.analyzeCOT(pair);
        const pairTime = Date.now() - pairStart;

        nonUsdTests[pair] = {
          success: true,
          executionTime: pairTime,
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          recommendation: analysis.recommendation,
          largeSpecPercentile: analysis.largeSpecPercentile,
          commercialPercentile: analysis.commercialPercentile,
          reasoning: analysis.reasoning.slice(0, 2), // First 2 reasons
        };
        console.log(`[TEST] ✅ ${pair}: ${analysis.sentiment} (${analysis.confidence}% confidence) in ${pairTime}ms`);
      } catch (error: any) {
        const pairTime = Date.now() - pairStart;
        nonUsdTests[pair] = {
          success: false,
          error: error.message,
          executionTime: pairTime,
        };
        results.errors.push({ pair, error: error.message });
        console.error(`[TEST] ❌ ${pair} failed:`, error);
      }
    }

    results.tests.nonUsdPairs = nonUsdTests;

    // Test 3: Inverse COT Analysis for USD Pairs
    console.log('[TEST] Testing inverse COT analysis for USD pairs...');
    const usdPairTests: any = {};

    for (const pair of usdPairs) {
      const pairStart = Date.now();
      try {
        const analysis = await COTAnalyzer.analyzeCOT(pair);
        const pairTime = Date.now() - pairStart;

        // Check if inverse COT logic is working
        const cotData = await COTAnalyzer.fetchCOTData(pair);
        const isInverse = cotData.length > 0 && cotData[0].netNonCommercial !== undefined;

        usdPairTests[pair] = {
          success: true,
          executionTime: pairTime,
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          recommendation: analysis.recommendation,
          largeSpecPercentile: analysis.largeSpecPercentile,
          commercialPercentile: analysis.commercialPercentile,
          hasInverseCOT: isInverse,
          dataCount: cotData.length,
          reasoning: analysis.reasoning.slice(0, 2),
        };
        console.log(`[TEST] ✅ ${pair}: ${analysis.sentiment} (${analysis.confidence}% confidence, inverse: ${isInverse}) in ${pairTime}ms`);
      } catch (error: any) {
        const pairTime = Date.now() - pairStart;
        usdPairTests[pair] = {
          success: false,
          error: error.message,
          executionTime: pairTime,
        };
        results.errors.push({ pair, error: error.message });
        console.error(`[TEST] ❌ ${pair} failed:`, error);
      }
    }

    results.tests.usdPairs = usdPairTests;

    // Summary
    const totalTime = Date.now() - startTime;
    const currencySuccess = Object.values(currencyTests).filter((t: any) => t.success).length;
    const nonUsdSuccess = Object.values(nonUsdTests).filter((t: any) => t.success).length;
    const usdSuccess = Object.values(usdPairTests).filter((t: any) => t.success).length;
    const totalRecords = Object.values(currencyTests)
      .filter((t: any) => t.success && t.recordCount)
      .reduce((sum: number, t: any) => sum + t.recordCount, 0);

    results.summary = {
      totalExecutionTime: totalTime,
      currencyTests: {
        total: currencies.length,
        success: currencySuccess,
        successRate: (currencySuccess / currencies.length) * 100,
      },
      nonUsdPairTests: {
        total: nonUsdPairs.length,
        success: nonUsdSuccess,
        successRate: (nonUsdSuccess / nonUsdPairs.length) * 100,
      },
      usdPairTests: {
        total: usdPairs.length,
        success: usdSuccess,
        successRate: (usdSuccess / usdPairs.length) * 100,
      },
      totalRecords,
      averageRecordsPerCurrency: currencySuccess > 0 ? Math.round(totalRecords / currencySuccess) : 0,
      allTestsPassing: currencySuccess === currencies.length && 
                       nonUsdSuccess === nonUsdPairs.length && 
                       usdSuccess === usdPairs.length,
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[TEST] Fatal error:', error);
    return NextResponse.json(
      {
        ...results,
        fatalError: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

