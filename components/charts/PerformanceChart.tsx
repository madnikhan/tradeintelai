'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Trade } from '@/types/trading';

interface PerformanceChartProps {
  trades: Trade[];
  initialBalance: number;
  currentBalance: number;
}

export function PerformanceChart({ trades, initialBalance, currentBalance }: PerformanceChartProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-8 text-center">
        <p className="text-gray-400">No trade data available for performance chart</p>
      </div>
    );
  }

  // Calculate equity curve (cumulative P/L over time)
  const equityData: Array<{ date: string; equity: number; pnl: number }> = [];
  let runningEquity = initialBalance;

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sortedTrades.forEach((trade) => {
    if (trade.status === 'closed') {
      runningEquity += trade.profitLoss || 0;
      equityData.push({
        date: new Date(trade.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        equity: runningEquity,
        pnl: trade.profitLoss || 0,
      });
    }
  });

  // Add current balance as final point
  if (equityData.length > 0) {
    equityData.push({
      date: 'Now',
      equity: currentBalance,
      pnl: currentBalance - initialBalance,
    });
  }

  return (
    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
      <h3 className="text-lg font-bold text-white mb-4">Equity Curve</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={equityData}>
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1321',
              border: '1px solid #1e2738',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#06b6d4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorEquity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

