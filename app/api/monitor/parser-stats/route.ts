import { NextRequest, NextResponse } from 'next/server';
import { ParserMonitor } from '@/lib/data-providers/parser-monitor';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Get parser performance statistics
 */
export async function GET(request: NextRequest) {
  try {
    const summary = ParserMonitor.getSummary();
    const health = ParserMonitor.getHealthStatus();
    const allStats = ParserMonitor.getAllStats();

    // Calculate success rates for each source
    const statsWithRates = Object.entries(allStats).map(([source, stats]) => ({
      ...stats,
      successRate: ParserMonitor.getSuccessRate(source),
      health: health.healthy.includes(source) 
        ? 'healthy' 
        : health.degraded.includes(source) 
        ? 'degraded' 
        : 'failing',
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary,
      health,
      sources: statsWithRates,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to get parser stats',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

