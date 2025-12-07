/**
 * Investing.com Economic Calendar Provider
 * Parses economic calendar events from Investing.com
 */

import { EconomicEvent } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';

export class InvestingCalendarProvider {
  private static cache: Map<string, { data: EconomicEvent[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 1800000; // 30 minutes cache

  /**
   * Parse HTML and extract economic events
   */
  private static parseHTML(html: string): EconomicEvent[] {
    const events: EconomicEvent[] = [];
    
    try {
      // Investing.com uses a table structure for economic calendar
      // We'll use regex to extract event data from the HTML
      
      // Pattern: Look for table rows with event data
      // The structure typically includes: time, country, event, impact, actual, forecast, previous
      const eventRowPattern = /<tr[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
      const rows = html.matchAll(eventRowPattern);
      
      for (const rowMatch of rows) {
        const rowHtml = rowMatch[1];
        
        // Extract time
        const timeMatch = rowHtml.match(/<td[^>]*class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const timeStr = timeMatch ? timeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        
        // Extract country flag/code
        const countryMatch = rowHtml.match(/<td[^>]*class="[^"]*flag[^"]*"[^>]*>[\s\S]*?<span[^>]*>([A-Z]{2})<\/span>/i) ||
                            rowHtml.match(/data-country="([^"]+)"/i);
        const countryCode = countryMatch ? countryMatch[1].toUpperCase() : '';
        
        // Extract event name
        const eventMatch = rowHtml.match(/<td[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                          rowHtml.match(/<td[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const eventName = eventMatch ? eventMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        
        // Extract impact (bull icon = high, etc.)
        const impactMatch = rowHtml.match(/<td[^>]*class="[^"]*sentiment[^"]*"[^>]*>[\s\S]*?bull[^"]*"/i) ||
                           rowHtml.match(/data-img_key="bull(\d)"/i);
        const impactLevel = this.parseImpact(impactMatch, rowHtml);
        
        // Extract actual, forecast, previous values
        const actualMatch = rowHtml.match(/<td[^>]*class="[^"]*actual[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const forecastMatch = rowHtml.match(/<td[^>]*class="[^"]*forecast[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const previousMatch = rowHtml.match(/<td[^>]*class="[^"]*previous[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        
        const actual = actualMatch ? this.parseNumber(actualMatch[1]) : undefined;
        const forecast = forecastMatch ? this.parseNumber(forecastMatch[1]) : undefined;
        const previous = previousMatch ? this.parseNumber(previousMatch[1]) : undefined;
        
        if (!eventName || !countryCode) continue;
        
        // Parse date/time
        const eventDate = this.parseDateTime(timeStr);
        
        // Map country to currency
        const currency = this.countryToCurrency(countryCode);
        
        const event: EconomicEvent = {
          id: `investing_${eventDate.getTime()}_${eventName.replace(/\s+/g, '_').substring(0, 50)}`,
          title: eventName,
          country: countryCode,
          impact: impactLevel,
          date: eventDate,
          currency,
          category: 'Economic',
          actual,
          forecast,
          previous,
        };
        
        events.push(event);
      }
    } catch (error) {
      logger.warn('⚠️ Error parsing Investing.com HTML:', error);
    }
    
    return events;
  }

  /**
   * Parse impact level from HTML
   */
  private static parseImpact(impactMatch: RegExpMatchArray | null, rowHtml: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (impactMatch) {
      const bullCount = impactMatch[1] ? parseInt(impactMatch[1]) : 0;
      if (bullCount >= 3) return 'HIGH';
      if (bullCount >= 2) return 'MEDIUM';
      return 'LOW';
    }
    
    // Fallback: check for high/medium/low keywords
    if (rowHtml.match(/high|red|bull3/gi)) return 'HIGH';
    if (rowHtml.match(/low|green|bull1/gi)) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Parse number from string (handles formatting)
   */
  private static parseNumber(str: string): number | undefined {
    if (!str) return undefined;
    const cleaned = str.replace(/<[^>]+>/g, '').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Parse date/time string
   */
  private static parseDateTime(timeStr: string): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Try to parse time (format: "HH:MM" or "HH:MM AM/PM")
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3]?.toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const eventDate = new Date(today);
      eventDate.setHours(hours, minutes, 0, 0);
      
      // If time is in the past, assume it's tomorrow
      if (eventDate < now) {
        eventDate.setDate(eventDate.getDate() + 1);
      }
      
      return eventDate;
    }
    
    return now;
  }

  /**
   * Map country code to currency
   */
  private static countryToCurrency(countryCode: string): string {
    const mapping: Record<string, string> = {
      'US': 'USD',
      'EU': 'EUR',
      'UK': 'GBP',
      'GB': 'GBP',
      'JP': 'JPY',
      'AU': 'AUD',
      'CA': 'CAD',
      'CH': 'CHF',
      'NZ': 'NZD',
      'DE': 'EUR',
      'FR': 'EUR',
      'IT': 'EUR',
      'ES': 'EUR',
      'CN': 'CNY',
      'IN': 'INR',
      'BR': 'BRL',
      'MX': 'MXN',
      'ZA': 'ZAR',
      'KR': 'KRW',
      'SG': 'SGD',
    };
    
    return mapping[countryCode] || 'USD';
  }

  /**
   * Get economic calendar events from Investing.com
   */
  static async getEconomicCalendar(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EconomicEvent[]> {
    const cacheKey = 'economic_calendar_investing';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const startTime = Date.now();
    try {
      // Fetch HTML via Next.js API route (bypasses CORS)
      const apiUrl = '/api/rss/investing-calendar';
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('Investing.com', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ Investing.com API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.success || !data.html) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('Investing.com', false, executionTime, 0, 'No data returned');
        logger.warn(`⚠️ Investing.com API returned no data`);
        return [];
      }

      const html = data.html;
      logger.debug(`✅ Investing.com API: Received ${html.length} bytes of HTML`);
      const events = this.parseHTML(html);

      // Filter by date range if provided
      let filteredEvents = events;
      if (fromDate) {
        filteredEvents = filteredEvents.filter(e => e.date >= fromDate);
      }
      if (toDate) {
        filteredEvents = filteredEvents.filter(e => e.date <= toDate);
      }

      // Filter for major currencies only
      const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
      filteredEvents = filteredEvents.filter(e => majorCurrencies.includes(e.currency));

      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('Investing.com', true, executionTime, filteredEvents.length);

      this.cache.set(cacheKey, { data: filteredEvents, timestamp: Date.now() });
      logger.debug(`✅ Investing.com: Loaded ${filteredEvents.length} economic events in ${executionTime}ms`);
      
      return filteredEvents;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('Investing.com', false, executionTime, 0, error.message);
      logger.warn('⚠️ Investing.com getEconomicCalendar error:', error);
      return [];
    }
  }
}

