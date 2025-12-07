/**
 * ForexFactory RSS Economic Calendar Provider
 * Free, unlimited economic calendar data from RSS feeds
 * Replaces Finnhub for economic calendar
 */

import { EconomicEvent } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';

const RSS_URL = 'https://www.forexfactory.com/calendar.php?week=today&format=rss';

interface ForexFactoryRSSItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
}

export class ForexFactoryRSSProvider {
  private static cache: Map<string, { data: EconomicEvent[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 3600000; // 1 hour cache (economic calendar doesn't change frequently)

  /**
   * Parse RSS feed and extract economic events
   */
  private static parseRSSFeed(xmlText: string): EconomicEvent[] {
    const events: EconomicEvent[] = [];
    
    try {
      // Simple XML parsing (for production, consider using a proper XML parser)
      const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
      
      for (const match of itemMatches) {
        const itemXml = match[1];
        
        // Extract title
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        if (!titleMatch) continue;
        
        const title = titleMatch[1].trim();
        
        // Extract description
        const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract pubDate
        const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
        
        // Extract link
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? linkMatch[1] : '';
        
        // Parse event details from title/description
        // Format: "Event Name | Country | Impact | Time"
        const event = this.parseEventDetails(title, description, pubDate, link);
        if (event) {
          events.push(event);
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error parsing ForexFactory RSS:', error);
    }
    
    return events;
  }

  /**
   * Parse event details from RSS item
   * Enhanced to extract more information from description
   */
  private static parseEventDetails(
    title: string,
    description: string,
    date: Date,
    link: string
  ): EconomicEvent | null {
    try {
      // ForexFactory format: "Event Name | Country | Impact | Time"
      // Example: "GDP Growth Rate | US | High | 13:30"
      
      const parts = title.split('|').map(p => p.trim());
      if (parts.length < 3) {
        // Try parsing from description if title format is different
        return this.parseFromDescription(title, description, date, link);
      }
      
      const eventName = parts[0];
      const country = parts[1];
      const impact = parts[2]?.toUpperCase() || 'MEDIUM';
      const time = parts[3] || '';
      
      // Parse time if provided
      let eventDate = date;
      if (time) {
        const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          eventDate = new Date(date);
          eventDate.setHours(hours, minutes, 0, 0);
          
          // If time is in the past, assume it's tomorrow
          if (eventDate < new Date()) {
            eventDate.setDate(eventDate.getDate() + 1);
          }
        }
      }
      
      // Map country to currency
      const countryToCurrency: Record<string, string> = {
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
      };
      
      const currency = countryToCurrency[country] || 'USD';
      
      // Map impact (ForexFactory uses color indicators)
      let impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (impact.includes('HIGH') || impact.includes('RED') || impact === '3') {
        impactLevel = 'HIGH';
      } else if (impact.includes('LOW') || impact.includes('GREEN') || impact === '1') {
        impactLevel = 'LOW';
      }
      
      // Try to extract actual/forecast/previous from description
      const { actual, forecast, previous } = this.extractValues(description);
      
      return {
        id: `ff_${eventDate.getTime()}_${eventName.replace(/\s+/g, '_').substring(0, 50)}`,
        title: eventName,
        country,
        impact: impactLevel,
        date: eventDate,
        currency,
        category: 'Economic',
        actual,
        forecast,
        previous,
      };
    } catch (error) {
      logger.warn('⚠️ Error parsing event details:', error);
      return null;
    }
  }

  /**
   * Parse event from description if title format is different
   */
  private static parseFromDescription(
    title: string,
    description: string,
    date: Date,
    link: string
  ): EconomicEvent | null {
    try {
      // Try to extract event info from description HTML
      const eventMatch = description.match(/<b>([^<]+)<\/b>/i);
      const eventName = eventMatch ? eventMatch[1].trim() : title;
      
      // Extract country from description or link
      const countryMatch = description.match(/Country:\s*([A-Z]{2})/i) ||
                          link.match(/country=([A-Z]{2})/i);
      const country = countryMatch ? countryMatch[1] : 'US';
      
      // Extract impact
      const impactMatch = description.match(/Impact:\s*(High|Medium|Low)/i);
      let impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (impactMatch) {
        const impact = impactMatch[1].toUpperCase();
        if (impact.includes('HIGH')) impactLevel = 'HIGH';
        else if (impact.includes('LOW')) impactLevel = 'LOW';
      }
      
      const countryToCurrency: Record<string, string> = {
        'US': 'USD', 'EU': 'EUR', 'UK': 'GBP', 'GB': 'GBP',
        'JP': 'JPY', 'AU': 'AUD', 'CA': 'CAD', 'CH': 'CHF', 'NZ': 'NZD',
      };
      
      const currency = countryToCurrency[country] || 'USD';
      const { actual, forecast, previous } = this.extractValues(description);
      
      return {
        id: `ff_${date.getTime()}_${eventName.replace(/\s+/g, '_').substring(0, 50)}`,
        title: eventName,
        country,
        impact: impactLevel,
        date,
        currency,
        category: 'Economic',
        actual,
        forecast,
        previous,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract actual, forecast, previous values from description
   */
  private static extractValues(description: string): {
    actual?: number;
    forecast?: number;
    previous?: number;
  } {
    const result: { actual?: number; forecast?: number; previous?: number } = {};
    
    // Look for patterns like "Actual: 2.5%", "Forecast: 2.3%", "Previous: 2.1%"
    const actualMatch = description.match(/Actual[:\s]+([\d.+-]+)/i);
    const forecastMatch = description.match(/Forecast[:\s]+([\d.+-]+)/i);
    const previousMatch = description.match(/Previous[:\s]+([\d.+-]+)/i);
    
    if (actualMatch) {
      const num = parseFloat(actualMatch[1].replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) result.actual = num;
    }
    
    if (forecastMatch) {
      const num = parseFloat(forecastMatch[1].replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) result.forecast = num;
    }
    
    if (previousMatch) {
      const num = parseFloat(previousMatch[1].replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) result.previous = num;
    }
    
    return result;
  }

  /**
   * Get economic calendar events from ForexFactory RSS
   */
  static async getEconomicCalendar(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EconomicEvent[]> {
    const cacheKey = 'economic_calendar_ff';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const startTime = Date.now();
    try {
      // Fetch RSS feed via Next.js API route (bypasses CORS)
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate.toISOString());
      if (toDate) params.append('to', toDate.toISOString());
      
      const apiUrl = `/api/rss/economic-calendar${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('ForexFactory', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ ForexFactory RSS API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.success || !data.xml) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('ForexFactory', false, executionTime, 0, 'No data returned');
        logger.warn(`⚠️ ForexFactory RSS API returned no data: ${JSON.stringify(data)}`);
        return [];
      }

      const xmlText = data.xml;
      logger.debug(`✅ ForexFactory RSS API: Received ${xmlText.length} bytes of XML`);
      const events = this.parseRSSFeed(xmlText);

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
      ParserMonitor.recordExecution('ForexFactory', true, executionTime, filteredEvents.length);

      this.cache.set(cacheKey, { data: filteredEvents, timestamp: Date.now() });
      logger.debug(`✅ ForexFactory RSS: Loaded ${filteredEvents.length} economic events in ${executionTime}ms`);
      
      return filteredEvents;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('ForexFactory', false, executionTime, 0, error.message);
      logger.warn('⚠️ ForexFactory RSS getEconomicCalendar error:', error);
      return [];
    }
  }
}

