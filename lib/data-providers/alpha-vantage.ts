/**
 * Alpha Vantage API Integration
 * Provides economic indicators and fundamental data
 */

// Note: Alpha Vantage is not currently used in the system
// This file is kept for potential future use
// If needed, create an API proxy route similar to other providers

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
    // Alpha Vantage not currently used - returns null
    // To enable: create API proxy route and update this method
    return null;
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
    
    // Alpha Vantage not currently used - returns null
    // To enable: create API proxy route and update this method
    return null;
  }

  /**
   * Helper delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

