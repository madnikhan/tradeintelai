import { NextRequest, NextResponse } from 'next/server';
import { ForexFactoryRSSProvider } from '@/lib/data-providers/forexfactory-rss';
import { InvestingCalendarProvider } from '@/lib/data-providers/investing-calendar';
import { TradingEconomicsCalendarProvider } from '@/lib/data-providers/tradingeconomics-calendar';
import { UnifiedCalendarProvider } from '@/lib/data-providers/unified-calendar';
import { logger } from '@/lib/logger';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Test endpoint for calendar parsers
 * Tests all parsers and returns detailed results
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {},
    errors: [],
  };

  try {
    // Test 1: ForexFactory RSS
    console.log('[TEST] Testing ForexFactory RSS parser...');
    const ffStart = Date.now();
    try {
      const ffEvents = await ForexFactoryRSSProvider.getEconomicCalendar();
      const ffTime = Date.now() - ffStart;
      results.tests.forexFactory = {
        success: true,
        eventCount: ffEvents.length,
        executionTime: ffTime,
        sampleEvents: ffEvents.slice(0, 3).map(e => ({
          title: e.title,
          country: e.country,
          currency: e.currency,
          impact: e.impact,
          date: e.date.toISOString(),
          hasActual: e.actual !== undefined,
          hasForecast: e.forecast !== undefined,
          hasPrevious: e.previous !== undefined,
        })),
        eventsByCurrency: countByCurrency(ffEvents),
        eventsByImpact: countByImpact(ffEvents),
      };
      console.log(`[TEST] ✅ ForexFactory: ${ffEvents.length} events in ${ffTime}ms`);
    } catch (error: any) {
      const ffTime = Date.now() - ffStart;
      results.tests.forexFactory = {
        success: false,
        error: error.message,
        executionTime: ffTime,
      };
      results.errors.push({ source: 'ForexFactory', error: error.message });
      console.error(`[TEST] ❌ ForexFactory failed:`, error);
    }

    // Test 2: Investing.com
    console.log('[TEST] Testing Investing.com parser...');
    const investingStart = Date.now();
    try {
      const investingEvents = await InvestingCalendarProvider.getEconomicCalendar();
      const investingTime = Date.now() - investingStart;
      results.tests.investing = {
        success: true,
        eventCount: investingEvents.length,
        executionTime: investingTime,
        sampleEvents: investingEvents.slice(0, 3).map(e => ({
          title: e.title,
          country: e.country,
          currency: e.currency,
          impact: e.impact,
          date: e.date.toISOString(),
          hasActual: e.actual !== undefined,
          hasForecast: e.forecast !== undefined,
          hasPrevious: e.previous !== undefined,
        })),
        eventsByCurrency: countByCurrency(investingEvents),
        eventsByImpact: countByImpact(investingEvents),
      };
      console.log(`[TEST] ✅ Investing.com: ${investingEvents.length} events in ${investingTime}ms`);
    } catch (error: any) {
      const investingTime = Date.now() - investingStart;
      results.tests.investing = {
        success: false,
        error: error.message,
        executionTime: investingTime,
      };
      results.errors.push({ source: 'Investing.com', error: error.message });
      console.error(`[TEST] ❌ Investing.com failed:`, error);
    }

    // Test 3: Trading Economics
    console.log('[TEST] Testing Trading Economics parser...');
    const teStart = Date.now();
    try {
      const teEvents = await TradingEconomicsCalendarProvider.getEconomicCalendar();
      const teTime = Date.now() - teStart;
      results.tests.tradingEconomics = {
        success: true,
        eventCount: teEvents.length,
        executionTime: teTime,
        sampleEvents: teEvents.slice(0, 3).map(e => ({
          title: e.title,
          country: e.country,
          currency: e.currency,
          impact: e.impact,
          date: e.date.toISOString(),
          hasActual: e.actual !== undefined,
          hasForecast: e.forecast !== undefined,
          hasPrevious: e.previous !== undefined,
        })),
        eventsByCurrency: countByCurrency(teEvents),
        eventsByImpact: countByImpact(teEvents),
      };
      console.log(`[TEST] ✅ Trading Economics: ${teEvents.length} events in ${teTime}ms`);
    } catch (error: any) {
      const teTime = Date.now() - teStart;
      results.tests.tradingEconomics = {
        success: false,
        error: error.message,
        executionTime: teTime,
      };
      results.errors.push({ source: 'Trading Economics', error: error.message });
      console.error(`[TEST] ❌ Trading Economics failed:`, error);
    }

    // Test 4: Unified Provider
    console.log('[TEST] Testing Unified Calendar Provider...');
    const unifiedStart = Date.now();
    try {
      const unifiedEvents = await UnifiedCalendarProvider.getEconomicCalendar();
      const unifiedTime = Date.now() - unifiedStart;
      const sourceStats = await UnifiedCalendarProvider.getSourceStats();
      
      results.tests.unified = {
        success: true,
        eventCount: unifiedEvents.length,
        executionTime: unifiedTime,
        sourceStats,
        sampleEvents: unifiedEvents.slice(0, 5).map(e => ({
          title: e.title,
          country: e.country,
          currency: e.currency,
          impact: e.impact,
          date: e.date.toISOString(),
          hasActual: e.actual !== undefined,
          hasForecast: e.forecast !== undefined,
          hasPrevious: e.previous !== undefined,
        })),
        eventsByCurrency: countByCurrency(unifiedEvents),
        eventsByImpact: countByImpact(unifiedEvents),
        eventsWithData: {
          withActual: unifiedEvents.filter(e => e.actual !== undefined).length,
          withForecast: unifiedEvents.filter(e => e.forecast !== undefined).length,
          withPrevious: unifiedEvents.filter(e => e.previous !== undefined).length,
          withAll: unifiedEvents.filter(e => 
            e.actual !== undefined && e.forecast !== undefined && e.previous !== undefined
          ).length,
        },
      };
      console.log(`[TEST] ✅ Unified: ${unifiedEvents.length} events in ${unifiedTime}ms`);
    } catch (error: any) {
      const unifiedTime = Date.now() - unifiedStart;
      results.tests.unified = {
        success: false,
        error: error.message,
        executionTime: unifiedTime,
      };
      results.errors.push({ source: 'Unified', error: error.message });
      console.error(`[TEST] ❌ Unified failed:`, error);
    }

    // Summary
    const totalTime = Date.now() - startTime;
    const successCount = Object.values(results.tests).filter((t: any) => t.success).length;
    const totalEvents = Object.values(results.tests)
      .filter((t: any) => t.success && t.eventCount)
      .reduce((sum: number, t: any) => sum + t.eventCount, 0);

    results.summary = {
      totalExecutionTime: totalTime,
      successCount,
      totalTests: Object.keys(results.tests).length,
      totalEvents,
      averageEventsPerSource: successCount > 0 ? Math.round(totalEvents / successCount) : 0,
      allSourcesWorking: successCount === Object.keys(results.tests).length,
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

function countByCurrency(events: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.currency] = (counts[e.currency] || 0) + 1;
  });
  return counts;
}

function countByImpact(events: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.impact] = (counts[e.impact] || 0) + 1;
  });
  return counts;
}

