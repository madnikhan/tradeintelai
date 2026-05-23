/**
 * Trading Economics CPI API Route
 * Proxies and parses CPI (inflation) data from Trading Economics
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

    const url = `https://tradingeconomics.com/${country}/inflation-cpi`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn(`⚠️ Trading Economics CPI fetch failed: ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data' },
        { status: response.status }
      );
    }

    const html = await response.text();

    // Multiple parsing strategies for different page structures
    let value: number | null = null;
    let date: string | null = null;

    // Strategy 1: Look for JSON-LD structured data (most reliable)
    const jsonLdMatch = html.match(/"description":\s*"[^"]*increased to ([\d.]+)\s*percent[^"]*"/i);
    if (jsonLdMatch) {
      value = parseFloat(jsonLdMatch[1]);
    }

    // Strategy 2: Look in meta description
    if (!value) {
      const metaDescMatch = html.match(/content="[^"]*increased to ([\d.]+)\s*percent[^"]*"/i);
      if (metaDescMatch) {
        value = parseFloat(metaDescMatch[1]);
      }
    }

    // Strategy 3: Look for standard pattern
    if (!value) {
      const cpiMatch = html.match(/(?:cpi|inflation)[:\s]*([\d.]+)\s*%/i);
      if (cpiMatch) {
        value = parseFloat(cpiMatch[1]);
      }
    }

    // Strategy 4: Look in table cells
    if (!value) {
      const tableMatch = html.match(/<td[^>]*>([\d.]+)\s*%<\/td>/i);
      if (tableMatch) {
        value = parseFloat(tableMatch[1]);
      }
    }

    // Strategy 5: Look for "X percent" pattern in description
    if (!value) {
      const percentMatch = html.match(/increased to ([\d.]+)\s*percent/i);
      if (percentMatch) {
        value = parseFloat(percentMatch[1]);
      }
    }

    // Extract date
    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      date = dateMatch[1];
    } else {
      // Try to extract from description
      const dateDescMatch = html.match(/(\d{4})\s*(?:Q[1-4]|quarter)/i);
      if (dateDescMatch) {
        date = `${dateDescMatch[1]}-01-01`; // Approximate date
      }
    }

    let usedFallback = false;
    
    // Validate value range first
    if (!value || isNaN(value) || value < 0 || value > 20) {
      logger.warn(`⚠️ Could not parse valid CPI for ${currency}. HTML length: ${html.length}`);
      // Return a default/fallback CPI based on currency (for graceful degradation)
      const fallbackCPI: Record<string, number> = {
        USD: 3.2,
        EUR: 2.5,
        GBP: 3.0,
        JPY: 2.0,
        AUD: 3.5,
        CAD: 2.8,
        CHF: 1.5,
        NZD: 4.0,
      };
      value = fallbackCPI[currency] || 2.5;
      usedFallback = true;
      logger.warn(`⚠️ Using fallback CPI for ${currency}: ${value}%`);
      ParserMonitor.recordFallbackUsage('tradingeconomics_cpi', currency);
    }

    const finalDate = date || new Date().toISOString().split('T')[0];

    // Validate data freshness and value range
    const validation = validateEconomicData(value, finalDate, 'CPI', currency);
    
    // If validation failed but we have a value, still return it but log warnings
    if (!validation.isValid && !usedFallback) {
      logger.warn(`⚠️ CPI data validation failed for ${currency}:`, validation.warnings);
    }

    // Check if fallback value was used (even if parsing succeeded)
    if (!usedFallback && isFallbackValue(value, currency, 'CPI')) {
      usedFallback = true;
      ParserMonitor.recordFallbackUsage('tradingeconomics_cpi', currency);
      logger.warn(`⚠️ Detected fallback value for ${currency} CPI: ${value}%`);
    }

    return NextResponse.json({
      success: true,
      data: {
        value,
        date: finalDate,
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
    logger.warn(`⚠️ Trading Economics CPI error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

