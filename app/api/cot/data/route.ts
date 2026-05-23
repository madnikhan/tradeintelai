import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Proxy COT data from CFTC API
 * Server-side fetch bypasses CORS restrictions
 */
export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'EUR';
    const weeks = parseInt(searchParams.get('weeks') || '52');
    const endpoint = searchParams.get('endpoint') || 'legacy'; // 'legacy' or 'tff'

    console.log(`[API] Fetching COT data for ${currency} (${weeks} weeks, ${endpoint} endpoint)...`);

    // CFTC Socrata API endpoints
    const CFTC_API_BASE = 'https://publicreporting.cftc.gov/resource';
    const LEGACY_FUTURES_ENDPOINT = '6dca-aqww.json';
    const TFF_ENDPOINT = 'gpe5-46if.json';

    // Contract codes
    const FOREX_CONTRACTS: Record<string, { name: string; code: string }> = {
      'EUR': { name: 'EUROPEAN CURRENCY UNIT', code: '099741' },
      'GBP': { name: 'POUND STERLING', code: '096742' },
      'JPY': { name: 'JAPANESE YEN', code: '097741' },
      'AUD': { name: 'AUSTRALIAN DOLLAR', code: '232741' },
      'CAD': { name: 'CANADIAN DOLLAR', code: '090741' },
      'CHF': { name: 'SWISS FRANC', code: '092741' },
    };

    const contract = FOREX_CONTRACTS[currency.toUpperCase()];
    if (!contract) {
      return NextResponse.json(
        { success: false, error: `No CFTC contract mapping for ${currency}` },
        { status: 400 }
      );
    }

    const selectedEndpoint = endpoint === 'tff' ? TFF_ENDPOINT : LEGACY_FUTURES_ENDPOINT;
    const url = new URL(`${CFTC_API_BASE}/${selectedEndpoint}`);
    url.searchParams.set('$limit', weeks.toString());
    url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
    url.searchParams.set('cftc_contract_market_code', contract.code);

    // Fetch from CFTC API (server-side, no CORS issues)
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradeIntelAI/1.0)',
      },
      next: { revalidate: 21600 }, // Cache for 6 hours (COT updates weekly)
    });

    if (!response.ok) {
      console.error(`[API] CFTC API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { success: false, error: `CFTC API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API] CFTC API fetched: ${Array.isArray(data) ? data.length : 0} records`);

    return NextResponse.json({
      success: true,
      currency,
      contract: contract.name,
      contractCode: contract.code,
      endpoint: selectedEndpoint,
      recordCount: Array.isArray(data) ? data.length : 0,
      data: data,
    });
  } catch (error: any) {
    console.error('[API] COT data fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch COT data',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

