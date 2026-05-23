/**
 * COT (Commitment of Traders) Report Analyzer
 * Analyzes CFTC weekly reports to track smart money positions
 */

import { detectAssetType } from './constants';

export interface COTData {
  symbol: string;
  date: Date;
  reportableLong: number;      // Commercial long positions
  reportableShort: number;     // Commercial short positions
  nonReportableLong: number;   // Small speculator long
  nonReportableShort: number;  // Small speculator short
  nonCommercialLong: number;  // Large speculator long
  nonCommercialShort: number;  // Large speculator short
  openInterest: number;
  netCommercial: number;        // Commercial long - short
  netNonCommercial: number;   // Large spec long - short
  netSmallSpec: number;        // Small spec long - short
}

export interface COTAnalysis {
  symbol: string;
  date: Date;
  largeSpecPosition: 'EXTREME_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'EXTREME_SHORT';
  commercialPosition: 'EXTREME_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'EXTREME_SHORT';
  largeSpecPercentile: number;  // 0-100, where 100 = extreme long
  commercialPercentile: number;  // 0-100, where 100 = extreme long
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;  // 0-100
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reasoning: string[];
}

export class COTAnalyzer {
  private static cotData: Map<string, COTData[]> = new Map();
  private static readonly PERCENTILE_THRESHOLD = {
    EXTREME: 90,  // Top 10% = extreme
    STRONG: 75,   // Top 25% = strong
    NEUTRAL: 25,  // Bottom 25% = neutral
  };

