/**
 * Trade History Helper
 * Fetches and converts MT5 trade history to Trade format
 */

import { Trade, TradeDirection, TradeStatus } from '@/types/trading';
import { httpBridge } from './http-bridge-connector';
import { RiskCalculator } from './risk-calculator';
import { getBridgeUrl } from '@/config/bridge-config';
import { 
  saveTradesToFirestore, 
  getTradesFromFirestore
} from './firebase/trade-history';
import { isFirebaseConfigured } from './firebase/config';

export interface MT5Deal {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  exitPrice?: number;
  profit: number;
  sl?: number;
  tp?: number;
  openTime: string;
  closeTime?: string;
}

/**
 * Fetch trade history from MT5 automatically
 */
export async function fetchTradeHistory(): Promise<Trade[]> {
  try {
    // Try to get closed positions from MT5 bridge
    const response = await fetch(getBridgeUrl('/closed-positions'), {
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.positions && data.positions.length > 0) {
        const trades = convertClosedPositionsToTrades(data.positions);
        
        // Store in localStorage for persistence (always)
        if (typeof window !== 'undefined') {
          localStorage.setItem('mt5_trade_history', JSON.stringify(trades));
        }
        
        // Also save to Firestore if configured (dual-write strategy)
        if (isFirebaseConfigured()) {
          try {
            await saveTradesToFirestore(trades);
          } catch (error) {
            console.warn('Failed to save trades to Firestore (non-critical):', error);
          }
        }
        
        return trades;
      }
    }

    // Try Firestore first (if configured), then fallback to localStorage
    if (isFirebaseConfigured()) {
      try {
        const firestoreTrades = await getTradesFromFirestore();
        if (firestoreTrades.length > 0) {
          // Also update localStorage for offline access
          if (typeof window !== 'undefined') {
            localStorage.setItem('mt5_trade_history', JSON.stringify(firestoreTrades));
          }
          return firestoreTrades;
        }
      } catch (error) {
        console.warn('Failed to get trades from Firestore, falling back to localStorage:', error);
      }
    }

    // Fallback: Try to get from localStorage (manual entries or cached)
    if (typeof window !== 'undefined') {
      const storedTrades = localStorage.getItem('mt5_trade_history');
      if (storedTrades) {
        try {
          const trades = JSON.parse(storedTrades);
          return trades.map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp),
          }));
        } catch (e) {
          console.error('Failed to parse stored trades:', e);
        }
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch trade history:', error);
    // Return cached trades if available
    if (typeof window !== 'undefined') {
      const storedTrades = localStorage.getItem('mt5_trade_history');
      if (storedTrades) {
        try {
          const trades = JSON.parse(storedTrades);
          return trades.map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp),
          }));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    return [];
  }
}

/**
 * Convert closed positions from MT5 to Trade format
 */
function convertClosedPositionsToTrades(positions: any[]): Trade[] {
  return positions.map((pos, index) => {
    const entryPrice = pos.entry_price || pos.entryPrice || 0;
    const exitPrice = pos.exit_price || pos.exitPrice || 0;
    const stopLoss = entryPrice * 0.99; // Estimate if not available
    const takeProfit = entryPrice * 1.02; // Estimate if not available
    const lotSize = pos.volume || 0;

    // Calculate risk/reward
    const riskCalc = RiskCalculator.calculateTradeSizeSync(
      entryPrice,
      stopLoss,
      pos.symbol || 'EURUSD'
    );

    // Net P/L = profit + swap + commission (all costs included)
    const profit = pos.profit || 0;
    const swap = pos.swap || 0;
    const commission = pos.commission || 0;
    const netProfitLoss = profit + swap + commission;

    return {
      id: pos.position_id?.toString() || `closed_${Date.now()}_${index}`,
      pair: pos.symbol || 'EURUSD',
      direction: (pos.direction === 'BUY' || pos.direction === 'buy') ? 'BUY' : 'SELL',
      entryPrice,
      stopLoss,
      takeProfit,
      lotSize,
      riskAmount: riskCalc.riskAmount,
      rewardAmount: riskCalc.rewardAmount,
      status: 'closed' as TradeStatus,
      profitLoss: netProfitLoss, // Net P/L after commission and swap
      timestamp: new Date(pos.open_time || pos.close_time || Date.now()),
      reason: 'MT5 Closed Position',
    };
  });
}

