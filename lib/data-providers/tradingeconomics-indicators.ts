/**
 * Trading Economics Economic Indicators Provider
 * Parses economic data from Trading Economics website
 * Provides: Interest Rates, CPI, GDP, Unemployment for all major currencies
 */

import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';
import { validateEconomicData } from './data-validator';

export interface EconomicIndicator {
  country: string;
  currency: string;
  name: string;
  value: number;
  date: string;
  unit: string;
  change?: number; // Change from previous period
  changePercent?: number;
}

export interface InterestRateData {
  currency: string;
  rate: number;
  date: string;
  centralBank: string;
  change?: number;
}

export class TradingEconomicsIndicatorsProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = {
    INTEREST_RATE: 24 * 60 * 60 * 1000, // 24 hours (rates change monthly)
    CPI: 7 * 24 * 60 * 60 * 1000, // 7 days (CPI updates monthly)
    GDP: 7 * 24 * 60 * 60 * 1000, // 7 days (GDP updates quarterly)
    UNEMPLOYMENT: 7 * 24 * 60 * 60 * 1000, // 7 days (unemployment updates monthly)
  };

  /**
   * Get base URL for API routes (handles server-side/test contexts)
   */
  private static getApiBaseUrl(): string {
    if (typeof window === 'undefined') {
      // Server-side or test context - need absolute URL
      const protocol = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ? 'https' : 'http';
      const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
      return `${protocol}://${host}/api/tradingeconomics`;
    }
    return '/api/tradingeconomics';
  }

  // Currency to country mapping
  private static readonly CURRENCY_COUNTRY_MAP: Record<string, string> = {
    USD: 'United States',
    EUR: 'Euro Area',
    GBP: 'United Kingdom',
    JPY: 'Japan',
    AUD: 'Australia',
    CAD: 'Canada',
    CHF: 'Switzerland',
    NZD: 'New Zealand',
  };

  // Central bank names
  private static readonly CENTRAL_BANK_MAP: Record<string, string> = {
    USD: 'Federal Reserve',
    EUR: 'European Central Bank',
    GBP: 'Bank of England',
    JPY: 'Bank of Japan',
    AUD: 'Reserve Bank of Australia',
    CAD: 'Bank of Canada',
    CHF: 'Swiss National Bank',
    NZD: 'Reserve Bank of New Zealand',
  };

  /**
   * Get interest rate for a currency
   */
  static async getInterestRate(currency: string): Promise<InterestRateData | null> {
    const cacheKey = `interest_rate_${currency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL.INTEREST_RATE) {
      return cached.data;
    }

    try {
      const startTime = Date.now();
      
      // Fetch from API route (server-side proxy)
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/interest-rate?currency=${currency}`);
      
      if (!response.ok) {
        ParserMonitor.recordExecution('tradingeconomics_interest_rate', false, Date.now() - startTime, 0, 'HTTP error');
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        ParserMonitor.recordExecution('tradingeconomics_interest_rate', false, Date.now() - startTime, 0, 'No data');
        return null;
      }

      // Validate data freshness and value range
      const validation = validateEconomicData(
        data.data.rate,
        data.data.date,
        'INTEREST_RATE',
        currency
      );

      // Log warnings if validation failed
      if (!validation.isValid) {
        logger.warn(`⚠️ Interest rate data validation warnings for ${currency}:`, validation.warnings);
      }

      // Track fallback usage if detected
      if (data.data.usedFallback) {
        ParserMonitor.recordFallbackUsage('tradingeconomics_interest_rate', currency);
      }

      const result: InterestRateData = {
        currency,
        rate: data.data.rate,
        date: data.data.date,
        centralBank: this.CENTRAL_BANK_MAP[currency] || 'Unknown',
        change: data.data.change,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      ParserMonitor.recordExecution(
        'tradingeconomics_interest_rate',
        true,
        Date.now() - startTime,
        1,
        undefined,
        data.data.usedFallback
      );
      
      logger.debug(`✅ Trading Economics: Interest rate for ${currency} = ${result.rate}% (confidence: ${validation.confidence}%)`);
      return result;
    } catch (error) {
      ParserMonitor.recordExecution('tradingeconomics_interest_rate', false, 0, 0, String(error));
      logger.warn(`⚠️ Trading Economics interest rate error for ${currency}:`, error);
      return null;
    }
  }

  /**
   * Get CPI (inflation) for a currency
   */
  static async getCPI(currency: string): Promise<EconomicIndicator | null> {
    const cacheKey = `cpi_${currency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL.CPI) {
      return cached.data;
    }

    try {
      const startTime = Date.now();
      
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/cpi?currency=${currency}`);
      
      if (!response.ok) {
        ParserMonitor.recordExecution('tradingeconomics_cpi', false, Date.now() - startTime, 0, 'HTTP error');
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        ParserMonitor.recordExecution('tradingeconomics_cpi', false, Date.now() - startTime, 0, 'No data');
        return null;
      }

      // Validate data freshness and value range
      const validation = validateEconomicData(
        data.data.value,
        data.data.date,
        'CPI',
        currency
      );

      // Log warnings if validation failed
      if (!validation.isValid) {
        logger.warn(`⚠️ CPI data validation warnings for ${currency}:`, validation.warnings);
      }

      // Track fallback usage if detected
      if (data.data.usedFallback) {
        ParserMonitor.recordFallbackUsage('tradingeconomics_cpi', currency);
      }

      const country = this.CURRENCY_COUNTRY_MAP[currency] || currency;
      const result: EconomicIndicator = {
        country,
        currency,
        name: 'Consumer Price Index (CPI)',
        value: data.data.value,
        date: data.data.date,
        unit: '%',
        change: data.data.change,
        changePercent: data.data.changePercent,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      ParserMonitor.recordExecution(
        'tradingeconomics_cpi',
        true,
        Date.now() - startTime,
        1,
        undefined,
        data.data.usedFallback
      );
      
      logger.debug(`✅ Trading Economics: CPI for ${currency} = ${result.value}% (confidence: ${validation.confidence}%)`);
      return result;
    } catch (error) {
      ParserMonitor.recordExecution('tradingeconomics_cpi', false, 0, 0, String(error));
      logger.warn(`⚠️ Trading Economics CPI error for ${currency}:`, error);
      return null;
    }
  }

  /**
   * Get GDP growth for a currency
   */
  static async getGDP(currency: string): Promise<EconomicIndicator | null> {
    const cacheKey = `gdp_${currency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL.GDP) {
      return cached.data;
    }

    try {
      const startTime = Date.now();
      
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/gdp?currency=${currency}`);
      
      if (!response.ok) {
        ParserMonitor.recordExecution('tradingeconomics_gdp', false, Date.now() - startTime, 0, 'HTTP error');
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        ParserMonitor.recordExecution('tradingeconomics_gdp', false, Date.now() - startTime, 0, 'No data');
        return null;
      }

      // Validate data freshness and value range
      const validation = validateEconomicData(
        data.data.value,
        data.data.date,
        'GDP',
        currency
      );

      // Log warnings if validation failed
      if (!validation.isValid) {
        logger.warn(`⚠️ GDP data validation warnings for ${currency}:`, validation.warnings);
      }

      // Track fallback usage if detected
      if (data.data.usedFallback) {
        ParserMonitor.recordFallbackUsage('tradingeconomics_gdp', currency);
      }

      const country = this.CURRENCY_COUNTRY_MAP[currency] || currency;
      const result: EconomicIndicator = {
        country,
        currency,
        name: 'GDP Growth Rate',
        value: data.data.value,
        date: data.data.date,
        unit: '%',
        change: data.data.change,
        changePercent: data.data.changePercent,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      ParserMonitor.recordExecution(
        'tradingeconomics_gdp',
        true,
        Date.now() - startTime,
        1,
        undefined,
        data.data.usedFallback
      );
      
      logger.debug(`✅ Trading Economics: GDP for ${currency} = ${result.value}% (confidence: ${validation.confidence}%)`);
      return result;
    } catch (error) {
      ParserMonitor.recordExecution('tradingeconomics_gdp', false, 0, 0, String(error));
      logger.warn(`⚠️ Trading Economics GDP error for ${currency}:`, error);
      return null;
    }
  }

  /**
   * Get unemployment rate for a currency
   */
  static async getUnemployment(currency: string): Promise<EconomicIndicator | null> {
    const cacheKey = `unemployment_${currency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL.UNEMPLOYMENT) {
      return cached.data;
    }

    try {
      const startTime = Date.now();
      
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/unemployment?currency=${currency}`);
      
      if (!response.ok) {
        ParserMonitor.recordExecution('tradingeconomics_unemployment', false, Date.now() - startTime, 0, 'HTTP error');
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        ParserMonitor.recordExecution('tradingeconomics_unemployment', false, Date.now() - startTime, 0, 'No data');
        return null;
      }

      // Validate data freshness and value range
      const validation = validateEconomicData(
        data.data.value,
        data.data.date,
        'UNEMPLOYMENT',
        currency
      );

      // Log warnings if validation failed
      if (!validation.isValid) {
        logger.warn(`⚠️ Unemployment data validation warnings for ${currency}:`, validation.warnings);
      }

      // Track fallback usage if detected
      if (data.data.usedFallback) {
        ParserMonitor.recordFallbackUsage('tradingeconomics_unemployment', currency);
      }

      const country = this.CURRENCY_COUNTRY_MAP[currency] || currency;
      const result: EconomicIndicator = {
        country,
        currency,
        name: 'Unemployment Rate',
        value: data.data.value,
        date: data.data.date,
        unit: '%',
        change: data.data.change,
        changePercent: data.data.changePercent,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      ParserMonitor.recordExecution(
        'tradingeconomics_unemployment',
        true,
        Date.now() - startTime,
        1,
        undefined,
        data.data.usedFallback
      );
      
      logger.debug(`✅ Trading Economics: Unemployment for ${currency} = ${result.value}% (confidence: ${validation.confidence}%)`);
      return result;
    } catch (error) {
      ParserMonitor.recordExecution('tradingeconomics_unemployment', false, 0, 0, String(error));
      logger.warn(`⚠️ Trading Economics unemployment error for ${currency}:`, error);
      return null;
    }
  }

  /**
   * Get all economic indicators for a currency
   */
  static async getAllIndicators(currency: string): Promise<{
    interestRate: InterestRateData | null;
    cpi: EconomicIndicator | null;
    gdp: EconomicIndicator | null;
    unemployment: EconomicIndicator | null;
  }> {
    const [interestRate, cpi, gdp, unemployment] = await Promise.all([
      this.getInterestRate(currency),
      this.getCPI(currency),
      this.getGDP(currency),
      this.getUnemployment(currency),
    ]);

    return {
      interestRate,
      cpi,
      gdp,
      unemployment,
    };
  }
}

