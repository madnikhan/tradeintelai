import { NextResponse } from 'next/server';

/**
 * Lightweight TE health ping — does not scrape CPI or run validation.
 * Used by SystemStatus instead of /api/tradingeconomics/cpi on every poll.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Trading Economics routes configured',
  });
}
