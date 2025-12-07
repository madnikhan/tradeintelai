/**
 * Divergence Detector
 * Detects RSI and MACD divergences
 * Uses existing indicator calculations
 */

import { PriceData } from '@/types/trading';

export interface DivergenceSignal {
  type: 'bullish' | 'bearish';
  indicator: 'RSI' | 'MACD';
  strength: number; // 0-100
  confirmed: boolean;
}

export interface DivergenceAnalysis {
  rsiDivergence: {
    bullish: boolean;
    bearish: boolean;
    strength: number;
  };
  macdDivergence: {
    bullish: boolean;
    bearish: boolean;
    strength: number;
  };
  signals: DivergenceSignal[];
  overallStrength: number; // 0-100
}

export class DivergenceDetector {
  /**
   * Detect all divergences
   */
  static detect(
    priceData: PriceData[],
    rsi: number[],
    macd: { macd: number; signal: number; histogram: number }[]
  ): DivergenceAnalysis {
    if (priceData.length < 20 || rsi.length < 20 || macd.length < 20) {
      return this.getDefaultAnalysis();
    }

    const prices = priceData.map(d => d.close);

    // Detect RSI divergence
    const rsiDivergence = this.detectRSIDivergence(prices, rsi);

    // Detect MACD divergence
    const macdDivergence = this.detectMACDDivergence(prices, macd);

    // Collect all signals
    const signals: DivergenceSignal[] = [];
    if (rsiDivergence.bullish) {
      signals.push({
        type: 'bullish',
        indicator: 'RSI',
        strength: rsiDivergence.strength,
        confirmed: rsiDivergence.strength > 50,
      });
    }
    if (rsiDivergence.bearish) {
      signals.push({
        type: 'bearish',
        indicator: 'RSI',
        strength: rsiDivergence.strength,
        confirmed: rsiDivergence.strength > 50,
      });
    }
    if (macdDivergence.bullish) {
      signals.push({
        type: 'bullish',
        indicator: 'MACD',
        strength: macdDivergence.strength,
        confirmed: macdDivergence.strength > 50,
      });
    }
    if (macdDivergence.bearish) {
      signals.push({
        type: 'bearish',
        indicator: 'MACD',
        strength: macdDivergence.strength,
        confirmed: macdDivergence.strength > 50,
      });
    }

    // Calculate overall strength
    const overallStrength = this.calculateOverallStrength(rsiDivergence, macdDivergence);

    return {
      rsiDivergence,
      macdDivergence,
      signals,
      overallStrength,
    };
  }

