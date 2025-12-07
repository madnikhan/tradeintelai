/**
 * Trading Economics Interest Rate API Route
 * Proxies and parses interest rate data from Trading Economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Currency to Trading Economics country code mapping
const CURRENCY_COUNTRY_MAP: Record<string, string> = {
  USD: 'united-states',
  EUR: 'euro-area',
  GBP: 'united-kingdom',
  JPY: 'japan',
  AUD: 'australia',
  CAD: 'canada',
  CHF: 'switzerland',
  NZD: 'new-zealand',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const currency = searchParams.get('currency')?.toUpperCase() || 'USD';

  try {
    const country = CURRENCY_COUNTRY_MAP[currency];
    if (!country) {
      return NextResponse.json(
        { success: false, error: `Unsupported currency: ${currency}` },
        { status: 400 }
      );
    }

    // Trading Economics interest rate page
    const url = `https://tradingeconomics.com/${country}/interest-rate`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn(`⚠️ Trading Economics interest rate fetch failed: ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data' },
        { status: response.status }
      );
    }

    const html = await response.text();

    // Parse interest rate from HTML
    // Trading Economics displays rate in a specific format
    // Look for patterns like: "5.25%" or "Interest Rate: 5.25%"
    const rateMatch = html.match(/(?:interest\s*rate|rate)[:\s]*([\d.]+)\s*%/i);
    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);

    if (!rateMatch) {
      // Try alternative parsing methods
      const tableMatch = html.match(/<td[^>]*>([\d.]+)\s*%<\/td>/i);
      if (tableMatch) {
        const rate = parseFloat(tableMatch[1]);
        return NextResponse.json({
          success: true,
          data: {
            rate,
            date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
            change: null,
          },
        });
      }

      logger.warn(`⚠️ Could not parse interest rate for ${currency}`);
      return NextResponse.json(
        { success: false, error: 'Could not parse interest rate' },
        { status: 500 }
      );
    }

    const rate = parseFloat(rateMatch[1]);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    return NextResponse.json({
      success: true,
      data: {
        rate,
        date,
        change: null, // Would need historical data to calculate
      },
    });
  } catch (error: any) {
    logger.warn(`⚠️ Trading Economics interest rate error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

