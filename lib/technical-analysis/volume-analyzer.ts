/**
 * Volume Analyzer
 * Analyzes volume trends and volume-price relationships
 * Uses MT5 tick volume data
 */

import { PriceData } from '@/types/trading';

export interface VolumeAnalysis {
  trend: 'increasing' | 'decreasing' | 'neutral';
  averageVolume: number;
  currentVolume: number;
  volumeRatio: number; // Current volume / Average volume
  volumeDivergence: {
    bullish: boolean;
    bearish: boolean;
    strength: number; // 0-100
  };
  volumeConfirmation: {
    confirmed: boolean;
    strength: number; // 0-100
  };
}

export class VolumeAnalyzer {
  /**
   * Analyze volume trends and patterns
   */
  static analyze(priceData: PriceData[]): VolumeAnalysis {
    if (priceData.length < 20) {
      return this.getDefaultAnalysis();
    }

    const volumes = priceData.map(d => d.volume);
    const prices = priceData.map(d => d.close);

    // Calculate average volume (excluding last 5 bars for comparison)
    const recentVolumes = volumes.slice(-20, -5);
    const averageVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = averageVolume > 0 ? currentVolume / averageVolume : 1;

    // Determine volume trend
    const recentTrend = this.calculateVolumeTrend(volumes.slice(-10));
    const trend = recentTrend > 0.1 ? 'increasing' : recentTrend < -0.1 ? 'decreasing' : 'neutral';

    // Detect volume divergence
    const volumeDivergence = this.detectVolumeDivergence(prices, volumes);

    // Check volume confirmation
    const volumeConfirmation = this.checkVolumeConfirmation(prices, volumes);

    return {
      trend,
      averageVolume: Math.round(averageVolume),
      currentVolume,
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      volumeDivergence,
      volumeConfirmation,
    };
  }

  /**
   * Calculate volume trend (positive = increasing, negative = decreasing)
   */
  private static calculateVolumeTrend(volumes: number[]): number {
    if (volumes.length < 5) return 0;

    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    if (firstAvg === 0) return 0;
    return (secondAvg - firstAvg) / firstAvg;
  }

  /**
   * Detect volume-price divergence
   * Bullish: Price making lower lows, volume making higher lows
   * Bearish: Price making higher highs, volume making lower highs
   */
  private static detectVolumeDivergence(
    prices: number[],
    volumes: number[]
  ): { bullish: boolean; bearish: boolean; strength: number } {
    if (prices.length < 10 || volumes.length < 10) {
      return { bullish: false, bearish: false, strength: 0 };
    }

    // Find recent price peaks and troughs
    const recentPrices = prices.slice(-20);
    const recentVolumes = volumes.slice(-20);

    // Find price peaks (local maxima)
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
    let divergenceStrength = 0;

    // Check for bullish divergence (price lower low, volume higher low)
    if (priceTroughs.length >= 2) {
      const lastTrough = priceTroughs[priceTroughs.length - 1];
      const prevTrough = priceTroughs[priceTroughs.length - 2];

      const priceLower = recentPrices[lastTrough] < recentPrices[prevTrough];
      const volumeHigher = recentVolumes[lastTrough] > recentVolumes[prevTrough];

      if (priceLower && volumeHigher) {
        bullishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastTrough] - recentPrices[prevTrough]) / recentPrices[prevTrough]);
        const volumeChange = Math.abs((recentVolumes[lastTrough] - recentVolumes[prevTrough]) / (recentVolumes[prevTrough] || 1));
        divergenceStrength = Math.min(100, (priceChange + volumeChange) * 1000);
      }
    }

    // Check for bearish divergence (price higher high, volume lower high)
    if (pricePeaks.length >= 2) {
      const lastPeak = pricePeaks[pricePeaks.length - 1];
      const prevPeak = pricePeaks[pricePeaks.length - 2];

      const priceHigher = recentPrices[lastPeak] > recentPrices[prevPeak];
      const volumeLower = recentVolumes[lastPeak] < recentVolumes[prevPeak];

      if (priceHigher && volumeLower) {
        bearishDivergence = true;
        const priceChange = Math.abs((recentPrices[lastPeak] - recentPrices[prevPeak]) / recentPrices[prevPeak]);
        const volumeChange = Math.abs((recentVolumes[lastPeak] - recentVolumes[prevPeak]) / (recentVolumes[prevPeak] || 1));
        divergenceStrength = Math.max(divergenceStrength, Math.min(100, (priceChange + volumeChange) * 1000));
      }
    }

    return {
      bullish: bullishDivergence,
      bearish: bearishDivergence,
      strength: Math.round(divergenceStrength),
    };
  }

  /**
   * Check if volume confirms price movement
   * Confirmed: Price up + Volume up, or Price down + Volume up
   */
  private static checkVolumeConfirmation(
    prices: number[],
    volumes: number[]
  ): { confirmed: boolean; strength: number } {
    if (prices.length < 5 || volumes.length < 5) {
      return { confirmed: false, strength: 0 };
    }

    const recentPrices = prices.slice(-5);
    const recentVolumes = volumes.slice(-5);

    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    const volumeChange = (recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / (recentVolumes[0] || 1);

    // Volume confirms if:
    // 1. Price up and volume up (strong confirmation)
    // 2. Price down and volume up (confirms selling pressure)
    const confirmed = (priceChange > 0 && volumeChange > 0) || (priceChange < 0 && volumeChange > 0);

    // Calculate strength based on magnitude of volume change
    const strength = Math.min(100, Math.abs(volumeChange) * 200);

    return {
      confirmed,
      strength: Math.round(strength),
    };
  }

  /**
   * Get default analysis when insufficient data
   */
  private static getDefaultAnalysis(): VolumeAnalysis {
    return {
      trend: 'neutral',
      averageVolume: 0,
      currentVolume: 0,
      volumeRatio: 1,
      volumeDivergence: {
        bullish: false,
        bearish: false,
        strength: 0,
      },
      volumeConfirmation: {
        confirmed: false,
        strength: 0,
      },
    };
  }
}

