/**
 * Firestore Analytics Service
 * Performance tracking and analytics
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  aggregateQuerySnapshot,
  AggregateField,
  Timestamp
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './config';
import { Trade } from '@/types/trading';
import { getAccountDocumentId } from './account-context';

const ANALYTICS_COLLECTION = 'analytics';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageTradeDuration: number; // in seconds
  sharpeRatio?: number;
  maxDrawdown?: number;
}

/**
 * Calculate performance metrics from trades
 */
export async function calculatePerformanceMetrics(
  symbol?: string,
  startDate?: Date,
  endDate?: Date
): Promise<PerformanceMetrics> {
  if (!isFirebaseConfigured()) {
    return getDefaultMetrics();
  }

  try {
    const accountDocId = getAccountDocumentId();
    const tradesRef = collection(getDb(), 'trades', accountDocId, 'trades');
    
    let q = query(tradesRef, where('status', '==', 'closed'));
    if (symbol) {
      q = query(tradesRef, where('status', '==', 'closed'), where('symbol', '==', symbol));
    }
    
    const querySnapshot = await getDocs(q);
    const trades: Trade[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const trade: Trade = {
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(data.timestamp),
      } as Trade;
      
      // Filter by date range if provided
      if (startDate && trade.timestamp < startDate) return;
      if (endDate && trade.timestamp > endDate) return;
      
      trades.push(trade);
    });
    
    return calculateMetricsFromTrades(trades);
  } catch (error) {
    console.error('❌ Failed to calculate performance metrics:', error);
    return getDefaultMetrics();
  }
}

/**
 * Calculate metrics from trade array
 */
function calculateMetricsFromTrades(trades: Trade[]): PerformanceMetrics {
  if (trades.length === 0) {
    return getDefaultMetrics();
  }

  const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
  const losingTrades = trades.filter(t => (t.profitLoss || 0) < 0);
  
  const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0));
  const netProfit = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  
  const averageWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
  
  const largestWin = winningTrades.length > 0 
    ? Math.max(...winningTrades.map(t => t.profitLoss || 0))
    : 0;
  const largestLoss = losingTrades.length > 0
    ? Math.min(...losingTrades.map(t => t.profitLoss || 0))
    : 0;

  // Calculate average trade duration (simplified - would need open/close times)
  const averageTradeDuration = 0; // TODO: Calculate from open/close times

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalProfit,
    totalLoss,
    netProfit,
    profitFactor,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    averageTradeDuration,
  };
}

/**
 * Get default metrics
 */
function getDefaultMetrics(): PerformanceMetrics {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netProfit: 0,
    profitFactor: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    averageTradeDuration: 0,
  };
}

/**
 * Get performance by symbol
 */
export async function getPerformanceBySymbol(): Promise<Record<string, PerformanceMetrics>> {
  if (!isFirebaseConfigured()) {
    return {};
  }

  try {
    const accountDocId = getAccountDocumentId();
    const tradesRef = collection(getDb(), 'trades', accountDocId, 'trades');
    const q = query(tradesRef, where('status', '==', 'closed'));
    
    const querySnapshot = await getDocs(q);
    const tradesBySymbol: Record<string, Trade[]> = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const trade: Trade = {
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(data.timestamp),
      } as Trade;
      
      const symbol = trade.symbol || trade.pair || 'UNKNOWN';
      if (!tradesBySymbol[symbol]) {
        tradesBySymbol[symbol] = [];
      }
      tradesBySymbol[symbol].push(trade);
    });
    
    const performanceBySymbol: Record<string, PerformanceMetrics> = {};
    for (const [symbol, trades] of Object.entries(tradesBySymbol)) {
      performanceBySymbol[symbol] = calculateMetricsFromTrades(trades);
    }
    
    return performanceBySymbol;
  } catch (error) {
    console.error('❌ Failed to get performance by symbol:', error);
    return {};
  }
}

/**
 * Save performance snapshot (for historical tracking)
 */
export async function savePerformanceSnapshot(metrics: PerformanceMetrics): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  try {
    const accountDocId = getAccountDocumentId();
    const snapshotId = `snapshot_${Date.now()}`;
    const snapshotRef = doc(getDb(), ANALYTICS_COLLECTION, accountDocId, 'snapshots', snapshotId);
    
    await setDoc(snapshotRef, {
      ...metrics,
      timestamp: Timestamp.now(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    });
    
    console.log(`✅ Performance snapshot saved`);
  } catch (error) {
    console.error('❌ Failed to save performance snapshot:', error);
  }
}

