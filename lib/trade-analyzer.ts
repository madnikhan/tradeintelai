/**
 * Trade Analyzer
 * Analyzes executed trades to show capital allocation and performance
 */

import { logger } from './logger';

export interface TradeAnalysis {
  tradeNumber: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  profit: number;
  riskAmount: number; // Capital at risk (2% of balance)
  marginUsed: number; // Actual margin/capital used
  pipValue: number;
  pipMovement: number;
  returnOnRisk: number; // Profit / Risk Amount
  returnOnMargin: number; // Profit / Margin Used
}

export interface TradeSummary {
  totalTrades: number;
  totalProfit: number;
  totalRiskAmount: number; // Total capital at risk across all trades
  totalMarginUsed: number; // Total margin/capital used
  averageProfitPerTrade: number;
  averageReturnOnRisk: number;
  averageReturnOnMargin: number;
  winRate: number;
  largestWin: number;
  largestLoss: number;
}

export class TradeAnalyzer {
  /**
   * Calculate margin used for a trade
   * Margin = (Lot Size * Contract Size * Price) / Leverage
   * For JPY pairs, price is already in quote currency, so calculation is correct
   * For other pairs, price is in base currency, so we need to convert if account currency differs
   */
  static calculateMargin(
    lotSize: number,
    symbol: string,
    entryPrice: number,
    leverage: number = 200 // Default leverage (IC Markets typically 200-500)
  ): number {
    const contractSize = 100000; // Standard lot = 100,000 units
    // For JPY pairs, entryPrice is already in JPY (e.g., 206.586)
    // For other pairs, entryPrice is in quote currency (e.g., 1.32215 for GBPUSD)
    // Margin calculation: (lot size × contract size × price) / leverage
    const margin = (lotSize * contractSize * entryPrice) / leverage;
    return margin;
  }

  /**
   * Calculate pip value for a trade
   */
  static calculatePipValue(
    lotSize: number,
    symbol: string,
    entryPrice: number
  ): number {
    const contractSize = 100000;
    const isJPY = symbol.includes('JPY');
    const pipSize = isJPY ? 0.01 : 0.0001;
    
    if (isJPY) {
      // For JPY pairs: pip value = (lot size * contract size * pip size) / entry price
      return (lotSize * contractSize * pipSize) / entryPrice;
    } else {
      // For other pairs: pip value = lot size * contract size * pip size
      return lotSize * contractSize * pipSize;
    }
  }

  /**
   * Calculate pip movement
   */
  static calculatePipMovement(
    entryPrice: number,
    exitPrice: number,
    symbol: string
  ): number {
    const isJPY = symbol.includes('JPY');
    const pipSize = isJPY ? 0.01 : 0.0001;
    return Math.abs(exitPrice - entryPrice) / pipSize;
  }

  /**
   * Analyze a single trade
   */
  static analyzeTrade(
    trade: {
      symbol: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      exitPrice: number;
      lotSize: number;
      profit: number;
      balance: number; // Balance at time of trade
      leverage?: number;
    }
  ): TradeAnalysis {
    const leverage = trade.leverage || 200; // Default to 200 (more common)
    // Risk amount should be 2% of balance at time of trade
    // Use the actual balance passed in (could be current balance or balance at time of trade)
    // Only cap if balance is unreasonably high (likely a data error, not a legitimate large account)
    let balanceAtTrade = trade.balance || 100;
    if (balanceAtTrade > 100000000) {
      // If balance is > $100M, it's likely a data error (e.g., wrong currency conversion)
      // Use a more reasonable balance for risk calculation (e.g., $100k)
      logger.warn(`⚠️ Balance seems unreasonably high (${balanceAtTrade}), capping at $100k for risk calculation`);
      balanceAtTrade = 100000;
    }
    const riskAmount = balanceAtTrade * 0.02; // 2% risk per trade
    const marginUsed = this.calculateMargin(trade.lotSize, trade.symbol, trade.entryPrice, leverage);
    const pipValue = this.calculatePipValue(trade.lotSize, trade.symbol, trade.entryPrice);
    const pipMovement = this.calculatePipMovement(trade.entryPrice, trade.exitPrice, trade.symbol);
    
    const returnOnRisk = (trade.profit / riskAmount) * 100;
    const returnOnMargin = (trade.profit / marginUsed) * 100;

    return {
      tradeNumber: 0, // Will be set by caller
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      lotSize: trade.lotSize,
      profit: trade.profit,
      riskAmount,
      marginUsed,
      pipValue,
      pipMovement,
      returnOnRisk,
      returnOnMargin,
    };
  }

  /**
   * Analyze multiple trades and create summary
   */
  static analyzeTrades(
    trades: Array<{
      symbol: string;
      direction: 'BUY' | 'SELL';
      entryPrice: number;
      exitPrice: number;
      lotSize: number;
      profit: number;
      balance: number;
      leverage?: number;
    }>
  ): { analyses: TradeAnalysis[]; summary: TradeSummary } {
    const analyses = trades.map((trade, index) => ({
      ...this.analyzeTrade(trade),
      tradeNumber: index + 1,
    }));

    const totalProfit = analyses.reduce((sum, a) => sum + a.profit, 0);
    const totalRiskAmount = analyses.reduce((sum, a) => sum + a.riskAmount, 0);
    const totalMarginUsed = analyses.reduce((sum, a) => sum + a.marginUsed, 0);
    const winningTrades = analyses.filter(a => a.profit > 0);
    const losingTrades = analyses.filter(a => a.profit < 0);

    const summary: TradeSummary = {
      totalTrades: analyses.length,
      totalProfit,
      totalRiskAmount,
      totalMarginUsed,
      averageProfitPerTrade: totalProfit / analyses.length,
      averageReturnOnRisk: analyses.reduce((sum, a) => sum + a.returnOnRisk, 0) / analyses.length,
      averageReturnOnMargin: analyses.reduce((sum, a) => sum + a.returnOnMargin, 0) / analyses.length,
      winRate: (winningTrades.length / analyses.length) * 100,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.profit)) : 0,
    };

    return { analyses, summary };
  }

  /**
   * Estimate lot size from profit and price movement
   * Useful for reverse-engineering what lot size was used
   */
  static estimateLotSize(
    profit: number,
    entryPrice: number,
    exitPrice: number,
    symbol: string
  ): number {
    const pipMovement = this.calculatePipMovement(entryPrice, exitPrice, symbol);
    const isJPY = symbol.includes('JPY');
    
    if (pipMovement === 0) return 0;

    if (isJPY) {
      // For JPY: profit = lot size * 100000 * pip movement * 0.01 / entry price
      // Therefore: lot size = profit * entry price / (100000 * pip movement * 0.01)
      return (profit * entryPrice) / (100000 * pipMovement * 0.01);
    } else {
      // For others: profit = lot size * 100000 * pip movement * 0.0001
      // Therefore: lot size = profit / (100000 * pip movement * 0.0001)
      return profit / (100000 * pipMovement * 0.0001);
    }
  }
}

