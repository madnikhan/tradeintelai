/**
 * COT (Commitment of Traders) Data Provider
 * Fetches real CFTC COT data from official government API
 * Enhanced with performance monitoring and API route proxy
 */

import { COTData } from '@/lib/cot-analyzer';
import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';

// CFTC Socrata API endpoints
const CFTC_API_BASE = 'https://publicreporting.cftc.gov/resource';

// Legacy COT Report (Futures Only) - has forex data
const LEGACY_FUTURES_ENDPOINT = '6dca-aqww.json';

// Traders in Financial Futures (TFF) - better for forex
const TFF_ENDPOINT = 'gpe5-46if.json';

// TFF Contract Codes (different from Legacy)
const TFF_CONTRACTS: Record<string, { name: string; code: string }> = {
  'EUR': { name: 'EURO FX', code: '099741' },
  'GBP': { name: 'BRITISH POUND', code: '096742' },
  'JPY': { name: 'JAPANESE YEN', code: '097741' },
  'AUD': { name: 'AUSTRALIAN DOLLAR', code: '232741' },
  'CAD': { name: 'CANADIAN DOLLAR', code: '090741' },
  'CHF': { name: 'SWISS FRANC', code: '092741' },
  'NZD': { name: 'NEW ZEALAND DOLLAR', code: '112741' },
};

// CFTC Contract Market Codes for Forex Futures (CME)
// Verified codes from CFTC database
const FOREX_CONTRACTS: Record<string, { name: string; code: string }> = {
  'EUR': { name: 'EUROPEAN CURRENCY UNIT', code: '099741' },
  'GBP': { name: 'POUND STERLING', code: '096742' },
  'JPY': { name: 'JAPANESE YEN', code: '097741' },
  'AUD': { name: 'AUSTRALIAN DOLLAR', code: '232741' },
  'CAD': { name: 'CANADIAN DOLLAR', code: '090741' },
  'CHF': { name: 'SWISS FRANC', code: '092741' },
  'NZD': { name: 'NEW ZEALAND DOLLAR', code: '112741' }, // Added NZD support
};

interface CFTCRecord {
  report_date_as_yyyy_mm_dd: string;
  commodity_name: string;
  cftc_contract_market_code: string;
  open_interest_all: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
  nonrept_positions_long_all: string;
  nonrept_positions_short_all: string;
}