  /**
   * Detect RSI divergence
   * Bullish: Price lower low, RSI higher low
   * Bearish: Price higher high, RSI lower high
   */
  private static detectRSIDivergence(
    prices: number[],
    rsi: number[]
  ): { bullish: boolean; bearish: boolean; strength: number } {
    // Use last 30 bars for divergence detection
    const recentPrices = prices.slice(-30);
    const recentRSI = rsi.slice(-30);

    // Find price peaks and troughs
    const pricePeaks: number[] = [];
    const priceTroughs: number[] = [];

    for (let i = 1; i < recentPrices.length - 1; i++) {
      if (recentPrices[i] > recentPrices[i - 1] && recentPrices[i] > recentPrices[i + 1]) {
        pricePeaks.push(i);
      }
      if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i + 1]) {
        priceTroughs.push(i);
      }
    }

    let bullishDivergence = false;
    let bearishDivergence = false;
    let maxStrength = 0;

    // Check for bullish divergence (price lower low, RSI higher low)
    if (priceTroughs.length >= 2) {
      const lastTrough = priceTroughs[priceTroughs.length - 1];
      const prevTrough = priceTroughs[priceTroughs.length - 2];

      const priceLower = recentPrices[lastTrough] < recentPrices[prevTrough];
      const rsiHigher = recentRSI[lastTrough] > recentRSI[prevTrough];

      if (priceLower && rsiHigher) {
        bullishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastTrough] - recentPrices[prevTrough]) / recentPrices[prevTrough]);
        const rsiChange = Math.abs((recentRSI[lastTrough] - recentRSI[prevTrough]) / (recentRSI[prevTrough] || 1));
        maxStrength = Math.max(maxStrength, Math.min(100, (priceChange + rsiChange) * 200));
      }
    }

    // Check for bearish divergence (price higher high, RSI lower high)
    if (pricePeaks.length >= 2) {
      const lastPeak = pricePeaks[pricePeaks.length - 1];
      const prevPeak = pricePeaks[pricePeaks.length - 2];

      const priceHigher = recentPrices[lastPeak] > recentPrices[prevPeak];
      const rsiLower = recentRSI[lastPeak] < recentRSI[prevPeak];

      if (priceHigher && rsiLower) {
        bearishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastPeak] - recentPrices[prevPeak]) / recentPrices[prevPeak]);
        const rsiChange = Math.abs((recentRSI[lastPeak] - recentRSI[prevPeak]) / (recentRSI[prevPeak] || 1));
        maxStrength = Math.max(maxStrength, Math.min(100, (priceChange + rsiChange) * 200));
      }
    }

    return {
      bullish: bullishDivergence,
      bearish: bearishDivergence,
      strength: Math.round(maxStrength),
    };
  }

  /**
   * Detect MACD divergence
   * Bullish: Price lower low, MACD histogram higher low
   * Bearish: Price higher high, MACD histogram lower high
   */
  private static detectMACDDivergence(
    prices: number[],
    macd: { macd: number; signal: number; histogram: number }[]
  ): { bullish: boolean; bearish: boolean; strength: number } {
    // Use last 30 bars for divergence detection
    const recentPrices = prices.slice(-30);
    const recentMACD = macd.slice(-30);
    const macdHistograms = recentMACD.map(m => m.histogram);

    // Find price peaks and troughs
    const pricePeaks: number[] = [];
    const priceTroughs: number[] = [];

    for (let i = 1; i < recentPrices.length - 1; i++) {
      if (recentPrices[i] > recentPrices[i - 1] && recentPrices[i] > recentPrices[i + 1]) {
        pricePeaks.push(i);
      }
      if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i + 1]) {
        priceTroughs.push(i);
      }
    }

    let bullishDivergence = false;
    let bearishDivergence = false;
    let maxStrength = 0;

    // Check for bullish divergence (price lower low, MACD histogram higher low)
    if (priceTroughs.length >= 2) {
      const lastTrough = priceTroughs[priceTroughs.length - 1];
      const prevTrough = priceTroughs[priceTroughs.length - 2];

      const priceLower = recentPrices[lastTrough] < recentPrices[prevTrough];
      const macdHigher = macdHistograms[lastTrough] > macdHistograms[prevTrough];

      if (priceLower && macdHigher) {
        bullishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastTrough] - recentPrices[prevTrough]) / recentPrices[prevTrough]);
        const macdChange = Math.abs((macdHistograms[lastTrough] - macdHistograms[prevTrough]) / (Math.abs(macdHistograms[prevTrough]) || 0.0001));
        maxStrength = Math.max(maxStrength, Math.min(100, (priceChange + macdChange) * 150));
      }
    }

    // Check for bearish divergence (price higher high, MACD histogram lower high)
    if (pricePeaks.length >= 2) {
      const lastPeak = pricePeaks[pricePeaks.length - 1];
      const prevPeak = pricePeaks[pricePeaks.length - 2];

      const priceHigher = recentPrices[lastPeak] > recentPrices[prevPeak];
      const macdLower = macdHistograms[lastPeak] < macdHistograms[prevPeak];

      if (priceHigher && macdLower) {
        bearishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastPeak] - recentPrices[prevPeak]) / recentPrices[prevPeak]);
        const macdChange = Math.abs((macdHistograms[lastPeak] - macdHistograms[prevPeak]) / (Math.abs(macdHistograms[prevPeak]) || 0.0001));
        maxStrength = Math.max(maxStrength, Math.min(100, (priceChange + macdChange) * 150));
      }
    }

    return {
      bullish: bullishDivergence,
      bearish: bearishDivergence,
      strength: Math.round(maxStrength),
    };
  }

  /**
   * Calculate overall divergence strength
   */
  private static calculateOverallStrength(
    rsiDivergence: { bullish: boolean; bearish: boolean; strength: number },
    macdDivergence: { bullish: boolean; bearish: boolean; strength: number }
  ): number {
    let totalStrength = 0;
    let count = 0;

    if (rsiDivergence.bullish || rsiDivergence.bearish) {
      totalStrength += rsiDivergence.strength;
      count++;
    }

    if (macdDivergence.bullish || macdDivergence.bearish) {
      totalStrength += macdDivergence.strength;
      count++;
    }

    // If both indicators show divergence in same direction, increase strength
    if (
      (rsiDivergence.bullish && macdDivergence.bullish) ||
      (rsiDivergence.bearish && macdDivergence.bearish)
    ) {
      return Math.min(100, (totalStrength / count) * 1.2);
    }

    return count > 0 ? Math.round(totalStrength / count) : 0;
  }

  /**
   * Get default analysis
   */
  private static getDefaultAnalysis(): DivergenceAnalysis {
    return {
      rsiDivergence: {
        bullish: false,
        bearish: false,
        strength: 0,
      },
      macdDivergence: {
        bullish: false,
        bearish: false,
        strength: 0,
      },
      signals: [],
      overallStrength: 0,
    };
  }
}

