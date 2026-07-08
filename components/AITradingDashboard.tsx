'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketAnalysis } from '@/lib/ai-trading-engine';
import { gatedEngineAdapter, ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';
import { executeGatedTrade } from '@/lib/execute-gated-trade';
import { PriceChart } from '@/components/charts/PriceChart';
import { AIExplanation } from '@/components/AIExplanation';
import { ChartVisionAnalysis } from '@/components/ChartVisionAnalysis';
import { ScalpingService } from '@/lib/scalping-service';
import { useTradingContext } from '@/context/TradingContext';
import { SymbolPicker } from '@/components/trading/SymbolPicker';
import { AccordionItem } from '@/components/ui/Accordion';
import { toCompactSymbol } from '@/lib/trading-symbols';
import { getChartVisionCache } from '@/lib/chart-vision-cache';
import type { ChartAnalysis } from '@/lib/ai-types';
import type { GPTStructureAnalysis } from '@/lib/gated-trading-engine';

interface AITradingDashboardProps {
  onAnalysisChange?: (analysis: MarketAnalysis | null) => void;
  embedded?: boolean;
  onAnalyzingChange?: (analyzing: boolean) => void;
}

export function AITradingDashboard({ onAnalysisChange, embedded = false, onAnalyzingChange }: AITradingDashboardProps) {
  const {
    symbol: ctxSymbol,
    setSymbol: setCtxSymbol,
    aiAnalysis: ctxAnalysis,
    setAiAnalysis: setCtxAnalysis,
  } = useTradingContext();
  const [standaloneSymbol, setStandaloneSymbol] = useState('EURUSD');
  const selectedSymbol = embedded ? ctxSymbol : standaloneSymbol;
  const setSelectedSymbol = embedded ? setCtxSymbol : setStandaloneSymbol;
  const [analysis, setAnalysis] = useState<ExtendedMarketAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [usingCachedScan, setUsingCachedScan] = useState(false);
  const [chartVisionApplied, setChartVisionApplied] = useState(false);
  const visionRefreshRef = useRef<{ symbol: string; updatedAt: number } | null>(null);

  // Hydrate from TradingContext when opening from Scan tab
  useEffect(() => {
    if (!embedded || !ctxAnalysis) return;
    const ctxKey = ctxAnalysis.symbol?.replace(/\//g, '').toUpperCase();
    const symKey = selectedSymbol.replace(/\//g, '').toUpperCase();
    if (ctxKey === symKey) {
      setAnalysis(ctxAnalysis);
      setUsingCachedScan(true);
    }
  }, [embedded, ctxAnalysis, selectedSymbol]);

  const analyzeMarket = useCallback(async (includeChart = false) => {
    setIsAnalyzing(true);
    onAnalyzingChange?.(true);
    setAnalysisError(null);
    setUsingCachedScan(false);
    try {
      console.log(`🔍 Starting analysis for ${selectedSymbol} (chart: ${includeChart})...`);

      // Default: same inputs as Opportunity Scanner (no chart capture) unless vision cache exists
      let chartImageBase64: string | undefined;
      let precomputedGptStructure: GPTStructureAnalysis | undefined;
      const cachedVision = !includeChart ? getChartVisionCache(selectedSymbol) : undefined;

      if (includeChart) {
        try {
          const chartContainerId = `chart-container-${selectedSymbol}-1h`;
          let container: HTMLElement | null = null;
          let chartElement: HTMLElement | null = null;
          const maxRetries = 10;
          const retryDelay = 500;

          for (let i = 0; i < maxRetries; i++) {
            container = document.getElementById(chartContainerId);
            if (container) {
              chartElement = container.querySelector('.recharts-wrapper') as HTMLElement;
              if (chartElement && chartElement.clientWidth > 0 && chartElement.clientHeight > 0) {
                break;
              }
            }
            if (i < maxRetries - 1) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }

          if (container && chartElement && chartElement.clientWidth > 0 && chartElement.clientHeight > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const { captureRechartsChart } = await import('@/lib/chart-capture');
            chartImageBase64 = (await captureRechartsChart(chartContainerId)) || undefined;
          }
        } catch (chartError) {
          console.error('Chart capture error:', chartError);
        }
      } else if (cachedVision?.structure) {
        precomputedGptStructure = cachedVision.structure;
        console.log(
          `📊 Using cached chart vision for Gate 1 (${cachedVision.structure.patterns?.length || 0} patterns, trend ${cachedVision.structure.trendStrength ?? 'n/a'}%)`
        );
      }

      console.log(`📊 Analyzing ${selectedSymbol} with Gated Trading Engine...`);
      console.log(
        `📊 Chart image provided: ${chartImageBase64 ? `YES (${chartImageBase64.length} chars)` : 'NO'}; precomputed vision: ${precomputedGptStructure ? 'YES' : 'NO'}`
      );
      const marketAnalysis = await gatedEngineAdapter.analyzeMarket(
        selectedSymbol,
        [],
        chartImageBase64,
        { precomputedGptStructure }
      );
      
      // 🔒 DEBUG: Log GPT structure from analysis
      if (marketAnalysis.gptChartAnalysis) {
        const gptChart = marketAnalysis.gptChartAnalysis as Record<string, unknown>;
        console.log(`📊 GPT Chart Analysis received:`, {
          confidence: marketAnalysis.gptChartAnalysis.confidence,
          trend: marketAnalysis.gptChartAnalysis.trend,
          patterns: Array.isArray(gptChart.patterns) ? gptChart.patterns.length : 0,
        });
      } else {
        console.warn('⚠️ No GPT Chart Analysis in market analysis result');
      }
      
      // 🔒 DEBUG: Log Gate 1 status
      if (marketAnalysis.gateStatus) {
        console.log(`📊 Gate 1 Status:`, {
          marketReadable: marketAnalysis.gateStatus.marketReadable,
          reason: marketAnalysis.gateStatus.marketReadabilityReason,
          gate1Inputs: marketAnalysis.gateStatus.gate1Inputs
        });
      }
      
      if (!marketAnalysis) {
        throw new Error('Analysis returned no results');
      }
      
      console.log(`✅ Analysis complete for ${selectedSymbol}:`, {
        recommendation: marketAnalysis.recommendation,
        score: marketAnalysis.overallScore,
        confidence: marketAnalysis.confidence
      });
      
      setAnalysis(marketAnalysis);
      setUsingCachedScan(false);
      setChartVisionApplied(Boolean(precomputedGptStructure) || Boolean(includeChart && chartImageBase64));
      setAnalysisError(null);
      if (embedded) {
        setCtxAnalysis(marketAnalysis);
      }
      if (onAnalysisChange) {
        onAnalysisChange(marketAnalysis);
      }

      // Auto-trigger scalping if signal is strong enough
      const config = ScalpingService.getConfig();
      console.log(`⚡ Scalping check - Enabled: ${config.enabled}, Confidence: ${marketAnalysis.confidence}%, Required: ${config.minSignalStrength}%`);
      
      if (ScalpingService.isSignalStrongEnough(marketAnalysis)) {
        console.log(`⚡ Strong signal detected (${marketAnalysis.confidence}%) - attempting scalping trade...`);
        try {
          const scalpResult = await ScalpingService.executeScalp(selectedSymbol, marketAnalysis);
          if (scalpResult.success) {
            console.log(`✅ Scalping trade executed: ${scalpResult.trade?.id}`);
            // Show notification
            if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
              (window as any).addErrorNotification({
                type: 'success',
                title: '⚡ Scalping Trade Executed',
                message: `${selectedSymbol} ${scalpResult.trade?.direction} @ $${scalpResult.trade?.takeProfitAmount.toFixed(2)} target`,
              });
            }
          } else {
            console.warn(`❌ Scalping not executed: ${scalpResult.error}`);
            // Show error notification
            if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
              (window as any).addErrorNotification({
                type: 'error',
                title: '⚡ Scalping Blocked',
                message: scalpResult.error || 'Unknown error',
              });
            }
          }
        } catch (error) {
          console.error('❌ Scalping execution error:', error);
          if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
            (window as any).addErrorNotification({
              type: 'error',
              title: '⚡ Scalping Error',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      } else {
        console.log(`⚡ Scalping skipped - signal not strong enough or conditions not met`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Analysis failed:', error);
      setAnalysisError(`Analysis failed: ${errorMessage}. Please check the console for details.`);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
      onAnalyzingChange?.(false);
    }
  }, [selectedSymbol, onAnalysisChange, embedded, setCtxAnalysis, onAnalyzingChange]);

  const handleVisionComplete = useCallback(
    (_analysis: ChartAnalysis, _imageBase64: string) => {
      if (!embedded) return;

      const cached = getChartVisionCache(selectedSymbol);
      if (!cached?.structure) return;

      if (
        visionRefreshRef.current?.symbol === selectedSymbol &&
        visionRefreshRef.current.updatedAt === cached.updatedAt
      ) {
        return;
      }

      const symKey = selectedSymbol.replace(/\//g, '').toUpperCase();
      const ctxKey = ctxAnalysis?.symbol?.replace(/\//g, '').toUpperCase();
      const currentAnalysis =
        analysis ?? (ctxKey === symKey ? (ctxAnalysis as ExtendedMarketAnalysis | null) : null);

      if (!currentAnalysis) return;

      const gatePatternConf = currentAnalysis.gateStatus?.gate1Inputs?.patternConfidence ?? 0;
      const visionPatternConf =
        cached.structure.patterns?.length > 0
          ? Math.max(...cached.structure.patterns.map((p) => p.confidence || 0))
          : 0;

      if (gatePatternConf >= 70 && visionPatternConf >= 70) {
        return;
      }

      visionRefreshRef.current = { symbol: selectedSymbol, updatedAt: cached.updatedAt };
      void analyzeMarket(false);
    },
    [embedded, selectedSymbol, analysis, ctxAnalysis, analyzeMarket]
  );

  useEffect(() => {
    visionRefreshRef.current = null;
    setChartVisionApplied(false);
  }, [selectedSymbol]);

  // DISABLED: Automatic analysis to prevent OpenAI credit usage
  // Analysis now requires manual trigger via "Start AI Analysis" or "Re-analyze" button
  // useEffect(() => {
  //   analyzeMarket();
  // }, [analyzeMarket]);

  const executionBlocked =
    !analysis ||
    analysis.recommendation === 'HOLD' ||
    (analysis.gateStatus != null && !analysis.gateStatus.executionPermitted);

  const executeAITrade = async () => {
    if (!analysis) return;
    setIsExecuting(true);
    setLastExecution(null);
    try {
      const result = await executeGatedTrade({
        symbol: selectedSymbol,
        analysis,
        source: 'ai',
      });
      if (result.cancelled) return;
      setLastExecution(result);
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
    if (embedded) {
      return (
        <div className="p-4">
          <p className="text-secondary text-sm mb-4">
            Run AI analysis for {toCompactSymbol(selectedSymbol)}. Chart vision feeds Gate 1 when the chart analysis completes.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void analyzeMarket(false)}
              disabled={isAnalyzing}
              className="btn btn-primary min-h-[44px]"
            >
              {isAnalyzing ? 'Analyzing…' : 'Analyze market'}
            </button>
            <button
              type="button"
              onClick={() => void analyzeMarket(true)}
              disabled={isAnalyzing}
              className="btn btn-secondary min-h-[44px] text-sm"
              title="Optional chart vision — may differ from Scan results"
            >
              Analyze with chart
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="p-6">
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl">🤖</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">AI Trading Engine</h2>
          <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Select a trading instrument (Forex, Metals, or Stocks) and start analyzing the market</p>
          
          {/* Trading Instrument Selector */}
          <div className="max-w-md mx-auto mb-6 sm:mb-8">
            <label className="block text-sm font-medium text-gray-400 mb-3 text-left">
              Select Trading Instrument
            </label>
            <select 
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full px-4 py-3 sm:py-3.5 bg-[#141c2b] border border-[#1e2738] rounded-xl text-white font-medium focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-base sm:text-lg"
            >
              <optgroup label="Forex - Major Pairs">
                <option value="EURUSD">EUR/USD</option>
                <option value="GBPUSD">GBP/USD</option>
                <option value="USDJPY">USD/JPY</option>
                <option value="USDCHF">USD/CHF</option>
                <option value="AUDUSD">AUD/USD</option>
                <option value="USDCAD">USD/CAD</option>
                <option value="NZDUSD">NZD/USD</option>
              </optgroup>
              <optgroup label="Forex - Cross Pairs">
                <option value="EURGBP">EUR/GBP</option>
                <option value="EURJPY">EUR/JPY</option>
                <option value="GBPJPY">GBP/JPY</option>
                <option value="AUDJPY">AUD/JPY</option>
              </optgroup>
              <optgroup label="Metals">
                <option value="XAUUSD">XAU/USD (Gold)</option>
                <option value="XAGUSD">XAG/USD (Silver)</option>
                <option value="XAUEUR">XAU/EUR (Gold/Euro)</option>
                <option value="XAUGBP">XAU/GBP (Gold/Pound)</option>
                <option value="XPTUSD">XPT/USD (Platinum)</option>
                <option value="XPDUSD">XPD/USD (Palladium)</option>
              </optgroup>
              <optgroup label="Stocks - Tech">
                <option value="AAPL">AAPL (Apple)</option>
                <option value="MSFT">MSFT (Microsoft)</option>
                <option value="GOOGL">GOOGL (Google)</option>
                <option value="AMZN">AMZN (Amazon)</option>
                <option value="META">META (Meta/Facebook)</option>
                <option value="TSLA">TSLA (Tesla)</option>
                <option value="NVDA">NVDA (NVIDIA)</option>
                <option value="NFLX">NFLX (Netflix)</option>
              </optgroup>
              <optgroup label="Stocks - Finance">
                <option value="JPM">JPM (JPMorgan)</option>
                <option value="BAC">BAC (Bank of America)</option>
                <option value="GS">GS (Goldman Sachs)</option>
                <option value="WFC">WFC (Wells Fargo)</option>
              </optgroup>
              <optgroup label="Stocks - Consumer">
                <option value="WMT">WMT (Walmart)</option>
                <option value="HD">HD (Home Depot)</option>
                <option value="MCD">MCD (McDonald&apos;s)</option>
                <option value="SBUX">SBUX (Starbucks)</option>
              </optgroup>
              <optgroup label="Stocks - Healthcare">
                <option value="JNJ">JNJ (Johnson & Johnson)</option>
                <option value="PFE">PFE (Pfizer)</option>
                <option value="UNH">UNH (UnitedHealth)</option>
              </optgroup>
              <optgroup label="Stocks - Industrial">
                <option value="BA">BA (Boeing)</option>
                <option value="CAT">CAT (Caterpillar)</option>
                <option value="GE">GE (General Electric)</option>
              </optgroup>
            </select>
          </div>
          
          {/* Start Analysis Button */}
          <button
            onClick={() => void analyzeMarket(false)}
            className="px-8 py-3 sm:py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 text-base sm:text-lg min-h-[48px] sm:min-h-[52px]"
          >
            Start AI Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'p-4' : 'p-6'}>
      {embedded ? (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[#1e2738]">
          <button
            type="button"
            onClick={() => void analyzeMarket(false)}
            disabled={isAnalyzing}
            className="btn btn-primary min-h-[44px] flex-1 sm:flex-none"
          >
            {isAnalyzing ? 'Analyzing…' : 'Re-analyze'}
          </button>
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🤖</span> AI Trading Engine
        </h2>
        <div className="flex gap-2">
          <select 
            value={selectedSymbol}
            onChange={(e) => {
              setSelectedSymbol(e.target.value);
              setAnalysis(null); // Clear previous analysis when symbol changes
              setAnalysisError(null); // Clear any errors
            }}
            className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white font-medium focus:outline-none focus:border-cyan-500"
            disabled={isAnalyzing}
          >
            <optgroup label="Forex - Major Pairs">
              <option value="EURUSD">EUR/USD</option>
              <option value="GBPUSD">GBP/USD</option>
              <option value="USDJPY">USD/JPY</option>
              <option value="USDCHF">USD/CHF</option>
              <option value="AUDUSD">AUD/USD</option>
              <option value="USDCAD">USD/CAD</option>
              <option value="NZDUSD">NZD/USD</option>
            </optgroup>
            <optgroup label="Forex - Cross Pairs">
              <option value="EURGBP">EUR/GBP</option>
              <option value="EURJPY">EUR/JPY</option>
              <option value="GBPJPY">GBP/JPY</option>
              <option value="AUDJPY">AUD/JPY</option>
            </optgroup>
            <optgroup label="Metals">
              <option value="XAUUSD">XAU/USD (Gold)</option>
              <option value="XAGUSD">XAG/USD (Silver)</option>
              <option value="XAUEUR">XAU/EUR (Gold/Euro)</option>
              <option value="XAUGBP">XAU/GBP (Gold/Pound)</option>
              <option value="XPTUSD">XPT/USD (Platinum)</option>
              <option value="XPDUSD">XPD/USD (Palladium)</option>
            </optgroup>
            <optgroup label="Stocks - Tech">
              <option value="AAPL">AAPL (Apple)</option>
              <option value="MSFT">MSFT (Microsoft)</option>
              <option value="GOOGL">GOOGL (Google)</option>
              <option value="AMZN">AMZN (Amazon)</option>
              <option value="META">META (Meta/Facebook)</option>
              <option value="TSLA">TSLA (Tesla)</option>
              <option value="NVDA">NVDA (NVIDIA)</option>
              <option value="NFLX">NFLX (Netflix)</option>
            </optgroup>
            <optgroup label="Stocks - Finance">
              <option value="JPM">JPM (JPMorgan)</option>
              <option value="BAC">BAC (Bank of America)</option>
              <option value="GS">GS (Goldman Sachs)</option>
              <option value="WFC">WFC (Wells Fargo)</option>
            </optgroup>
            <optgroup label="Stocks - Consumer">
              <option value="WMT">WMT (Walmart)</option>
              <option value="HD">HD (Home Depot)</option>
              <option value="MCD">MCD (McDonald&apos;s)</option>
              <option value="SBUX">SBUX (Starbucks)</option>
            </optgroup>
            <optgroup label="Stocks - Healthcare">
              <option value="JNJ">JNJ (Johnson & Johnson)</option>
              <option value="PFE">PFE (Pfizer)</option>
              <option value="UNH">UNH (UnitedHealth)</option>
            </optgroup>
            <optgroup label="Stocks - Industrial">
              <option value="BA">BA (Boeing)</option>
              <option value="CAT">CAT (Caterpillar)</option>
              <option value="GE">GE (General Electric)</option>
            </optgroup>
          </select>
          <button
            onClick={() => void analyzeMarket(false)}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-cyan-400 hover:bg-[#1e2738] transition-all font-medium disabled:opacity-50"
          >
            {isAnalyzing ? '↻ Analyzing...' : '↻ Re-analyze'}
          </button>
        </div>
      </div>
      </>
      )}

      {/* Error Message */}
      {analysisError && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          <strong>Error:</strong> {analysisError}
        </div>
      )}

      {/* Price Chart - Always show */}
      <div className="space-y-6">
        <div>
          <PriceChart symbol={selectedSymbol} timeframe="1h" height={250} />
          
          {/* Chart Vision Analysis - Show independently (doesn't require main analysis) */}
          <ChartVisionAnalysis
            symbol={selectedSymbol}
            timeframe="1h"
            chartContainerId={`chart-container-${selectedSymbol}-1h`}
            currentPrice={analysis?.detailedReasoning?.risk?.[0]?.includes('Current Price:') 
              ? parseFloat(analysis.detailedReasoning.risk[0].split('Current Price: ')[1]?.split(' ')[0] || '0')
              : undefined
            }
            onVisionComplete={embedded ? handleVisionComplete : undefined}
          />
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
          <div className={`p-5 sm:p-6 rounded-xl bg-gradient-to-r ${getRecommendationStyle(analysis.recommendation)}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm opacity-80 mb-2">AI Trading Engine Recommendation</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{analysis.recommendation}</p>
                <p className="text-sm sm:text-base opacity-80 mt-2">Confidence: {analysis.confidence}%</p>
                <p className="text-xs sm:text-sm opacity-60 mt-3 leading-relaxed">
                  💡 Based on technical indicators, fundamentals, sentiment, COT, regime, and chart structure.
                  {chartVisionApplied ? (
                    <>
                      <br className="hidden sm:block" />
                      <span className="block sm:inline mt-1 sm:mt-0 text-emerald-300">
                        Chart vision is included in Gate 1 structure assessment.
                      </span>
                    </>
                  ) : (
                    <>
                      <br className="hidden sm:block" />
                      <span className="block sm:inline mt-1 sm:mt-0 text-yellow-300">
                        Waiting for chart vision — Gate 1 uses indicators only until the chart analysis above completes.
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-left sm:text-right">
                {analysis.gateStatus ? (
                  <div className="space-y-2">
                    <div className="text-sm sm:text-base opacity-80">Confidence</div>
                    <div className="text-4xl sm:text-5xl md:text-6xl font-bold leading-none">{analysis.confidence}%</div>
                    {analysis.gateStatus.expectancyData && (
                      <div className="text-xs sm:text-sm opacity-60 mt-2">
                        Expectancy: {analysis.gateStatus.expectancyData.estimatedExpectancy > 0 ? '+' : ''}{analysis.gateStatus.expectancyData.estimatedExpectancy} {analysis.gateStatus.expectancyData.unit || 'pips'}/trade
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold leading-none">{analysis.overallScore}</div>
                <div className="text-sm sm:text-base opacity-80 mt-1">/100 Score</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
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
              <div key={item.label} className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-4 sm:p-5">
                <p className="text-xs sm:text-sm text-gray-500 mb-2">{item.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono leading-tight">{item.score}</p>
                {item.confidence && (
                  <p className="text-xs sm:text-sm text-gray-400 mt-1.5">Confidence: {item.confidence}%</p>
                )}
                <div className="mt-3 h-2 bg-[#1e2738] rounded-full overflow-hidden">
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

          {/* Gate Status Display */}
          {analysis.gateStatus && (
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>🚪</span> Gate Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gate 1: Market Readability */}
                <div className={`p-4 rounded-lg border ${
                  analysis.gateStatus.marketReadable 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Gate 1: Market Readability</span>
                    {analysis.gateStatus.marketReadable ? (
                      <span className="text-emerald-400">✅</span>
                    ) : (
                      <span className="text-rose-400">❌</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {(() => {
                      // 🔒 HARD-ENFORCED INVARIANT: Gate-1 output is single source of truth - use verbatim, NO fallbacks, NO recomputation
                      // MarketReadability object is immutable and must be consumed verbatim by all UI, logs, explanations, and retry renders
                      
                      // Runtime assertion: If marketReadabilityReason exists, use it verbatim
                      if (analysis.gateStatus.marketReadabilityReason) {
                        // 🔒 RUNTIME ASSERTION: Verify displayed value matches Gate-1 output
                        if (analysis.gateStatus.gate1Inputs) {
                          const gate1TrendStrength = analysis.gateStatus.gate1Inputs.trendStrength;
                          // Extract trend strength from reason string for comparison
                          const trendMatch = analysis.gateStatus.marketReadabilityReason.match(/Trend:\s*([\d.]+)%/);
                          if (trendMatch) {
                            const displayedTrendStrength = parseFloat(trendMatch[1]);
                            if (Math.abs(displayedTrendStrength - gate1TrendStrength) > 0.1) {
                              // Desync detected - throw error
                              const errorMsg = `[GATE1-DESYNC] CRITICAL: UI-displayed trend strength (${displayedTrendStrength}%) differs from Gate-1 output (${gate1TrendStrength}%). This violates single source of truth invariant.`;
                              console.error(errorMsg);
                              throw new Error(errorMsg);
                            }
                          }
                        }
                        return analysis.gateStatus.marketReadabilityReason;
                      }
                      
                      // 🔒 RUNTIME ASSERTION: If marketReadabilityReason is missing but gate1Inputs exist, this is a desync error
                      if (analysis.gateStatus.gate1Inputs) {
                        const gate1TrendStrength = analysis.gateStatus.gate1Inputs.trendStrength;
                        const errorMsg = `[GATE1-DESYNC] CRITICAL: Gate-1 reason missing but gate1Inputs exist. Trend strength: ${gate1TrendStrength}%. This violates single source of truth invariant.`;
                        console.error(errorMsg);
                        // Force-render Gate-1 value verbatim (no fallback, use gate1Inputs directly)
                        if (analysis.gateStatus.marketReadable) {
                          return `Market structure is clear and readable (Trend: ${gate1TrendStrength.toFixed(1)}%)`;
                        } else {
                          return `Market structure unclear (Trend: ${gate1TrendStrength.toFixed(1)}%)`;
                        }
                      }
                      
                      // 🔒 PROHIBITED: Fallback should never happen - Gate-1 output must always be present
                      const errorMsg = `[GATE1-DESYNC] CRITICAL: Both marketReadabilityReason and gate1Inputs are missing. This violates single source of truth invariant.`;
                      console.error(errorMsg);
                      throw new Error(errorMsg);
                    })()}
                  </p>
                </div>

                {/* Gate 2: Directional Bias */}
                <div className={`p-4 rounded-lg border ${
                  analysis.gateStatus.directionalBias !== 'NEUTRAL'
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Gate 2: Directional Bias</span>
                    {analysis.gateStatus.directionalBias !== 'NEUTRAL' ? (
                      <span className="text-emerald-400">✅</span>
                    ) : (
                      <span className="text-yellow-400">⏸️</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {analysis.gateStatus.directionalBias !== 'NEUTRAL'
                      ? `${analysis.gateStatus.directionalBias} (${analysis.gateStatus.biasStrength}% strength)`
                      : 'No clear directional bias'}
                  </p>
                </div>

                {/* Gate 3: GPT Structure */}
                {analysis.gateStatus.gptStructure && (
                  <div className={`p-4 rounded-lg border ${
                    analysis.gateStatus.gptStructure.alignment === 'CONFIRMS'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : analysis.gateStatus.gptStructure.alignment === 'CONTRADICTS'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-gray-500/10 border-gray-500/30'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Gate 3: GPT Structure</span>
                      {analysis.gateStatus.gptStructure.alignment === 'CONFIRMS' ? (
                        <span className="text-emerald-400">✅</span>
                      ) : analysis.gateStatus.gptStructure.alignment === 'CONTRADICTS' ? (
                        <span className="text-rose-400">❌</span>
                      ) : (
                        <span className="text-gray-400">➖</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {analysis.gateStatus.gptStructure.marketStructure} ({analysis.gateStatus.gptStructure.alignment}, {analysis.gateStatus.gptStructure.confidence}%)
                    </p>
                  </div>
                )}

                {/* Gate 4: Execution Permission */}
                <div className={`p-4 rounded-lg border ${
                  analysis.gateStatus.executionPermitted
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Gate 4: Execution Permission</span>
                    {analysis.gateStatus.executionPermitted ? (
                      <span className="text-emerald-400">✅</span>
                    ) : (
                      <span className="text-rose-400">❌</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {analysis.gateStatus.executionPermitted
                      ? `Execution permitted (confidence: ${analysis.confidence}%)`
                      : 'Execution blocked - conditions not met'}
                  </p>
                </div>
              </div>

              {/* Expectancy Data */}
              {analysis.gateStatus.expectancyData && (
                <div className="mt-4 p-4 bg-[#0d1321] rounded-lg border border-[#1e2738]">
                  <h4 className="text-sm font-medium text-white mb-3">Expected Performance</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Win Rate</p>
                      <p className="text-white font-bold">{analysis.gateStatus.expectancyData.estimatedWinRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Avg Win</p>
                      <p className="text-emerald-400 font-bold">+{analysis.gateStatus.expectancyData.estimatedAvgWin} {analysis.gateStatus.expectancyData.unit || 'pips'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Avg Loss</p>
                      <p className="text-rose-400 font-bold">-{analysis.gateStatus.expectancyData.estimatedAvgLoss} {analysis.gateStatus.expectancyData.unit || 'pips'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Expectancy</p>
                      <p className={`font-bold ${
                        analysis.gateStatus.expectancyData.estimatedExpectancy > 0 
                          ? 'text-emerald-400' 
                          : 'text-rose-400'
                      }`}>
                        {analysis.gateStatus.expectancyData.estimatedExpectancy > 0 ? '+' : ''}
                        {analysis.gateStatus.expectancyData.estimatedExpectancy} {analysis.gateStatus.expectancyData.unit || 'pips'}/trade
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5 flex items-center gap-2">
                <span>📊</span> Trade Setup
              </h3>
              <div className="space-y-3 sm:space-y-4 text-sm sm:text-base">
                {/* CRITICAL FIX: Add entry price display */}
                {analysis.detailedReasoning?.risk?.[0] && analysis.detailedReasoning.risk[0].includes('Current Price:') && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entry Price</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {analysis.detailedReasoning.risk[0].split('Current Price: ')[1]?.split(' ')[0] || 'N/A'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 text-sm sm:text-base">Position Size</span>
                  <span className={`font-mono font-bold text-base sm:text-lg ${
                    analysis.suggestedPositionSize && analysis.suggestedPositionSize > 200 ? 'text-red-400' : 'text-white'
                  }`}>
                    {analysis.suggestedPositionSize 
                      ? (analysis.suggestedPositionSize > 200 
                      ? `⚠️ ${Math.min(analysis.suggestedPositionSize, 200).toFixed(2)} lots (capped at 200)` 
                          : `${analysis.suggestedPositionSize.toFixed(2)} lots`)
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 text-sm sm:text-base">Stop Loss</span>
                  <span className="font-mono font-bold text-base sm:text-lg text-rose-400">
                    {analysis.suggestedStopLoss ? analysis.suggestedStopLoss.toFixed(4) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 text-sm sm:text-base">Take Profit</span>
                  <span className="font-mono font-bold text-base sm:text-lg text-emerald-400">
                    {analysis.suggestedTakeProfit ? analysis.suggestedTakeProfit.toFixed(4) : 'N/A'}
                  </span>
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
            <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5">📊 Detailed Analysis</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 text-sm sm:text-base">
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
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5 flex items-center gap-2">
                <span>📊</span> COT Analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm sm:text-base mb-4">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Large Specs</p>
                  <p className="font-bold text-white text-sm sm:text-base">{analysis.cotAnalysis.largeSpecPosition}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{analysis.cotAnalysis.largeSpecPercentile}th %ile</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Commercials</p>
                  <p className="font-bold text-white text-sm sm:text-base">{analysis.cotAnalysis.commercialPosition}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{analysis.cotAnalysis.commercialPercentile}th %ile</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Sentiment</p>
                  <p className={`font-bold text-sm sm:text-base ${
                    analysis.cotAnalysis.sentiment === 'BULLISH' ? 'text-emerald-400' :
                    analysis.cotAnalysis.sentiment === 'BEARISH' ? 'text-rose-400' : 'text-gray-400'
                  }`}>{analysis.cotAnalysis.sentiment}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">COT Signal</p>
                  {/* 🔒 EXPLANATION-SOURCE INTEGRITY: Forbid BUY/SELL wording when non-actionable */}
                  {(() => {
                    const isBiasNonActionable = analysis.gateStatus?.directionalBias === 'NEUTRAL';
                    const isExecutionBlocked = !analysis.gateStatus?.executionPermitted;
                    const shouldSanitize = isBiasNonActionable || isExecutionBlocked;
                    
                    if (shouldSanitize) {
                      // Show "Context-Only / Non-Actionable" instead of BUY/SELL
                      const cotDirection = analysis.cotAnalysis.recommendation.includes('BUY') ? 'BULLISH' :
                                         analysis.cotAnalysis.recommendation.includes('SELL') ? 'BEARISH' : 'NEUTRAL';
                      return (
                        <p className="text-yellow-400 font-bold text-sm sm:text-base">
                          {cotDirection} (Context-Only / Non-Actionable)
                        </p>
                      );
                    }
                    
                    // Show normal COT recommendation when actionable
                    return (
                      <p className={`font-bold text-sm sm:text-base ${
                        analysis.cotAnalysis.recommendation.includes('BUY') ? 'text-emerald-400' :
                        analysis.cotAnalysis.recommendation.includes('SELL') ? 'text-rose-400' : 'text-yellow-400'
                      }`}>{analysis.cotAnalysis.recommendation}</p>
                    );
                  })()}
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-400 space-y-1.5 mt-3">
                {analysis.cotAnalysis.reasoning.slice(0, 2).map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          )}

          {/* Regime Detection */}
          {analysis.regimeAnalysis && (
            <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-xl border border-indigo-500/30 p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5 flex items-center gap-2">
                <span>📈</span> Market Regime
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm sm:text-base mb-4">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Regime</p>
                  <p className="font-bold text-white text-sm sm:text-base leading-tight">{analysis.regimeAnalysis.regime.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Strategy</p>
                  <p className="font-bold text-cyan-400 text-sm sm:text-base leading-tight">{analysis.regimeAnalysis.suggestedStrategy.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Volatility</p>
                  <p className="font-bold text-white text-sm sm:text-base">{analysis.regimeAnalysis.volatility}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm mb-1">Confidence</p>
                  <p className="font-bold text-white text-sm sm:text-base">{analysis.regimeAnalysis.confidence}%</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-400 space-y-1.5 mt-3">
                {analysis.regimeAnalysis.reasoning.slice(0, 2).map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          )}

          {usingCachedScan && (
            <p className="text-xs text-cyan-400/80 mb-2 text-center">
              Using analysis from Scan — Re-analyze for a fresh signal
            </p>
          )}

          {/* Execute Button */}
          <button
            onClick={executeAITrade}
            disabled={isExecuting || executionBlocked}
            title={
              executionBlocked && analysis.gateStatus?.executionBlockedBy?.length
                ? analysis.gateStatus.executionBlockedBy.join('; ')
                : undefined
            }
            className={`w-full py-4 sm:py-5 rounded-xl font-bold text-base sm:text-lg text-white transition-all touch-manipulation min-h-[56px] flex items-center justify-center ${
              !executionBlocked && analysis.recommendation.includes('BUY')
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 active:from-emerald-600 active:to-green-600 shadow-lg shadow-emerald-500/20'
                : !executionBlocked && analysis.recommendation.includes('SELL')
                ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 active:from-rose-600 active:to-red-600 shadow-lg shadow-rose-500/20'
                : 'bg-gray-700 cursor-not-allowed text-gray-500'
            } disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500`}
          >
            {isExecuting
              ? '↻ Executing...'
              : executionBlocked
              ? 'EXECUTION BLOCKED — SEE GATE 4'
              : `Execute ${analysis.recommendation}`}
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
