/**
 * Account Calculator
 * Calculates daily and monthly P/L from trades
 */

import { Trade } from '@/types/trading';

export interface AccountMetrics {
  dailyProfitLoss: number; // Realized P/L from trades closed today only
  unrealizedPL: number; // Current profit/loss from all open positions
  monthlyProfitLoss: number;
  allTimeProfitLoss: number; // Total profit/loss from all closed trades (regardless of date)
  openTrades: number;
  tradesToday: number;
  totalTrades: number;
}

/**
 * Calculate account metrics from trades
 */
export function calculateAccountMetrics(
  trades: Trade[],
  openPositions: any[] = []
): AccountMetrics {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0); // Set to start of day
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  // Calculate daily P/L:
  // Daily P/L = Realized P/L from trades closed TODAY only
  // (Does NOT include unrealized P/L from open positions - that's shown separately as "Unrealized P/L")
  const closedTradesToday = trades.filter(trade => {
    if (trade.status !== 'closed') return false;
    const tradeDate = new Date(trade.timestamp);
    tradeDate.setHours(0, 0, 0, 0);
    return tradeDate.getTime() === today.getTime();
  });

  // Daily P/L = only realized profit/loss from trades closed today
  const dailyProfitLoss = closedTradesToday.reduce((sum, trade) => {
    // Type validation: Ensure profitLoss is a number
    const profitLoss = typeof trade.profitLoss === 'number' ? trade.profitLoss : 0;
    if (typeof trade.profitLoss !== 'number' && trade.profitLoss !== undefined && trade.profitLoss !== null) {
      console.warn(`⚠️ Trade ${trade.id} (${trade.pair}) has invalid profitLoss type: ${typeof trade.profitLoss}. Expected number.`);
    }
    return sum + profitLoss;
  }, 0);

  // Calculate unrealized P/L separately (for display purposes)
  // This is the current profit/loss of all open positions
  const openTradesInArray = trades.filter(trade => trade.status === 'open');
  const unrealizedPLFromTrades = openTradesInArray.reduce((sum, trade) => {
    // Type validation: Ensure profitLoss is a number
    const profitLoss = typeof trade.profitLoss === 'number' ? trade.profitLoss : 0;
    return sum + profitLoss;
  }, 0);

  // Also include any open positions from MT5 that might not be in trades array
  const unrealizedPLFromPositions = openPositions.reduce((sum, pos) => {
    // Check if this position is already counted in trades array
    const alreadyCounted = openTradesInArray.some(t => {
      const posSymbol = (pos.symbol || '').replace('/', '').toUpperCase();
      const tradeSymbol = (t.pair || '').replace('/', '').toUpperCase();
      return posSymbol === tradeSymbol && 
        Math.abs(t.entryPrice - (pos.open_price || pos.entryPrice || 0)) < 0.0001;
    });
    
    if (!alreadyCounted) {
      // Use profit field from MT5 position (this is the current unrealized P/L)
      const profit = pos.profit !== undefined ? pos.profit : (pos.profitLoss || 0);
      return sum + profit;
    }
    return sum;
  }, 0);

  const totalUnrealizedPL = unrealizedPLFromTrades + unrealizedPLFromPositions;

  // Debug logging
  console.log('📊 P/L Calculation:', {
    dailyPL: dailyProfitLoss, // Realized P/L from closed trades today
    unrealizedPL: totalUnrealizedPL, // Current P/L from open positions
    closedTradesToday: closedTradesToday.length,
    openTradesInArray: openTradesInArray.length,
    openPositionsCount: openPositions.length
  });

  // Calculate monthly P/L from closed trades this month
  const closedTradesThisMonth = trades.filter(trade => {
    if (trade.status !== 'closed') return false;
    const tradeDate = new Date(trade.timestamp);
    return tradeDate >= firstDayOfMonth;
  });

  const monthlyProfitLoss = closedTradesThisMonth.reduce((sum, trade) => {
    // Type validation: Ensure profitLoss is a number
    const profitLoss = typeof trade.profitLoss === 'number' ? trade.profitLoss : 0;
    return sum + profitLoss;
  }, 0);

  // Calculate all-time P/L from all closed trades (regardless of date)
  const allClosedTrades = trades.filter(trade => {
    const isClosed = trade.status === 'closed';
    if (!isClosed) {
      console.warn(`⚠️ Trade ${trade.id} (${trade.pair}) has status: "${trade.status}", expected "closed"`);
    }
    return isClosed;
  });
  
  const allTimeProfitLoss = allClosedTrades.reduce((sum, trade) => {
    // Type validation: Ensure profitLoss is a number
    const profitLoss = typeof trade.profitLoss === 'number' ? trade.profitLoss : 0;
    if (profitLoss === 0 && trade.status === 'closed') {
      console.warn(`⚠️ Trade ${trade.id} (${trade.pair}) has profitLoss: ${profitLoss}, might be missing P/L data`);
    }
    if (typeof trade.profitLoss !== 'number' && trade.profitLoss !== undefined && trade.profitLoss !== null) {
      console.warn(`⚠️ Trade ${trade.id} (${trade.pair}) has invalid profitLoss type: ${typeof trade.profitLoss}. Expected number.`);
    }
    return sum + profitLoss;
  }, 0);

  // Debug logging for All Time P/L
  console.log('📊 All Time P/L Calculation:', {
    totalTrades: trades.length,
    closedTradesCount: allClosedTrades.length,
    allTimeProfitLoss,
    allClosedTradesPL: allClosedTrades.map(t => t.profitLoss || 0),
    sampleClosedTrades: allClosedTrades.slice(0, 5).map(t => ({
      id: t.id,
      pair: t.pair,
      profitLoss: t.profitLoss,
      status: t.status,
      timestamp: t.timestamp
    }))
  });

  // Count open trades
  const openTrades = openPositions.length;

  // Count trades executed today (both open and closed)
  const tradesTodayCount = trades.filter(trade => {
    const tradeDate = new Date(trade.timestamp);
    tradeDate.setHours(0, 0, 0, 0);
    return tradeDate.getTime() === today.getTime();
  }).length;

  // Total trades
  const totalTrades = trades.length;

  return {
    dailyProfitLoss, // Realized P/L from trades closed today
    unrealizedPL: totalUnrealizedPL, // Current P/L from all open positions
    monthlyProfitLoss,
    allTimeProfitLoss, // Total profit/loss from all closed trades
    openTrades,
    tradesToday: tradesTodayCount,
    totalTrades,
  };
}

