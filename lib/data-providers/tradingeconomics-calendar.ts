/**
 * Trading Economics Economic Calendar Provider
 * Parses economic calendar events from Trading Economics
 */

import { EconomicEvent } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';

export class TradingEconomicsCalendarProvider {
  private static cache: Map<string, { data: EconomicEvent[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 1800000; // 30 minutes cache

  /**
   * Parse HTML and extract economic events
   */
  private static parseHTML(html: string): EconomicEvent[] {
    const events: EconomicEvent[] = [];
    
    try {
      // Trading Economics uses a calendar table structure
      // Look for event rows in the calendar
      
      // Pattern: Look for calendar event entries
      const eventPattern = /<tr[^>]*data-event-id="[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
      const rows = html.matchAll(eventPattern);
      
      for (const rowMatch of rows) {
        const rowHtml = rowMatch[1];
        
        // Extract event ID
        const eventIdMatch = rowHtml.match(/data-event-id="([^"]+)"/i);
        const eventId = eventIdMatch ? eventIdMatch[1] : '';
        
        // Extract time
        const timeMatch = rowHtml.match(/<td[^>]*class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/td>/i) ||
                         rowHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
        const timeStr = timeMatch ? timeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        
        // Extract country
        const countryMatch = rowHtml.match(/<td[^>]*class="[^"]*country[^"]*"[^>]*>[\s\S]*?<span[^>]*>([A-Z]{2})<\/span>/i) ||
                            rowHtml.match(/data-country="([^"]+)"/i) ||
                            rowHtml.match(/<img[^>]*alt="([^"]+)"[^>]*>/i);
        const countryCode = countryMatch ? this.extractCountryCode(countryMatch[1]) : '';
        
        // Extract event name
        const eventMatch = rowHtml.match(/<td[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                          rowHtml.match(/<td[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const eventName = eventMatch ? eventMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        
        // Extract impact
        const impactMatch = rowHtml.match(/<td[^>]*class="[^"]*importance[^"]*"[^>]*>[\s\S]*?(\d)[\s\S]*?<\/td>/i);
        const impactLevel = this.parseImpact(impactMatch, rowHtml);
        
        // Extract actual, forecast, previous
        const actualMatch = rowHtml.match(/<td[^>]*class="[^"]*actual[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const forecastMatch = rowHtml.match(/<td[^>]*class="[^"]*forecast[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const previousMatch = rowHtml.match(/<td[^>]*class="[^"]*previous[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        
        const actual = actualMatch ? this.parseNumber(actualMatch[1]) : undefined;
        const forecast = forecastMatch ? this.parseNumber(forecastMatch[1]) : undefined;
        const previous = previousMatch ? this.parseNumber(previousMatch[1]) : undefined;
        
        if (!eventName || !countryCode) continue;
        
        // Parse date/time
        const eventDate = this.parseDateTime(timeStr, html);
        
        // Map country to currency
        const currency = this.countryToCurrency(countryCode);
        
        const event: EconomicEvent = {
          id: `te_${eventId || eventDate.getTime()}_${eventName.replace(/\s+/g, '_').substring(0, 50)}`,
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
      
      // Alternative: Try to parse from JSON data if embedded in page
      const jsonDataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (jsonDataMatch && events.length === 0) {
        try {
          const jsonData = JSON.parse(jsonDataMatch[1]);
          // Parse events from JSON structure if available
          // This depends on Trading Economics' internal data structure
        } catch (e) {
          // JSON parsing failed, continue with HTML parsing
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error parsing Trading Economics HTML:', error);
    }
    
    return events;
  }

  /**
   * Extract country code from various formats
   */
  private static extractCountryCode(input: string): string {
    // If it's already a 2-letter code
    if (/^[A-Z]{2}$/i.test(input)) {
      return input.toUpperCase();
    }
    
    // Map country names to codes
    const countryMap: Record<string, string> = {
      'united states': 'US',
      'eurozone': 'EU',
      'united kingdom': 'GB',
      'japan': 'JP',
      'australia': 'AU',
      'canada': 'CA',
      'switzerland': 'CH',
      'new zealand': 'NZ',
      'germany': 'DE',
      'france': 'FR',
      'italy': 'IT',
      'spain': 'ES',
    };
    
    const lower = input.toLowerCase();
    return countryMap[lower] || 'US';
  }

  /**
   * Parse impact level
   */
  private static parseImpact(impactMatch: RegExpMatchArray | null, rowHtml: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (impactMatch) {
      const level = parseInt(impactMatch[1]);
      if (level >= 3) return 'HIGH';
      if (level >= 2) return 'MEDIUM';
      return 'LOW';
    }
    
    // Fallback: check for keywords
    if (rowHtml.match(/high|red|3/gi)) return 'HIGH';
    if (rowHtml.match(/low|green|1/gi)) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Parse number from string
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
  private static parseDateTime(timeStr: string, html: string): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Try to extract date from page if available
    const dateMatch = html.match(/data-date="([^"]+)"/) || 
                     html.match(/calendar-date[^>]*>([\d-]+)</);
    const dateStr = dateMatch ? dateMatch[1] : '';
    
    // Try to parse time
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      const eventDate = dateStr ? new Date(dateStr) : new Date(today);
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
   * Get economic calendar events from Trading Economics
   */
  static async getEconomicCalendar(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EconomicEvent[]> {
    const cacheKey = 'economic_calendar_te';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const startTime = Date.now();
    try {
      // Fetch HTML via Next.js API route (bypasses CORS)
      const apiUrl = '/api/rss/tradingeconomics-calendar';
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('Trading Economics', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ Trading Economics API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.success || !data.html) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('Trading Economics', false, executionTime, 0, 'No data returned');
        logger.warn(`⚠️ Trading Economics API returned no data`);
        return [];
      }

      const html = data.html;
      logger.debug(`✅ Trading Economics API: Received ${html.length} bytes of HTML`);
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
      ParserMonitor.recordExecution('Trading Economics', true, executionTime, filteredEvents.length);

      this.cache.set(cacheKey, { data: filteredEvents, timestamp: Date.now() });
      logger.debug(`✅ Trading Economics: Loaded ${filteredEvents.length} economic events in ${executionTime}ms`);
      
      return filteredEvents;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('Trading Economics', false, executionTime, 0, error.message);
      logger.warn('⚠️ Trading Economics getEconomicCalendar error:', error);
      return [];
    }
  }
}

