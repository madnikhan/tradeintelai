import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

const RSS_URL = 'https://www.forexfactory.com/calendar.php?week=today&format=rss';

/**
 * Proxy RSS feed for economic calendar
 * Server-side fetch bypasses CORS restrictions
 */
export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    console.log('[API] Fetching ForexFactory RSS economic calendar...');

    // Fetch RSS feed server-side (no CORS issues)
    const response = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradeIntelAI/1.0)',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`[API] ForexFactory RSS error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { success: false, error: `RSS feed error: ${response.status}` },
        { status: response.status }
      );
    }

    const xmlText = await response.text();
    console.log(`[API] ForexFactory RSS fetched: ${xmlText.length} bytes`);

    return NextResponse.json({
      success: true,
      xml: xmlText,
      fromDate,
      toDate,
    });
  } catch (error: any) {
    console.error('[API] ForexFactory RSS fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch economic calendar RSS',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

