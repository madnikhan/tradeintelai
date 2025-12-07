/**
 * Alpha Vantage API Integration
 * Provides economic indicators and fundamental data
 */

import { apiKeyManager } from '@/config/api-keys';

const BASE_URL = 'https://www.alphavantage.co/query';

interface EconomicIndicator {
  name: string;
  value: number;
  date: string;
  unit: string;
}

export class AlphaVantageProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 3600000; // 1 hour cache for economic data

  /**
   * Get Federal Funds Rate (Interest Rate)
   */
  static async getFederalFundsRate(): Promise<EconomicIndicator | null> {
    return this.getEconomicIndicator('FEDERAL_FUNDS_RATE', 'Federal Funds Rate', '%');
  }

  /**
   * Get CPI (Inflation)
   */
  static async getCPI(): Promise<EconomicIndicator | null> {
    return this.getEconomicIndicator('CPI', 'Consumer Price Index', 'index');
  }

  /**
   * Get GDP
   */
  static async getGDP(): Promise<EconomicIndicator | null> {
    return this.getEconomicIndicator('REAL_GDP', 'Real GDP', 'billions');
  }

  /**
   * Get Unemployment Rate
   */
  static async getUnemployment(): Promise<EconomicIndicator | null> {
    return this.getEconomicIndicator('UNEMPLOYMENT', 'Unemployment Rate', '%');
  }

  /**
   * Get Treasury Yield
   */
  static async getTreasuryYield(maturity: '3month' | '2year' | '5year' | '10year' = '10year'): Promise<EconomicIndicator | null> {
    return this.getEconomicIndicator(`TREASURY_YIELD&maturity=${maturity}`, `Treasury Yield ${maturity}`, '%');
  }

  /**
   * Get all key economic indicators for USD
   */
  static async getUSEconomicIndicators(): Promise<{
    interestRate: EconomicIndicator | null;
    inflation: EconomicIndicator | null;
    gdp: EconomicIndicator | null;
    unemployment: EconomicIndicator | null;
    treasuryYield: EconomicIndicator | null;
  }> {
    const cacheKey = 'us_economic_indicators';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Fetch all indicators (with delays to respect rate limits)
    const [interestRate, inflation, gdp, unemployment, treasuryYield] = await Promise.all([
      this.getFederalFundsRate(),
      this.delay(1000).then(() => this.getCPI()),
      this.delay(2000).then(() => this.getGDP()),
      this.delay(3000).then(() => this.getUnemployment()),
      this.delay(4000).then(() => this.getTreasuryYield()),
    ]);
    
    const result = { interestRate, inflation, gdp, unemployment, treasuryYield };
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }

  /**
   * Get forex exchange rate
   */
  static async getForexRate(fromCurrency: string, toCurrency: string): Promise<{
    rate: number;
    bid: number;
    ask: number;
    timestamp: Date;
  } | null> {
    try {
      const apiKey = apiKeyManager.getKey('ALPHA_VANTAGE');
      
      const response = await fetch(
        `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      const rateData = data['Realtime Currency Exchange Rate'];
      
      if (!rateData) {
        return null;
      }
      
      const rate = parseFloat(rateData['5. Exchange Rate']);
      const bid = parseFloat(rateData['8. Bid Price']) || rate * 0.9999;
      const ask = parseFloat(rateData['9. Ask Price']) || rate * 1.0001;
      
      return {
        rate,
        bid,
        ask,
        timestamp: new Date(rateData['6. Last Refreshed']),
      };
    } catch (error) {
      console.error('Alpha Vantage getForexRate error:', error);
      return null;
    }
  }

  /**
   * Generic economic indicator fetcher
   */
  private static async getEconomicIndicator(
    function_name: string,
    displayName: string,
    unit: string
  ): Promise<EconomicIndicator | null> {
    const cacheKey = `indicator_${function_name}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const apiKey = apiKeyManager.getKey('ALPHA_VANTAGE');
      
      const response = await fetch(
        `${BASE_URL}?function=${function_name}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      // Alpha Vantage returns data in 'data' array
      if (!data.data || data.data.length === 0) {
        console.warn(`Alpha Vantage: No data for ${displayName}`);
        return null;
      }
      
      const latestData = data.data[0];
      const result: EconomicIndicator = {
        name: displayName,
        value: parseFloat(latestData.value),
        date: latestData.date,
        unit,
      };
      
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      console.log(`✅ Alpha Vantage: ${displayName} = ${result.value}${unit}`);
      
      return result;
    } catch (error) {
      console.error(`Alpha Vantage get${displayName} error:`, error);
      return null;
    }
  }

  /**
   * Helper delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

