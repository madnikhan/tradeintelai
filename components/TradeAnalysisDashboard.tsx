'use client';

import { useState, useEffect } from 'react';
import { TradeAnalyzer, TradeAnalysis, TradeSummary } from '@/lib/trade-analyzer';
import { httpBridge } from '@/lib/http-bridge-connector';
import { TradingModeManager } from '@/lib/trading-mode';
import { convertClosedTradeToTrade, storeTradeInHistory, fetchTradeHistory } from '@/lib/trade-history';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Tooltip, MetricTooltip } from '@/components/Tooltip';
import { TradeHistoryChart } from '@/components/charts/TradeHistoryChart';
import { PLGraph } from '@/components/charts/PLGraph';
import { logger } from '@/lib/logger';
import { Trade, TradeStatus } from '@/types/trading';
import { getBridgeUrl } from '@/config/bridge-config';

export function TradeAnalysisDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]); // Trade[] format for charts
  const [tradesForAnalysis, setTradesForAnalysis] = useState<any[]>([]); // Custom format for analysis table
  const [analyses, setAnalyses] = useState<TradeAnalysis[]>([]);
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [leverage, setLeverage] = useState(200); // Default leverage
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const [filterWinLoss, setFilterWinLoss] = useState<'all' | 'win' | 'loss'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [manualTrade, setManualTrade] = useState({
    symbol: 'GBPJPY',
    direction: 'BUY' as 'BUY' | 'SELL',
    entryPrice: '',
    exitPrice: '',
    lotSize: '',
    profit: '',
    balance: '',
  });

  useEffect(() => {
    // Check connection status first (non-blocking)
    checkConnection();
    loadBalance();
    loadTrades();
    
    // Auto-refresh connection status every 10 seconds
    const connectionInterval = setInterval(() => {
      checkConnection();
    }, 10000);
    
    // Auto-refresh trades every 30 seconds
    const tradesInterval = setInterval(() => {
      loadTrades();
    }, 30000);
    
    return () => {
      clearInterval(connectionInterval);
      clearInterval(tradesInterval);
    };
  }, [balance]); // Re-run when balance changes

  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const healthResponse = await fetch(getBridgeUrl('/health'), {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
        }
      });
      
      clearTimeout(timeoutId);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        if (healthData && healthData.status === 'running') {
          setConnectionStatus('connected');
          return;
        }
      }
      // If health check fails, don't immediately set to disconnected
      // (might be a temporary issue, keep current status)
    } catch (error: any) {
      // If health check times out or fails, don't change status immediately
      // Only set to disconnected if we're sure the bridge is down
      if (error.name !== 'AbortError') {
        logger.debug('Health check failed:', error);
      }
      // Only set to disconnected if we've tried multiple times and failed
      // For now, keep the current status
    }
  };

  const loadBalance = async () => {
    try {
      const accountInfo = await httpBridge.getAccountInfo();
      if (accountInfo.success && accountInfo.balance !== undefined && accountInfo.balance !== null && !isNaN(accountInfo.balance)) {
        setBalance(accountInfo.balance);
        // Also get leverage from account info
        if (accountInfo.leverage) {
          setLeverage(accountInfo.leverage);
        }
      }
    } catch (error) {
      logger.error('Failed to load balance:', error);
    }
  };

  const loadTrades = async () => {
    setIsLoading(true);
    // Don't change connection status here - it's managed by checkConnection()
    try {
      // Fetch ALL trades (both open and closed) from MT5 bridge
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout for /all-trades
      
      const response = await fetch(getBridgeUrl('/all-trades'), {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Connection is working if we got data
        if (data.success !== false) {
          setConnectionStatus('connected');
        }
        
        // Combine open and closed positions
        const allPositions = [
          ...(data.closed || []).map((pos: any) => ({ ...pos, status: 'closed' })),
          ...(data.open || []).map((pos: any) => ({ ...pos, status: 'open' }))
        ];
        
        if (allPositions.length > 0) {
          // Convert MT5 positions to Trade format for charts
          const tradeListForCharts: Trade[] = [];
          
          // Convert MT5 positions to trade analysis format (for table)
          const tradeList = await Promise.all(allPositions.map(async (pos: any) => {
            // For open positions, fetch current price to use as exit price for display
            let exitPrice = pos.exit_price || pos.exitPrice || pos.open_price || pos.entry_price || pos.entryPrice;
            
            if (pos.status === 'open') {
              try {
                // Fetch current market price for open positions
                const priceResponse = await fetch(getBridgeUrl(`/price/${pos.symbol}`), {
                  headers: {
                    'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
                  },
                });
                if (priceResponse.ok) {
                  const priceData = await priceResponse.json();
                  if (priceData.success && priceData.price) {
                    // Use bid for SELL, ask for BUY
                    exitPrice = (pos.type === 'BUY' || pos.type === 'buy') 
                      ? (priceData.ask || priceData.price)
                      : (priceData.bid || priceData.price);
                  }
                }
              } catch (e) {
                // If price fetch fails, use open_price as fallback
                exitPrice = pos.open_price || pos.entry_price || pos.entryPrice || 0;
              }
            }
            
            // Also create Trade format for charts
            const entryPrice = pos.open_price || pos.entry_price || pos.entryPrice || 0;
            const profit = pos.profit || 0;
            const swap = pos.swap || 0;
            const commission = pos.commission || 0;
            const netProfitLoss = profit + swap + commission;
            
            const tradeForChart: Trade = {
              id: pos.position_id?.toString() || pos.ticket?.toString() || `trade_${Date.now()}_${tradeListForCharts.length}`,
              pair: pos.symbol || 'EURUSD',
              direction: (pos.direction === 'BUY' || pos.direction === 'buy' || pos.type === 'BUY' || pos.type === 'buy') ? 'BUY' : 'SELL',
              entryPrice: entryPrice,
              stopLoss: pos.sl || pos.stopLoss || entryPrice * 0.99,
              takeProfit: pos.tp || pos.takeProfit || entryPrice * 1.02,
              lotSize: pos.volume || 0,
              riskAmount: 0, // Will be calculated if needed
              rewardAmount: 0, // Will be calculated if needed
              status: (pos.status === 'open' ? 'open' : 'closed') as TradeStatus,
              profitLoss: netProfitLoss,
              timestamp: new Date(pos.close_time || pos.closeTime || pos.open_time || pos.openTime || Date.now()),
              reason: pos.status === 'open' ? 'MT5 Open Position' : 'MT5 Closed Position',
            };
            
            tradeListForCharts.push(tradeForChart);
            
            return {
              symbol: pos.symbol,
              type: (pos.direction || pos.type || 'BUY').toLowerCase(),
              entryPrice: entryPrice,
              exitPrice: exitPrice,
              volume: pos.volume || 0,
              profit: netProfitLoss, // Use net profit for display
              balance: balance, // Use current balance (will be corrected per-trade if needed)
              leverage: leverage, // Use actual account leverage
              status: pos.status || 'closed',
            };
          }));
          
          setTrades(tradeListForCharts); // Set Trade[] format for charts
          setTradesForAnalysis(tradeList); // Set custom format for analysis table
          analyzeTrades(tradeList); // Use custom format for analysis
          
          // Also store CLOSED trades in Trade format for Performance section
          allPositions.filter((pos: any) => pos.status === 'closed').forEach((pos: any) => {
            const trade = convertClosedTradeToTrade(
              {
                symbol: pos.symbol,
                type: (pos.direction === 'BUY' || pos.direction === 'buy' || pos.type === 'BUY' || pos.type === 'buy') ? 'BUY' : 'SELL',
                entryPrice: pos.open_price || pos.entry_price || pos.entryPrice || 0,
                exitPrice: pos.exit_price || pos.exitPrice || 0,
                volume: pos.volume || 0,
                profit: pos.profit || 0,
                openTime: pos.open_time || pos.openTime || new Date().toISOString(),
                closeTime: pos.close_time || pos.closeTime || new Date().toISOString(),
              },
              balance
            );
            // Store trade (async, fire-and-forget)
            storeTradeInHistory(trade).catch(err => {
              console.warn('Failed to store trade (non-critical):', err);
            });
          });
          
          // Trigger update event for Performance section
          window.dispatchEvent(new CustomEvent('tradesUpdated'));
          
          logger.info(`✅ Auto-loaded ${tradeList.length} trades from MT5 (${data.total_closed || 0} closed, ${data.total_open || 0} open)`);
        } else {
          // Try to get from localStorage (manual entries)
          const storedTrades = localStorage.getItem('mt5_trade_history');
          if (storedTrades) {
            try {
              const parsed = JSON.parse(storedTrades);
              const tradeList = parsed.map((t: any) => ({
                symbol: t.pair,
                type: t.direction?.toLowerCase() || 'buy',
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice || t.entryPrice,
                volume: t.lotSize,
                profit: t.profitLoss || 0,
                balance: balance,
                leverage: leverage,
              }));
              setTrades(tradeList);
              analyzeTrades(tradeList);
            } catch (e) {
              logger.error('Failed to parse stored trades:', e);
            }
          }
        }
      } else {
        // Fallback: Try localStorage
        const storedTrades = localStorage.getItem('mt5_trade_history');
        if (storedTrades) {
          try {
            const parsed = JSON.parse(storedTrades);
            const tradeList = parsed.map((t: any) => ({
              symbol: t.pair,
              type: t.direction?.toLowerCase() || 'buy',
              entryPrice: t.entryPrice,
              exitPrice: t.exitPrice || t.entryPrice,
              volume: t.lotSize,
              profit: t.profitLoss || 0,
              balance: balance,
              leverage: 500,
            }));
            setTrades(tradeList);
            analyzeTrades(tradeList);
          } catch (e) {
            console.error('Failed to parse stored trades:', e);
          }
        }
      }
    } catch (error: any) {
      // Don't immediately set to disconnected - might be a timeout or temporary issue
      // Connection status is managed by checkConnection() separately
      if (error.name === 'AbortError') {
        logger.warn('⏱️ Trade fetch timeout - bridge may be slow or EA processing');
      } else {
        logger.error('Failed to load trades from MT5:', error);
      }
      
      // Fallback to localStorage
      try {
        const storedTrades = localStorage.getItem('mt5_trade_history');
        if (storedTrades) {
          const parsed = JSON.parse(storedTrades);
          const tradeList = parsed.map((t: any) => ({
            symbol: t.pair,
            type: t.direction?.toLowerCase() || 'buy',
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice || t.entryPrice,
            volume: t.lotSize,
            profit: t.profitLoss || 0,
            balance: balance,
            leverage: 500,
          }));
          setTrades(tradeList);
          analyzeTrades(tradeList);
          logger.info('📦 Loaded trades from localStorage fallback');
        }
      } catch (e) {
        logger.error('Failed to load from localStorage:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeTrades = (tradeList: any[]) => {
    if (tradeList.length === 0) return;

    const analyzed = TradeAnalyzer.analyzeTrades(
      tradeList.map(t => ({
        symbol: t.symbol,
        direction: t.type === 'buy' ? 'BUY' : 'SELL',
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        lotSize: t.volume,
        profit: t.profit,
        balance: t.balance || balance,
        leverage: t.leverage || 500,
      }))
    );

    setAnalyses(analyzed.analyses);
    setSummary(analyzed.summary);
  };

  // Filter trades (for charts - using Trade[] format)
  const filteredTrades = trades.filter(trade => {
    // Status filter
    if (filterStatus !== 'all') {
      const status = trade.status || 'closed';
      if (filterStatus === 'open' && status !== 'open') return false;
      if (filterStatus === 'closed' && status !== 'closed') return false;
    }
    
    // Symbol filter (Trade uses 'pair' field)
    if (filterSymbol !== 'all' && trade.pair !== filterSymbol) return false;
    
    // Win/Loss filter (Trade uses 'profitLoss' field)
    if (filterWinLoss !== 'all') {
      const profit = trade.profitLoss || 0;
      if (filterWinLoss === 'win' && profit <= 0) return false;
      if (filterWinLoss === 'loss' && profit >= 0) return false;
    }
    
    // Date range filter (Trade uses 'timestamp' field)
    if (dateRange !== 'all') {
      const tradeDate = new Date(trade.timestamp || Date.now());
      const now = new Date();
      const diffDays = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dateRange === 'today' && diffDays > 1) return false;
      if (dateRange === 'week' && diffDays > 7) return false;
      if (dateRange === 'month' && diffDays > 30) return false;
    }
    
    return true;
  });
  
  // Filter analyses (for table - match by symbol and entry price)
  const filteredAnalyses = analyses.filter((analysis) => {
    // Find matching trade in tradesForAnalysis
    const trade = tradesForAnalysis.find(t => 
      t.symbol === analysis.symbol && 
      Math.abs(t.entryPrice - analysis.entryPrice) < 0.0001
    );
    if (!trade) return true; // Include if no match found (shouldn't happen)
    
    // Status filter
    if (filterStatus !== 'all') {
      const status = trade.status || 'closed';
      if (filterStatus === 'open' && status !== 'open') return false;
      if (filterStatus === 'closed' && status !== 'closed') return false;
    }
    
    // Symbol filter
    if (filterSymbol !== 'all' && trade.symbol !== filterSymbol) return false;
    
    // Win/Loss filter
    if (filterWinLoss !== 'all') {
      const profit = trade.profit || 0;
      if (filterWinLoss === 'win' && profit <= 0) return false;
      if (filterWinLoss === 'loss' && profit >= 0) return false;
    }
    
    // Date range filter - use analysis profit to determine if it's recent
    // Since we don't have date in analysis, we'll skip date filtering for analyses
    // The chart filtering will handle date ranges
    
    return true;
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Symbol', 'Type', 'Entry Price', 'Exit Price', 'Volume', 'Profit', 'Status', 'Date'];
    const rows = filteredTrades.map(trade => [
      trade.pair || '',
      trade.direction || '',
      trade.entryPrice || 0,
      trade.takeProfit || trade.entryPrice || 0, // Use takeProfit as exit approximation
      trade.lotSize || 0,
      trade.profitLoss || 0,
      trade.status || 'closed',
      new Date(trade.timestamp || Date.now()).toLocaleDateString(),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Re-analyze filtered trades when filters change
  useEffect(() => {
    if (filteredTrades.length > 0) {
      analyzeTrades(filteredTrades);
    } else if (trades.length > 0) {
      // If no filtered trades, analyze all trades
      analyzeTrades(trades);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterSymbol, filterWinLoss, dateRange]);

  const handleManualEntry = () => {
    setShowManualEntry(true);
  };

  const addManualTrade = () => {
    if (!manualTrade.symbol || !manualTrade.entryPrice || !manualTrade.exitPrice || !manualTrade.lotSize) {
      alert('Please fill in all required fields');
      return;
    }

    // Convert to Trade format for charts
    const tradeForPerformance = convertClosedTradeToTrade(
      {
        symbol: manualTrade.symbol,
        type: manualTrade.direction,
        entryPrice: parseFloat(manualTrade.entryPrice),
        exitPrice: parseFloat(manualTrade.exitPrice),
        volume: parseFloat(manualTrade.lotSize),
        profit: manualTrade.profit ? parseFloat(manualTrade.profit) : 0,
        openTime: new Date().toISOString(),
        closeTime: new Date().toISOString(),
      },
      balance
    );
    storeTradeInHistory(tradeForPerformance);

    // Trigger a page refresh to update PerformanceTracker
    window.dispatchEvent(new CustomEvent('tradesUpdated'));

    // Reset form
    setManualTrade({
      symbol: 'GBPJPY',
      direction: 'BUY',
      entryPrice: '',
      exitPrice: '',
      lotSize: '',
      profit: '',
      balance: '',
    });
    setShowManualEntry(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📊</span> Trade Analysis
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500">Capital allocation & performance metrics</p>
            {connectionStatus === 'connected' && trades.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>Auto-synced from MT5</span>
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                <span>MT5 Bridge Disconnected</span>
              </div>
            )}
            {connectionStatus === 'checking' && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                <span>Checking connection...</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={filteredTrades.length === 0}
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm font-medium disabled:opacity-50"
          >
            📥 Export CSV
          </button>
          <button
            onClick={loadTrades}
            disabled={isLoading}
            className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-cyan-400 hover:bg-[#1e2738] transition-all text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? '↻ Syncing...' : '↻ Sync from MT5'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#141c2b] rounded-xl border border-[#1e2738]">
        <div>
          <label className="block text-xs text-gray-500 mb-2">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Symbol</label>
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Pairs</option>
            {Array.from(new Set(trades.map(t => t.pair))).map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Win/Loss</label>
          <select
            value={filterWinLoss}
            onChange={(e) => setFilterWinLoss(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All</option>
            <option value="win">Winners</option>
            <option value="loss">Losers</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Charts Section */}
      {trades.length > 0 && (
        <div className="space-y-6 mb-6">
          <PLGraph trades={trades} type="daily" />
          <TradeHistoryChart trades={trades} />
        </div>
      )}

      {/* Summary Cards */}
      {summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricTooltip
            metric="Total Profit"
            description="Total profit or loss from all trades (net of commissions and swap fees)."
          >
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 cursor-help">
              <p className="text-xs text-gray-500 mb-1">Total Profit</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">
                {TradingModeManager.getCurrencySymbol()}{summary.totalProfit.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary.totalTrades} trades</p>
            </div>
          </MetricTooltip>

          <MetricTooltip
            metric="Total Capital Used"
            description="Total margin required across all trades. This is the capital locked up as margin for your positions."
            formula="Margin = (Lot Size × Contract Size × Price) / Leverage"
          >
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 cursor-help">
              <p className="text-xs text-gray-500 mb-1">Total Capital Used</p>
              <p className="text-2xl font-bold text-cyan-400 font-mono">
                {TradingModeManager.getCurrencySymbol()}{summary.totalMarginUsed.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Margin across all trades</p>
            </div>
          </MetricTooltip>

          <MetricTooltip
            metric="Return on Capital"
            description="Average return on margin used per trade. Shows how efficiently you're using your capital."
            formula="ROI = (Profit / Margin Used) × 100"
          >
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 cursor-help">
              <p className="text-xs text-gray-500 mb-1">Return on Capital</p>
              <p className="text-2xl font-bold text-purple-400 font-mono">
                {summary.averageReturnOnMargin.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Per trade average</p>
            </div>
          </MetricTooltip>

          <MetricTooltip
            metric="Win Rate"
            description="Percentage of winning trades. A win rate above 50% is generally good, but profit factor matters more."
          >
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 cursor-help">
              <p className="text-xs text-gray-500 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">
                {summary.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary.largestWin > 0 && `Best: ${TradingModeManager.getCurrencySymbol()}${summary.largestWin.toFixed(2)}`}
              </p>
            </div>
          </MetricTooltip>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton type="metric" className="md:col-span-4" />
      ) : null}

      {/* Trade Details Table */}
      {filteredAnalyses.length > 0 ? (
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#141c2b] border-b border-[#1e2738]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400">Trade</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400">Symbol</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">Lot Size</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">Capital Used</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">Risk Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">ROI</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-400">Pips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2738]">
                {filteredAnalyses.map((analysis) => (
                  <tr key={analysis.tradeNumber} className="hover:bg-[#141c2b]/50">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      #{analysis.tradeNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-white">{analysis.symbol}</p>
                        <p className="text-xs text-gray-500">
                          {analysis.direction} • {analysis.entryPrice.toFixed(5)} → {analysis.exitPrice.toFixed(5)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-white">
                      {analysis.lotSize}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-cyan-400">
                      {TradingModeManager.getCurrencySymbol()}{analysis.marginUsed.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-yellow-400">
                      {TradingModeManager.getCurrencySymbol()}{analysis.riskAmount.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-mono font-bold ${
                      analysis.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {analysis.profit >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{analysis.profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-purple-400">
                      {analysis.returnOnMargin.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-400">
                      {analysis.pipMovement.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : connectionStatus === 'disconnected' ? (
        <ErrorMessage
          type="error"
          title="MT5 Bridge Connection Failed"
          message="Unable to connect to the MT5 bridge. Please ensure the Python bridge is running on port 8080 and the MT5 EA is attached to a chart."
          actions={[
            {
              label: '↻ Retry Connection',
              onClick: loadTrades,
              variant: 'primary',
            },
            {
              label: '📝 Manual Entry',
              onClick: handleManualEntry,
              variant: 'secondary',
            },
          ]}
        />
      ) : (
        <EmptyState
          icon="📊"
          title="No Trade History Available"
          description="Trades will auto-load from MT5 every 30 seconds. You can also sync manually or add trades manually."
          action={{
            label: '↻ Sync Now',
            onClick: loadTrades,
          }}
          secondaryAction={{
            label: '📝 Manual Entry',
            onClick: handleManualEntry,
          }}
        />
      )}

      {/* Manual Entry Form */}
      {showManualEntry && (
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Add Trade Manually</h3>
            <button
              onClick={() => setShowManualEntry(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Symbol</label>
              <input
                type="text"
                value={manualTrade.symbol}
                onChange={(e) => setManualTrade({ ...manualTrade, symbol: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="GBPJPY"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Direction</label>
              <select
                value={manualTrade.direction}
                onChange={(e) => setManualTrade({ ...manualTrade, direction: e.target.value as 'BUY' | 'SELL' })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lot Size</label>
              <input
                type="number"
                step="0.01"
                value={manualTrade.lotSize}
                onChange={(e) => setManualTrade({ ...manualTrade, lotSize: e.target.value })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Entry Price</label>
              <input
                type="number"
                step="0.00001"
                value={manualTrade.entryPrice}
                onChange={(e) => setManualTrade({ ...manualTrade, entryPrice: e.target.value })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="206.649"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Exit Price</label>
              <input
                type="number"
                step="0.00001"
                value={manualTrade.exitPrice}
                onChange={(e) => setManualTrade({ ...manualTrade, exitPrice: e.target.value })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="206.803"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Profit (optional)</label>
              <input
                type="number"
                step="0.01"
                value={manualTrade.profit}
                onChange={(e) => setManualTrade({ ...manualTrade, profit: e.target.value })}
                className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="985.09"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={addManualTrade}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-400 transition-all"
            >
              Add Trade
            </button>
            <button
              onClick={() => setShowManualEntry(false)}
              className="px-4 py-2 bg-[#1e2738] text-gray-400 rounded-lg text-sm hover:bg-[#2a3548] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics Breakdown */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Capital Efficiency */}
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>💰</span> Capital Efficiency
            </h3>
            <div className="space-y-3">
              <MetricTooltip
                metric="Avg Capital per Trade"
                description="Average margin used per trade. Shows typical capital allocation."
              >
                <div className="flex justify-between items-center cursor-help">
                  <span className="text-xs text-gray-500">Avg Capital per Trade</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {TradingModeManager.getCurrencySymbol()}{(summary.totalMarginUsed / summary.totalTrades).toFixed(2)}
                  </span>
                </div>
              </MetricTooltip>
              <MetricTooltip
                metric="Avg Profit per Trade"
                description="Average profit or loss per trade. Positive means profitable on average."
              >
                <div className="flex justify-between items-center cursor-help">
                  <span className="text-xs text-gray-500">Avg Profit per Trade</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {TradingModeManager.getCurrencySymbol()}{summary.averageProfitPerTrade.toFixed(2)}
                  </span>
                </div>
              </MetricTooltip>
              <MetricTooltip
                metric="Return on Risk"
                description="Average return relative to risk amount (2% of balance per trade)."
                formula="Return on Risk = (Profit / Risk Amount) × 100"
              >
                <div className="flex justify-between items-center cursor-help">
                  <span className="text-xs text-gray-500">Return on Risk</span>
                  <span className="text-sm font-bold text-purple-400 font-mono">
                    {summary.averageReturnOnRisk.toFixed(2)}%
                  </span>
                </div>
              </MetricTooltip>
              <MetricTooltip
                metric="Return on Margin"
                description="Average return on actual margin used. Shows capital efficiency."
                formula="Return on Margin = (Profit / Margin Used) × 100"
              >
                <div className="flex justify-between items-center cursor-help">
                  <span className="text-xs text-gray-500">Return on Margin</span>
                  <span className="text-sm font-bold text-cyan-400 font-mono">
                    {summary.averageReturnOnMargin.toFixed(2)}%
                  </span>
                </div>
              </MetricTooltip>
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>🛡️</span> Risk Analysis
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Total Risk Amount</span>
                <span className="text-sm font-bold text-yellow-400 font-mono">
                  {TradingModeManager.getCurrencySymbol()}{summary.totalRiskAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Capital Utilization</span>
                <span className="text-sm font-bold text-white font-mono">
                  {(() => {
                    const currentBalance = balance || TradingModeManager.getCurrentBalance();
                    if (currentBalance <= 0) return '0.0%';
                    const utilization = (summary.totalMarginUsed / currentBalance) * 100;
                    // If utilization > 100%, show as multiplier (e.g., "32.5x" instead of "3250%")
                    if (utilization > 100) {
                      return (utilization / 100).toFixed(1) + 'x';
                    }
                    return utilization.toFixed(1) + '%';
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Largest Win</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {TradingModeManager.getCurrencySymbol()}{summary.largestWin.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Largest Loss</span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {TradingModeManager.getCurrencySymbol()}{summary.largestLoss.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30 p-4">
        <p className="text-xs text-gray-400">
          <strong className="text-cyan-400">💡 Note:</strong> Capital Used = Margin Required (Lot Size × Contract Size × Price / Leverage). 
          Risk Amount = 2% of balance per trade. ROI shows return on actual margin used.
        </p>
      </div>
    </div>
  );
}

