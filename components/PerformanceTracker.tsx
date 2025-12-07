'use client'

import { TradingMode, TradingConfig, PerformanceMetrics } from '@/types/trading'
import { PerformanceAnalytics } from '@/lib/performance-analytics'
import { Trade } from '@/types/trading'
import { EmptyState } from '@/components/EmptyState'
import { Tooltip, MetricTooltip } from '@/components/Tooltip'
import { PerformanceChart } from '@/components/charts/PerformanceChart'

interface PerformanceTrackerProps {
  mode: TradingMode
  config: TradingConfig
  trades?: Trade[]
  currentBalance?: number
}

export default function PerformanceTracker({ mode, config, trades = [], currentBalance }: PerformanceTrackerProps) {
  // Calculate advanced metrics if trades provided
  const performance: PerformanceMetrics = trades.length > 0 && currentBalance
    ? PerformanceAnalytics.calculateAdvancedMetrics(trades, config.initialBalance, currentBalance)
    : {
        totalTrades: 0,
        winningTrades: 0,
        winRate: 0,
        totalProfit: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        consecutiveProfitableWeeks: 0,
      }

  const losingTrades = performance.totalTrades - performance.winningTrades
  const targetAmount = config.initialBalance * config.monthlyTarget
  const progressPercentage = targetAmount > 0 
    ? Math.min((performance.totalProfit / targetAmount) * 100, 100)
    : 0

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📈</span>
          Performance
        </h3>
        {trades.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Auto-synced from MT5</span>
          </div>
        )}
      </div>

      {trades.length === 0 && (
        <EmptyState
          icon="📈"
          title="No Performance Data"
          description="To see your performance metrics, you need trade history. Go to 'Trade Analysis' to add trades manually or ensure the MT5 EA is running to auto-sync."
        />
      )}

      <div className="space-y-4">
        {/* Monthly Target Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Monthly Target Progress</span>
            <span className="text-lg font-bold text-white font-mono">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-[#1e2738] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                progressPercentage >= 100
                  ? 'bg-green-500'
                  : progressPercentage >= 50
                  ? 'bg-blue-500'
                  : 'bg-yellow-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Target: {(config.monthlyTarget * 100).toFixed(0)}% (
            {(config.initialBalance * config.monthlyTarget).toFixed(2)} {config.currency})
          </p>
        </div>

        {/* Trade Statistics */}
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Trades</p>
              <p className="text-xl font-bold">{performance.totalTrades}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Win Rate</p>
              <p className="text-xl font-bold">
                {performance.winRate.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Winning Trades</p>
              <p className="text-xl font-bold text-green-500">
                {performance.winningTrades}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Losing Trades</p>
              <p className="text-xl font-bold text-red-500">
                {losingTrades}
              </p>
            </div>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Profit</span>
              <span
                className={`text-lg font-bold ${
                  performance.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {performance.totalProfit >= 0 ? '+' : ''}
                {performance.totalProfit.toFixed(2)} {config.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Max Drawdown</span>
              <span className="text-lg font-bold text-red-500">
                {(performance.maxDrawdown * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Profit Factor</span>
              <span className="text-lg font-bold">
                {performance.profitFactor.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Consecutive Weeks</span>
              <span className="text-lg font-bold">
                {performance.consecutiveProfitableWeeks}
              </span>
            </div>
          </div>
        </div>

        {/* PHASE 2: Advanced Risk-Adjusted Metrics */}
        {(performance.sharpeRatio !== undefined || performance.calmarRatio !== undefined) && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Risk-Adjusted Returns</h3>
            <div className="space-y-2">
              {performance.sharpeRatio !== undefined && (
                <MetricTooltip
                  metric="Sharpe Ratio"
                  description="Measures risk-adjusted returns. Higher is better. Above 1.0 is good, above 2.0 is excellent."
                  formula="Sharpe = (Average Return - Risk Free Rate) / Standard Deviation"
                >
                  <div className="flex justify-between cursor-help">
                    <span className="text-sm text-gray-600">Sharpe Ratio</span>
                    <span className={`text-lg font-bold ${
                      performance.sharpeRatio > 1 ? 'text-green-500' :
                      performance.sharpeRatio > 0 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {isNaN(performance.sharpeRatio) ? 'N/A' : performance.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
              {performance.calmarRatio !== undefined && (
                <MetricTooltip
                  metric="Calmar Ratio"
                  description="Annual return divided by maximum drawdown. Higher is better. Shows return relative to risk."
                  formula="Calmar = Annual Return / Max Drawdown"
                >
                  <div className="flex justify-between cursor-help">
                    <span className="text-sm text-gray-600">Calmar Ratio</span>
                    <span className={`text-lg font-bold ${
                      performance.calmarRatio > 1 ? 'text-green-500' :
                      performance.calmarRatio > 0 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {performance.calmarRatio.toFixed(2)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
              {performance.sortinoRatio !== undefined && (
                <MetricTooltip
                  metric="Sortino Ratio"
                  description="Similar to Sharpe Ratio but only considers downside volatility. Higher is better."
                  formula="Sortino = (Average Return - Risk Free Rate) / Downside Deviation"
                >
                  <div className="flex justify-between cursor-help">
                    <span className="text-sm text-gray-600">Sortino Ratio</span>
                    <span className={`text-lg font-bold ${
                      performance.sortinoRatio > 1 ? 'text-green-500' :
                      performance.sortinoRatio > 0 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {isNaN(performance.sortinoRatio) ? 'N/A' : performance.sortinoRatio.toFixed(2)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
              {performance.recoveryFactor !== undefined && (
                <MetricTooltip
                  metric="Recovery Factor"
                  description="Total profit divided by maximum drawdown. Shows how quickly you recover from losses. Higher is better."
                  formula="Recovery Factor = Total Profit / Max Drawdown"
                >
                  <div className="flex justify-between cursor-help">
                    <span className="text-sm text-gray-600">Recovery Factor</span>
                    <span className={`text-lg font-bold ${
                      performance.recoveryFactor > 1 ? 'text-green-500' :
                      performance.recoveryFactor > 0 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {performance.recoveryFactor.toFixed(2)}
                    </span>
                  </div>
                </MetricTooltip>
              )}
              {performance.expectancy !== undefined && (
                <MetricTooltip
                  metric="Expectancy"
                  description="Average profit per trade. Positive expectancy means you're profitable on average. Negative means you lose money on average."
                  formula="Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)"
                >
                  <div className="flex justify-between cursor-help">
                    <span className="text-sm text-gray-600">Expectancy</span>
                    <span className={`text-lg font-bold ${
                      performance.expectancy > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {performance.expectancy.toFixed(2)} {config.currency}
                    </span>
                  </div>
                </MetricTooltip>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Performance Chart */}
      {trades.length > 0 && currentBalance && (
        <div className="mt-6">
          <PerformanceChart 
            trades={trades} 
            initialBalance={config.initialBalance}
            currentBalance={currentBalance}
          />
        </div>
      )}
    </div>
  )
}

