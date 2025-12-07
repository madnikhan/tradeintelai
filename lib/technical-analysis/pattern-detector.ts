/**
 * Pattern Detector
 * Detects candlestick and chart patterns
 * Uses existing OHLC data
 */

import { PriceData } from '@/types/trading';

export interface CandlestickPattern {
  type: 'engulfing' | 'doji' | 'hammer' | 'shooting_star' | 'hanging_man' | 'inverted_hammer';
  bullish: boolean;
  confidence: number; // 0-100
  position: number; // Index in price data
}

export interface ChartPattern {
  type: 'head_shoulders' | 'double_top' | 'double_bottom' | 'triangle' | 'flag' | 'pennant';
  bullish: boolean;
  confidence: number; // 0-100
  completed: boolean;
}

export interface PatternAnalysis {
  candlestickPatterns: CandlestickPattern[];
  chartPatterns: ChartPattern[];
  strongestPattern: CandlestickPattern | ChartPattern | null;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  signalStrength: number; // 0-100
}

export class PatternDetector {
  /**
   * Detect all patterns
   */
  static detect(priceData: PriceData[]): PatternAnalysis {
    if (priceData.length < 10) {
      return this.getDefaultAnalysis();
    }

    // Detect candlestick patterns
    const candlestickPatterns = this.detectCandlestickPatterns(priceData);

    // Detect chart patterns
    const chartPatterns = this.detectChartPatterns(priceData);

    // Find strongest pattern
    const strongestPattern = this.findStrongestPattern(candlestickPatterns, chartPatterns);

    // Determine overall signal
    const { overallSignal, signalStrength } = this.determineOverallSignal(
      candlestickPatterns,
      chartPatterns
    );

    return {
      candlestickPatterns,
      chartPatterns,
      strongestPattern,
      overallSignal,
      signalStrength,
    };
  }

  /**
   * Detect candlestick patterns
   */
  private static detectCandlestickPatterns(priceData: PriceData[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];

    // Analyze last 10 candles
    const recent = priceData.slice(-10);

    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i - 1];

      // Engulfing patterns
      const bullishEngulfing = this.isBullishEngulfing(previous, current);
      const bearishEngulfing = this.isBearishEngulfing(previous, current);

      if (bullishEngulfing) {
        patterns.push({
          type: 'engulfing',
          bullish: true,
          confidence: this.calculateEngulfingConfidence(previous, current),
          position: priceData.length - recent.length + i,
        });
      }

      if (bearishEngulfing) {
        patterns.push({
          type: 'engulfing',
          bullish: false,
          confidence: this.calculateEngulfingConfidence(previous, current),
          position: priceData.length - recent.length + i,
        });
      }

      // Doji
      const doji = this.isDoji(current);
      if (doji) {
        patterns.push({
          type: 'doji',
          bullish: false, // Doji is neutral, but often reversal
          confidence: this.calculateDojiConfidence(current),
          position: priceData.length - recent.length + i,
        });
      }

      // Hammer
      const hammer = this.isHammer(current);
      if (hammer) {
        patterns.push({
          type: 'hammer',
          bullish: true,
          confidence: this.calculateHammerConfidence(current),
          position: priceData.length - recent.length + i,
        });
      }

