/**
 * Performance Analytics
 * Calculates risk-adjusted returns (Sharpe Ratio, Calmar Ratio, etc.)
 */

import { Trade, PerformanceMetrics } from '@/types/trading';

export interface AdvancedPerformanceMetrics extends PerformanceMetrics {
  sharpeRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  recoveryFactor: number;
  expectancy: number;
  strategyBreakdown: {
    [strategy: string]: {
      trades: number;
      winRate: number;
      profit: number;
      profitFactor: number;
    };
  };
  monthlyReturns: number[];
  weeklyReturns: number[];
}

export class PerformanceAnalytics {
  /**
   * Calculate advanced performance metrics
   */
  static calculateAdvancedMetrics(
    trades: Trade[],
    initialBalance: number,
    currentBalance: number
  ): AdvancedPerformanceMetrics {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.profitLoss !== undefined);
    
    if (closedTrades.length === 0) {
      return this.getEmptyMetrics();
    }

    // Basic metrics
    const winningTrades = closedTrades.filter(t => (t.profitLoss || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profitLoss || 0) < 0);
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0));

    const winRate = (winningTrades.length / closedTrades.length) * 100;
    const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

    // Calculate drawdown
    const { maxDrawdown, maxDrawdownPercent } = this.calculateDrawdown(trades, initialBalance);

    // Calculate returns
    const returns = this.calculateReturns(trades, initialBalance);
    const monthlyReturns = this.groupReturnsByMonth(returns);
    const weeklyReturns = this.groupReturnsByWeek(returns);

    // Risk-adjusted metrics
    const sharpeRatio = this.calculateSharpeRatio(monthlyReturns);
    const calmarRatio = this.calculateCalmarRatio(monthlyReturns, maxDrawdownPercent);
    const sortinoRatio = this.calculateSortinoRatio(monthlyReturns);
    const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : totalProfit > 0 ? 999 : 0;
    const expectancy = this.calculateExpectancy(winRate, averageWin, averageLoss);

    // Strategy breakdown (simplified - would need strategy tags on trades)
    const strategyBreakdown = this.calculateStrategyBreakdown(trades);

    // Consecutive profitable weeks
    const consecutiveProfitableWeeks = this.calculateConsecutiveProfitableWeeks(weeklyReturns);

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      winRate,
      totalProfit,
      maxDrawdown,
      profitFactor,
      averageWin,
      averageLoss,
      consecutiveProfitableWeeks,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      strategyBreakdown,
      monthlyReturns,
      weeklyReturns
    };
  }

  /**
   * Calculate drawdown
   */
  private static calculateDrawdown(trades: Trade[], initialBalance: number): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
  } {
    let balance = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const trade of trades) {
      if (trade.status === 'closed' && trade.profitLoss !== undefined) {
        balance += trade.profitLoss;
        
        if (balance > peak) {
          peak = balance;
        }
        
        const drawdown = peak - balance;
        const drawdownPercent = (drawdown / peak) * 100;
        
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  /**
   * Calculate returns from trades
   */
  private static calculateReturns(trades: Trade[], initialBalance: number): Array<{ date: Date; return: number }> {
    const returns: Array<{ date: Date; return: number }> = [];
    let balance = initialBalance;

    for (const trade of trades) {
      if (trade.status === 'closed' && trade.profitLoss !== undefined) {
        balance += trade.profitLoss;
        const returnPercent = (trade.profitLoss / initialBalance) * 100;
        returns.push({
          date: trade.timestamp,
          return: returnPercent
        });
      }
    }

    return returns;
  }

  /**
   * Group returns by month
   */
  private static groupReturnsByMonth(returns: Array<{ date: Date; return: number }>): number[] {
    const monthly: { [key: string]: number } = {};

    for (const ret of returns) {
      const monthKey = `${ret.date.getFullYear()}-${ret.date.getMonth()}`;
      monthly[monthKey] = (monthly[monthKey] || 0) + ret.return;
    }

    return Object.values(monthly);
  }

  /**
   * Group returns by week
   */
  private static groupReturnsByWeek(returns: Array<{ date: Date; return: number }>): number[] {
    const weekly: { [key: string]: number } = {};

    for (const ret of returns) {
      const week = this.getWeekNumber(ret.date);
      const weekKey = `${ret.date.getFullYear()}-W${week}`;
      weekly[weekKey] = (weekly[weekKey] || 0) + ret.return;
    }

    return Object.values(weekly);
  }

  /**
   * Get week number of year
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Calculate Sharpe Ratio
   * Sharpe = (Average Return - Risk Free Rate) / Standard Deviation of Returns
   */
  private static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0 || returns.length === 1) return 0; // Need at least 2 data points

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0 || !isFinite(stdDev)) return 0; // Avoid division by zero or NaN
    const sharpe = (avgReturn - riskFreeRate) / stdDev;
    return isFinite(sharpe) ? sharpe : 0;
  }

  /**
   * Calculate Calmar Ratio
   * Calmar = Annual Return / Maximum Drawdown
   */
  private static calculateCalmarRatio(monthlyReturns: number[], maxDrawdownPercent: number): number {
    if (monthlyReturns.length === 0 || maxDrawdownPercent === 0) return 0;

    const avgMonthlyReturn = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
    const annualReturn = avgMonthlyReturn * 12;

    return annualReturn / maxDrawdownPercent;
  }

  /**
   * Calculate Sortino Ratio
   * Sortino = (Average Return - Risk Free Rate) / Downside Deviation
   */
  private static calculateSortinoRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0 || returns.length === 1) return 0; // Need at least 2 data points

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);
    
    if (downsideReturns.length === 0) return avgReturn > riskFreeRate ? 999 : 0;

    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0 || !isFinite(downsideDev)) return 0; // Avoid division by zero or NaN
    const sortino = (avgReturn - riskFreeRate) / downsideDev;
    return isFinite(sortino) ? sortino : 0;
  }

  /**
   * Calculate Expectancy
   * Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
   */
  private static calculateExpectancy(winRate: number, avgWin: number, avgLoss: number): number {
    const lossRate = 100 - winRate;
    return (winRate / 100 * avgWin) - (lossRate / 100 * avgLoss);
  }

  /**
   * Calculate strategy breakdown
   */
  private static calculateStrategyBreakdown(trades: Trade[]): {
    [strategy: string]: {
      trades: number;
      winRate: number;
      profit: number;
      profitFactor: number;
    };
  } {
    // Simplified - would need strategy tags on trades
    // For now, group by pair or use reason field
    const breakdown: {
      [strategy: string]: {
        trades: number;
        wins: number;
        profit: number;
        winsAmount: number;
        lossesAmount: number;
      };
    } = {};

    for (const trade of trades) {
      if (trade.status === 'closed' && trade.profitLoss !== undefined) {
        // Use pair as strategy for now (can be enhanced)
        const strategy = trade.pair || 'UNKNOWN';
        
        if (!breakdown[strategy]) {
          breakdown[strategy] = {
            trades: 0,
            wins: 0,
            profit: 0,
            winsAmount: 0,
            lossesAmount: 0
          };
        }

        breakdown[strategy].trades++;
        breakdown[strategy].profit += trade.profitLoss;
        
        if (trade.profitLoss > 0) {
          breakdown[strategy].wins++;
          breakdown[strategy].winsAmount += trade.profitLoss;
        } else {
          breakdown[strategy].lossesAmount += Math.abs(trade.profitLoss);
        }
      }
    }

    // Convert to final format
    const result: {
      [strategy: string]: {
        trades: number;
        winRate: number;
        profit: number;
        profitFactor: number;
      };
    } = {};

    for (const [strategy, data] of Object.entries(breakdown)) {
      const winRate = (data.wins / data.trades) * 100;
      const profitFactor = data.lossesAmount > 0 ? data.winsAmount / data.lossesAmount : data.winsAmount > 0 ? 999 : 0;

      result[strategy] = {
        trades: data.trades,
        winRate: Math.round(winRate * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100
      };
    }

    return result;
  }

  /**
   * Calculate consecutive profitable weeks
   */
  private static calculateConsecutiveProfitableWeeks(weeklyReturns: number[]): number {
    let consecutive = 0;
    
    // Count from most recent backwards
    for (let i = weeklyReturns.length - 1; i >= 0; i--) {
      if (weeklyReturns[i] > 0) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  /**
   * Get empty metrics
   */
  private static getEmptyMetrics(): AdvancedPerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      winRate: 0,
      totalProfit: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      consecutiveProfitableWeeks: 0,
      sharpeRatio: 0,
      calmarRatio: 0,
      sortinoRatio: 0,
      maxDrawdownPercent: 0,
      recoveryFactor: 0,
      expectancy: 0,
      strategyBreakdown: {},
      monthlyReturns: [],
      weeklyReturns: []
    };
  }
}

