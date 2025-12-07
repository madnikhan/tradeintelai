/**
 * Finnhub API Integration
 * Provides economic calendar, market news, and sentiment data
 */

import { EconomicEvent } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';
import { callProxyAPI } from '@/lib/api-proxy-client';


interface FinnhubCalendarEvent {
  country: string;
  actual: number | null;
  estimate: number | null;
  event: string;
  impact: string;
  prev: number | null;
  time: string;
  unit: string;
}

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface FinnhubSentiment {
  buzz: {
    articlesInLastWeek: number;
    weeklyAverage: number;
    buzz: number;
  };
  sentiment: {
    bullishPercent: number;
    bearishPercent: number;
  };
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  symbol: string;
}

export class FinnhubProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 300000; // 5 minute cache for calendar

  /**
   * Get economic calendar events
   */
  static async getEconomicCalendar(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EconomicEvent[]> {
    const cacheKey = 'economic_calendar';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const from = fromDate || new Date();
      const to = toDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
      
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      
      const response = await callProxyAPI('finnhub', 'calendar/economic', {
        from: fromStr,
        to: toStr,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('⚠️ Finnhub API: Authentication required. Please sign in.');
        } else if (response.status === 403) {
          logger.warn('⚠️ Finnhub API: 403 Forbidden - API key may be invalid or expired. Please check your environment variables.');
        } else if (response.status === 429) {
          logger.warn('⚠️ Finnhub API: 429 Too Many Requests - Rate limit exceeded. Consider reducing scan frequency or upgrading API plan.');
        } else {
          logger.warn(`⚠️ Finnhub API error: ${response.status} ${response.statusText}`);
        }
        return [];
      }
      
      const data = await response.json();
      
      if (!data.economicCalendar) {
        return [];
      }
      
      const events: EconomicEvent[] = data.economicCalendar.map((event: FinnhubCalendarEvent, index: number) => ({
        id: `finnhub_${index}_${event.time}`,
        title: event.event,
        country: event.country,
        impact: this.mapImpact(event.impact),
        date: new Date(event.time),
        currency: this.countryToCurrency(event.country),
        category: 'Economic',
        actual: event.actual || undefined,
        forecast: event.estimate || undefined,
        previous: event.prev || undefined,
      }));
      
      // Filter for high impact events affecting major currencies
      const filteredEvents = events.filter(e => 
        ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'].includes(e.currency)
      );
      
      this.cache.set(cacheKey, { data: filteredEvents, timestamp: Date.now() });
      logger.debug(`✅ Finnhub: Loaded ${filteredEvents.length} economic events`);
      
      return filteredEvents;
    } catch (error) {
      logger.warn('⚠️ Finnhub getEconomicCalendar error:', error);
      return [];
    }
  }

  /**
   * Get market news
   */
  static async getMarketNews(category: 'general' | 'forex' | 'crypto' = 'forex'): Promise<FinnhubNews[]> {
    try {
      const response = await callProxyAPI('finnhub', 'news', {
        category,
      });
      
      if (!response.ok) {
        return [];
      }
      
      const data: FinnhubNews[] = await response.json();
      logger.debug(`✅ Finnhub: Loaded ${data.length} news articles`);
      return data;
    } catch (error) {
      logger.warn('⚠️ Finnhub getMarketNews error:', error);
      return [];
    }
  }

  /**
   * Get forex rates
   */
  static async getForexRates(base: string = 'USD'): Promise<Map<string, number>> {
    const rates = new Map<string, number>();
    
    try {
      const response = await callProxyAPI('finnhub', 'forex/rates', {
        base,
      });
      
      if (!response.ok) {
        return rates;
      }
      
      const data = await response.json();
      
      if (data.quote) {
        for (const [currency, rate] of Object.entries(data.quote)) {
          rates.set(`${base}${currency}`, rate as number);
        }
      }
      
      return rates;
    } catch (error) {
      logger.warn('⚠️ Finnhub getForexRates error:', error);
      return rates;
    }
  }

  /**
   * Map Finnhub impact to our format
   */
  private static mapImpact(impact: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    switch (impact?.toLowerCase()) {
      case 'high':
      case '3':
        return 'HIGH';
      case 'medium':
      case '2':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  /**
   * Map country to currency
   */
  private static countryToCurrency(country: string): string {
    const map: Record<string, string> = {
      'US': 'USD',
      'EU': 'EUR',
      'GB': 'GBP',
      'JP': 'JPY',
      'AU': 'AUD',
      'CA': 'CAD',
      'CH': 'CHF',
      'NZ': 'NZD',
      'CN': 'CNY',
    };
    return map[country] || 'USD';
  }
}

