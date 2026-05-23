/**
 * Backtesting Framework
 * Replays historical data to validate trading strategies
 */

import { PriceData } from '@/types/trading'
import { GatedTradingEngine } from './gated-trading-engine'
import { Trade } from '@/types/trading'
import { PerformanceAnalytics } from './performance-analytics'
import { MT5PriceDataProvider } from './data-providers/mt5-price-data'

export interface BacktestConfig {
  symbol: string
  startDate: Date
  endDate: Date
  timeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1'
  initialBalance: number
  riskPercentage: number
  maxOpenTrades: number
}

export interface BacktestResult {
  config: BacktestConfig
  trades: Trade[]
  metrics: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number
    totalProfit: number
    maxDrawdown: number
    maxDrawdownPercent: number
    profitFactor: number
    sharpeRatio: number
    calmarRatio: number
    sortinoRatio: number
    expectancy: number
    finalBalance: number
    returnPercent: number
  }
  equityCurve: { date: Date; balance: number; equity: number }[]
  errors: string[]
}

export class BacktestingEngine {
  private engine: GatedTradingEngine
  private historicalData: PriceData[] = []
  private trades: Trade[] = []
  private currentBalance: number
  private equityCurve: { date: Date; balance: number; equity: number }[] = []

  constructor(initialBalance: number) {
    this.engine = new GatedTradingEngine()
    this.currentBalance = initialBalance
    this.equityCurve.push({
      date: new Date(),
      balance: initialBalance,
      equity: initialBalance,
    })
  }

