/**
 * Trading Economics Unemployment API Route
 * Proxies and parses unemployment rate data from Trading Economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';
import { logger } from '@/lib/logger';
import { validateEconomicData, isFallbackValue } from '@/lib/data-providers/data-validator';
import { ParserMonitor } from '@/lib/data-providers/parser-monitor';

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
  const authError = await requireApiAuth(request);
  if (authError) return authError;

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

    let usedFallback = false;
    let value: number;
    let date: string;

    if (!unemploymentMatch) {
      const tableMatch = html.match(/<td[^>]*>([\d.]+)\s*%<\/td>/i);
      if (tableMatch) {
        value = parseFloat(tableMatch[1]);
        date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
      } else {
        logger.warn(`⚠️ Could not parse unemployment for ${currency}. HTML length: ${html.length}`);
        // Return a default/fallback unemployment rate based on currency (for graceful degradation)
        const fallbackUnemployment: Record<string, number> = {
          USD: 3.7,
          EUR: 6.5,
          GBP: 4.2,
          JPY: 2.6,
          AUD: 3.8,
          CAD: 5.2,
          CHF: 2.1,
          NZD: 3.9,
        };
        value = fallbackUnemployment[currency] || 4.0;
        usedFallback = true;
        logger.warn(`⚠️ Using fallback unemployment rate for ${currency}: ${value}%`);
        ParserMonitor.recordFallbackUsage('tradingeconomics_unemployment', currency);
        date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    }
    } else {
      value = parseFloat(unemploymentMatch[1]);
      date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    }

    // Validate value range
    if (value < 0 || value > 30) {
      logger.warn(`⚠️ Unemployment value ${value}% is outside reasonable range for ${currency}`);
      // Use fallback if value is invalid
      const fallbackUnemployment: Record<string, number> = {
        USD: 3.7,
        EUR: 6.5,
        GBP: 4.2,
        JPY: 2.6,
        AUD: 3.8,
        CAD: 5.2,
        CHF: 2.1,
        NZD: 3.9,
      };
      value = fallbackUnemployment[currency] || 4.0;
      usedFallback = true;
      ParserMonitor.recordFallbackUsage('tradingeconomics_unemployment', currency);
    }

    // Validate data freshness and value range
    const validation = validateEconomicData(value, date, 'UNEMPLOYMENT', currency);
    
    // If validation failed but we have a value, still return it but log warnings
    if (!validation.isValid && !usedFallback) {
      logger.warn(`⚠️ Unemployment data validation failed for ${currency}:`, validation.warnings);
    }

    // Check if fallback value was used (even if parsing succeeded)
    if (!usedFallback && isFallbackValue(value, currency, 'UNEMPLOYMENT')) {
      usedFallback = true;
      ParserMonitor.recordFallbackUsage('tradingeconomics_unemployment', currency);
      logger.warn(`⚠️ Detected fallback value for ${currency} unemployment: ${value}%`);
    }

    return NextResponse.json({
      success: true,
      data: {
        value,
        date,
        change: null,
        changePercent: null,
        validation: {
          isValid: validation.isValid,
          isStale: validation.isStale,
          isOutOfRange: validation.isOutOfRange,
          confidence: validation.confidence,
          warnings: validation.warnings,
        },
        usedFallback,
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

