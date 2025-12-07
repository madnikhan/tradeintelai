/**
 * TwelveData API Integration
 * Provides historical price data and real-time forex quotes
 */

import { apiKeyManager } from '@/config/api-keys';
import { PriceData } from '@/types/trading';

const BASE_URL = 'https://api.twelvedata.com';

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  previous_close: string;
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency_base: string;
    currency_quote: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
  }>;
  status: string;
}

export class TwelveDataProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 60000; // 1 minute cache

  /**
   * Get real-time forex quote
   */
  static async getQuote(symbol: string): Promise<{
    bid: number;
    ask: number;
    price: number;
    timestamp: Date;
  } | null> {
    try {
      const apiKey = apiKeyManager.getKey('TWELVE_DATA');
      const forexSymbol = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      
      const response = await fetch(
        `${BASE_URL}/quote?symbol=${forexSymbol}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        console.error('TwelveData quote error:', response.status);
        return null;
      }
      
      const data: TwelveDataQuote = await response.json();
      
      if (!data.close) {
        console.error('TwelveData: No quote data');
        return null;
      }
      
      const price = parseFloat(data.close);
      const spread = price * 0.0001; // Approximate spread
      
      return {
        bid: price - spread / 2,
        ask: price + spread / 2,
        price,
        timestamp: new Date(data.datetime),
      };
    } catch (error) {
      console.error('TwelveData getQuote error:', error);
      return null;
    }
  }

  /**
   * Get historical price data for technical analysis
   */
  static async getHistoricalData(
    symbol: string,
    interval: '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' = '1h',
    outputSize: number = 100
  ): Promise<PriceData[]> {
    const cacheKey = `${symbol}_${interval}_${outputSize}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const apiKey = apiKeyManager.getKey('TWELVE_DATA');
      const forexSymbol = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      
      const response = await fetch(
        `${BASE_URL}/time_series?symbol=${forexSymbol}&interval=${interval}&outputsize=${outputSize}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        console.error('TwelveData historical error:', response.status);
        return [];
      }
      
      const data: TwelveDataTimeSeries = await response.json();
      
      if (data.status === 'error' || !data.values) {
        console.error('TwelveData: No historical data', data);
        return [];
      }
      
      const priceData: PriceData[] = data.values.map((candle) => ({
        timestamp: new Date(candle.datetime),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: 0, // Forex doesn't have volume in TwelveData free tier
      })).reverse(); // Reverse to get oldest first
      
      // Cache the result
      this.cache.set(cacheKey, { data: priceData, timestamp: Date.now() });
      
      console.log(`✅ TwelveData: Loaded ${priceData.length} candles for ${symbol}`);
      return priceData;
    } catch (error) {
      console.error('TwelveData getHistoricalData error:', error);
      return [];
    }
  }

  /**
   * Get multiple forex quotes at once
   */
  static async getMultipleQuotes(symbols: string[]): Promise<Map<string, number>> {
    const quotes = new Map<string, number>();
    
    try {
      const apiKey = apiKeyManager.getKey('TWELVE_DATA');
      const forexSymbols = symbols.map(s => 
        s.includes('/') ? s : `${s.slice(0, 3)}/${s.slice(3)}`
      ).join(',');
      
      const response = await fetch(
        `${BASE_URL}/price?symbol=${forexSymbols}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        return quotes;
      }
      
      const data = await response.json();
      
      // Handle single vs multiple response format
      if (symbols.length === 1) {
        quotes.set(symbols[0], parseFloat(data.price));
      } else {
        for (const symbol of symbols) {
          const forexSymbol = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
          if (data[forexSymbol]?.price) {
            quotes.set(symbol, parseFloat(data[forexSymbol].price));
          }
        }
      }
    } catch (error) {
      console.error('TwelveData getMultipleQuotes error:', error);
    }
    
    return quotes;
  }
}