  /**
   * Fetch COT data for a symbol
   * Uses COTDataProvider for real CFTC data
   * Supports inverse COT logic for USD pairs
   * Note: COT data is only available for forex pairs
   */
  static async fetchCOTData(symbol: string, weeks: number = 52): Promise<COTData[]> {
    // Check cache
    const cached = this.cotData.get(symbol);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      // Detect asset type
      const assetType = detectAssetType(symbol);
      
      // COT data is only available for forex pairs
      if (assetType !== 'forex') {
        console.log(`📊 COT data not available for ${symbol} (${assetType}) - COT is forex-only`);
        return [];
      }
      
      const baseCurrency = symbol.slice(0, 3);
      const quoteCurrency = symbol.slice(3, 6);
      
      // Dynamic import to avoid circular dependencies
      const { COTDataProvider } = await import('./data-providers/cot-data');
      
      // For USD pairs, use inverse COT logic (use quote currency COT data)
      let data: COTData[] = [];
      let currencyToFetch = baseCurrency;
      
      if (baseCurrency === 'USD') {
        // For USD pairs (USDJPY, USDCAD, USDCHF), use quote currency COT
        // and we'll invert the logic in the analysis
        currencyToFetch = quoteCurrency;
        console.log(`📊 USD pair detected (${symbol}), using inverse COT from ${quoteCurrency}`);
      }
      
      // Use TFF report (better for forex) with fallback to Legacy
      data = await COTDataProvider.getCOTData(currencyToFetch, weeks, true);
      
      if (data.length > 0) {
      // For USD pairs, invert the positions (long becomes short, short becomes long)
      if (baseCurrency === 'USD') {
        data = data.map(cot => ({
          ...cot,
          // Invert positions: if JPY specs are long, USDJPY should be bearish
          netNonCommercial: -cot.netNonCommercial, // Invert spec positions
          netCommercial: -cot.netCommercial, // Invert commercial positions
          netSmallSpec: -cot.netSmallSpec, // Invert small spec positions
          nonCommercialLong: cot.nonCommercialShort, // Swap long/short
          nonCommercialShort: cot.nonCommercialLong,
          reportableLong: cot.reportableShort, // Commercial long = inverted short
          reportableShort: cot.reportableLong, // Commercial short = inverted long
        }));
        console.log(`✅ Loaded ${data.length} weeks of inverse COT data for ${symbol} (from ${quoteCurrency})`);
      } else {
        console.log(`✅ Loaded ${data.length} weeks of COT data for ${symbol}`);
      }
        
        this.cotData.set(symbol, data);
      } else {
        if (baseCurrency === 'USD') {
          console.warn(`⚠️ No COT data for ${symbol} - tried inverse COT from ${quoteCurrency}`);
        } else {
          console.warn(`⚠️ No COT data for ${symbol} - requires premium data subscription`);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching COT data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Analyze COT data and generate trading signals
   * Returns neutral analysis for non-forex assets
   */
  static async analyzeCOT(symbol: string): Promise<COTAnalysis> {
    // Detect asset type
    const assetType = detectAssetType(symbol);
    
    // COT analysis is only for forex pairs
    if (assetType !== 'forex') {
      const neutral = this.getNeutralAnalysis(symbol);
      neutral.reasoning = [`COT data not available for ${assetType} assets`];
      return neutral;
    }
    
    const cotData = await this.fetchCOTData(symbol);
    
    if (cotData.length === 0) {
      return this.getNeutralAnalysis(symbol);
    }

    const latest = cotData[cotData.length - 1];
    const historical = cotData.slice(0, -1);

    // Calculate percentiles for Large Speculators
    const largeSpecNet = cotData.map(d => d.netNonCommercial);
    const currentLargeSpec = latest.netNonCommercial;
    const largeSpecPercentile = this.calculatePercentile(largeSpecNet, currentLargeSpec);

    // Calculate percentiles for Commercials
    const commercialNet = cotData.map(d => d.netCommercial);
    const currentCommercial = latest.netCommercial;
    const commercialPercentile = this.calculatePercentile(commercialNet, currentCommercial);

    // Determine position extremes
    const largeSpecPosition = this.getPositionType(largeSpecPercentile);
    const commercialPosition = this.getPositionType(commercialPercentile);

    // Generate sentiment
    const sentiment = this.calculateSentiment(largeSpecPosition, commercialPosition);

    // Generate recommendation
    const recommendation = this.generateRecommendation(sentiment, largeSpecPercentile, commercialPercentile);

    // Calculate confidence
    const confidence = this.calculateConfidence(largeSpecPercentile, commercialPercentile);

    // NEW: Calculate COT Index and Momentum
    const cotIndex = this.calculateCOTIndex(largeSpecNet, currentLargeSpec);
    const cotMomentum = this.calculateCOTMomentum(largeSpecNet);

    // Generate reasoning
    const reasoning = this.generateReasoning(
      largeSpecPosition,
      commercialPosition,
      largeSpecPercentile,
      commercialPercentile,
      latest,
      cotIndex,
      cotMomentum
    );

    return {
      symbol,
      date: latest.date,
      largeSpecPosition,
      commercialPosition,
      largeSpecPercentile: Math.round(largeSpecPercentile),
      commercialPercentile: Math.round(commercialPercentile),
      sentiment,
      confidence: Math.round(confidence),
      recommendation,
      reasoning
    };
  }

  /**
   * Calculate COT Index (0-100 scale)
   * Normalizes position to 0-100 where 0 = extreme short, 100 = extreme long
   */
  private static calculateCOTIndex(historical: number[], current: number): number {
    if (historical.length === 0) return 50;
    
    const min = Math.min(...historical);
    const max = Math.max(...historical);
    
    if (max === min) return 50;
    
    // Normalize to 0-100
    const index = ((current - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, index));
  }

  /**
   * Calculate COT Momentum (rate of change)
   * Positive = increasing positions, Negative = decreasing positions
   */
  private static calculateCOTMomentum(historical: number[], period: number = 4): number {
    if (historical.length < period + 1) return 0;
    
    const recent = historical.slice(-period);
    const older = historical.slice(-period * 2, -period);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    // Calculate percentage change
    if (olderAvg === 0) return 0;
    const momentum = ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100;
    
    return Math.round(momentum * 100) / 100;
  }

  /**
   * Calculate percentile of current value in historical data
   */
  private static calculatePercentile(historical: number[], current: number): number {
    if (historical.length === 0) return 50;
    
    const sorted = [...historical].sort((a, b) => a - b);
    const below = sorted.filter(v => v < current).length;
    return (below / sorted.length) * 100;
  }

  /**
   * Get position type based on percentile
   */
  private static getPositionType(percentile: number): 'EXTREME_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'EXTREME_SHORT' {
    if (percentile >= this.PERCENTILE_THRESHOLD.EXTREME) return 'EXTREME_LONG';
    if (percentile >= this.PERCENTILE_THRESHOLD.STRONG) return 'LONG';
    if (percentile <= 100 - this.PERCENTILE_THRESHOLD.EXTREME) return 'EXTREME_SHORT';
    if (percentile <= 100 - this.PERCENTILE_THRESHOLD.STRONG) return 'SHORT';
    return 'NEUTRAL';
  }

  /**
   * Calculate overall sentiment from positions
   */
  private static calculateSentiment(
    largeSpec: 'EXTREME_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'EXTREME_SHORT',
    commercial: 'EXTREME_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'EXTREME_SHORT'
  ): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
    // Large speculators are contrarian (when they're long, price often goes down)
    // Commercials are hedgers (when they're long, price often goes up)
    
    const specScore = this.positionToScore(largeSpec) * -1; // Invert for contrarian
    const commercialScore = this.positionToScore(commercial);
    const totalScore = specScore + commercialScore;

    if (totalScore > 1) return 'BULLISH';
    if (totalScore < -1) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Convert position type to numeric score
   */
  private static positionToScore(position: string): number {
    switch (position) {
      case 'EXTREME_LONG': return 2;
      case 'LONG': return 1;
      case 'NEUTRAL': return 0;
      case 'SHORT': return -1;
      case 'EXTREME_SHORT': return -2;
      default: return 0;
    }
  }

  /**
   * Generate recommendation based on COT analysis
   */
  private static generateRecommendation(
    sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH',
    largeSpecPercentile: number,
    commercialPercentile: number
  ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (sentiment === 'BULLISH' && largeSpecPercentile < 20 && commercialPercentile > 80) {
      return 'STRONG_BUY'; // Commercials very long, specs very short = bullish
    }
    if (sentiment === 'BULLISH') {
      return 'BUY';
    }
    if (sentiment === 'BEARISH' && largeSpecPercentile > 80 && commercialPercentile < 20) {
      return 'STRONG_SELL'; // Commercials very short, specs very long = bearish
    }
    if (sentiment === 'BEARISH') {
      return 'SELL';
    }
    return 'HOLD';
  }

  /**
   * Calculate confidence in COT signal
   * ENHANCED: Improved confidence calculation with trend analysis
   */
  private static calculateConfidence(largeSpecPercentile: number, commercialPercentile: number): number {
    // Higher confidence when positions are at extremes
    const specExtreme = Math.abs(largeSpecPercentile - 50) / 50; // 0-1
    const commercialExtreme = Math.abs(commercialPercentile - 50) / 50; // 0-1
    
    // ENHANCED: Boost confidence when both are at extremes (strong signal)
    const bothExtreme = (specExtreme > 0.8 && commercialExtreme > 0.8) ? 1.2 : 1.0;
    
    // ENHANCED: Boost confidence when positions are diverging (specs vs commercials)
    const divergence = Math.abs(largeSpecPercentile - commercialPercentile) / 100;
    const divergenceBoost = divergence > 0.6 ? 1.15 : 1.0;
    
    const baseConfidence = (specExtreme + commercialExtreme) / 2 * 100;
    
    // Apply boosts
    const enhancedConfidence = baseConfidence * bothExtreme * divergenceBoost;
    
    return Math.round(Math.min(100, enhancedConfidence));
  }

  /**
   * Generate reasoning for COT analysis
   */
  private static generateReasoning(
    largeSpec: string,
    commercial: string,
    largeSpecPercentile: number,
    commercialPercentile: number,
    latest: COTData,
    cotIndex?: number,
    cotMomentum?: number
  ): string[] {
    const reasoning: string[] = [];

    // Large Speculator analysis
    if (largeSpec === 'EXTREME_LONG') {
      reasoning.push(`Large Speculators at EXTREME LONG (${largeSpecPercentile.toFixed(0)}th percentile) - Contrarian bearish signal`);
    } else if (largeSpec === 'EXTREME_SHORT') {
      reasoning.push(`Large Speculators at EXTREME SHORT (${largeSpecPercentile.toFixed(0)}th percentile) - Contrarian bullish signal`);
    } else if (largeSpec === 'LONG') {
      reasoning.push(`Large Speculators LONG (${largeSpecPercentile.toFixed(0)}th percentile) - Slight bearish bias`);
    } else if (largeSpec === 'SHORT') {
      reasoning.push(`Large Speculators SHORT (${largeSpecPercentile.toFixed(0)}th percentile) - Slight bullish bias`);
    }

    // Commercial analysis
    if (commercial === 'EXTREME_LONG') {
      reasoning.push(`Commercials (hedgers) at EXTREME LONG (${commercialPercentile.toFixed(0)}th percentile) - Strong bullish signal`);
    } else if (commercial === 'EXTREME_SHORT') {
      reasoning.push(`Commercials (hedgers) at EXTREME SHORT (${commercialPercentile.toFixed(0)}th percentile) - Strong bearish signal`);
    } else if (commercial === 'LONG') {
      reasoning.push(`Commercials LONG (${commercialPercentile.toFixed(0)}th percentile) - Bullish bias`);
    } else if (commercial === 'SHORT') {
      reasoning.push(`Commercials SHORT (${commercialPercentile.toFixed(0)}th percentile) - Bearish bias`);
    }

    // Net position analysis
    // CRITICAL FIX: Only show "strong alignment" when positions are actually extreme
    // Both must be at least "LONG" or "SHORT" (not NEUTRAL) to show strong alignment
    const isStrongAlignment = (largeSpec === 'LONG' || largeSpec === 'EXTREME_LONG' || largeSpec === 'SHORT' || largeSpec === 'EXTREME_SHORT') &&
                              (commercial === 'LONG' || commercial === 'EXTREME_LONG' || commercial === 'SHORT' || commercial === 'EXTREME_SHORT');
    
    if (isStrongAlignment) {
      if (latest.netCommercial > 0 && latest.netNonCommercial < 0) {
        reasoning.push('Commercials net long while Large Specs net short - Strong bullish alignment');
      } else if (latest.netCommercial < 0 && latest.netNonCommercial > 0) {
        reasoning.push('Commercials net short while Large Specs net long - Strong bearish alignment');
      } else if (latest.netCommercial > 0 && latest.netNonCommercial > 0) {
        reasoning.push('Both Commercials and Large Specs net long - Mixed signals');
      } else if (latest.netCommercial < 0 && latest.netNonCommercial < 0) {
        reasoning.push('Both Commercials and Large Specs net short - Mixed signals');
      }
    } else {
      // When positions are neutral, just note the net positions without claiming "strong alignment"
      if (latest.netCommercial > 0 && latest.netNonCommercial < 0) {
        reasoning.push('Commercials net long, Large Specs net short - Mild bullish bias');
      } else if (latest.netCommercial < 0 && latest.netNonCommercial > 0) {
        reasoning.push('Commercials net short, Large Specs net long - Mild bearish bias');
      }
    }

    // NEW: Add COT Index and Momentum insights
    if (cotIndex !== undefined) {
      if (cotIndex > 80) {
        reasoning.push(`COT Index: ${cotIndex.toFixed(0)} (Extreme Long - Contrarian bearish signal)`);
      } else if (cotIndex < 20) {
        reasoning.push(`COT Index: ${cotIndex.toFixed(0)} (Extreme Short - Contrarian bullish signal)`);
      } else {
        reasoning.push(`COT Index: ${cotIndex.toFixed(0)} (Neutral zone)`);
      }
    }

    if (cotMomentum !== undefined) {
      if (cotMomentum > 5) {
        reasoning.push(`COT Momentum: +${cotMomentum.toFixed(1)}% (Positions increasing - Bullish momentum)`);
      } else if (cotMomentum < -5) {
        reasoning.push(`COT Momentum: ${cotMomentum.toFixed(1)}% (Positions decreasing - Bearish momentum)`);
      }
    }

    return reasoning;
  }

  /**
   * Get neutral analysis when no data available
   */
  private static getNeutralAnalysis(symbol: string): COTAnalysis {
    return {
      symbol,
      date: new Date(),
      largeSpecPosition: 'NEUTRAL',
      commercialPosition: 'NEUTRAL',
      largeSpecPercentile: 50,
      commercialPercentile: 50,
      sentiment: 'NEUTRAL',
      confidence: 0,
      recommendation: 'HOLD',
      reasoning: ['No COT data available']
    };
  }

  /**
   * Check if COT data indicates extreme position (reversal signal)
   */
  static async isExtremePosition(symbol: string): Promise<boolean> {
    const analysis = await this.analyzeCOT(symbol);
    return analysis.largeSpecPosition === 'EXTREME_LONG' || 
           analysis.largeSpecPosition === 'EXTREME_SHORT' ||
           analysis.commercialPosition === 'EXTREME_LONG' ||
           analysis.commercialPosition === 'EXTREME_SHORT';
  }
}

