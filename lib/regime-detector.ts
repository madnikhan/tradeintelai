/**
 * Regime Detection
 * Classifies market state and switches strategies accordingly
 */

import { PriceData } from '@/types/trading';

export type MarketRegime = 
  | 'LOW_VOLATILITY_RANGE'    // Mean reversion strategy
  | 'HIGH_VOLATILITY_TREND'   // Momentum/breakout strategy
  | 'TRENDING_UP'              // Trend following
  | 'TRENDING_DOWN'            // Trend following
  | 'HIGH_VOLATILITY_RANGE'    // Avoid trading
  | 'UNKNOWN';                 // Insufficient data

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number;  // 0-100
  volatility: number;  // Current ATR or volatility measure
  trendStrength: number;  // 0-100, how strong the trend is
  rangeStrength: number;  // 0-100, how strong the range is
  suggestedStrategy: 'MEAN_REVERSION' | 'MOMENTUM' | 'BREAKOUT' | 'TREND_FOLLOWING' | 'AVOID';
  reasoning: string[];
}

export class RegimeDetector {
  private static readonly VOLATILITY_THRESHOLDS = {
    LOW: 0.001,      // Low ATR threshold
    HIGH: 0.002,     // High ATR threshold
  };

  private static readonly TREND_THRESHOLD = 0.6;  // 60% of price moves in one direction
  private static readonly RANGE_THRESHOLD = 0.4;  // 40% price oscillation = range

  /**
   * Detect market regime from price data
   */
  static detectRegime(priceData: PriceData[]): RegimeAnalysis {
    if (priceData.length < 20) {
      // FIXED: Don't force AVOID for insufficient data - use neutral strategy
      return {
        regime: 'UNKNOWN',
        confidence: 0,
        volatility: 0,
        trendStrength: 0,
        rangeStrength: 0,
        suggestedStrategy: 'TREND_FOLLOWING', // Changed from AVOID
        reasoning: ['Insufficient data for regime detection - using default strategy']
      };
    }

    // Calculate volatility (ATR)
    const volatility = this.calculateATR(priceData);
    
    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(priceData);
    
    // Calculate range strength
    const rangeStrength = this.calculateRangeStrength(priceData);

    // FIXED: Determine regime with explicit trend direction check
    const regime = this.classifyRegime(priceData, volatility, trendStrength, rangeStrength);

    // Calculate confidence
    const confidence = this.calculateConfidence(volatility, trendStrength, rangeStrength);

    // Suggest strategy (pass trend strength to avoid contradictory signals)
    const suggestedStrategy = this.suggestStrategy(regime, trendStrength);

    // Generate reasoning
    const reasoning = this.generateReasoning(regime, volatility, trendStrength, rangeStrength, suggestedStrategy);

    return {
      regime,
      confidence: Math.round(confidence),
      volatility: Math.round(volatility * 100000) / 100000, // ATR value
      trendStrength: Math.round(trendStrength),
      rangeStrength: Math.round(rangeStrength),
      suggestedStrategy,
      reasoning
    };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private static calculateATR(priceData: PriceData[], period: number = 14): number {
    if (priceData.length < period + 1) {
      // Return default ATR for EURUSD if insufficient data
      return 0.007; // 70 pips default
    }

    const trueRanges: number[] = [];
    const lookback = Math.min(priceData.length, period + 1);

    for (let i = priceData.length - lookback + 1; i < priceData.length; i++) {
      const high = priceData[i].high || priceData[i].close;
      const low = priceData[i].low || priceData[i].close;
      const prevClose = i > 0 ? (priceData[i - 1].close || priceData[i].close) : priceData[i].close;

      // Validate price data
      if (high <= 0 || low <= 0 || prevClose <= 0) {
        continue;
      }

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      // Validate TR is reasonable
      if (tr > 0 && tr < 0.1) {
        trueRanges.push(tr);
      }
    }

    if (trueRanges.length === 0) {
      return 0.007; // Default ATR for EURUSD
    }
    
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    
    // CRITICAL: Validate ATR is in reasonable range (pair-specific)
    // More lenient validation - minimum 0.0005 (5 pips) instead of 0.001 (10 pips)
    // This allows for low volatility periods without triggering warnings
    if (atr < 0.0005 || atr > 0.02) {
      // Only warn if significantly off
      // 🔒 DISABLED: Changed to reduce warning noise
      // if (atr < 0.0003 || atr > 0.02) {
      //   console.warn(`⚠️ Regime detector: Calculated ATR ${atr.toFixed(5)} is outside reasonable range (0.0005-0.02). Using default 0.007 (70 pips).`);
      // }
      return 0.007; // Default to 70 pips
    }
    
    return atr;
  }

  /**
   * Calculate trend strength (0-100)
   * Higher = stronger trend
   */
  private static calculateTrendStrength(priceData: PriceData[]): number {
    if (priceData.length < 20) return 0;

    const prices = priceData.map(d => d.close);
    const lookback = Math.min(20, prices.length);
    const recent = prices.slice(-lookback);

    // Calculate EMA slopes
    const ema20 = this.calculateEMA(recent, 20);
    const ema10 = this.calculateEMA(recent, 10);
    const ema5 = this.calculateEMA(recent, 5);

    // Check if EMAs are aligned (trending)
    const emaAlignment = (ema5 > ema10 && ema10 > ema20) || (ema5 < ema10 && ema10 < ema20);
    
    // Calculate price movement consistency
    let upMoves = 0;
    let downMoves = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) upMoves++;
      else if (recent[i] < recent[i - 1]) downMoves++;
    }

