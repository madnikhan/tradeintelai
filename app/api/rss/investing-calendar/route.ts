import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Proxy Investing.com economic calendar
 * Server-side fetch bypasses CORS restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('[API] Fetching Investing.com economic calendar...');

    // Investing.com economic calendar URL
    // Format: https://www.investing.com/economic-calendar/
    const url = `https://www.investing.com/economic-calendar/`;

    // Fetch page server-side (no CORS issues)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.investing.com/',
      },
      next: { revalidate: 1800 }, // Cache for 30 minutes
    });

    if (!response.ok) {
      console.error(`[API] Investing.com error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { success: false, error: `Investing.com error: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    console.log(`[API] Investing.com fetched: ${html.length} bytes`);

    return NextResponse.json({
      success: true,
      html,
      date,
    });
  } catch (error: any) {
    console.error('[API] Investing.com fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Investing.com economic calendar',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

