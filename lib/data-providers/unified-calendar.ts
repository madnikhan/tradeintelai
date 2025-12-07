/**
 * Unified Economic Calendar Provider
 * Aggregates events from multiple sources: ForexFactory, Investing.com, Trading Economics
 * Provides the most comprehensive economic calendar data
 */

import { EconomicEvent } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';
import { ForexFactoryRSSProvider } from './forexfactory-rss';
import { InvestingCalendarProvider } from './investing-calendar';
import { TradingEconomicsCalendarProvider } from './tradingeconomics-calendar';

export class UnifiedCalendarProvider {
  private static cache: Map<string, { data: EconomicEvent[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 1800000; // 30 minutes cache

  /**
   * Merge and deduplicate events from multiple sources
   */
  private static mergeEvents(
    events1: EconomicEvent[],
    events2: EconomicEvent[],
    events3: EconomicEvent[]
  ): EconomicEvent[] {
    const eventMap = new Map<string, EconomicEvent>();
    
    // Add events from all sources, preferring higher impact and more complete data
    const allEvents = [...events1, ...events2, ...events3];
    
    for (const event of allEvents) {
      // Create a key based on event title, date, and currency
      const dateKey = event.date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeKey = event.date.toISOString().split('T')[1]?.substring(0, 5) || ''; // HH:MM
      const key = `${event.title}_${dateKey}_${timeKey}_${event.currency}`;
      
      const existing = eventMap.get(key);
      
      if (!existing) {
        // New event, add it
        eventMap.set(key, event);
      } else {
        // Event exists, merge if this one has better data
        const shouldReplace = 
          // Higher impact
          (event.impact === 'HIGH' && existing.impact !== 'HIGH') ||
          // More complete data (has actual/forecast/previous)
          ((event.actual !== undefined || event.forecast !== undefined || event.previous !== undefined) &&
           existing.actual === undefined && existing.forecast === undefined && existing.previous === undefined) ||
          // More recent (better timestamp accuracy)
          (event.date.getTime() > existing.date.getTime());
        
        if (shouldReplace) {
          // Merge data, keeping the best from both
          eventMap.set(key, {
            ...existing,
            ...event,
            // Keep actual/forecast/previous if available
            actual: event.actual !== undefined ? event.actual : existing.actual,
            forecast: event.forecast !== undefined ? event.forecast : existing.forecast,
            previous: event.previous !== undefined ? event.previous : existing.previous,
            // Prefer higher impact
            impact: event.impact === 'HIGH' ? 'HIGH' : existing.impact,
          });
        }
      }
    }
    
    return Array.from(eventMap.values());
  }

  /**
   * Get economic calendar events from all sources
   */
  static async getEconomicCalendar(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EconomicEvent[]> {
    const cacheKey = `unified_calendar_${fromDate?.toISOString() || 'all'}_${toDate?.toISOString() || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug(`✅ Unified Calendar: Cache hit (${cached.data.length} events)`);
      return cached.data;
    }

    try {
      logger.debug('📅 Unified Calendar: Fetching from all sources...');
      
      // Fetch from all sources in parallel
      const [ffEvents, investingEvents, teEvents] = await Promise.allSettled([
        ForexFactoryRSSProvider.getEconomicCalendar(fromDate, toDate),
        InvestingCalendarProvider.getEconomicCalendar(fromDate, toDate),
        TradingEconomicsCalendarProvider.getEconomicCalendar(fromDate, toDate),
      ]);

      // Extract successful results
      const events1 = ffEvents.status === 'fulfilled' ? ffEvents.value : [];
      const events2 = investingEvents.status === 'fulfilled' ? investingEvents.value : [];
      const events3 = teEvents.status === 'fulfilled' ? teEvents.value : [];

      // Log results
      logger.debug(`✅ ForexFactory: ${events1.length} events`);
      logger.debug(`✅ Investing.com: ${events2.length} events`);
      logger.debug(`✅ Trading Economics: ${events3.length} events`);

      // Merge and deduplicate
      const mergedEvents = this.mergeEvents(events1, events2, events3);
      
      // Sort by date
      mergedEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Filter by date range if provided
      let filteredEvents = mergedEvents;
      if (fromDate) {
        filteredEvents = filteredEvents.filter(e => e.date >= fromDate);
      }
      if (toDate) {
        filteredEvents = filteredEvents.filter(e => e.date <= toDate);
      }

      this.cache.set(cacheKey, { data: filteredEvents, timestamp: Date.now() });
      logger.debug(`✅ Unified Calendar: Loaded ${filteredEvents.length} unique economic events (merged from ${events1.length + events2.length + events3.length} total)`);
      
      return filteredEvents;
    } catch (error) {
      logger.warn('⚠️ Unified Calendar getEconomicCalendar error:', error);
      return [];
    }
  }

  /**
   * Get events count by source (for diagnostics)
   */
  static async getSourceStats(): Promise<{
    forexFactory: number;
    investing: number;
    tradingEconomics: number;
    total: number;
  }> {
    try {
      const [ffEvents, investingEvents, teEvents] = await Promise.allSettled([
        ForexFactoryRSSProvider.getEconomicCalendar(),
        InvestingCalendarProvider.getEconomicCalendar(),
        TradingEconomicsCalendarProvider.getEconomicCalendar(),
      ]);

      const events1 = ffEvents.status === 'fulfilled' ? ffEvents.value : [];
      const events2 = investingEvents.status === 'fulfilled' ? investingEvents.value : [];
      const events3 = teEvents.status === 'fulfilled' ? teEvents.value : [];
      const merged = this.mergeEvents(events1, events2, events3);

      return {
        forexFactory: events1.length,
        investing: events2.length,
        tradingEconomics: events3.length,
        total: merged.length,
      };
    } catch (error) {
      logger.warn('⚠️ Unified Calendar getSourceStats error:', error);
      return {
        forexFactory: 0,
        investing: 0,
        tradingEconomics: 0,
        total: 0,
      };
    }
  }
}

