'use client';

/**
 * Chart Vision Analysis Component
 * Displays OpenAI Vision analysis of chart patterns
 */

import { useState, useEffect, useRef } from 'react';
import { analyzeChartImage, isOpenAIConfigured } from '@/lib/openai-service';
import { captureRechartsChart } from '@/lib/chart-capture';

interface ChartVisionAnalysisProps {
  symbol: string;
  timeframe: string;
  chartContainerId: string;
  currentPrice?: number;
}

interface ChartAnalysis {
  patterns: {
    type: string;
    confidence: number;
    description: string;
    priceLevel?: number;
  }[];
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  trend: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    description: string;
  };
  candlestickPatterns: {
    pattern: string;
    location: string;
    significance: string;
  }[];
  recommendation: string;
  keyLevels: {
    level: number;
    type: 'support' | 'resistance' | 'breakout';
    importance: 'high' | 'medium' | 'low';
  }[];
}

export function ChartVisionAnalysis({
  symbol,
  timeframe,
  chartContainerId,
  currentPrice,
}: ChartVisionAnalysisProps) {
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isConfigured = isOpenAIConfigured();

  const analyzeChart = async () => {
    if (!isConfigured) {
      setError('OpenAI not configured');
      return;
    }

    // Check if chart container exists
    const container = document.getElementById(chartContainerId);
    if (!container) {
      console.warn(`Chart container "${chartContainerId}" not found, skipping analysis`);
      return;
    }

    // Also verify the chart element exists and has dimensions
    const chartElement = container.querySelector('.recharts-wrapper') as HTMLElement;
    if (!chartElement) {
      console.warn(`Chart element not found in container "${chartContainerId}", skipping analysis`);
      return;
    }

    if (chartElement.clientWidth === 0 || chartElement.clientHeight === 0) {
      console.warn(`Chart element has no dimensions, skipping analysis`);
      return;
    }

    setLoading(true);
    setError(null);
    setIsAnalyzing(true);

    try {
      // Capture chart as image (with retry logic built-in)
      const imageBase64 = await captureRechartsChart(chartContainerId);
      
      if (!imageBase64) {
        throw new Error('Failed to capture chart image. The chart may not be fully rendered. Please wait a moment and try again.');
      }
      
      console.log(`✅ Chart captured successfully (${Math.round(imageBase64.length / 1024)}KB)`);

      // Analyze with OpenAI Vision
      const result = await analyzeChartImage(imageBase64, symbol, timeframe, currentPrice);
      
      if (result) {
        setAnalysis(result);
      } else {
        setError('Failed to analyze chart');
      }
    } catch (err: any) {
      console.error('Chart vision analysis error:', err);
      const errorMessage = err?.message || 'Error analyzing chart';
      setError(errorMessage.includes('API error') ? errorMessage : `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  // DISABLED: Auto-analyze when component mounts to prevent OpenAI credit usage
  // Chart analysis now requires manual trigger via "Re-analyze" button
  // useEffect(() => {
  //   if (isConfigured && chartContainerId) {
  //     // Use a more robust approach: wait for chart to be fully rendered
  //     const checkAndAnalyze = () => {
  //       const container = document.getElementById(chartContainerId);
  //       if (container) {
  //         // Also check if the chart element (Recharts wrapper) exists
  //         const chartElement = container.querySelector('.recharts-wrapper') as HTMLElement;
  //         if (chartElement && chartElement.clientWidth > 0 && chartElement.clientHeight > 0) {
  //           analyzeChart().catch(err => {
  //             console.warn('Auto-analysis failed (non-blocking):', err);
  //             // Don't set error state for auto-analysis failures
  //           });
  //           return true; // Chart found and analyzed
  //         }
  //       }
  //       return false; // Chart not ready yet
  //     };

  //     // Wait longer for chart to fully render with data
  //     // Recharts needs time to render SVG elements and data
  //     const initialDelay = 2000; // Wait 2 seconds first
  //     setTimeout(() => {
  //       if (checkAndAnalyze()) {
  //         return; // Success
  //       }
  //     }, initialDelay);

  //     // If not ready, try with increasing delays
  //     const delays = [3000, 5000, 7000, 10000];
  //     const timers: NodeJS.Timeout[] = [];

  //     delays.forEach((delay, index) => {
  //       const timer = setTimeout(() => {
  //         if (checkAndAnalyze()) {
  //           // Clear remaining timers if successful
  //           delays.slice(index + 1).forEach((_, i) => {
  //             if (timers[index + 1 + i]) {
  //               clearTimeout(timers[index + 1 + i]);
  //             }
  //           });
  //         }
  //       }, delay);
  //       timers.push(timer);
  //     });

  //     return () => {
  //       timers.forEach(timer => clearTimeout(timer));
  //     };
  //   }
  // }, [symbol, timeframe, chartContainerId, isConfigured]);

  if (!isConfigured) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50/10 to-pink-50/10 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/30 dark:border-purple-800/30 p-4 sm:p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          {/* OpenAI Logo */}
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#10A37F"/>
            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#10A37F"/>
            <circle cx="12" cy="12" r="2" fill="#10A37F"/>
          </svg>
          {/* GPT-5.1 Logo */}
          <img 
            src="/gpt-5.1.png" 
            alt="GPT-5.1" 
            className="w-5 h-5 flex-shrink-0 rounded"
          />
          <span>AI Chart Pattern Analysis</span>
          <span className="text-xs font-normal text-gray-400">Powered by GPT-5.1</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={analyzeChart}
            disabled={loading || isAnalyzing}
            className="px-3 py-1.5 text-xs sm:text-sm bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading || isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400"></div>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-analyze
              </>
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="space-y-4">
          {loading || isAnalyzing ? (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
              <p className="text-sm text-gray-400">Analyzing chart patterns with AI vision...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              {error.includes('quota') || error.includes('billing') ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-red-300">
                    💡 To fix this:
                  </p>
                  <ol className="text-xs text-red-300 list-decimal list-inside space-y-1 ml-2">
                    <li>Go to <a href="https://platform.openai.com/account/billing" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Billing</a></li>
                    <li>Add payment method or credits</li>
                    <li>Wait a few minutes for activation</li>
                    <li>Try again</li>
                  </ol>
                </div>
              ) : (
                <button
                  onClick={analyzeChart}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Try again
                </button>
              )}
            </div>
          ) : analysis ? (
            <>
              {/* Recommendation */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <h4 className="text-xs sm:text-sm font-semibold text-purple-400 mb-2">
                  📊 GPT-5.1 Visual Chart Recommendation
                </h4>
                <p className="text-sm text-gray-300 mb-2">{analysis.recommendation}</p>
                <p className="text-xs text-yellow-300/80">
                  💡 This analysis is based on visual chart patterns. The AI Trading Engine (above) uses technical indicators and may show different recommendations.
                </p>
              </div>

              {/* Trend Analysis */}
              {analysis.trend && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <span>📈</span> Trend Analysis
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Direction:</span>
                      <span className={`text-xs font-semibold ${
                        analysis.trend.direction === 'bullish' ? 'text-emerald-400' :
                        analysis.trend.direction === 'bearish' ? 'text-rose-400' :
                        'text-gray-400'
                      }`}>
                        {analysis.trend.direction.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Strength:</span>
                      <span className="text-xs font-semibold text-white">{analysis.trend.strength}%</span>
                    </div>
                    <p className="text-xs text-gray-400">{analysis.trend.description}</p>
                  </div>
                </div>
              )}

              {/* Patterns */}
              {analysis.patterns && analysis.patterns.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                    <span>🔍</span> Chart Patterns Detected
                  </h4>
                  <div className="space-y-2">
                    {analysis.patterns.map((pattern, index) => (
                      <div key={index} className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-emerald-400">{pattern.type}</span>
                          <span className="text-xs text-gray-400">{pattern.confidence}% confidence</span>
                        </div>
                        {pattern.priceLevel && (
                          <p className="text-xs text-gray-400 mb-1">
                            Price: {typeof pattern.priceLevel === 'number' ? pattern.priceLevel.toFixed(5) : String(pattern.priceLevel)}
                          </p>
                        )}
                        <p className="text-xs text-gray-300">{pattern.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support/Resistance */}
              {analysis.supportResistance && (analysis.supportResistance.support?.length > 0 || analysis.supportResistance.resistance?.length > 0) && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <span>📊</span> Support & Resistance
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {analysis.supportResistance.support && analysis.supportResistance.support.length > 0 && (() => {
                      const validSupport = analysis.supportResistance.support
                        .map(level => typeof level === 'number' ? level : parseFloat(String(level)))
                        .filter(level => level > 0 && !isNaN(level));
                      return validSupport.length > 0 ? (
                        <div>
                          <p className="text-xs text-emerald-400 font-semibold mb-1">Support Levels:</p>
                          <ul className="space-y-1">
                            {validSupport.map((level, index) => (
                              <li key={index} className="text-xs text-gray-300 font-mono">
                                {level.toFixed(5)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}
                    {analysis.supportResistance.resistance && analysis.supportResistance.resistance.length > 0 && (() => {
                      const validResistance = analysis.supportResistance.resistance
                        .map(level => typeof level === 'number' ? level : parseFloat(String(level)))
                        .filter(level => level > 0 && !isNaN(level));
                      return validResistance.length > 0 ? (
                        <div>
                          <p className="text-xs text-rose-400 font-semibold mb-1">Resistance Levels:</p>
                          <ul className="space-y-1">
                            {validResistance.map((level, index) => (
                              <li key={index} className="text-xs text-gray-300 font-mono">
                                {level.toFixed(5)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Key Levels */}
              {analysis.keyLevels && analysis.keyLevels.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <span>🎯</span> Key Price Levels
                  </h4>
                  <div className="space-y-1">
                    {analysis.keyLevels.map((level, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-mono">
                          {typeof level.level === 'number' ? level.level.toFixed(5) : parseFloat(String(level.level)).toFixed(5)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            level.type === 'support' ? 'bg-emerald-500/20 text-emerald-400' :
                            level.type === 'resistance' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {level.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            level.importance === 'high' ? 'bg-red-500/20 text-red-400' :
                            level.importance === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {level.importance}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candlestick Patterns */}
              {analysis.candlestickPatterns && analysis.candlestickPatterns.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <span>🕯️</span> Candlestick Patterns
                  </h4>
                  <div className="space-y-2">
                    {analysis.candlestickPatterns.map((pattern, index) => (
                      <div key={index} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-yellow-400">{pattern.pattern}</span>
                          <span className="text-xs text-gray-400">{pattern.location}</span>
                        </div>
                        <p className="text-xs text-gray-300">{pattern.significance}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Click "Re-analyze" to analyze chart patterns</p>
          )}
        </div>
      )}
    </div>
  );
}

