'use client';

import { useState, useEffect, useCallback } from 'react';
import { TradeDirection } from '@/types/trading';
import { TradingModeManager } from '@/lib/trading-mode';
import { RiskCalculator } from '@/lib/risk-calculator';
import { TRADING_RULES } from '@/config/trading-rules';
import { httpBridge } from '@/lib/http-bridge-connector';
import { MarketAnalysis } from '@/lib/ai-trading-engine';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';
import { MultiAccountExecutor } from '@/lib/multi-account-executor';
import { accountManager } from '@/lib/account-manager';
import { assertCanTrade } from '@/lib/trade-permissions';
import { registerPositionWatch } from '@/lib/register-position-watch';
import { useRealtimePrice } from '@/lib/use-realtime-price';
import { useTradingContext } from '@/context/TradingContext';
import { ConfirmTradeModal } from '@/components/trading/ConfirmTradeModal';
import { SymbolPicker } from '@/components/trading/SymbolPicker';
import { toCompactSymbol } from '@/lib/trading-symbols';

interface TradePanelProps {
  aiAnalysis?: MarketAnalysis | null;
  embedded?: boolean;
}

export function TradePanel({ aiAnalysis: aiAnalysisProp, embedded = false }: TradePanelProps = {}) {
  const { symbol: ctxSymbol, aiAnalysis: ctxAnalysis, setSymbol: setCtxSymbol } = useTradingContext();
  const aiAnalysis = embedded ? (ctxAnalysis ?? aiAnalysisProp) : (aiAnalysisProp ?? ctxAnalysis);
  const [localPair, setLocalPair] = useState('EURUSD');
  const selectedPair = embedded ? ctxSymbol : localPair;
  const setSelectedPair = embedded ? setCtxSymbol : setLocalPair;
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [lastTradeResult, setLastTradeResult] = useState<any>(null);
  const [tradingAccounts, setTradingAccounts] = useState(accountManager.getTradingAccounts());
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  
  // Real-time price updates
  const { priceData: realtimePrice, isLoading: isRealtimeLoading } = useRealtimePrice(
    selectedPair,
    realtimeEnabled,
    3000 // Update every 3 seconds
  );

  // Update trading accounts when they change
  useEffect(() => {
    const interval = setInterval(() => {
      setTradingAccounts(accountManager.getTradingAccounts());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const symbolMatches = (sym: string | undefined) =>
    sym && toCompactSymbol(sym) === toCompactSymbol(selectedPair);

  const aiRecommendation = aiAnalysis && symbolMatches(aiAnalysis.symbol)
    ? aiAnalysis.recommendation 
    : null;
  const isAiHold = aiRecommendation === 'HOLD';
  const extendedAnalysis =
    aiAnalysis && symbolMatches(aiAnalysis.symbol)
      ? (aiAnalysis as ExtendedMarketAnalysis)
      : null;
  const executionPermitted = extendedAnalysis?.gateStatus?.executionPermitted ?? true;
  const executionBlocked = isAiHold || !executionPermitted;
  const executionBlockedBy = extendedAnalysis?.gateStatus?.executionBlockedBy ?? [];
  const aiConfidence = aiAnalysis && symbolMatches(aiAnalysis.symbol)
    ? aiAnalysis.confidence 
    : null;
  
  const loadRealPrice = useCallback(async () => {
    setIsLoadingPrice(true);
    try {
      const priceData = await httpBridge.getMarketData(selectedPair);
      
      if (priceData.success) {
        // Use current market price for entry
        const currentPrice = direction === 'BUY' ? priceData.ask : priceData.bid;
        setEntryPrice(currentPrice.toFixed(5));
        
        // Use AI's stop loss if available, otherwise calculate a default one
        const aiStopLoss = aiAnalysis && symbolMatches(aiAnalysis.symbol)
          ? ((aiAnalysis as any).suggestedStopLoss || (aiAnalysis as any).stopLoss)
          : null;
        
        if (aiStopLoss) {
          setStopLoss(aiStopLoss.toFixed(5));
        } else {
          // Calculate default stop loss
          const stopDistance = currentPrice * 0.01;
          const suggestedStop = direction === 'BUY' 
            ? currentPrice - stopDistance 
            : currentPrice + stopDistance;
          setStopLoss(suggestedStop.toFixed(5));
        }
      } else {
        throw new Error(priceData.error || 'Failed to get market price');
      }
    } catch (error) {
      console.error('Failed to load market price:', error);
      // Don't clear values if they're already set from AI analysis
      if (!entryPrice) setEntryPrice('');
      if (!stopLoss) setStopLoss('');
    } finally {
      setIsLoadingPrice(false);
    }
  }, [selectedPair, direction, aiAnalysis, entryPrice, stopLoss]);

  useEffect(() => {
    loadRealPrice();
  }, [loadRealPrice]);

  // Update entry price when real-time price changes
  useEffect(() => {
    if (realtimePrice && realtimeEnabled && !isRealtimeLoading) {
      const currentPrice = direction === 'BUY' ? realtimePrice.ask : realtimePrice.bid;
      setEntryPrice(currentPrice.toFixed(5));
    }
  }, [realtimePrice, direction, realtimeEnabled, isRealtimeLoading]);

  // Use AI analysis values when available
  useEffect(() => {
    if (aiAnalysis && symbolMatches(aiAnalysis.symbol)) {
      // Update direction to match AI recommendation if it's BUY or SELL
      if (aiAnalysis.recommendation === 'BUY' && direction !== 'BUY') {
        setDirection('BUY');
      } else if (aiAnalysis.recommendation === 'SELL' && direction !== 'SELL') {
        setDirection('SELL');
      }
      
      // Use AI's stop loss and take profit if available (check both naming conventions)
      const aiStopLoss = (aiAnalysis as any).suggestedStopLoss || (aiAnalysis as any).stopLoss;
      const aiTakeProfit = (aiAnalysis as any).suggestedTakeProfit || (aiAnalysis as any).takeProfit;
      
      if (aiStopLoss && (!stopLoss || stopLoss === '0' || stopLoss === '')) {
        setStopLoss(aiStopLoss.toFixed(5));
      }
      // Entry price should come from live market data, but we can use AI's if market data fails
      const aiEntryPrice = (aiAnalysis as any).entryPrice || (aiAnalysis as any).currentPrice;
      if (aiEntryPrice && (!entryPrice || entryPrice === '0' || entryPrice === '')) {
        setEntryPrice(aiEntryPrice.toFixed(5));
      }
    }
  }, [aiAnalysis, selectedPair, stopLoss, entryPrice, direction]);

  const entry = parseFloat(entryPrice) || 0;
  const stop = parseFloat(stopLoss) || 0;
  
  // Use AI's take profit if available, otherwise calculate
  const aiTakeProfit = aiAnalysis && symbolMatches(aiAnalysis.symbol)
    ? ((aiAnalysis as any).suggestedTakeProfit || (aiAnalysis as any).takeProfit)
    : null;
  const takeProfit = aiTakeProfit || (entry + (entry - stop) * TRADING_RULES.MIN_REWARD_RISK_RATIO * (direction === 'BUY' ? 1 : -1));
  
  const tradeCalculation = RiskCalculator.calculateTradeSizeSync(entry, stop, selectedPair);

  const doExecuteTrade = async () => {
    setIsExecuting(true);
    setLastTradeResult(null);
    try {
      const tradingAccounts = accountManager.getTradingAccounts();
      if (tradingAccounts.length > 1) {
        const multiResult = await MultiAccountExecutor.executeOnMultipleAccounts({
          symbol: selectedPair,
          type: direction,
          volume: tradeCalculation.lotSize,
          stopLoss: stop,
          takeProfit: takeProfit,
        });
        setLastTradeResult({
          success: multiResult.successful > 0,
          message: `Executed on ${multiResult.successful}/${multiResult.totalAccounts} accounts`,
          multiAccount: true,
          results: multiResult.results,
          successful: multiResult.successful,
          failed: multiResult.failed,
        });
        multiResult.results.forEach((result) => {
          window.dispatchEvent(new CustomEvent('tradeExecuted', {
            detail: {
              symbol: selectedPair,
              type: direction,
              volume: tradeCalculation.lotSize,
              entryPrice: entry,
              stopLoss: stop,
              takeProfit,
              success: result.success,
              accountId: result.accountId,
              accountName: result.accountName,
              orderId: result.orderId,
              error: result.error,
              message: result.message,
            },
          }));
          if (result.success) {
            void registerPositionWatch({
              symbol: selectedPair,
              direction,
              entryPrice: entry,
              stopLoss: stop,
              takeProfit,
              ticket: result.orderId,
              source: 'manual',
              recommendation: aiAnalysis?.recommendation,
            });
          }
        });
      } else {
        const permission = await assertCanTrade();
        if (!permission.allowed) {
          setLastTradeResult({ success: false, error: permission.error });
          return;
        }

        const result = await httpBridge.executeTrade({
          symbol: selectedPair,
          type: direction,
          volume: tradeCalculation.lotSize,
          stopLoss: stop,
          takeProfit: takeProfit,
          accountLogin: permission.accountLogin,
        });
        setLastTradeResult(result);
        window.dispatchEvent(new CustomEvent('tradeExecuted', {
          detail: {
            symbol: selectedPair,
            type: direction,
            volume: tradeCalculation.lotSize,
            entryPrice: entry,
            stopLoss: stop,
            takeProfit,
            success: result.success,
            orderId: result.order_id || result.orderId,
            error: result.error,
            message: result.message,
          },
        }));
        if (result.success) {
          void registerPositionWatch({
            symbol: selectedPair,
            direction,
            entryPrice: entry,
            stopLoss: stop,
            takeProfit,
            ticket: result.order_id || result.orderId,
            source: 'manual',
            recommendation: aiAnalysis?.recommendation,
          });
        }
      }
    } catch (error) {
      setLastTradeResult({ success: false, error: 'Trade execution failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const executeTrade = async () => {
    // Validate entry price and stop loss
    if (!entryPrice || entry === 0) {
      setLastTradeResult({
        success: false,
        message: 'Please set entry price. Click "Refresh Live Price" or enter manually.'
      });
      return;
    }
    
    if (!stopLoss || stop === 0) {
      setLastTradeResult({
        success: false,
        message: 'Please set stop loss. Click "Refresh Live Price" or enter manually.'
      });
      return;
    }
    
    if (!tradeCalculation.isValid) {
      setLastTradeResult({
        success: false,
        message: tradeCalculation.message || 'Invalid position size. Check entry price and stop loss values.'
      });
      return;
    }
    
    // CRITICAL SAFETY CHECK: Reject dangerous position sizes
    if (tradeCalculation.lotSize <= 0) {
      setLastTradeResult({
        success: false,
        message: `Invalid position size: ${tradeCalculation.lotSize} lots. ${tradeCalculation.message || 'Check your risk settings and account balance.'}`
      });
      return;
    }
    
    // CONFIDENCE THRESHOLD: Block weak signals
    // UPDATED: Lowered thresholds to match Opportunity Scanner (65+ score, 55%+ confidence)
    // NOTE: Using >= for threshold checks (score >= 65.0 passes, score < 65.0 fails)
    const MIN_SCORE = 65; // Minimum overall score to execute (lowered from 70)
    const MIN_CONFIDENCE = 55; // Minimum confidence percentage (lowered from 60)
    
    if (aiAnalysis) {
      if (aiAnalysis.overallScore < MIN_SCORE) {
        setConfirmModal({
          open: true,
          title: 'Weak signal',
          message: `AI Score: ${aiAnalysis.overallScore}/100 (minimum: ${MIN_SCORE}). Proceed with ${direction}?`,
          variant: 'warning',
          onConfirm: () => {
            setConfirmModal((m) => ({ ...m, open: false }));
            void doExecuteTrade();
          },
        });
        return;
      }
      if (aiAnalysis.confidence < MIN_CONFIDENCE) {
        setConfirmModal({
          open: true,
          title: 'Low confidence',
          message: `AI Confidence: ${aiAnalysis.confidence}% (minimum: ${MIN_CONFIDENCE}%). Proceed?`,
          variant: 'warning',
          onConfirm: () => {
            setConfirmModal((m) => ({ ...m, open: false }));
            void doExecuteTrade();
          },
        });
        return;
      }
    }
    
    if (isAiHold) {
      setConfirmModal({
        open: true,
        title: 'AI recommends HOLD',
        message: `AI recommends HOLD for ${selectedPair}. Proceed with ${direction}?`,
        variant: 'danger',
        onConfirm: () => {
          setConfirmModal((m) => ({ ...m, open: false }));
          void doExecuteTrade();
        },
      });
      return;
    }
    
    await doExecuteTrade();
  };

  return (
    <div className={embedded ? 'p-4' : 'p-6'}>
      {!embedded && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>💹</span> Manual Trade
        </h2>
        <button
          onClick={loadRealPrice}
          disabled={isLoadingPrice}
          className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-cyan-400 hover:bg-[#1e2738] transition-all text-sm font-medium disabled:opacity-50"
        >
          {isLoadingPrice ? '↻ Loading...' : '↻ Refresh Price'}
        </button>
      </div>
      </>
      )}

      {embedded && !symbolMatches(aiAnalysis?.symbol) && (
        <div className="mb-4 p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-sm text-cyan-300">
          Run analysis for {selectedPair} in the panel above to load AI levels.
        </div>
      )}

      {/* AI Recommendation Warning */}
      {aiAnalysis && symbolMatches(aiAnalysis.symbol) && (
        <div className={`mb-6 p-4 rounded-xl border ${
          isAiHold 
            ? 'bg-yellow-500/10 border-yellow-500/30' 
            : aiRecommendation?.includes('BUY')
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : aiRecommendation?.includes('SELL')
            ? 'bg-rose-500/10 border-rose-500/30'
            : 'bg-gray-500/10 border-gray-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <p className={`font-bold ${
                  isAiHold ? 'text-yellow-400' : 
                  aiRecommendation?.includes('BUY') ? 'text-emerald-400' :
                  aiRecommendation?.includes('SELL') ? 'text-rose-400' : 'text-gray-400'
                }`}>
                  AI: {aiRecommendation || 'N/A'}
                </p>
                <p className="text-xs text-gray-400">
                  {aiConfidence}% confidence • {aiAnalysis.overallScore}/100 score
                </p>
              </div>
            </div>
          </div>
          {isAiHold && (
            <p className="text-xs text-yellow-400/80 mt-2">
              ⚠️ AI recommends HOLD. Manual trades may contradict analysis.
            </p>
          )}
        </div>
      )}

      {/* Pair Selection */}
      {!embedded && (
      <div className="mb-4">
        <label htmlFor="trade-panel-symbol" className="label block mb-2">Trading instrument</label>
        <SymbolPicker
          value={selectedPair}
          onChange={setSelectedPair}
          compact
        />
      </div>
      )}

      {/* Direction Buttons */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-2">Direction</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDirection('BUY')}
            className={`p-4 rounded-xl font-bold transition-all ${
              direction === 'BUY' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'bg-[#141c2b] text-gray-400 border border-[#1e2738] hover:border-emerald-500/50'
            }`}
          >
            📈 BUY
          </button>
          <button
            onClick={() => setDirection('SELL')}
            className={`p-4 rounded-xl font-bold transition-all ${
              direction === 'SELL' 
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                : 'bg-[#141c2b] text-gray-400 border border-[#1e2738] hover:border-rose-500/50'
            }`}
          >
            📉 SELL
          </button>
        </div>
      </div>

      {/* Real-time Price Toggle */}
      <div className="mb-4 flex items-center justify-between p-3 bg-[#141c2b] rounded-xl border border-[#1e2738]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Real-time Price Updates</span>
          {realtimePrice && realtimeEnabled && (
            <span className="text-xs text-cyan-400">
              {direction === 'BUY' ? realtimePrice.ask.toFixed(5) : realtimePrice.bid.toFixed(5)}
            </span>
          )}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={realtimeEnabled}
            onChange={(e) => setRealtimeEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[#1e2738] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {/* Price Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-2">
            Entry Price {realtimePrice && realtimeEnabled && (
              <span className="text-cyan-400 text-xs ml-2">● Live</span>
            )}
          </label>
          <input
            type="number"
            step="0.0001"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="w-full px-4 py-3 bg-[#141c2b] border border-[#1e2738] rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="0.00000"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Stop Loss</label>
          <input
            type="number"
            step="0.0001"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="w-full px-4 py-3 bg-[#141c2b] border border-[#1e2738] rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="0.00000"
          />
        </div>
      </div>

      {/* Trade Summary */}
      <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 mb-4">
        <h3 className="text-sm font-bold text-white mb-3">Trade Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Take Profit</span>
            <p className="font-mono font-bold text-white">{takeProfit.toFixed(5)}</p>
          </div>
          <div>
            <span className="text-gray-500">Risk</span>
            <p className="font-mono font-bold text-rose-400">{TradingModeManager.getCurrencySymbol()}{tradeCalculation.riskAmount}</p>
          </div>
          <div>
            <span className="text-gray-500">Reward</span>
            <p className="font-mono font-bold text-emerald-400">{TradingModeManager.getCurrencySymbol()}{tradeCalculation.rewardAmount}</p>
          </div>
          <div>
            <span className="text-gray-500">Lot Size</span>
            <p className="font-mono font-bold text-cyan-400">{tradeCalculation.lotSize}</p>
          </div>
        </div>
        
        {executionBlocked ? (
          <div className="mt-3 p-2 rounded-lg text-sm bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Execution blocked by Gate 4 — same rules as analysis above.
            {executionBlockedBy.length > 0 && (
              <span className="block mt-1 text-xs">{executionBlockedBy[0]}</span>
            )}
          </div>
        ) : (
          <div className={`mt-3 p-2 rounded-lg text-sm ${
            tradeCalculation.isValid 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            {tradeCalculation.isValid ? '✓ ' : '✕ '}{tradeCalculation.message}
          </div>
        )}
      </div>

      {/* Last Trade Result */}
      {lastTradeResult && (
        <div className={`mb-4 p-4 rounded-xl border ${
          lastTradeResult.success 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-rose-500/10 border-rose-500/30'
        }`}>
          {lastTradeResult.multiAccount ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{lastTradeResult.success ? '✅' : '⚠️'}</span>
                <div>
                  <p className={`font-bold ${lastTradeResult.successful > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Multi-Account Execution: {lastTradeResult.successful}/{lastTradeResult.totalAccounts} Successful
                  </p>
                  <p className="text-xs text-gray-400">
                    {lastTradeResult.message}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lastTradeResult.results.map((result: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-xs ${
                      result.success ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{result.accountName}</span>
                      <span className={result.success ? 'text-emerald-400' : 'text-rose-400'}>
                        {result.success ? '✓' : '✗'}
                      </span>
                    </div>
                    {result.success && result.orderId && (
                      <p className="text-gray-400 mt-1">Order: {result.orderId}</p>
                    )}
                    {!result.success && result.error && (
                      <p className="text-rose-400 mt-1">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lastTradeResult.success ? '✅' : '❌'}</span>
              <div>
                <p className={`font-bold ${lastTradeResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {lastTradeResult.success ? 'Trade Executed!' : 'Trade Failed'}
                </p>
                <p className="text-xs text-gray-400">
                  {lastTradeResult.success ? lastTradeResult.message : lastTradeResult.error}
                </p>
                {lastTradeResult.order_id && (
                  <p className="text-xs text-emerald-400 mt-1">Order ID: {lastTradeResult.order_id}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trading Accounts Info */}
      {tradingAccounts.length > 0 && (
        <div className="mb-4 p-3 bg-[#141c2b] rounded-xl border border-[#1e2738]">
          <p className="text-xs text-gray-500 mb-2">Will execute on {tradingAccounts.length} account{tradingAccounts.length > 1 ? 's' : ''}:</p>
          <div className="flex flex-wrap gap-2">
            {tradingAccounts.map(acc => (
              <span key={acc.id} className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium">
                {acc.name} ({acc.login})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeTrade}
        disabled={executionBlocked ? true : !tradeCalculation.isValid || isExecuting}
        className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
          !executionBlocked && tradeCalculation.isValid && !isExecuting
            ? isAiHold
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 shadow-lg shadow-yellow-500/20'
              : direction === 'BUY' 
              ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-lg shadow-emerald-500/20' 
              : 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 shadow-lg shadow-rose-500/20'
            : 'bg-gray-700 cursor-not-allowed text-gray-500'
        }`}
      >
        {isExecuting 
          ? '↻ EXECUTING...' 
          : executionBlocked
            ? 'EXECUTION BLOCKED — SEE GATE 4'
            : tradeCalculation.isValid 
            ? isAiHold
              ? `⚠️ EXECUTE ${direction} (AI: HOLD)${tradingAccounts.length > 1 ? ` on ${tradingAccounts.length} accounts` : ''}`
              : `EXECUTE ${direction}${tradingAccounts.length > 1 ? ` on ${tradingAccounts.length} accounts` : ''}` 
            : 'CHECK PARAMETERS'
        }
      </button>

      {/* Mode Indicator */}
      <p className="text-center text-xs text-tertiary mt-3">
        {TradingModeManager.isDemoMode() ? 'Demo mode' : 'Live trading'}
      </p>

      <ConfirmTradeModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((m) => ({ ...m, open: false }))}
      />
    </div>
  );
}
