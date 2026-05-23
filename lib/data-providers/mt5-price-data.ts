/**
 * MT5 Price Data Provider
 * Uses MT5 bridge for free, unlimited price data
 * Replaces TwelveData for historical and real-time data
 */

import { httpBridge } from '@/lib/http-bridge-connector';
import { PriceData } from '@/types/trading';
import { logger } from '@/lib/logger';
import { getBridgeUrl } from '@/config/bridge-config';

export class MT5PriceDataProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 60000; // 1 minute cache for real-time data
  private static HISTORICAL_CACHE_TTL = 300000; // 5 minute cache for historical data

  /**
   * Get real-time quote from MT5
   */
  static async getQuote(symbol: string): Promise<{
    bid: number;
    ask: number;
    price: number;
    timestamp: Date;
  } | null> {
    const cacheKey = `quote_${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const data = await httpBridge.getMarketData(symbol);
      
      if (!data.success || !data.bid || !data.ask) {
        logger.warn(`⚠️ MT5: No price data for ${symbol}`);
        return null;
      }

      const price = (data.bid + data.ask) / 2;
      const result = {
        bid: data.bid,
        ask: data.ask,
        price,
        timestamp: new Date(data.timestamp || Date.now()),
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      logger.warn(`⚠️ MT5 getQuote error for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get historical price data from MT5
   * Note: This requires adding a historical data endpoint to the MT5 bridge
   * For now, we'll use CopyRates from MT5 EA
   */
  static async getHistoricalData(
    symbol: string,
    timeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' = 'H1',
    count: number = 100
  ): Promise<PriceData[]> {
    const cacheKey = `historical_${symbol}_${timeframe}_${count}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.HISTORICAL_CACHE_TTL) {
      return cached.data;
    }

    try {
      // Map timeframe to MT5 format
      const timeframeMap: Record<string, string> = {
        'M1': 'M1',
        'M5': 'M5',
        'M15': 'M15',
        'M30': 'M30',
        'H1': 'H1',
        'H4': 'H4',
        'D1': 'D1',
      };
      
      const mt5Timeframe = timeframeMap[timeframe] || 'H1';
      
      // Fetch historical data from MT5 bridge
      const url = getBridgeUrl(`/historical/${symbol}?timeframe=${mt5Timeframe}&count=${count}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
        },
        signal: AbortSignal.timeout(20000), // 20 second timeout
      });

      if (!response.ok) {
        logger.warn(`⚠️ MT5 historical data API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.success || !data.data || !Array.isArray(data.data)) {
        logger.warn(`⚠️ MT5 historical data returned invalid response for ${symbol}`);
        return [];
      }

      // Convert MT5 data format to PriceData format
      const priceData: PriceData[] = data.data.map((bar: any) => ({
        timestamp: new Date(bar.timestamp),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume) || 0,
      }));

      // Cache the result
      this.cache.set(cacheKey, { data: priceData, timestamp: Date.now() });
      
      logger.debug(`✅ MT5: Loaded ${priceData.length} historical bars for ${symbol} (${timeframe})`);
      
      return priceData;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn(`⚠️ MT5 historical data timeout for ${symbol}`);
      } else {
        logger.warn(`⚠️ MT5 getHistoricalData error for ${symbol}:`, error);
      }
      return [];
    }
  }

  /**
   * Get multiple quotes at once
   */
  static async getMultipleQuotes(symbols: string[]): Promise<Map<string, number>> {
    const quotes = new Map<string, number>();
    
    // Fetch quotes in parallel
    const promises = symbols.map(async (symbol) => {
      const quote = await this.getQuote(symbol);
      if (quote) {
        quotes.set(symbol, quote.price);
      }
    });

    await Promise.all(promises);
    return quotes;
  }
}

