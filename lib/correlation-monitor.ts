/**
 * Correlation Monitor
 * Tracks correlated positions to prevent over-exposure to the same theme
 */

import { Trade, TradeDirection } from '@/types/trading';

export interface CorrelationMatrix {
  [pair1: string]: {
    [pair2: string]: number; // Correlation coefficient (-1 to 1)
  };
}

export interface PositionExposure {
  theme: string;
  pairs: string[];
  totalExposure: number;
  maxAllowedExposure: number;
  isOverExposed: boolean;
}

export class CorrelationMonitor {
  // Correlation matrix for major Forex pairs
  // Values: 1.0 = perfect positive, -1.0 = perfect negative, 0 = no correlation
  private static correlationMatrix: CorrelationMatrix = {
    'EURUSD': {
      'EURUSD': 1.0,
      'GBPUSD': 0.7,   // Both are USD pairs, moderate correlation
      'AUDUSD': 0.6,   // USD pairs correlation
      'NZDUSD': 0.5,
      'USDJPY': -0.7,  // Inverse correlation (EUR/USD up = USD/JPY down)
      'USDCHF': -0.8,  // Strong inverse
      'USDCAD': -0.6,
    },
    'GBPUSD': {
      'EURUSD': 0.7,
      'GBPUSD': 1.0,
      'AUDUSD': 0.8,   // Strong correlation (both risk-on currencies)
      'NZDUSD': 0.7,
      'USDJPY': -0.6,
      'USDCHF': -0.7,
      'USDCAD': -0.5,
    },
    'AUDUSD': {
      'EURUSD': 0.6,
      'GBPUSD': 0.8,
      'AUDUSD': 1.0,
      'NZDUSD': 0.9,   // Very strong correlation (both commodity currencies)
      'USDJPY': -0.5,
      'USDCHF': -0.6,
      'USDCAD': -0.4,
    },
    'NZDUSD': {
      'EURUSD': 0.5,
      'GBPUSD': 0.7,
      'AUDUSD': 0.9,
      'NZDUSD': 1.0,
      'USDJPY': -0.5,
      'USDCHF': -0.6,
      'USDCAD': -0.4,
    },
    'USDJPY': {
      'EURUSD': -0.7,
      'GBPUSD': -0.6,
      'AUDUSD': -0.5,
      'NZDUSD': -0.5,
      'USDJPY': 1.0,
      'USDCHF': 0.8,   // Both are USD pairs
      'USDCAD': 0.7,
    },
    'USDCHF': {
      'EURUSD': -0.8,
      'GBPUSD': -0.7,
      'AUDUSD': -0.6,
      'NZDUSD': -0.6,
      'USDJPY': 0.8,
      'USDCHF': 1.0,
      'USDCAD': 0.6,
    },
    'USDCAD': {
      'EURUSD': -0.6,
      'GBPUSD': -0.5,
      'AUDUSD': -0.4,
      'NZDUSD': -0.4,
      'USDJPY': 0.7,
      'USDCHF': 0.6,
      'USDCAD': 1.0,
    }
  };

  // Correlation threshold - pairs with correlation > this are considered correlated
  private static CORRELATION_THRESHOLD = 0.7;

  // Maximum exposure to a single theme (as % of account)
  private static MAX_THEME_EXPOSURE = 0.05; // 5% of account per theme

  /**
   * Get correlation coefficient between two pairs
   */
  static getCorrelation(pair1: string, pair2: string): number {
    const normalized1 = pair1.toUpperCase();
    const normalized2 = pair2.toUpperCase();
    
    if (normalized1 === normalized2) return 1.0;
    
    return this.correlationMatrix[normalized1]?.[normalized2] ?? 0;
  }

  /**
   * Check if two pairs are correlated
   */
  static areCorrelated(pair1: string, pair2: string): boolean {
    const correlation = Math.abs(this.getCorrelation(pair1, pair2));
    return correlation >= this.CORRELATION_THRESHOLD;
  }

