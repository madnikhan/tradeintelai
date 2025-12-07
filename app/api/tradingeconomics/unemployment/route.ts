/**
 * Trading Economics Unemployment API Route
 * Proxies and parses unemployment rate data from Trading Economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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

    const url = `https://tradingeconomics.com/${country}/unemployment-rate`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn(`⚠️ Trading Economics unemployment fetch failed: ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data' },
        { status: response.status }
      );
    }

    const html = await response.text();

    // Parse unemployment rate from HTML
    const unemploymentMatch = html.match(/(?:unemployment\s*rate|unemployment)[:\s]*([\d.]+)\s*%/i);
    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);

    if (!unemploymentMatch) {
      const tableMatch = html.match(/<td[^>]*>([\d.]+)\s*%<\/td>/i);
      if (tableMatch) {
        const value = parseFloat(tableMatch[1]);
        return NextResponse.json({
          success: true,
          data: {
            value,
            date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
            change: null,
            changePercent: null,
          },
        });
      }

      logger.warn(`⚠️ Could not parse unemployment for ${currency}`);
      return NextResponse.json(
        { success: false, error: 'Could not parse unemployment' },
        { status: 500 }
      );
    }

    const value = parseFloat(unemploymentMatch[1]);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    return NextResponse.json({
      success: true,
      data: {
        value,
        date,
        change: null,
        changePercent: null,
      },
    });
  } catch (error: any) {
    logger.warn(`⚠️ Trading Economics unemployment error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

