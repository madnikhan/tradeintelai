'use client'

import { useState, useEffect } from 'react'
import { getAnalysisAccuracy } from '@/lib/firebase/analysis-storage'
import { PerformanceAnalytics } from '@/lib/performance-analytics'
import { Trade } from '@/types/trading'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './EmptyState'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AccuracyDashboardProps {
  trades?: Trade[]
  currentBalance?: number
  initialBalance?: number
}

interface AccuracyStats {
  total: number
  correct: number
  incorrect: number
  pending: number
  accuracy: number
}

interface TimeSeriesData {
  date: string
  accuracy: number
  winRate: number
  profitFactor: number
}

export function AccuracyDashboard({ trades = [], currentBalance, initialBalance = 10000 }: AccuracyDashboardProps) {
  const [accuracyStats, setAccuracyStats] = useState<AccuracyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])

  useEffect(() => {
    loadAccuracyData()
  }, [timeRange])

  const loadAccuracyData = async () => {
    try {
      setLoading(true)
      const stats = await getAnalysisAccuracy()
      setAccuracyStats(stats)
      
      // Calculate time series data from trades
      if (trades.length > 0 && currentBalance) {
        const metrics = PerformanceAnalytics.calculateAdvancedMetrics(
          trades,
          initialBalance,
          currentBalance
        )
        
        // Group trades by date and calculate metrics
        const groupedTrades = groupTradesByDate(trades, timeRange)
        const seriesData: TimeSeriesData[] = groupedTrades.map(group => {
          const groupMetrics = PerformanceAnalytics.calculateAdvancedMetrics(
            group.trades,
            initialBalance,
            currentBalance
          )
          return {
            date: group.date,
            accuracy: stats.accuracy, // Use overall accuracy for now
            winRate: groupMetrics.winRate,
            profitFactor: groupMetrics.profitFactor || 0,
          }
        })
        setTimeSeriesData(seriesData)
      }
    } catch (error) {
      console.error('Failed to load accuracy data:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupTradesByDate = (trades: Trade[], range: string) => {
    const now = new Date()
    const cutoffDate = new Date()
    
    switch (range) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoffDate.setDate(now.getDate() - 90)
        break
      default:
        cutoffDate.setFullYear(2000) // All time
    }

    const filteredTrades = trades.filter(t => {
      const tradeDate = new Date(t.timestamp)
      return tradeDate >= cutoffDate
    })

    // Group by date
    const grouped: { [key: string]: Trade[] } = {}
    filteredTrades.forEach(trade => {
      const date = new Date(trade.timestamp).toISOString().split('T')[0]
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(trade)
    })

    return Object.keys(grouped)
      .sort()
      .map(date => ({
        date,
        trades: grouped[date],
      }))
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!accuracyStats || accuracyStats.total === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Accuracy Data"
        description="Accuracy metrics will appear here once you have executed trades based on AI analysis. The system tracks prediction accuracy, win rate, and profit factor over time."
      />
    )
  }

  const performanceMetrics = trades.length > 0 && currentBalance
    ? PerformanceAnalytics.calculateAdvancedMetrics(trades, initialBalance, currentBalance)
    : null

  const accuracyColor = accuracyStats.accuracy >= 70 ? 'text-green-400' : 
                        accuracyStats.accuracy >= 60 ? 'text-yellow-400' : 
                        'text-red-400'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Engine Accuracy</h2>
          <p className="text-sm text-gray-400 mt-1">
            Track prediction accuracy and performance metrics over time
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="bg-[#141c2b] border border-[#1e2738] text-white rounded-lg px-4 py-2 text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Accuracy */}
        <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Prediction Accuracy</span>
            <span className="text-xs text-gray-500">AI Analysis</span>
          </div>
          <div className={`text-3xl font-bold ${accuracyColor} mb-1`}>
            {accuracyStats.accuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            {accuracyStats.correct} correct / {accuracyStats.total} total
          </div>
          <div className="mt-3 h-2 bg-[#1e2738] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                accuracyStats.accuracy >= 70 ? 'bg-green-500' :
                accuracyStats.accuracy >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${accuracyStats.accuracy}%` }}
            />
          </div>
        </div>

        {/* Win Rate */}
        {performanceMetrics && (
          <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Win Rate</span>
              <span className="text-xs text-gray-500">Trades</span>
            </div>
            <div className={`text-3xl font-bold ${
              performanceMetrics.winRate >= 60 ? 'text-green-400' :
              performanceMetrics.winRate >= 50 ? 'text-yellow-400' :
              'text-red-400'
            } mb-1`}>
              {performanceMetrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              {performanceMetrics.winningTrades} wins / {performanceMetrics.totalTrades} trades
            </div>
            <div className="mt-3 h-2 bg-[#1e2738] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  performanceMetrics.winRate >= 60 ? 'bg-green-500' :
                  performanceMetrics.winRate >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${performanceMetrics.winRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Profit Factor */}
        {performanceMetrics && (
          <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Profit Factor</span>
              <span className="text-xs text-gray-500">Risk/Reward</span>
            </div>
            <div className={`text-3xl font-bold ${
              performanceMetrics.profitFactor >= 2 ? 'text-green-400' :
              performanceMetrics.profitFactor >= 1.5 ? 'text-yellow-400' :
              'text-red-400'
            } mb-1`}>
              {performanceMetrics.profitFactor.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              {performanceMetrics.totalProfit > 0 ? '+' : ''}
              ${performanceMetrics.totalProfit.toFixed(2)} net profit
            </div>
          </div>
        )}

        {/* Sharpe Ratio */}
        {performanceMetrics && performanceMetrics.sharpeRatio !== undefined && (
          <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Sharpe Ratio</span>
              <span className="text-xs text-gray-500">Risk-Adjusted</span>
            </div>
            <div className={`text-3xl font-bold ${
              performanceMetrics.sharpeRatio >= 2 ? 'text-green-400' :
              performanceMetrics.sharpeRatio >= 1 ? 'text-yellow-400' :
              'text-red-400'
            } mb-1`}>
              {performanceMetrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              {performanceMetrics.sharpeRatio >= 2 ? 'Excellent' :
               performanceMetrics.sharpeRatio >= 1 ? 'Good' :
               'Needs Improvement'}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      {timeSeriesData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy Trend */}
          <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Accuracy Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141c2b', border: '1px solid #1e2738', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  name="Accuracy %"
                  dot={{ fill: '#06b6d4', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Win Rate vs Profit Factor */}
          {performanceMetrics && (
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141c2b', border: '1px solid #1e2738', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Bar dataKey="winRate" fill="#10b981" name="Win Rate %" />
                  <Bar dataKey="profitFactor" fill="#06b6d4" name="Profit Factor" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Detailed Breakdown */}
      <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Accuracy Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{accuracyStats.total}</div>
            <div className="text-sm text-gray-400 mt-1">Total Predictions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{accuracyStats.correct}</div>
            <div className="text-sm text-gray-400 mt-1">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{accuracyStats.incorrect}</div>
            <div className="text-sm text-gray-400 mt-1">Incorrect</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{accuracyStats.pending}</div>
            <div className="text-sm text-gray-400 mt-1">Pending</div>
          </div>
        </div>
      </div>
    </div>
  )
}