      // Shooting Star
      const shootingStar = this.isShootingStar(current);
      if (shootingStar) {
        patterns.push({
          type: 'shooting_star',
          bullish: false,
          confidence: this.calculateShootingStarConfidence(current),
          position: priceData.length - recent.length + i,
        });
      }
    }

    return patterns;
  }

  /**
   * Detect chart patterns
   */
  private static detectChartPatterns(priceData: PriceData[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    if (priceData.length < 20) {
      return patterns;
    }

    const prices = priceData.map(d => d.close);

    // Double Top
    const doubleTop = this.detectDoubleTop(prices);
    if (doubleTop) {
      patterns.push({
        type: 'double_top',
        bullish: false,
        confidence: doubleTop.confidence,
        completed: doubleTop.completed,
      });
    }

    // Double Bottom
    const doubleBottom = this.detectDoubleBottom(prices);
    if (doubleBottom) {
      patterns.push({
        type: 'double_bottom',
        bullish: true,
        confidence: doubleBottom.confidence,
        completed: doubleBottom.completed,
      });
    }

    // Triangle
    const triangle = this.detectTriangle(prices);
    if (triangle) {
      patterns.push({
        type: 'triangle',
        bullish: triangle.bullish,
        confidence: triangle.confidence,
        completed: triangle.completed,
      });
    }

    return patterns;
  }

  // Candlestick pattern detection methods

  private static isBullishEngulfing(prev: PriceData, curr: PriceData): boolean {
    const prevBearish = prev.close < prev.open;
    const currBullish = curr.close > curr.open;
    return (
      prevBearish &&
      currBullish &&
      curr.open < prev.close &&
      curr.close > prev.open
    );
  }

  private static isBearishEngulfing(prev: PriceData, curr: PriceData): boolean {
    const prevBullish = prev.close > prev.open;
    const currBearish = curr.close < curr.open;
    return (
      prevBullish &&
      currBearish &&
      curr.open > prev.close &&
      curr.close < prev.open
    );
  }

  private static calculateEngulfingConfidence(prev: PriceData, curr: PriceData): number {
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    const bodyRatio = currBody / (prevBody || 0.0001);
    return Math.min(100, bodyRatio * 50);
  }

  private static isDoji(candle: PriceData): boolean {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    return range > 0 && body / range < 0.1; // Body is less than 10% of range
  }

  private static calculateDojiConfidence(candle: PriceData): number {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    return Math.min(100, (1 - body / range) * 100);
  }

  private static isHammer(candle: PriceData): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const range = candle.high - candle.low;

    return (
      range > 0 &&
      lowerShadow > body * 2 &&
      upperShadow < body * 0.5 &&
      body / range > 0.1
    );
  }

  private static calculateHammerConfidence(candle: PriceData): number {
    const body = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    return Math.min(100, (lowerShadow / range) * 100);
  }

  private static isShootingStar(candle: PriceData): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const range = candle.high - candle.low;

    return (
      range > 0 &&
      upperShadow > body * 2 &&
      lowerShadow < body * 0.5 &&
      body / range > 0.1
    );
  }

  private static calculateShootingStarConfidence(candle: PriceData): number {
    const body = Math.abs(candle.close - candle.open);
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    return Math.min(100, (upperShadow / range) * 100);
  }

  // Chart pattern detection methods

  private static detectDoubleTop(prices: number[]): { confidence: number; completed: boolean } | null {
    if (prices.length < 20) return null;

    const recent = prices.slice(-20);
    const maxIndex = recent.indexOf(Math.max(...recent));
    if (maxIndex < 5 || maxIndex > recent.length - 5) return null;

    // Find two peaks around the max
    const leftPeak = Math.max(...recent.slice(0, maxIndex));
    const rightPeak = Math.max(...recent.slice(maxIndex + 1));

    const peakDifference = Math.abs(leftPeak - rightPeak) / leftPeak;
    if (peakDifference < 0.02) {
      // Peaks are within 2% of each other
      return {
        confidence: Math.min(100, (1 - peakDifference * 50) * 100),
        completed: recent[recent.length - 1] < Math.min(leftPeak, rightPeak) * 0.98,
      };
    }

    return null;
  }

  private static detectDoubleBottom(prices: number[]): { confidence: number; completed: boolean } | null {
    if (prices.length < 20) return null;

    const recent = prices.slice(-20);
    const minIndex = recent.indexOf(Math.min(...recent));
    if (minIndex < 5 || minIndex > recent.length - 5) return null;

    // Find two troughs around the min
    const leftTrough = Math.min(...recent.slice(0, minIndex));
    const rightTrough = Math.min(...recent.slice(minIndex + 1));

    const troughDifference = Math.abs(leftTrough - rightTrough) / leftTrough;
    if (troughDifference < 0.02) {
      // Troughs are within 2% of each other
      return {
        confidence: Math.min(100, (1 - troughDifference * 50) * 100),
        completed: recent[recent.length - 1] > Math.max(leftTrough, rightTrough) * 1.02,
      };
    }

    return null;
  }

  private static detectTriangle(prices: number[]): { bullish: boolean; confidence: number; completed: boolean } | null {
    if (prices.length < 15) return null;

    const recent = prices.slice(-15);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstHigh = Math.max(...firstHalf);
    const firstLow = Math.min(...firstHalf);
    const secondHigh = Math.max(...secondHalf);
    const secondLow = Math.min(...secondHalf);

    const firstRange = firstHigh - firstLow;
    const secondRange = secondHigh - secondLow;

    // Ascending triangle: similar highs, rising lows
    if (Math.abs(firstHigh - secondHigh) / firstHigh < 0.01 && secondLow > firstLow) {
      return {
        bullish: true,
        confidence: Math.min(100, (secondLow / firstLow - 1) * 200),
        completed: recent[recent.length - 1] > firstHigh,
      };
    }

    // Descending triangle: similar lows, falling highs
    if (Math.abs(firstLow - secondLow) / firstLow < 0.01 && secondHigh < firstHigh) {
      return {
        bullish: false,
        confidence: Math.min(100, (1 - secondHigh / firstHigh) * 200),
        completed: recent[recent.length - 1] < firstLow,
      };
    }

    return null;
  }

  private static findStrongestPattern(
    candlestickPatterns: CandlestickPattern[],
    chartPatterns: ChartPattern[]
  ): CandlestickPattern | ChartPattern | null {
    const allPatterns = [...candlestickPatterns, ...chartPatterns] as Array<
      CandlestickPattern | ChartPattern
    >;

    if (allPatterns.length === 0) return null;

    return allPatterns.reduce((strongest, current) => {
      return current.confidence > strongest.confidence ? current : strongest;
    });
  }

  private static determineOverallSignal(
    candlestickPatterns: CandlestickPattern[],
    chartPatterns: ChartPattern[]
  ): { overallSignal: 'bullish' | 'bearish' | 'neutral'; signalStrength: number } {
    let bullishScore = 0;
    let bearishScore = 0;
    let totalConfidence = 0;

    // Score candlestick patterns
    for (const pattern of candlestickPatterns) {
      if (pattern.bullish) {
        bullishScore += pattern.confidence;
      } else {
        bearishScore += pattern.confidence;
      }
      totalConfidence += pattern.confidence;
    }

    // Score chart patterns
    for (const pattern of chartPatterns) {
      if (pattern.bullish) {
        bullishScore += pattern.confidence;
      } else {
        bearishScore += pattern.confidence;
      }
      totalConfidence += pattern.confidence;
    }

    if (totalConfidence === 0) {
      return { overallSignal: 'neutral', signalStrength: 0 };
    }

    const bullishRatio = bullishScore / totalConfidence;
    const bearishRatio = bearishScore / totalConfidence;

    if (bullishRatio > 0.6) {
      return { overallSignal: 'bullish', signalStrength: Math.round(bullishRatio * 100) };
    } else if (bearishRatio > 0.6) {
      return { overallSignal: 'bearish', signalStrength: Math.round(bearishRatio * 100) };
    } else {
      return { overallSignal: 'neutral', signalStrength: Math.round(Math.max(bullishRatio, bearishRatio) * 100) };
    }
  }

  private static getDefaultAnalysis(): PatternAnalysis {
    return {
      candlestickPatterns: [],
      chartPatterns: [],
      strongestPattern: null,
      overallSignal: 'neutral',
      signalStrength: 0,
    };
  }
}