export class COTDataProvider {
  private static cache: Map<string, { data: COTData[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hour cache (COT updates weekly on Friday)

  /**
   * Get COT data for a currency
   * Enhanced: Tries TFF report first (better for forex), falls back to Legacy
   */
  static async getCOTData(currency: string, weeks: number = 52, preferTFF: boolean = true): Promise<COTData[]> {
    const cacheKey = `cot_${currency}_${weeks}_${preferTFF ? 'tff' : 'legacy'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`📊 COT cache hit for ${currency}`);
      return cached.data;
    }

    const contract = FOREX_CONTRACTS[currency];
    if (!contract) {
      console.warn(`⚠️ No CFTC contract mapping for ${currency}`);
      return [];
    }

    try {
      let data: COTData[] = [];
      
      // Try TFF report first (better for forex) if preferred
      if (preferTFF) {
        const tffContract = TFF_CONTRACTS[currency];
        if (tffContract) {
          data = await this.fetchFromTFF(tffContract.name, tffContract.code, weeks);
          if (data.length > 0) {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            console.log(`✅ Loaded ${data.length} weeks of TFF COT data for ${currency}`);
            return data;
          }
        }
      }
      
      // Fallback to Legacy Futures report
      data = await this.fetchFromCFTC(contract.name, contract.code, weeks);
      
      if (data.length > 0) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        console.log(`✅ Loaded ${data.length} weeks of Legacy COT data for ${currency}`);
        return data;
      }

      console.warn(`⚠️ No COT data found for ${currency} (${contract.name})`);
      return [];
    } catch (error) {
      console.error(`Error fetching COT data for ${currency}:`, error);
      return [];
    }
  }

  /**
   * Fetch from TFF (Traders in Financial Futures) report
   * Better for forex futures with more detailed trader categories
   */
  private static async fetchFromTFF(
    commodityName: string,
    contractCode: string,
    weeks: number
  ): Promise<COTData[]> {
    const startTime = Date.now();
    try {
      // Try API route first
      try {
        const apiUrl = `/api/cot/data?currency=${commodityName}&weeks=${weeks}&endpoint=tff`;
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const apiData = await response.json();
          if (apiData.success && apiData.data && Array.isArray(apiData.data)) {
            const records: any[] = apiData.data;
            if (records.length > 0) {
              const executionTime = Date.now() - startTime;
              ParserMonitor.recordExecution('COT-TFF', true, executionTime, records.length);
              logger.debug(`✅ COT TFF API route: Loaded ${records.length} records in ${executionTime}ms`);
              return this.transformTFFRecords(records, commodityName);
            }
          }
        }
      } catch (apiError) {
        logger.warn('⚠️ COT TFF API route failed, trying direct fetch...', apiError);
      }

      // Fallback to direct CFTC API fetch
      const url = new URL(`${CFTC_API_BASE}/${TFF_ENDPOINT}`);
      url.searchParams.set('$limit', weeks.toString());
      url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
      url.searchParams.set('cftc_contract_market_code', contractCode);
      
      logger.debug(`📡 Fetching TFF COT data from CFTC: ${commodityName}`);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('COT-TFF', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ CFTC TFF API error: ${response.status}`);
        return [];
      }
      
      const records: any[] = await response.json();
      
      if (!records || records.length === 0) {
        return [];
      }
      
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('COT-TFF', true, executionTime, records.length);
      logger.debug(`✅ COT TFF direct fetch: Loaded ${records.length} records in ${executionTime}ms`);
      
      return this.transformTFFRecords(records, commodityName);
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('COT-TFF', false, executionTime, 0, error.message);
      logger.warn('⚠️ CFTC TFF fetch error:', error);
      return [];
    }
  }

  /**
   * Transform TFF records to our COTData format
   * TFF has different field names than Legacy
   */
  private static transformTFFRecords(records: any[], symbol: string): COTData[] {
    return records.map(record => {
      // TFF report uses different field names
      const nonCommLong = parseInt(record.noncomm_positions_long_all || record.asset_mgr_positions_long_all || '0') || 0;
      const nonCommShort = parseInt(record.noncomm_positions_short_all || record.asset_mgr_positions_short_all || '0') || 0;
      const commLong = parseInt(record.comm_positions_long_all || record.dealer_positions_long_all || '0') || 0;
      const commShort = parseInt(record.comm_positions_short_all || record.dealer_positions_short_all || '0') || 0;
      const nonReptLong = parseInt(record.nonrept_positions_long_all || '0') || 0;
      const nonReptShort = parseInt(record.nonrept_positions_short_all || '0') || 0;
      
      return {
        symbol,
        date: new Date(record.report_date_as_yyyy_mm_dd),
        reportableLong: commLong,
        reportableShort: commShort,
        nonReportableLong: nonReptLong,
        nonReportableShort: nonReptShort,
        nonCommercialLong: nonCommLong,
        nonCommercialShort: nonCommShort,
        openInterest: parseInt(record.open_interest_all || '0') || 0,
        netCommercial: commLong - commShort,
        netNonCommercial: nonCommLong - nonCommShort,
        netSmallSpec: nonReptLong - nonReptShort,
      };
    }).reverse(); // Oldest first for analysis
  }

  /**
   * Fetch from CFTC Socrata API
   * Uses API route proxy for better error handling and monitoring
   */
  private static async fetchFromCFTC(
    commodityName: string,
    contractCode: string,
    weeks: number
  ): Promise<COTData[]> {
    const startTime = Date.now();
    try {
      // Try API route first (better error handling and monitoring)
      try {
        const apiUrl = `/api/cot/data?currency=${commodityName}&weeks=${weeks}&endpoint=legacy`;
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const apiData = await response.json();
          if (apiData.success && apiData.data && Array.isArray(apiData.data)) {
            const records: CFTCRecord[] = apiData.data;
            if (records.length > 0) {
              const executionTime = Date.now() - startTime;
              ParserMonitor.recordExecution('COT-CFTC', true, executionTime, records.length);
              logger.debug(`✅ COT API route: Loaded ${records.length} records in ${executionTime}ms`);
              return this.transformRecords(records, commodityName);
            }
          }
        }
      } catch (apiError) {
        logger.warn('⚠️ COT API route failed, trying direct fetch...', apiError);
      }

      // Fallback to direct CFTC API fetch
      const url = new URL(`${CFTC_API_BASE}/${LEGACY_FUTURES_ENDPOINT}`);
      url.searchParams.set('$limit', weeks.toString());
      url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
      url.searchParams.set('cftc_contract_market_code', contractCode);
      
      logger.debug(`📡 Fetching COT data from CFTC: ${commodityName}`);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('COT-CFTC', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ CFTC API error: ${response.status}`);
        return [];
      }
      
      const records: CFTCRecord[] = await response.json();
      
      if (!records || records.length === 0) {
        // Try searching by commodity name instead
        return this.fetchByName(commodityName, weeks);
      }
      
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('COT-CFTC', true, executionTime, records.length);
      logger.debug(`✅ COT direct fetch: Loaded ${records.length} records in ${executionTime}ms`);
      
      return this.transformRecords(records, commodityName);
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('COT-CFTC', false, executionTime, 0, error.message);
      logger.warn('⚠️ CFTC fetch error:', error);
      return [];
    }
  }

  /**
   * Alternative fetch by commodity name
   */
  private static async fetchByName(commodityName: string, weeks: number): Promise<COTData[]> {
    try {
      const url = new URL(`${CFTC_API_BASE}/${LEGACY_FUTURES_ENDPOINT}`);
      url.searchParams.set('$limit', weeks.toString());
      url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
      url.searchParams.set('$where', `commodity_name LIKE '%${commodityName}%'`);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        return [];
      }
      
      const records: CFTCRecord[] = await response.json();
      return this.transformRecords(records, commodityName);
    } catch (error) {
      return [];
    }
  }

  /**
   * Transform CFTC records to our COTData format
   */
  private static transformRecords(records: CFTCRecord[], symbol: string): COTData[] {
    return records.map(record => {
      const nonCommLong = parseInt(record.noncomm_positions_long_all) || 0;
      const nonCommShort = parseInt(record.noncomm_positions_short_all) || 0;
      const commLong = parseInt(record.comm_positions_long_all) || 0;
      const commShort = parseInt(record.comm_positions_short_all) || 0;
      const nonReptLong = parseInt(record.nonrept_positions_long_all) || 0;
      const nonReptShort = parseInt(record.nonrept_positions_short_all) || 0;
      
      return {
        symbol,
        date: new Date(record.report_date_as_yyyy_mm_dd),
        reportableLong: commLong,
        reportableShort: commShort,
        nonReportableLong: nonReptLong,
        nonReportableShort: nonReptShort,
        nonCommercialLong: nonCommLong,
        nonCommercialShort: nonCommShort,
        openInterest: parseInt(record.open_interest_all) || 0,
        netCommercial: commLong - commShort,
        netNonCommercial: nonCommLong - nonCommShort,
        netSmallSpec: nonReptLong - nonReptShort,
      };
    }).reverse(); // Oldest first for analysis
  }

  /**
   * Get COT sentiment summary for a currency pair
   */
  static async getCOTSentiment(symbol: string): Promise<{
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    largeSpecNet: number;
    commercialNet: number;
    description: string;
  }> {
    const baseCurrency = symbol.slice(0, 3);
    const data = await this.getCOTData(baseCurrency, 52);
    
    if (data.length === 0) {
      return {
        sentiment: 'NEUTRAL',
        strength: 0,
        largeSpecNet: 0,
        commercialNet: 0,
        description: `No COT data available for ${baseCurrency}`,
      };
    }
    
    const latest = data[data.length - 1];
    const netSpec = latest.netNonCommercial;
    const netComm = latest.netCommercial;
    
    // Calculate percentile of current position vs history
    const historicalNetSpec = data.map(d => d.netNonCommercial);
    const percentile = this.calculatePercentile(historicalNetSpec, netSpec);
    
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let description = '';
    
    // Contrarian interpretation: 
    // - Large specs at extreme long = bearish (they're usually wrong at extremes)
    // - Commercials at extreme long = bullish (they hedge, so opposite is true direction)
    
    if (percentile > 80) {
      sentiment = 'BEARISH';
      description = `Large speculators extremely long ${baseCurrency} (${percentile.toFixed(0)}th percentile) - Contrarian bearish`;
    } else if (percentile < 20) {
      sentiment = 'BULLISH';
      description = `Large speculators extremely short ${baseCurrency} (${percentile.toFixed(0)}th percentile) - Contrarian bullish`;
    } else if (netComm > 0 && netSpec < 0) {
      sentiment = 'BULLISH';
      description = `Commercials net long, specs net short - Bullish alignment`;
    } else if (netComm < 0 && netSpec > 0) {
      sentiment = 'BEARISH';
      description = `Commercials net short, specs net long - Bearish alignment`;
    } else {
      description = `Mixed positioning - No clear signal`;
    }
    
    const strength = Math.abs(percentile - 50) * 2; // 0-100 based on extremity
    
    return {
      sentiment,
      strength: Math.round(strength),
      largeSpecNet: netSpec,
      commercialNet: netComm,
      description,
    };
  }

  /**
   * Calculate percentile of value in array
   */
  private static calculatePercentile(arr: number[], value: number): number {
    if (arr.length === 0) return 50;
    const sorted = [...arr].sort((a, b) => a - b);
    const below = sorted.filter(v => v < value).length;
    return (below / sorted.length) * 100;
  }
}
