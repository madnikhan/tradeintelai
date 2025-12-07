'use client'

import { Trade } from '@/types/trading'
import { TradingModeManager } from '@/lib/trading-mode'
import { RiskCalculator, getRiskMetrics } from '@/lib/risk-calculator'
import { TRADING_RULES } from '@/config/trading-rules'

interface RiskMonitorProps {
  dailyProfitLoss: number
  openTrades: number
  tradesToday: number
}

export function RiskMonitor({ dailyProfitLoss, openTrades, tradesToday }: RiskMonitorProps) {
  const balance = TradingModeManager.getCurrentBalance()
  const mockTrades: Trade[] = []
  const riskMetrics = getRiskMetrics(balance, mockTrades)
  
  const tradingPermission = RiskCalculator.canPlaceTrade(
    balance,
    dailyProfitLoss,
    openTrades,
    tradesToday
  )

  const riskPercentage = riskMetrics.riskPercentage
  const dailyLossLimit = balance * TRADING_RULES.DAILY_LOSS_PERCENT
  const dailyLossPercentage = Math.abs((dailyProfitLoss / balance) * 100) || 0

  return (
    <div className="p-5">
      <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
        <span>🛡️</span> Risk Monitor
      </h3>
      
      <div className="space-y-4">
        {/* Trading Permission Status */}
        <div className={`p-3 rounded-lg ${
          tradingPermission.allowed 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : 'bg-rose-500/10 border border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${
              tradingPermission.allowed ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {tradingPermission.allowed ? '✓ Trading Allowed' : '✕ Trading Blocked'}
            </span>
          </div>
          <p className={`text-xs mt-1 ${
            tradingPermission.allowed ? 'text-emerald-400/70' : 'text-rose-400/70'
          }`}>
            {tradingPermission.reason}
          </p>
        </div>

        {/* Current Risk */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">Current Risk</span>
            <span className={`text-sm font-bold font-mono ${
              riskPercentage > 5 ? 'text-rose-400' :
              riskPercentage > 3 ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {riskPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-[#1e2738] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                riskPercentage > 5 ? 'bg-rose-500' :
                riskPercentage > 3 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(riskPercentage * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Loss Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">Daily Loss Used</span>
            <span className={`text-sm font-bold font-mono ${
              dailyLossPercentage >= 3 ? 'text-rose-400' :
              dailyLossPercentage >= 2 ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {dailyLossPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-[#1e2738] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                dailyLossPercentage >= 3 ? 'bg-rose-500' :
                dailyLossPercentage >= 2 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((dailyLossPercentage / 3) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1e2738]">
          <div className="bg-[#141c2b] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500 mb-0.5">Open Trades</p>
            <p className="text-sm font-bold text-white font-mono">
              {openTrades} <span className="text-gray-500">/ {TRADING_RULES.MAX_OPEN_TRADES}</span>
            </p>
          </div>
          <div className="bg-[#141c2b] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500 mb-0.5">Trades Today</p>
            <p className="text-sm font-bold text-white font-mono">
              {tradesToday} <span className="text-gray-500">/ {TRADING_RULES.MAX_TRADES_PER_DAY}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
