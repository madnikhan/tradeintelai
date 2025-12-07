'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketAnalysis } from '@/lib/ai-trading-engine';
import { aiTradingEngine } from '@/lib/ai-trading-engine';
import { httpBridge } from '@/lib/http-bridge-connector';
import { TradingModeManager } from '@/lib/trading-mode';
import { PriceChart } from '@/components/charts/PriceChart';
import { AIExplanation } from '@/components/AIExplanation';
import { ChartVisionAnalysis } from '@/components/ChartVisionAnalysis';

interface AITradingDashboardProps {
  onAnalysisChange?: (analysis: MarketAnalysis | null) => void;
}

export function AITradingDashboard({ onAnalysisChange }: AITradingDashboardProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<any>(null);

  const analyzeMarket = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const marketAnalysis = await aiTradingEngine.analyzeMarket(selectedSymbol, []);
      setAnalysis(marketAnalysis);
      if (onAnalysisChange) {
        onAnalysisChange(marketAnalysis);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedSymbol, onAnalysisChange]);

  // DISABLED: Automatic analysis to prevent OpenAI credit usage
  // Analysis now requires manual trigger via "Start AI Analysis" or "Re-analyze" button
  // useEffect(() => {
  //   analyzeMarket();
  // }, [analyzeMarket]);

  const executeAITrade = async () => {
    if (!analysis) return;
    
    // CONFIDENCE THRESHOLD: Block weak signals
    // UPDATED: Lowered thresholds to match Opportunity Scanner (65+ score, 55%+ confidence)
    const MIN_SCORE = 65; // Minimum overall score to execute (lowered from 70)
    const MIN_CONFIDENCE = 55; // Minimum confidence percentage (lowered from 60)
    
    if (analysis.overallScore < MIN_SCORE) {
      setLastExecution({ 
        success: false, 
        error: `Signal too weak. Score: ${analysis.overallScore}/100 (minimum: ${MIN_SCORE}). Recommendation: ${analysis.recommendation}. Consider waiting for a stronger signal.` 
      });
      return;
    }
    
    if (analysis.confidence < MIN_CONFIDENCE) {
      setLastExecution({ 
        success: false, 
        error: `Confidence too low. Confidence: ${analysis.confidence}% (minimum: ${MIN_CONFIDENCE}%). The AI is not confident enough in this trade.` 
      });
      return;
    }
    
    // Block HOLD recommendations
    if (analysis.recommendation === 'HOLD') {
      setLastExecution({ 
        success: false, 
        error: `AI recommends HOLD. Score: ${analysis.overallScore}/100, Confidence: ${analysis.confidence}%. Not a good time to trade this pair.` 
      });
      return;
    }
    
    if (!analysis.suggestedPositionSize || analysis.suggestedPositionSize <= 0) {
      setLastExecution({ success: false, error: 'Invalid position size' });
      return;
    }
    
    if (!analysis.suggestedStopLoss || !analysis.suggestedTakeProfit) {
      setLastExecution({ success: false, error: 'Invalid stop loss or take profit' });
      return;
    }
    
    setIsExecuting(true);
    setLastExecution(null);
    
    try {
      const result = await httpBridge.executeTrade({
        symbol: selectedSymbol,
        type: analysis.recommendation.includes('BUY') ? 'BUY' : 'SELL',
        volume: Math.max(0.01, Math.min(analysis.suggestedPositionSize, 200)), // Cap at 200 lots maximum
        stopLoss: analysis.suggestedStopLoss,
        takeProfit: analysis.suggestedTakeProfit
      });

      setLastExecution(result);
    } catch (error) {
      setLastExecution({
        success: false,
        error: error instanceof Error ? error.message : 'Trade execution failed'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getRecommendationStyle = (rec: string) => {
    if (rec.includes('BUY')) return 'from-emerald-500 to-green-500 text-white';
    if (rec.includes('SELL')) return 'from-rose-500 to-red-500 text-white';
    return 'from-yellow-500 to-amber-500 text-white';
  };

  if (!analysis && !isAnalyzing) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <p className="text-gray-400 mb-4">Ready to analyze the market</p>
          <button
            onClick={analyzeMarket}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
          >
            Start AI Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🤖</span> AI Trading Engine
        </h2>
        <div className="flex gap-2">
          <select 
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white font-medium focus:outline-none focus:border-cyan-500"
            disabled={isAnalyzing}
          >
            <optgroup label="Major Pairs">
              <option value="EURUSD">EUR/USD</option>
              <option value="GBPUSD">GBP/USD</option>
              <option value="USDJPY">USD/JPY</option>
              <option value="USDCHF">USD/CHF</option>
              <option value="AUDUSD">AUD/USD</option>
              <option value="USDCAD">USD/CAD</option>
              <option value="NZDUSD">NZD/USD</option>
            </optgroup>
            <optgroup label="Cross Pairs">
              <option value="EURGBP">EUR/GBP</option>
              <option value="EURJPY">EUR/JPY</option>
              <option value="GBPJPY">GBP/JPY</option>
              <option value="AUDJPY">AUD/JPY</option>
            </optgroup>
          </select>
          <button
            onClick={analyzeMarket}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-cyan-400 hover:bg-[#1e2738] transition-all font-medium disabled:opacity-50"
          >
            {isAnalyzing ? '↻ Analyzing...' : '↻ Re-analyze'}
          </button>
        </div>
      </div>

      {/* Price Chart - Always show */}
      <div className="space-y-6">
        <div>
          <PriceChart symbol={selectedSymbol} timeframe="1h" height={250} />
          
                 {/* Chart Vision Analysis - Only show if analysis is complete and OpenAI is configured */}
          {analysis && !isAnalyzing && (
            <ChartVisionAnalysis
              symbol={selectedSymbol}
              timeframe="1h"
              chartContainerId={`chart-container-${selectedSymbol}-1h`}
              currentPrice={analysis.detailedReasoning?.risk?.[0]?.includes('Current Price:') 
                ? parseFloat(analysis.detailedReasoning.risk[0].split('Current Price: ')[1]?.split(' ')[0] || '0')
                : undefined
              }
            />
          )}
        </div>

      {isAnalyzing && (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">AI is analyzing market conditions...</p>
        </div>
      )}

      {analysis && !isAnalyzing && (
        <>

          {/* Main Recommendation Card */}
          <div className={`p-6 rounded-xl bg-gradient-to-r ${getRecommendationStyle(analysis.recommendation)}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-80 mb-1">AI Trading Engine Recommendation</p>
                <p className="text-3xl font-bold">{analysis.recommendation}</p>
                <p className="text-sm opacity-80 mt-1">Confidence: {analysis.confidence}%</p>
                <p className="text-xs opacity-60 mt-2">
                  💡 Based on technical indicators, fundamentals, sentiment, COT, and regime analysis.
                  <br />
                  <span className="text-yellow-300">Note: GPT-5.1&apos;s visual chart analysis (below) may differ as it analyzes chart patterns directly.</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold">{analysis.overallScore}</div>
                <div className="text-sm opacity-80">/100 Score</div>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { label: 'Technical', score: analysis.technicalScore, color: 'cyan' },
              { label: 'Fundamental', score: analysis.fundamentalScore, color: 'purple' },
              { label: 'Sentiment', score: analysis.sentimentScore, color: 'amber' },
              ...(analysis.gptChartAnalysis ? [{ 
                label: 'GPT-5.1 Chart', 
                score: analysis.gptChartAnalysis.score, 
                color: 'green',
                confidence: analysis.gptChartAnalysis.confidence 
              }] : []),
            ].map((item) => (
              <div key={item.label} className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-2xl font-bold text-white font-mono">{item.score}</p>
                {item.confidence && (
                  <p className="text-xs text-gray-400 mt-1">Confidence: {item.confidence}%</p>
                )}
                <div className="mt-2 h-1.5 bg-[#1e2738] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-${item.color}-500`}
                    style={{ 
                      width: `${item.score}%`, 
                      backgroundColor: item.color === 'cyan' ? '#06b6d4' : 
                                      item.color === 'purple' ? '#a855f7' : 
                                      item.color === 'amber' ? '#f59e0b' :
                                      item.color === 'green' ? '#10b981' : '#06b6d4'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* AI Explanation (GPT-powered) */}
          {analysis && (
            <AIExplanation 
              analysis={analysis} 
              symbol={selectedSymbol}
            />
          )}

          {/* Trade Setup & Reasoning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trade Setup */}
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> Trade Setup
              </h3>
              <div className="space-y-3 text-sm">
                {/* CRITICAL FIX: Add entry price display */}
                {analysis.detailedReasoning?.risk?.[0] && analysis.detailedReasoning.risk[0].includes('Current Price:') && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entry Price</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {analysis.detailedReasoning.risk[0].split('Current Price: ')[1]?.split(' ')[0] || 'N/A'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Position Size</span>
                  <span className={`font-mono font-bold ${
                    analysis.suggestedPositionSize > 200 ? 'text-red-400' : 'text-white'
                  }`}>
                    {analysis.suggestedPositionSize > 200 
                      ? `⚠️ ${Math.min(analysis.suggestedPositionSize, 200).toFixed(2)} lots (capped at 200)` 
                      : `${analysis.suggestedPositionSize.toFixed(2)} lots`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Stop Loss</span>
                  <span className="font-mono font-bold text-rose-400">{analysis.suggestedStopLoss}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Take Profit</span>
                  <span className="font-mono font-bold text-emerald-400">{analysis.suggestedTakeProfit}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Risk Level</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    analysis.riskLevel === 'LOW' ? 'bg-emerald-500/20 text-emerald-400' :
                    analysis.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>
                    {analysis.riskLevel}
                  </span>
                </div>
                {/* CRITICAL FIX: Add warning for very low confidence */}
                {analysis.confidence < 5 && (
                  <div className="mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300">
                    ⚠️ <strong>VERY LOW CONFIDENCE ({analysis.confidence}%)</strong> - AI strongly recommends avoiding this trade. Wait for clearer signals.
                  </div>
                )}
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>🧠</span> AI Reasoning
              </h3>
              <ul className="space-y-2 text-sm">
                {analysis.reasoning.slice(0, 4).map((reason, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-400">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Analysis */}
          {analysis.detailedReasoning && (
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5">
              <h3 className="text-sm font-bold text-white mb-4">📊 Detailed Analysis</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {analysis.detailedReasoning.technical.length > 0 && (
                  <div>
                    <p className="text-cyan-400 font-medium mb-2">Technical:</p>
                    <ul className="space-y-1 text-gray-400">
                      {analysis.detailedReasoning.technical.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.detailedReasoning.risk.length > 0 && (
                  <div>
                    <p className="text-amber-400 font-medium mb-2">Risk:</p>
                    <ul className="space-y-1 text-gray-400">
                      {analysis.detailedReasoning.risk.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COT Analysis */}
          {analysis.cotAnalysis && (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> COT Analysis
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Large Specs</p>
                  <p className="font-bold text-white">{analysis.cotAnalysis.largeSpecPosition}</p>
                  <p className="text-xs text-gray-500">{analysis.cotAnalysis.largeSpecPercentile}th %ile</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Commercials</p>
                  <p className="font-bold text-white">{analysis.cotAnalysis.commercialPosition}</p>
                  <p className="text-xs text-gray-500">{analysis.cotAnalysis.commercialPercentile}th %ile</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Sentiment</p>
                  <p className={`font-bold ${
                    analysis.cotAnalysis.sentiment === 'BULLISH' ? 'text-emerald-400' :
                    analysis.cotAnalysis.sentiment === 'BEARISH' ? 'text-rose-400' : 'text-gray-400'
                  }`}>{analysis.cotAnalysis.sentiment}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">COT Signal</p>
                  <p className={`font-bold ${
                    analysis.cotAnalysis.recommendation.includes('BUY') ? 'text-emerald-400' :
                    analysis.cotAnalysis.recommendation.includes('SELL') ? 'text-rose-400' : 'text-yellow-400'
                  }`}>{analysis.cotAnalysis.recommendation}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                {analysis.cotAnalysis.reasoning.slice(0, 2).map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          )}

          {/* Regime Detection */}
          {analysis.regimeAnalysis && (
            <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-xl border border-indigo-500/30 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📈</span> Market Regime
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Regime</p>
                  <p className="font-bold text-white">{analysis.regimeAnalysis.regime.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Strategy</p>
                  <p className="font-bold text-cyan-400">{analysis.regimeAnalysis.suggestedStrategy.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Volatility</p>
                  <p className="font-bold text-white">{analysis.regimeAnalysis.volatility}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Confidence</p>
                  <p className="font-bold text-white">{analysis.regimeAnalysis.confidence}%</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                {analysis.regimeAnalysis.reasoning.slice(0, 2).map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          )}

          {/* Execute Button */}
          <button
            onClick={executeAITrade}
            disabled={isExecuting || analysis.recommendation === 'HOLD'}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              analysis.recommendation.includes('BUY') 
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-lg shadow-emerald-500/20' 
                : analysis.recommendation.includes('SELL')
                ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 shadow-lg shadow-rose-500/20'
                : 'bg-gray-700 cursor-not-allowed text-gray-500'
            } disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500`}
          >
            {isExecuting ? '↻ Executing...' : `Execute ${analysis.recommendation}`}
          </button>

          {/* Execution Result */}
          {lastExecution && (
            <div className={`p-4 rounded-xl border ${
              lastExecution.success 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-rose-500/10 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lastExecution.success ? '✅' : '❌'}</span>
                <div>
                  <p className={`font-bold ${lastExecution.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {lastExecution.success ? 'Trade Executed!' : 'Execution Failed'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {lastExecution.success ? lastExecution.message : lastExecution.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
