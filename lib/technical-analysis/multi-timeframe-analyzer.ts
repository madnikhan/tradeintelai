/**
 * Multi-Timeframe Analyzer
 * Analyzes trends across multiple timeframes (H1, H4, D1)
 * Uses MT5 multi-timeframe data
 */

import { MT5PriceDataProvider } from '@/lib/data-providers/mt5-price-data';
import { PriceData } from '@/types/trading';
import { logger } from '@/lib/logger';

export interface TimeframeAnalysis {
  timeframe: 'H1' | 'H4' | 'D1';
  trend: 'up' | 'down' | 'neutral';
  strength: number; // 0-100
  ema20: number;
  ema50: number;
  pricePosition: number; // Position relative to EMA (0-1)
}

export interface MultiTimeframeAnalysis {
  h1: TimeframeAnalysis;
  h4: TimeframeAnalysis;
  d1: TimeframeAnalysis;
  alignment: 'bullish' | 'bearish' | 'mixed';
  alignmentStrength: number; // 0-100
  recommendation: 'trade_with_trend' | 'wait_for_alignment' | 'counter_trend';
}

export class MultiTimeframeAnalyzer {
  /**
   * Analyze multiple timeframes
   */
  static async analyze(symbol: string): Promise<MultiTimeframeAnalysis> {
    try {
      // Fetch data from all timeframes in parallel
      const [h1Data, h4Data, d1Data] = await Promise.all([
        MT5PriceDataProvider.getHistoricalData(symbol, 'H1', 100).catch(() => []),
        MT5PriceDataProvider.getHistoricalData(symbol, 'H4', 100).catch(() => []),
        MT5PriceDataProvider.getHistoricalData(symbol, 'D1', 100).catch(() => []),
      ]);

      // Analyze each timeframe
      const h1 = this.analyzeTimeframe(h1Data, 'H1');
      const h4 = this.analyzeTimeframe(h4Data, 'H4');
      const d1 = this.analyzeTimeframe(d1Data, 'D1');

      // Determine alignment
      const alignment = this.determineAlignment(h1, h4, d1);
      const alignmentStrength = this.calculateAlignmentStrength(h1, h4, d1);
      const recommendation = this.getRecommendation(alignment, alignmentStrength, h1, h4, d1);

      return {
        h1,
        h4,
        d1,
        alignment,
        alignmentStrength,
        recommendation,
      };
    } catch (error) {
      logger.warn(`⚠️ Multi-timeframe analysis error for ${symbol}:`, error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Analyze a single timeframe
   */
  private static analyzeTimeframe(
    priceData: PriceData[],
    timeframe: 'H1' | 'H4' | 'D1'
  ): TimeframeAnalysis {
    if (priceData.length < 50) {
      return this.getDefaultTimeframeAnalysis(timeframe);
    }

    const prices = priceData.map(d => d.close);
    const currentPrice = prices[prices.length - 1];

    // Calculate EMAs
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);

    // Determine trend
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    let strength = 0;

    if (currentPrice > ema50 && ema20 > ema50) {
      trend = 'up';
      // Calculate strength based on distance from EMAs
      const distanceFromEMA50 = (currentPrice - ema50) / ema50;
      const distanceFromEMA20 = (currentPrice - ema20) / ema20;
      strength = Math.min(100, (Math.abs(distanceFromEMA50) + Math.abs(distanceFromEMA20)) * 500);
    } else if (currentPrice < ema50 && ema20 < ema50) {
      trend = 'down';
      const distanceFromEMA50 = (ema50 - currentPrice) / ema50;
      const distanceFromEMA20 = (ema20 - currentPrice) / ema20;
      strength = Math.min(100, (Math.abs(distanceFromEMA50) + Math.abs(distanceFromEMA20)) * 500);
    }

    // Calculate price position relative to EMA range
    const emaRange = Math.abs(ema50 - ema20);
    let pricePosition = 0.5; // Neutral
    if (emaRange > 0) {
      if (currentPrice > ema50) {
        pricePosition = 0.5 + Math.min(0.5, (currentPrice - ema50) / (emaRange * 2));
      } else {
        pricePosition = 0.5 - Math.min(0.5, (ema50 - currentPrice) / (emaRange * 2));
      }
    }

    return {
      timeframe,
      trend,
      strength: Math.round(strength),
      ema20,
      ema50,
      pricePosition: Math.round(pricePosition * 100) / 100,
    };
  }

  /**
   * Calculate EMA
   */
  private static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1];
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Determine alignment across timeframes
   */
  private static determineAlignment(
    h1: TimeframeAnalysis,
    h4: TimeframeAnalysis,
    d1: TimeframeAnalysis
  ): 'bullish' | 'bearish' | 'mixed' {
    const trends = [h1.trend, h4.trend, d1.trend];
    const upCount = trends.filter(t => t === 'up').length;
    const downCount = trends.filter(t => t === 'down').length;

    if (upCount >= 2) return 'bullish';
    if (downCount >= 2) return 'bearish';
    return 'mixed';
  }

  /**
   * Calculate alignment strength
   */
  private static calculateAlignmentStrength(
    h1: TimeframeAnalysis,
    h4: TimeframeAnalysis,
    d1: TimeframeAnalysis
  ): number {
    const alignment = this.determineAlignment(h1, h4, d1);

    if (alignment === 'mixed') return 0;

    // Calculate average strength of aligned timeframes
    const strengths = [h1.strength, h4.strength, d1.strength];
    const alignedStrengths = strengths.filter((s, i) => {
      const trend = [h1.trend, h4.trend, d1.trend][i];
      return (alignment === 'bullish' && trend === 'up') || (alignment === 'bearish' && trend === 'down');
    });

    if (alignedStrengths.length === 0) return 0;

    const avgStrength = alignedStrengths.reduce((sum, s) => sum + s, 0) / alignedStrengths.length;
    return Math.round(avgStrength);
  }

  /**
   * Get trading recommendation based on alignment
   */
  private static getRecommendation(
    alignment: 'bullish' | 'bearish' | 'mixed',
    alignmentStrength: number,
    h1: TimeframeAnalysis,
    h4: TimeframeAnalysis,
    d1: TimeframeAnalysis
  ): 'trade_with_trend' | 'wait_for_alignment' | 'counter_trend' {
    if (alignment === 'mixed' || alignmentStrength < 50) {
      return 'wait_for_alignment';
    }

    // Higher timeframe (D1) has more weight
    if (alignment === 'bullish') {
      if (d1.trend === 'up' && h4.trend === 'up' && h1.trend === 'up') {
        return 'trade_with_trend';
      }
      if (d1.trend === 'up' && h4.trend === 'up' && h1.trend === 'down') {
        return 'counter_trend'; // Wait for H1 to align
      }
    } else {
      if (d1.trend === 'down' && h4.trend === 'down' && h1.trend === 'down') {
        return 'trade_with_trend';
      }
      if (d1.trend === 'down' && h4.trend === 'down' && h1.trend === 'up') {
        return 'counter_trend'; // Wait for H1 to align
      }
    }

    return alignmentStrength > 70 ? 'trade_with_trend' : 'wait_for_alignment';
  }

  /**
   * Get default analysis
   */
  private static getDefaultAnalysis(): MultiTimeframeAnalysis {
    return {
      h1: this.getDefaultTimeframeAnalysis('H1'),
      h4: this.getDefaultTimeframeAnalysis('H4'),
      d1: this.getDefaultTimeframeAnalysis('D1'),
      alignment: 'mixed',
      alignmentStrength: 0,
      recommendation: 'wait_for_alignment',
    };
  }

  /**
   * Get default timeframe analysis
   */
  private static getDefaultTimeframeAnalysis(timeframe: 'H1' | 'H4' | 'D1'): TimeframeAnalysis {
    return {
      timeframe,
      trend: 'neutral',
      strength: 0,
      ema20: 0,
      ema50: 0,
      pricePosition: 0.5,
    };
  }
}

