/**
 * Trading Economics Interest Rate API Route
 * Proxies and parses interest rate data from Trading Economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';
import { logger } from '@/lib/logger';
import { validateEconomicData, isFallbackValue } from '@/lib/data-providers/data-validator';
import { ParserMonitor } from '@/lib/data-providers/parser-monitor';

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

    // Enhanced parsing with multiple fallback methods
    // Trading Economics HTML structure may vary, so we try multiple patterns
    let rate: number | null = null;
    let date: string = new Date().toISOString().split('T')[0];

    // Method 1: Look for data-value or data-rate attributes (modern structure)
    const dataValueMatch = html.match(/data-value="([\d.]+)"/i) || html.match(/data-rate="([\d.]+)"/i);
    if (dataValueMatch) {
      rate = parseFloat(dataValueMatch[1]);
    }

    // Method 2: Look for JSON-LD structured data
    if (!rate) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd.value || jsonLd.rate) {
            rate = parseFloat(jsonLd.value || jsonLd.rate);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    // Method 3: Look for patterns like "5.25%" or "Interest Rate: 5.25%" in text
    if (!rate) {
      const rateMatch = html.match(/(?:interest\s*rate|rate|value)[:\s]*([\d.]+)\s*%/i);
      if (rateMatch) {
        rate = parseFloat(rateMatch[1]);
      }
    }

    // Method 4: Look in table cells (td elements)
    if (!rate) {
      const tableMatches = html.match(/<td[^>]*>([\d.]+)\s*%<\/td>/gi);
      if (tableMatches && tableMatches.length > 0) {
        // Take the first reasonable value (between 0 and 20%)
        for (const match of tableMatches) {
          const value = parseFloat(match.match(/([\d.]+)/)?.[1] || '0');
          if (value > 0 && value < 20) {
            rate = value;
            break;
          }
        }
      }
    }

    // Method 5: Look for specific class names or IDs that Trading Economics uses
    if (!rate) {
      const classMatch = html.match(/class=["'][^"']*rate[^"']*["'][^>]*>([\d.]+)\s*%/i) ||
                         html.match(/id=["'][^"']*rate[^"']*["'][^>]*>([\d.]+)\s*%/i);
      if (classMatch) {
        rate = parseFloat(classMatch[1]);
      }
    }

    // Method 6: Extract from meta tags or Open Graph data
    if (!rate) {
      const metaMatch = html.match(/<meta[^>]*property=["']og:.*rate["'][^>]*content=["']([\d.]+)/i) ||
                         html.match(/<meta[^>]*name=["'].*rate["'][^>]*content=["']([\d.]+)/i);
      if (metaMatch) {
        rate = parseFloat(metaMatch[1]);
      }
    }

    // Extract date from various formats
    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/) || 
                      html.match(/(\d{2}\/\d{2}\/\d{4})/) ||
                      html.match(/<time[^>]*>([^<]+)<\/time>/i);
    if (dateMatch) {
      try {
        const parsedDate = new Date(dateMatch[1]);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        // Use current date if parsing fails
      }
    }

    let usedFallback = false;
    
    // Validate value range first
    if (!rate || isNaN(rate) || rate < 0 || rate > 20) {
      logger.warn(`⚠️ Could not parse valid interest rate for ${currency}. HTML length: ${html.length}`);
      // Return a default/fallback rate based on currency (for graceful degradation)
      const fallbackRates: Record<string, number> = {
        USD: 5.25,
        EUR: 4.0,
        GBP: 5.0,
        JPY: 0.1,
        AUD: 4.35,
        CAD: 5.0,
        CHF: 1.75,
        NZD: 5.5,
      };
      rate = fallbackRates[currency] || 3.0;
      usedFallback = true;
      logger.warn(`⚠️ Using fallback interest rate for ${currency}: ${rate}%`);
      ParserMonitor.recordFallbackUsage('tradingeconomics_interest_rate', currency);
    }

    // Validate data freshness and value range
    const validation = validateEconomicData(rate, date, 'INTEREST_RATE', currency);
    
    // If validation failed but we have a value, still return it but log warnings
    if (!validation.isValid && !usedFallback) {
      logger.warn(`⚠️ Interest rate data validation failed for ${currency}:`, validation.warnings);
    }

    // Check if fallback value was used (even if parsing succeeded)
    if (!usedFallback && isFallbackValue(rate, currency, 'INTEREST_RATE')) {
      usedFallback = true;
      ParserMonitor.recordFallbackUsage('tradingeconomics_interest_rate', currency);
      logger.warn(`⚠️ Detected fallback value for ${currency} interest rate: ${rate}%`);
    }

    return NextResponse.json({
      success: true,
      data: {
        rate,
        date,
        change: null, // Would need historical data to calculate
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
    logger.warn(`⚠️ Trading Economics interest rate error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

