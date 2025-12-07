'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CellProps } from 'recharts';
import { Trade } from '@/types/trading';

interface TradeHistoryChartProps {
  trades: Trade[];
}

const COLORS = ['#10b981', '#ef4444', '#6b7280'];

export function TradeHistoryChart({ trades }: TradeHistoryChartProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-8 text-center">
        <p className="text-gray-400">No trade data available for history chart</p>
      </div>
    );
  }

  const closedTrades = trades.filter(t => t.status === 'closed');
  
  // Win/Loss distribution
  const winLossData = [
    { name: 'Wins', value: closedTrades.filter(t => (t.profitLoss || 0) > 0).length, color: '#10b981' },
    { name: 'Losses', value: closedTrades.filter(t => (t.profitLoss || 0) < 0).length, color: '#ef4444' },
    { name: 'Breakeven', value: closedTrades.filter(t => (t.profitLoss || 0) === 0).length, color: '#6b7280' },
  ];

  // P/L by currency pair
  const pairPL: Record<string, number> = {};
  closedTrades.forEach(trade => {
    const pair = trade.pair || 'Unknown';
    pairPL[pair] = (pairPL[pair] || 0) + (trade.profitLoss || 0);
  });

  const pairData = Object.entries(pairPL)
    .map(([pair, pl]) => ({ pair, pl }))
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 10); // Top 10 pairs

  // Monthly P/L
  const monthlyPL: Record<string, number> = {};
  closedTrades.forEach(trade => {
    const date = new Date(trade.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyPL[monthKey] = (monthlyPL[monthKey] || 0) + (trade.profitLoss || 0);
  });

  const monthlyData = Object.entries(monthlyPL)
    .map(([month, pl]) => ({ month, pl }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months

  return (
    <div className="space-y-6">
      {/* Win/Loss Pie Chart */}
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Win/Loss Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={winLossData}
              cx="50%"
              cy="50%"
              labelLine={false}
               label={(props: any) => {
                 const { name, percent } = props;
                 if (!name || percent === undefined) return '';
                 return `${name}: ${(percent * 100).toFixed(0)}%`;
               }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {winLossData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0d1321',
                border: '1px solid #1e2738',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly P/L Chart */}
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
        <h3 className="text-lg font-bold text-white mb-4">Monthly P/L</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => {
                const [year, month] = value.split('-');
                return `${month}/${year.slice(2)}`;
              }}
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
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'P/L']}
            />
            <Bar 
              dataKey="pl" 
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
            >
              {monthlyData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.pl >= 0 ? '#10b981' : '#ef4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Pairs by P/L */}
      {pairData.length > 0 && (
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
          <h3 className="text-lg font-bold text-white mb-4">P/L by Currency Pair</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pairData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2738" />
              <XAxis 
                type="number"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <YAxis 
                type="category"
                dataKey="pair"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0d1321',
                  border: '1px solid #1e2738',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'P/L']}
              />
              <Bar 
                dataKey="pl" 
                radius={[0, 4, 4, 0]}
              >
                {pairData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.pl >= 0 ? '#10b981' : '#ef4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