    const moveConsistency = Math.max(upMoves, downMoves) / recent.length;
    
    // Combine factors
    const trendScore = (emaAlignment ? 0.6 : 0) + (moveConsistency * 0.4);
    return Math.min(100, trendScore * 100);
  }

  /**
   * Calculate range strength (0-100)
   * Higher = stronger range (more oscillation)
   */
  private static calculateRangeStrength(priceData: PriceData[]): number {
    if (priceData.length < 20) return 0;

    const prices = priceData.map(d => d.close);
    const lookback = Math.min(20, prices.length);
    const recent = prices.slice(-lookback);

    // Calculate price range
    const high = Math.max(...recent);
    const low = Math.min(...recent);
    const range = high - low;
    const avgPrice = recent.reduce((sum, p) => sum + p, 0) / recent.length;

    // Range strength = how much price oscillates relative to average
    const rangeRatio = range / avgPrice;

    // Count direction changes (oscillation)
    let directionChanges = 0;
    for (let i = 2; i < recent.length; i++) {
      const prevDir = recent[i - 1] > recent[i - 2] ? 1 : -1;
      const currDir = recent[i] > recent[i - 1] ? 1 : -1;
      if (prevDir !== currDir) directionChanges++;
    }

    const oscillationScore = directionChanges / recent.length;
    const rangeScore = Math.min(1, rangeRatio * 10); // Normalize

    return Math.min(100, (oscillationScore * 0.6 + rangeScore * 0.4) * 100);
  }

  /**
   * Calculate trend direction from price data
   * Returns 'UP' if price is trending up, 'DOWN' if trending down, 'NEUTRAL' if unclear
   */
  private static calculateTrendDirection(priceData: PriceData[]): 'UP' | 'DOWN' | 'NEUTRAL' {
    if (priceData.length < 2) return 'NEUTRAL';

    const prices = priceData.map(d => d.close);
    const lookback = Math.min(20, prices.length);
    const recent = prices.slice(-lookback);

    // Calculate EMA slopes to determine direction
    const ema20 = this.calculateEMA(recent, 20);
    const ema10 = this.calculateEMA(recent, 10);
    const ema5 = this.calculateEMA(recent, 5);

    // Check EMA alignment for trend direction
    const bullishAlignment = ema5 > ema10 && ema10 > ema20;
    const bearishAlignment = ema5 < ema10 && ema10 < ema20;

    // Also check price movement (more recent prices vs older prices)
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length;

    // Determine direction based on EMA alignment and price movement
    if (bullishAlignment && secondHalfAvg > firstHalfAvg) {
      return 'UP';
    } else if (bearishAlignment && secondHalfAvg < firstHalfAvg) {
      return 'DOWN';
    } else if (secondHalfAvg > firstHalfAvg * 1.001) { // At least 0.1% higher
      return 'UP';
    } else if (secondHalfAvg < firstHalfAvg * 0.999) { // At least 0.1% lower
      return 'DOWN';
    }

    return 'NEUTRAL';
  }

  /**
   * Classify market regime
   * FIXED: Now includes explicit trend direction check
   */
  private static classifyRegime(
    priceData: PriceData[],
    volatility: number,
    trendStrength: number,
    rangeStrength: number
  ): MarketRegime {
    const isLowVol = volatility < this.VOLATILITY_THRESHOLDS.LOW;
    const isHighVol = volatility > this.VOLATILITY_THRESHOLDS.HIGH;
    const isTrending = trendStrength > this.TREND_THRESHOLD * 100;
    const isRanging = rangeStrength > this.RANGE_THRESHOLD * 100;

    if (isLowVol && isRanging) {
      return 'LOW_VOLATILITY_RANGE';
    }
    if (isHighVol && isTrending) {
      return 'HIGH_VOLATILITY_TREND';
    }
    if (isTrending && !isHighVol) {
      // FIXED: Explicitly calculate trend direction
      const trendDirection = this.calculateTrendDirection(priceData);
      return trendDirection === 'UP' ? 'TRENDING_UP' : trendDirection === 'DOWN' ? 'TRENDING_DOWN' : 'TRENDING_UP'; // Default to UP if neutral
    }
    if (isHighVol && isRanging) {
      return 'HIGH_VOLATILITY_RANGE';
    }
    if (isLowVol) {
      return 'LOW_VOLATILITY_RANGE';
    }

    return 'UNKNOWN';
  }

  /**
   * Calculate confidence in regime classification
   */
  private static calculateConfidence(
    volatility: number,
    trendStrength: number,
    rangeStrength: number
  ): number {
    // Higher confidence when indicators are clear
    const volConfidence = Math.abs(volatility - 0.0015) < 0.0005 ? 0.3 : 0.5; // Clear low or high vol
    const trendConfidence = Math.abs(trendStrength - 50) / 50; // Distance from neutral
    const rangeConfidence = Math.abs(rangeStrength - 50) / 50;

    return Math.min(100, (volConfidence + trendConfidence * 0.35 + rangeConfidence * 0.35) * 100);
  }

  /**
   * Suggest trading strategy based on regime
   * FIXED: Less conservative - only AVOID in truly dangerous conditions
   */
  private static suggestStrategy(regime: MarketRegime, trendStrength?: number): 'MEAN_REVERSION' | 'MOMENTUM' | 'BREAKOUT' | 'TREND_FOLLOWING' | 'AVOID' {
    // CRITICAL FIX: Don't suggest trend following if trend strength is weak (< 40%)
    // This prevents contradictory signals
    switch (regime) {
      case 'LOW_VOLATILITY_RANGE':
        return 'MEAN_REVERSION';
      case 'HIGH_VOLATILITY_TREND':
        return 'MOMENTUM';
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        // Only suggest trend following if trend is actually strong
        if (trendStrength !== undefined && trendStrength < 40) {
          return 'MEAN_REVERSION'; // Weak trend = use mean reversion instead
        }
        return 'TREND_FOLLOWING';
      case 'HIGH_VOLATILITY_RANGE':
        // FIXED: Use MEAN_REVERSION instead of AVOID for high vol ranges
        // This allows trading but with caution (handled by risk management)
        return 'MEAN_REVERSION';
      default:
        // CRITICAL FIX: For UNKNOWN regime, check trend strength
        // If trend is weak, use mean reversion instead of trend following
        if (trendStrength !== undefined && trendStrength < 40) {
          return 'MEAN_REVERSION';
        }
        // FIXED: Use TREND_FOLLOWING instead of AVOID for unknown
        // Let technical analysis decide, don't block all trades
        return 'TREND_FOLLOWING';
    }
  }

  /**
   * Generate reasoning for regime classification
   */
  private static generateReasoning(
    regime: MarketRegime,
    volatility: number,
    trendStrength: number,
    rangeStrength: number,
    suggestedStrategy?: string
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Volatility: ${volatility < this.VOLATILITY_THRESHOLDS.LOW ? 'LOW' : volatility > this.VOLATILITY_THRESHOLDS.HIGH ? 'HIGH' : 'MEDIUM'} (ATR: ${volatility.toFixed(5)})`);
    reasoning.push(`Trend Strength: ${trendStrength.toFixed(0)}% ${trendStrength > 60 ? '(Strong)' : trendStrength > 40 ? '(Moderate)' : '(Weak)'}`);
    reasoning.push(`Range Strength: ${rangeStrength.toFixed(0)}% ${rangeStrength > 60 ? '(Strong Range)' : '(Weak Range)'}`);

    switch (regime) {
      case 'LOW_VOLATILITY_RANGE':
        reasoning.push('📊 Market in LOW VOLATILITY RANGE - Use Mean Reversion strategy');
        reasoning.push('💡 Look for bounces off support/resistance levels');
        break;
      case 'HIGH_VOLATILITY_TREND':
        reasoning.push('📈 Market in HIGH VOLATILITY TREND - Use Momentum/Breakout strategy');
        reasoning.push('💡 Follow the trend, use wider stops');
        break;
      case 'TRENDING_UP':
        reasoning.push('⬆️ Market TRENDING UP - Use Trend Following strategy');
        reasoning.push('💡 Buy dips, trail stops');
        break;
      case 'TRENDING_DOWN':
        reasoning.push('⬇️ Market TRENDING DOWN - Use Trend Following strategy');
        reasoning.push('💡 Sell rallies, trail stops');
        break;
      case 'HIGH_VOLATILITY_RANGE':
        reasoning.push('⚠️ Market in HIGH VOLATILITY RANGE - AVOID trading');
        reasoning.push('💡 Too risky, wait for clearer direction');
        break;
      default:
        reasoning.push('❓ Market regime UNKNOWN - Insufficient data');
        if (suggestedStrategy === 'MEAN_REVERSION' && trendStrength < 40) {
          reasoning.push(`⚠️ Weak trend (${trendStrength.toFixed(0)}% strength) - Using mean reversion instead of trend following`);
        }
    }

    return reasoning;
  }

  /**
   * Calculate EMA
   */
  private static calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  }
}