/**
 * Convert MT5 positions to Trade format
 */
function convertPositionsToTrades(positions: any[]): Trade[] {
  return positions.map((pos, index) => {
    const entryPrice = pos.open_price || pos.entryPrice || 0;
    const stopLoss = pos.sl || pos.stopLoss || 0;
    const takeProfit = pos.tp || pos.takeProfit || 0;
    const lotSize = pos.volume || pos.lotSize || 0;

    // Calculate risk/reward
    const riskCalc = RiskCalculator.calculateTradeSizeSync(
      entryPrice,
      stopLoss || entryPrice * 0.99, // Fallback if no SL
      pos.symbol || 'EURUSD'
    );

    return {
      id: pos.ticket?.toString() || `trade_${Date.now()}_${index}`,
      pair: pos.symbol || 'EURUSD',
      direction: (pos.type === 'BUY' || pos.type === 'buy') ? 'BUY' : 'SELL',
      entryPrice,
      stopLoss: stopLoss || entryPrice * 0.99,
      takeProfit: takeProfit || entryPrice * 1.02,
      lotSize,
      riskAmount: riskCalc.riskAmount,
      rewardAmount: riskCalc.rewardAmount,
      status: 'open' as TradeStatus,
      profitLoss: pos.profit || 0,
      timestamp: new Date(pos.openTime || Date.now()),
      reason: 'MT5 Position',
    };
  });
}

/**
 * Convert closed trade data to Trade format
 * Used when trades are closed manually
 */
export function convertClosedTradeToTrade(
  deal: {
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    volume: number;
    profit: number;
    openTime: string;
    closeTime: string;
    sl?: number;
    tp?: number;
  },
  balance: number
): Trade {
  const entryPrice = deal.entryPrice;
  const stopLoss = deal.sl || entryPrice * 0.99;
  const takeProfit = deal.tp || entryPrice * 1.02;

  const riskCalc = RiskCalculator.calculateTradeSizeSync(
    entryPrice,
    stopLoss,
    deal.symbol
  );

  return {
    id: `closed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    pair: deal.symbol,
    direction: deal.type,
    entryPrice,
    stopLoss,
    takeProfit,
    lotSize: deal.volume,
    riskAmount: riskCalc.riskAmount,
    rewardAmount: riskCalc.rewardAmount,
    status: 'closed' as TradeStatus,
    profitLoss: deal.profit,
    timestamp: new Date(deal.openTime),
    reason: 'Manual Close',
  };
}

/**
 * Store trade in localStorage for persistence
 */
export async function storeTradeInHistory(trade: Trade): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Store in localStorage (always)
    const stored = localStorage.getItem('mt5_trade_history');
    const trades: Trade[] = stored ? JSON.parse(stored) : [];
    
    // Check if trade already exists
    const exists = trades.some(t => t.id === trade.id);
    if (!exists) {
      trades.push(trade);
      localStorage.setItem('mt5_trade_history', JSON.stringify(trades));
      
      // Also save to Firestore if configured (dual-write strategy)
      if (isFirebaseConfigured()) {
        try {
          const { saveTradeToFirestore } = await import('./firebase/trade-history');
          await saveTradeToFirestore(trade);
        } catch (error) {
          console.warn('Failed to save trade to Firestore (non-critical):', error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to store trade:', error);
  }
}

/**
 * Get stored trades from localStorage
 */
export function getStoredTrades(): Trade[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('mt5_trade_history');
    if (stored) {
      const trades = JSON.parse(stored);
      return trades.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp),
      }));
    }
  } catch (error) {
    console.error('Failed to get stored trades:', error);
  }

  return [];
}

