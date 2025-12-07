import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Proxy Trading Economics economic calendar
 * Server-side fetch bypasses CORS restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('[API] Fetching Trading Economics economic calendar...');

    // Trading Economics economic calendar URL
    const url = `https://tradingeconomics.com/calendar`;

    // Fetch page server-side (no CORS issues)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://tradingeconomics.com/',
      },
      next: { revalidate: 1800 }, // Cache for 30 minutes
    });

    if (!response.ok) {
      console.error(`[API] Trading Economics error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { success: false, error: `Trading Economics error: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    console.log(`[API] Trading Economics fetched: ${html.length} bytes`);

    return NextResponse.json({
      success: true,
      html,
      date,
    });
  } catch (error: any) {
    console.error('[API] Trading Economics fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Trading Economics economic calendar',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

