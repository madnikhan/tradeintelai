/**
 * Economic Calendar Integration
 * Fetches and analyzes economic events to adjust trading behavior
 */

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  date: Date;
  currency: string;
  category: string;
  actual?: number;
  forecast?: number;
  previous?: number;
}

export interface NewsImpact {
  hasHighImpactEvent: boolean;
  nextHighImpactEvent?: EconomicEvent;
  minutesUntilEvent?: number;
  shouldReducePosition: boolean;
  shouldAvoidTrading: boolean;
  affectedCurrencies: string[];
}

export class EconomicCalendar {
  private static events: EconomicEvent[] = [];
  private static lastFetch: Date | null = null;
  private static fetchInterval = 60 * 60 * 1000; // 1 hour

  /**
   * Fetch economic events from Finnhub API
   */
  static async fetchEvents(startDate?: Date, endDate?: Date): Promise<EconomicEvent[]> {
    const now = new Date();
    
    // Cache events for 1 hour
    if (this.lastFetch && (now.getTime() - this.lastFetch.getTime()) < this.fetchInterval) {
      return this.events;
    }

    try {
      // Try unified calendar (aggregates ForexFactory, Investing.com, Trading Economics)
      const { UnifiedCalendarProvider } = await import('./data-providers/unified-calendar');
      this.events = await UnifiedCalendarProvider.getEconomicCalendar(startDate, endDate);
      
      // Fallback to individual sources if unified returns no events
      if (this.events.length === 0) {
        const { ForexFactoryRSSProvider } = await import('./data-providers/forexfactory-rss');
        this.events = await ForexFactoryRSSProvider.getEconomicCalendar(startDate, endDate);
        
        if (this.events.length === 0) {
          // Final fallback to paid Finnhub
          const { FinnhubProvider } = await import('./data-providers/finnhub');
          this.events = await FinnhubProvider.getEconomicCalendar(startDate, endDate);
          if (this.events.length > 0) {
            console.log(`✅ Loaded ${this.events.length} economic events from Finnhub (fallback)`);
          }
        } else {
          console.log(`✅ Loaded ${this.events.length} economic events from ForexFactory RSS`);
        }
      } else {
        console.log(`✅ Loaded ${this.events.length} economic events from unified calendar (ForexFactory + Investing.com + Trading Economics)`);
      }
      
      this.lastFetch = now;
    } catch (error) {
      console.error('Error fetching economic calendar:', error);
      this.events = [];
    }
    
    return this.events;
  }

  /**
   * Check if there's a high-impact event coming up
   * Returns impact analysis for trading decisions
   */
  static async checkNewsImpact(
    currencyPair: string,
    minutesBefore: number = 15,
    minutesAfter: number = 15
  ): Promise<NewsImpact> {
    const events = await this.fetchEvents();
    const now = new Date();
    
    // Extract currencies from pair (e.g., "EURUSD" -> ["EUR", "USD"])
    const baseCurrency = currencyPair.substring(0, 3);
    const quoteCurrency = currencyPair.substring(3, 6);
    const affectedCurrencies = [baseCurrency, quoteCurrency];

    // Find high-impact events affecting this pair
    const relevantEvents = events.filter(event => {
      const eventTime = event.date.getTime();
      const nowTime = now.getTime();
      const minutesUntil = (eventTime - nowTime) / (1000 * 60);
      
      return (
        event.impact === 'HIGH' &&
        affectedCurrencies.includes(event.currency) &&
        minutesUntil >= -minutesAfter &&
        minutesUntil <= minutesBefore
      );
    });

    const nextHighImpactEvent = relevantEvents
      .filter(e => e.date.getTime() > now.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    const hasHighImpactEvent = relevantEvents.length > 0;
    const minutesUntilEvent = nextHighImpactEvent
      ? Math.round((nextHighImpactEvent.date.getTime() - now.getTime()) / (1000 * 60))
      : undefined;

    // Decision logic:
    // - Reduce position size if event is within 15 minutes
    // - Avoid new trades if event is within 5 minutes
    const shouldReducePosition = hasHighImpactEvent && (minutesUntilEvent !== undefined && minutesUntilEvent <= 15);
    const shouldAvoidTrading = hasHighImpactEvent && (minutesUntilEvent !== undefined && minutesUntilEvent <= 5);

    return {
      hasHighImpactEvent,
      nextHighImpactEvent,
      minutesUntilEvent,
      shouldReducePosition,
      shouldAvoidTrading,
      affectedCurrencies
    };
  }

  /**
   * Get position size reduction factor based on news impact
   * Returns 0.5 if should reduce, 1.0 if normal
   */
  static async getPositionSizeFactor(currencyPair: string): Promise<number> {
    const impact = await this.checkNewsImpact(currencyPair);
    return impact.shouldReducePosition ? 0.5 : 1.0;
  }

  /**
   * Check if trading should be avoided due to upcoming news
   */
  static async shouldAvoidTrading(currencyPair: string): Promise<boolean> {
    const impact = await this.checkNewsImpact(currencyPair);
    return impact.shouldAvoidTrading;
  }

  /**
   * Get upcoming high-impact events for a currency
   */
  static async getUpcomingEvents(currency: string, hours: number = 24): Promise<EconomicEvent[]> {
    const events = await this.fetchEvents();
    const now = new Date();
    const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return events
      .filter(event => 
        event.currency === currency &&
        event.impact === 'HIGH' &&
        event.date >= now &&
        event.date <= cutoff
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