  /**
   * Run backtest on historical data
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    this.trades = []
    this.currentBalance = config.initialBalance
    this.equityCurve = [{
      date: config.startDate,
      balance: config.initialBalance,
      equity: config.initialBalance,
    }]

    const errors: string[] = []

    try {
      // Load historical data
      await this.loadHistoricalData(config)

      if (this.historicalData.length === 0) {
        throw new Error('No historical data available for backtesting')
      }

      // Simulate trading on each candle
      for (let i = 0; i < this.historicalData.length; i++) {
        const currentPrice = this.historicalData[i]
        const openTrades = this.trades.filter(t => t.status === 'open')

        // Check if we can open new trades
        if (openTrades.length < config.maxOpenTrades) {
          try {
            // Run AI analysis (without chart image for backtesting)
            const analysis = await this.engine.analyzeMarket(
              config.symbol,
              openTrades,
              undefined // No chart image in backtesting
            )

            // Execute trade if analysis recommends and execution is allowed
            if (analysis.recommendation !== 'HOLD' && analysis.executionPermission.canExecute) {
              const trade = await this.simulateTrade(
                config,
                currentPrice,
                analysis,
                openTrades
              )

              if (trade) {
                this.trades.push(trade)
              }
            }
          } catch (error: any) {
            errors.push(`Error at ${currentPrice.timestamp.toISOString()}: ${error.message}`)
          }
        }

        // Update open trades (check for stop loss / take profit)
        await this.updateOpenTrades(currentPrice)

        // Update equity curve
        this.updateEquityCurve(currentPrice.timestamp)
      }

      // Close all remaining open trades at end
      const finalPrice = this.historicalData[this.historicalData.length - 1]
      this.closeAllTrades(finalPrice)

      // Calculate metrics
      const metrics = this.calculateMetrics(config.initialBalance)

      return {
        config,
        trades: this.trades,
        metrics,
        equityCurve: this.equityCurve,
        errors,
      }
    } catch (error: any) {
      errors.push(`Backtest failed: ${error.message}`)
      return {
        config,
        trades: this.trades,
        metrics: this.calculateMetrics(config.initialBalance),
        equityCurve: this.equityCurve,
        errors,
      }
    }
  }

  /**
   * Load historical data for backtesting
   */
  private async loadHistoricalData(config: BacktestConfig): Promise<void> {
    try {
      // Calculate number of candles needed
      const daysDiff = Math.ceil(
        (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // Estimate candles needed based on timeframe
      const candlesPerDay: Record<string, number> = {
        'M1': 1440,
        'M5': 288,
        'M15': 96,
        'M30': 48,
        'H1': 24,
        'H4': 6,
        'D1': 1,
      }
      
      const count = Math.ceil(daysDiff * (candlesPerDay[config.timeframe] || 24))
      
      // Load data
      const data = await MT5PriceDataProvider.getHistoricalData(
        config.symbol,
        config.timeframe,
        count
      )

      // Filter by date range
      this.historicalData = data.filter(d => {
        const date = d.timestamp
        return date >= config.startDate && date <= config.endDate
      })
    } catch (error) {
      throw new Error(`Failed to load historical data: ${error}`)
    }
  }

  /**
   * Simulate opening a trade
   */
  private async simulateTrade(
    config: BacktestConfig,
    priceData: PriceData,
    analysis: any,
    openTrades: Trade[]
  ): Promise<Trade | null> {
    const entryPrice = priceData.close
    const direction = analysis.recommendation === 'BUY' ? 'BUY' : 'SELL'
    
    // Calculate position size
    const riskAmount = this.currentBalance * config.riskPercentage
    const stopLoss = analysis.suggestedStopLoss || (direction === 'BUY' 
      ? entryPrice * 0.99 
      : entryPrice * 1.01)
    const takeProfit = analysis.suggestedTakeProfit || (direction === 'BUY'
      ? entryPrice * 1.02
      : entryPrice * 0.98)

    // Calculate lot size (simplified)
    const pipSize = config.symbol.includes('JPY') ? 0.01 : 0.0001
    const pipDistance = Math.abs(entryPrice - stopLoss) / pipSize
    const pipValuePerLot = 10 // Simplified for USD pairs
    const lotSize = Math.max(0.01, Math.min(riskAmount / (pipDistance * pipValuePerLot), 10))

    const trade: Trade = {
      id: `backtest-${Date.now()}-${Math.random()}`,
      pair: config.symbol,
      direction,
      entryPrice,
      lotSize,
      stopLoss,
      takeProfit,
      riskAmount,
      rewardAmount: Math.abs(takeProfit - entryPrice) * lotSize * pipValuePerLot,
      timestamp: priceData.timestamp,
      status: 'open',
      profitLoss: 0,
      reason: `Backtest ${analysis.recommendation || direction}`,
    }

    return trade
  }

  /**
   * Update open trades (check stop loss / take profit)
   */
  private async updateOpenTrades(currentPrice: PriceData): Promise<void> {
    const openTrades = this.trades.filter(t => t.status === 'open')
    
    for (const trade of openTrades) {
      const currentPriceValue = currentPrice.close
      let shouldClose = false
      let closeReason = ''
      let closePrice = currentPriceValue

      if (trade.direction === 'BUY') {
        if (currentPriceValue <= trade.stopLoss!) {
          shouldClose = true
          closeReason = 'stop_loss'
          closePrice = trade.stopLoss!
        } else if (currentPriceValue >= trade.takeProfit!) {
          shouldClose = true
          closeReason = 'take_profit'
          closePrice = trade.takeProfit!
        }
      } else {
        if (currentPriceValue >= trade.stopLoss!) {
          shouldClose = true
          closeReason = 'stop_loss'
          closePrice = trade.stopLoss!
        } else if (currentPriceValue <= trade.takeProfit!) {
          shouldClose = true
          closeReason = 'take_profit'
          closePrice = trade.takeProfit!
        }
      }

      if (shouldClose) {
        // Calculate profit/loss
        const pipSize = trade.pair.includes('JPY') ? 0.01 : 0.0001
        const pipDifference = trade.direction === 'BUY'
          ? (closePrice - trade.entryPrice) / pipSize
          : (trade.entryPrice - closePrice) / pipSize
        const pipValuePerLot = 10
        const profitLoss = pipDifference * trade.lotSize * pipValuePerLot

        trade.status = 'closed'
        trade.closePrice = closePrice
        trade.closeTime = currentPrice.timestamp
        trade.profitLoss = profitLoss
        trade.closeReason = closeReason

        // Update balance
        this.currentBalance += profitLoss
      } else {
        // Update unrealized P/L
        const pipSize = trade.pair.includes('JPY') ? 0.01 : 0.0001
        const pipDifference = trade.direction === 'BUY'
          ? (currentPriceValue - trade.entryPrice) / pipSize
          : (trade.entryPrice - currentPriceValue) / pipSize
        const pipValuePerLot = 10
        trade.profitLoss = pipDifference * trade.lotSize * pipValuePerLot
      }
    }
  }

  /**
   * Close all open trades
   */
  private closeAllTrades(finalPrice: PriceData): void {
    const openTrades = this.trades.filter(t => t.status === 'open')
    
    for (const trade of openTrades) {
      const closePrice = finalPrice.close
      const pipSize = trade.pair.includes('JPY') ? 0.01 : 0.0001
      const pipDifference = trade.direction === 'BUY'
        ? (closePrice - trade.entryPrice) / pipSize
        : (trade.entryPrice - closePrice) / pipSize
      const pipValuePerLot = 10
      const profitLoss = pipDifference * trade.lotSize * pipValuePerLot

      trade.status = 'closed'
      trade.closePrice = closePrice
      trade.closeTime = finalPrice.timestamp
      trade.profitLoss = profitLoss
      trade.closeReason = 'backtest_end'

      this.currentBalance += profitLoss
    }
  }

  /**
   * Update equity curve
   */
  private updateEquityCurve(date: Date): void {
    const openTrades = this.trades.filter(t => t.status === 'open')
    const unrealizedPL = openTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
    const equity = this.currentBalance + unrealizedPL

    this.equityCurve.push({
      date,
      balance: this.currentBalance,
      equity,
    })
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(initialBalance: number) {
    const closedTrades = this.trades.filter(t => t.status === 'closed')
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        sortinoRatio: 0,
        expectancy: 0,
        finalBalance: this.currentBalance,
        returnPercent: 0,
      }
    }

    const metrics = PerformanceAnalytics.calculateAdvancedMetrics(
      closedTrades,
      initialBalance,
      this.currentBalance
    )

    const returnPercent = ((this.currentBalance - initialBalance) / initialBalance) * 100

    return {
      totalTrades: metrics.totalTrades,
      winningTrades: metrics.winningTrades,
      losingTrades: metrics.totalTrades - metrics.winningTrades,
      winRate: metrics.winRate,
      totalProfit: metrics.totalProfit,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      profitFactor: metrics.profitFactor,
      sharpeRatio: metrics.sharpeRatio,
      calmarRatio: metrics.calmarRatio,
      sortinoRatio: metrics.sortinoRatio,
      expectancy: metrics.expectancy,
      finalBalance: this.currentBalance,
      returnPercent: Math.round(returnPercent * 100) / 100,
    }
  }
}

