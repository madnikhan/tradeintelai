'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Cell } from 'recharts';
import { Trade } from '@/types/trading';

interface PLGraphProps {
  trades: Trade[];
  type?: 'daily' | 'monthly' | 'cumulative';
}

export function PLGraph({ trades, type = 'daily' }: PLGraphProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-8 text-center">
        <p className="text-gray-400">No trade data available for P/L graph</p>
      </div>
    );
  }

  const closedTrades = trades.filter(t => t.status === 'closed');

  let chartData: Array<{ period: string; pnl: number; cumulative: number; trades: number }> = [];
  let cumulativePL = 0;

  if (type === 'daily') {
    const dailyPL: Record<string, { pnl: number; trades: number }> = {};
    
    closedTrades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyPL[dateKey]) {
        dailyPL[dateKey] = { pnl: 0, trades: 0 };
      }
      dailyPL[dateKey].pnl += trade.profitLoss || 0;
      dailyPL[dateKey].trades += 1;
    });

    chartData = Object.entries(dailyPL)
      .map(([period, data]) => {
        cumulativePL += data.pnl;
        return {
          period,
          pnl: data.pnl,
          cumulative: cumulativePL,
          trades: data.trades,
        };
      })
      .sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime())
      .slice(-30); // Last 30 days
  } else if (type === 'monthly') {
    const monthlyPL: Record<string, { pnl: number; trades: number }> = {};
    
    closedTrades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyPL[monthKey]) {
        monthlyPL[monthKey] = { pnl: 0, trades: 0 };
      }
      monthlyPL[monthKey].pnl += trade.profitLoss || 0;
      monthlyPL[monthKey].trades += 1;
    });

    chartData = Object.entries(monthlyPL)
      .map(([period, data]) => {
        cumulativePL += data.pnl;
        return {
          period: period.replace('-', '/'),
          pnl: data.pnl,
          cumulative: cumulativePL,
          trades: data.trades,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12); // Last 12 months
  } else {
    // Cumulative
    const sortedTrades = [...closedTrades].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    chartData = sortedTrades.map((trade, index) => {
      cumulativePL += trade.profitLoss || 0;
      return {
        period: `Trade ${index + 1}`,
        pnl: trade.profitLoss || 0,
        cumulative: cumulativePL,
        trades: 1,
      };
    });
  }

  return (
    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          {type === 'daily' ? 'Daily' : type === 'monthly' ? 'Monthly' : 'Cumulative'} P/L
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
          <XAxis 
            dataKey="period" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            yAxisId="left"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
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
            formatter={(value: number, name: string) => {
              if (name === 'pnl') return [`$${value.toFixed(2)}`, 'P/L'];
              if (name === 'cumulative') return [`$${value.toFixed(2)}`, 'Cumulative'];
              return [value, name];
            }}
          />
          <Legend />
          <Bar 
            yAxisId="left"
            dataKey="pnl" 
            fill="#06b6d4"
            radius={[4, 4, 0, 0]}
            name="P/L"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} 
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="Cumulative P/L"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

