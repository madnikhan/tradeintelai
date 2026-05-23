import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Test endpoint to fetch raw HTML/XML from sources
 * Useful for debugging parser issues
 */
export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'all';

  const results: any = {
    timestamp: new Date().toISOString(),
    sources: {},
  };

  try {
    // Fetch ForexFactory RSS
    if (source === 'all' || source === 'forexfactory') {
      try {
        const ffResponse = await fetch('https://www.forexfactory.com/calendar.php?week=today&format=rss', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TradeIntelAI/1.0)',
          },
        });
        const ffText = await ffResponse.text();
        results.sources.forexfactory = {
          success: ffResponse.ok,
          status: ffResponse.status,
          contentType: ffResponse.headers.get('content-type'),
          size: ffText.length,
          preview: ffText.substring(0, 2000), // First 2000 chars
          itemCount: (ffText.match(/<item>/g) || []).length,
        };
      } catch (error: any) {
        results.sources.forexfactory = {
          success: false,
          error: error.message,
        };
      }
    }

    // Fetch Investing.com
    if (source === 'all' || source === 'investing') {
      try {
        const investingResponse = await fetch('https://www.investing.com/economic-calendar/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        const investingText = await investingResponse.text();
        results.sources.investing = {
          success: investingResponse.ok,
          status: investingResponse.status,
          contentType: investingResponse.headers.get('content-type'),
          size: investingText.length,
          preview: investingText.substring(0, 2000), // First 2000 chars
          hasTable: investingText.includes('<table'),
          hasEventClass: investingText.includes('event'),
          hasTimeClass: investingText.includes('time'),
        };
      } catch (error: any) {
        results.sources.investing = {
          success: false,
          error: error.message,
        };
      }
    }

    // Fetch Trading Economics
    if (source === 'all' || source === 'tradingeconomics') {
      try {
        const teResponse = await fetch('https://tradingeconomics.com/calendar', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        const teText = await teResponse.text();
        results.sources.tradingeconomics = {
          success: teResponse.ok,
          status: teResponse.status,
          contentType: teResponse.headers.get('content-type'),
          size: teText.length,
          preview: teText.substring(0, 2000), // First 2000 chars
          hasTable: teText.includes('<table'),
          hasEventId: teText.includes('data-event-id'),
          hasTimeClass: teText.includes('time'),
        };
      } catch (error: any) {
        results.sources.tradingeconomics = {
          success: false,
          error: error.message,
        };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        ...results,
        fatalError: error.message,
      },
      { status: 500 }
    );
  }
}

