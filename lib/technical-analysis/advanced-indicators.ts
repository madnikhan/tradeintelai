/**
 * Advanced Technical Indicators
 * OBV, VWAP, Stochastic, Ichimoku Cloud
 */

import { PriceData } from '@/types/trading';

export interface OBVResult {
  obv: number;
  obvEMA: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  signal: 'buy' | 'sell' | 'hold';
}

export interface VWAPResult {
  vwap: number;
  priceVsVWAP: number; // Percentage difference
  signal: 'buy' | 'sell' | 'hold';
}

export interface StochasticResult {
  k: number; // %K
  d: number; // %D
  signal: 'overbought' | 'oversold' | 'neutral';
}

export interface IchimokuResult {
  tenkan: number; // Tenkan-sen (9-period)
  kijun: number; // Kijun-sen (26-period)
  senkouA: number; // Senkou Span A
  senkouB: number; // Senkou Span B
  chikou: number; // Chikou Span
  signal: 'bullish' | 'bearish' | 'neutral';
  cloud: 'above' | 'below' | 'inside';
}

export class AdvancedIndicators {
  /**
   * On-Balance Volume (OBV)
   * Measures buying and selling pressure
   */
  static calculateOBV(data: PriceData[], period: number = 14): OBVResult {
    if (data.length < 2) {
      return { obv: 0, obvEMA: 0, trend: 'neutral', signal: 'hold' };
    }

    let obv = 0;
    const obvValues: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const currentPrice = data[i].close;
      const previousPrice = data[i - 1].close;
      const volume = data[i].volume || 1; // Use tick volume if available

      if (currentPrice > previousPrice) {
        obv += volume; // Price up, add volume
      } else if (currentPrice < previousPrice) {
        obv -= volume; // Price down, subtract volume
      }
      // If price unchanged, OBV stays the same

      obvValues.push(obv);
    }

    // Calculate OBV EMA
    const obvEMA = this.calculateEMA(obvValues, period);

    // Determine trend
    const currentOBV = obvValues[obvValues.length - 1];
    const trend: 'bullish' | 'bearish' | 'neutral' = 
      currentOBV > obvEMA ? 'bullish' : currentOBV < obvEMA ? 'bearish' : 'neutral';

    // Generate signal
    const signal: 'buy' | 'sell' | 'hold' = 
      trend === 'bullish' && currentOBV > obvEMA * 1.02 ? 'buy' :
      trend === 'bearish' && currentOBV < obvEMA * 0.98 ? 'sell' : 'hold';

    return {
      obv: currentOBV,
      obvEMA,
      trend,
      signal,
    };
  }

  /**
   * Volume-Weighted Average Price (VWAP)
   * Average price weighted by volume
   */
  static calculateVWAP(data: PriceData[]): VWAPResult {
    if (data.length === 0) {
      return { vwap: 0, priceVsVWAP: 0, signal: 'hold' };
    }

    let totalVolumePrice = 0;
    let totalVolume = 0;

    for (const bar of data) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      const volume = bar.volume || 1;
      totalVolumePrice += typicalPrice * volume;
      totalVolume += volume;
    }

    const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : data[data.length - 1].close;
    const currentPrice = data[data.length - 1].close;
    const priceVsVWAP = ((currentPrice - vwap) / vwap) * 100;

    // Generate signal
    const signal: 'buy' | 'sell' | 'hold' = 
      priceVsVWAP < -1 ? 'buy' : // Price below VWAP by 1%+
      priceVsVWAP > 1 ? 'sell' : // Price above VWAP by 1%+
      'hold';

    return {
      vwap,
      priceVsVWAP,
      signal,
    };
  }

  /**
   * Stochastic Oscillator
   * Measures momentum by comparing closing price to price range
   */
  static calculateStochastic(data: PriceData[], kPeriod: number = 14, dPeriod: number = 3): StochasticResult {
    if (data.length < kPeriod) {
      return { k: 50, d: 50, signal: 'neutral' };
    }

    const recent = data.slice(-kPeriod);
    const highestHigh = Math.max(...recent.map(d => d.high));
    const lowestLow = Math.min(...recent.map(d => d.low));
    const currentClose = data[data.length - 1].close;

    // Calculate %K
    const k = highestHigh !== lowestLow 
      ? ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
      : 50;

    // Calculate %D (SMA of %K)
    const kValues: number[] = [];
    for (let i = kPeriod; i < data.length; i++) {
      const periodData = data.slice(i - kPeriod, i);
      const hh = Math.max(...periodData.map(d => d.high));
      const ll = Math.min(...periodData.map(d => d.low));
      const close = data[i].close;
      const kValue = hh !== ll ? ((close - ll) / (hh - ll)) * 100 : 50;
      kValues.push(kValue);
    }

    const d = kValues.length > 0 
      ? kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / Math.min(dPeriod, kValues.length)
      : k;

    // Generate signal
    const signal: 'overbought' | 'oversold' | 'neutral' = 
      k > 80 ? 'overbought' :
      k < 20 ? 'oversold' :
      'neutral';

    return {
      k: Math.round(k * 100) / 100,
      d: Math.round(d * 100) / 100,
      signal,
    };
  }

  /**
   * Ichimoku Cloud
   * Comprehensive trend-following indicator
   */
  static calculateIchimoku(data: PriceData[]): IchimokuResult {
    if (data.length < 52) {
      return {
        tenkan: 0,
        kijun: 0,
        senkouA: 0,
        senkouB: 0,
        chikou: 0,
        signal: 'neutral',
        cloud: 'inside',
      };
    }

    // Tenkan-sen (9-period)
    const tenkanPeriod = 9;
    const tenkanData = data.slice(-tenkanPeriod);
    const tenkan = (Math.max(...tenkanData.map(d => d.high)) + Math.min(...tenkanData.map(d => d.low))) / 2;

    // Kijun-sen (26-period)
    const kijunPeriod = 26;
    const kijunData = data.slice(-kijunPeriod);
    const kijun = (Math.max(...kijunData.map(d => d.high)) + Math.min(...kijunData.map(d => d.low))) / 2;

    // Senkou Span A (average of Tenkan and Kijun, projected 26 periods forward)
    const senkouA = (tenkan + kijun) / 2;

    // Senkou Span B (52-period, projected 26 periods forward)
    const senkouBPeriod = 52;
    const senkouBData = data.slice(-senkouBPeriod);
    const senkouB = (Math.max(...senkouBData.map(d => d.high)) + Math.min(...senkouBData.map(d => d.low))) / 2;

    // Chikou Span (current close, projected 26 periods back)
    const chikou = data[data.length - 1].close;

    const currentPrice = data[data.length - 1].close;

    // Determine cloud position
    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);
    const cloud: 'above' | 'below' | 'inside' = 
      currentPrice > cloudTop ? 'above' :
      currentPrice < cloudBottom ? 'below' :
      'inside';

    // Generate signal
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (currentPrice > cloudTop && tenkan > kijun) {
      signal = 'bullish';
    } else if (currentPrice < cloudBottom && tenkan < kijun) {
      signal = 'bearish';
    }

    return {
      tenkan,
      kijun,
      senkouA,
      senkouB,
      chikou,
      signal,
      cloud,
    };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private static calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length < period) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
  }
}

