import { NextRequest, NextResponse } from 'next/server';
import { RSSNewsProvider } from '@/lib/data-providers/rss-news';
import { SentimentParser } from '@/lib/data-providers/sentiment-parser';
import { logger } from '@/lib/logger';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Test endpoint for sentiment parsers
 * Tests sentiment analysis for all major currency pairs
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {},
    errors: [],
  };

  const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURJPY'];

  try {
    // Test 1: Keyword Extraction
    console.log('[TEST] Testing keyword extraction...');
    const keywordTests: any = {};

    for (const pair of pairs) {
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      const keywords = SentimentParser.extractKeywords(base, quote);
      
      keywordTests[pair] = {
        baseCurrency: base,
        quoteCurrency: quote,
        keywordCount: keywords.length,
        keywords: keywords.slice(0, 10), // First 10 keywords
        hasCountryNames: keywords.some(k => 
          ['United States', 'European Union', 'United Kingdom', 'Japan'].includes(k)
        ),
        hasCentralBanks: keywords.some(k => 
          ['Federal Reserve', 'ECB', 'Bank of England', 'BOJ'].includes(k)
        ),
        hasNicknames: keywords.some(k => 
          ['dollar', 'euro', 'pound', 'yen', 'aussie', 'loonie', 'swissie', 'kiwi'].includes(k.toLowerCase())
        ),
      };
    }

    results.tests.keywordExtraction = keywordTests;

    // Test 2: Sentiment Analysis for Pairs
    console.log('[TEST] Testing sentiment analysis for pairs...');
    const sentimentTests: any = {};

    for (const pair of pairs) {
      const pairStart = Date.now();
      try {
        const sentiment = await RSSNewsProvider.getSentimentScore(pair);
        const pairTime = Date.now() - pairStart;

        sentimentTests[pair] = {
          success: true,
          executionTime: pairTime,
          score: sentiment.score,
          bullish: sentiment.bullish,
          bearish: sentiment.bearish,
          neutral: sentiment.neutral,
          articleCount: sentiment.articleCount,
          confidence: sentiment.confidence,
          hasData: sentiment.articleCount > 0,
        };
        console.log(`[TEST] ✅ ${pair}: ${sentiment.articleCount} articles, score: ${sentiment.score}, confidence: ${sentiment.confidence}% in ${pairTime}ms`);
      } catch (error: any) {
        const pairTime = Date.now() - pairStart;
        sentimentTests[pair] = {
          success: false,
          error: error.message,
          executionTime: pairTime,
        };
        results.errors.push({ pair, error: error.message });
        console.error(`[TEST] ❌ ${pair} failed:`, error);
      }
    }

    results.tests.sentimentAnalysis = sentimentTests;

    // Test 3: Sentiment Parser Accuracy
    console.log('[TEST] Testing sentiment parser accuracy...');
    const accuracyTests = {
      positive: SentimentParser.analyzeSentiment('The dollar rises sharply as the economy shows strong growth and the Fed raises rates'),
      negative: SentimentParser.analyzeSentiment('The euro falls as recession fears grow and the ECB cuts rates amid economic crisis'),
      neutral: SentimentParser.analyzeSentiment('The pound trades in a narrow range as markets await economic data'),
      negated: SentimentParser.analyzeSentiment('The yen does not fall despite concerns, showing unexpected strength'),
    };

    results.tests.parserAccuracy = accuracyTests;

    // Summary
    const totalTime = Date.now() - startTime;
    const successCount = Object.values(sentimentTests).filter((t: any) => t.success).length;
    const pairsWithData = Object.values(sentimentTests).filter((t: any) => t.success && t.hasData).length;
    const totalArticles = Object.values(sentimentTests)
      .filter((t: any) => t.success && t.articleCount)
      .reduce((sum: number, t: any) => sum + t.articleCount, 0);
    const avgConfidence = Object.values(sentimentTests)
      .filter((t: any) => t.success && t.confidence)
      .reduce((sum: number, t: any) => sum + (t.confidence || 0), 0) / pairsWithData || 0;

    results.summary = {
      totalExecutionTime: totalTime,
      pairsTested: pairs.length,
      pairsSuccessful: successCount,
      pairsWithData,
      successRate: (successCount / pairs.length) * 100,
      dataCoverage: (pairsWithData / pairs.length) * 100,
      totalArticles,
      averageArticlesPerPair: pairsWithData > 0 ? Math.round(totalArticles / pairsWithData) : 0,
      averageConfidence: Math.round(avgConfidence),
      allPairsWorking: successCount === pairs.length,
      allPairsHaveData: pairsWithData === pairs.length,
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