  /**
   * Identify trading theme for a pair
   * Examples: "Short USD", "Long EUR", "Risk-On", etc.
   */
  static getTradingTheme(pair: string, direction: TradeDirection): string {
    const normalized = pair.toUpperCase();
    
    if (normalized.startsWith('USD')) {
      // USD pairs: direction determines theme
      return direction === 'BUY' ? `Long ${normalized.substring(3)}` : 'Short USD';
    } else if (normalized.endsWith('USD')) {
      // Pairs ending in USD: direction determines theme
      return direction === 'BUY' ? `Long ${normalized.substring(0, 3)}` : 'Short USD';
    }
    
    // Default theme
    return `${direction} ${normalized}`;
  }

  /**
   * Analyze position exposure by theme
   */
  static analyzeExposure(
    openTrades: Trade[],
    accountBalance: number
  ): PositionExposure[] {
    const themeExposure: Map<string, { pairs: Set<string>; totalRisk: number }> = new Map();

    // Group trades by theme
    for (const trade of openTrades) {
      const theme = this.getTradingTheme(trade.pair, trade.direction);
      
      if (!themeExposure.has(theme)) {
        themeExposure.set(theme, { pairs: new Set(), totalRisk: 0 });
      }
      
      const exposure = themeExposure.get(theme)!;
      exposure.pairs.add(trade.pair);
      exposure.totalRisk += trade.riskAmount || 0;
    }

    // Convert to array and check limits
    const exposures: PositionExposure[] = [];
    const maxAllowed = accountBalance * this.MAX_THEME_EXPOSURE;

    for (const [theme, data] of themeExposure.entries()) {
      const isOverExposed = data.totalRisk > maxAllowed;
      
      exposures.push({
        theme,
        pairs: Array.from(data.pairs),
        totalExposure: data.totalRisk,
        maxAllowedExposure: maxAllowed,
        isOverExposed
      });
    }

    return exposures;
  }

  /**
   * Check if a new trade would create over-exposure
   */
  static canAddTrade(
    newTrade: { pair: string; direction: TradeDirection; riskAmount: number },
    openTrades: Trade[],
    accountBalance: number
  ): { allowed: boolean; reason: string; correlatedPairs: string[] } {
    const newTheme = this.getTradingTheme(newTrade.pair, newTrade.direction);
    
    // Check for correlated pairs
    const correlatedPairs: string[] = [];
    for (const trade of openTrades) {
      if (this.areCorrelated(newTrade.pair, trade.pair)) {
        correlatedPairs.push(trade.pair);
      }
    }

    // Check theme exposure
    const currentExposure = this.analyzeExposure(openTrades, accountBalance);
    const themeExposure = currentExposure.find(e => e.theme === newTheme);
    
    const newTotalExposure = (themeExposure?.totalExposure || 0) + newTrade.riskAmount;
    const maxAllowed = accountBalance * this.MAX_THEME_EXPOSURE;

    if (newTotalExposure > maxAllowed) {
      return {
        allowed: false,
        reason: `Theme exposure would exceed ${(this.MAX_THEME_EXPOSURE * 100).toFixed(1)}% limit (${(newTotalExposure / accountBalance * 100).toFixed(1)}% vs ${(maxAllowed / accountBalance * 100).toFixed(1)}%)`,
        correlatedPairs
      };
    }

    // Check if too many correlated pairs
    if (correlatedPairs.length >= 2) {
      return {
        allowed: false,
        reason: `Already have ${correlatedPairs.length} correlated positions: ${correlatedPairs.join(', ')}`,
        correlatedPairs
      };
    }

    return {
      allowed: true,
      reason: 'No exposure limit exceeded',
      correlatedPairs
    };
  }

  /**
   * Get all correlated pairs for a given pair
   */
  static getCorrelatedPairs(pair: string): string[] {
    const normalized = pair.toUpperCase();
    const correlated: string[] = [];
    
    for (const otherPair in this.correlationMatrix[normalized] || {}) {
      if (this.areCorrelated(normalized, otherPair)) {
        correlated.push(otherPair);
      }
    }
    
    return correlated;
  }
}

