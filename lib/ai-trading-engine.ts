import { TradeSignal, TradeDirection, PriceData } from '@/types/trading';
import { EconomicCalendar, NewsImpact } from './economic-calendar';
import { CorrelationMonitor } from './correlation-monitor';
import { COTAnalyzer, COTAnalysis } from './cot-analyzer';
import { RegimeDetector, RegimeAnalysis } from './regime-detector';
import { MLRegimeDetector } from './regime-detector-ml';
import { TwelveDataProvider, NewsDataProvider, AlphaVantageProvider, MT5PriceDataProvider, ForexFactoryRSSProvider, RSSNewsProvider, TradingEconomicsIndicatorsProvider } from './data-providers';
import { TradingHoursFilter, TradingHoursAnalysis } from './trading-hours';
import { VolumeAnalyzer } from './technical-analysis/volume-analyzer';
import { MultiTimeframeAnalyzer } from './technical-analysis/multi-timeframe-analyzer';
import { DivergenceDetector } from './technical-analysis/divergence-detector';
import { PatternDetector } from './technical-analysis/pattern-detector';
import { AdvancedIndicators } from './technical-analysis/advanced-indicators';
import { isOpenAIConfigured } from './openai-service';

export interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  overallScore: number; // 0-100
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-100%
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  suggestedPositionSize: number;
  reasoning: string[];
  newsImpact?: NewsImpact;
  correlationWarning?: string;
  detailedReasoning?: {
    technical: string[];
    fundamental: string[];
    sentiment: string[];
    risk: string[];
  };
  cotAnalysis?: COTAnalysis;
  regimeAnalysis?: RegimeAnalysis;
  tradingHours?: TradingHoursAnalysis;
  gptChartAnalysis?: {
    score: number; // 0-100
    recommendation: string;
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: number;
    };
    confidence: number; // 0-100
  };
}

export class AITradingEngine {
  private historicalData: PriceData[] = [];

  /**
   * Get economic calendar events with fallback (free first, then paid)
   */
  private async getEconomicCalendarEvents(fromDate?: Date, toDate?: Date): Promise<any[]> {
    try {
      // Try unified calendar (aggregates ForexFactory, Investing.com, Trading Economics)
      const { UnifiedCalendarProvider } = await import('./data-providers/unified-calendar');
      const unifiedEvents = await UnifiedCalendarProvider.getEconomicCalendar(fromDate, toDate);
      if (unifiedEvents.length > 0) {
        return unifiedEvents;
      }
    } catch (error) {
      console.warn('Unified calendar failed, trying individual sources...', error);
    }

    try {
      // Fallback to individual ForexFactory RSS
      const { ForexFactoryRSSProvider } = await import('./data-providers/forexfactory-rss');
      const freeEvents = await ForexFactoryRSSProvider.getEconomicCalendar(fromDate, toDate);
      if (freeEvents.length > 0) {
        return freeEvents;
      }
    } catch (error) {
      console.warn('ForexFactory RSS failed, trying Finnhub...', error);
    }

    try {
      // Final fallback to paid Finnhub
      const { FinnhubProvider } = await import('./data-providers/finnhub');
      return await FinnhubProvider.getEconomicCalendar(fromDate, toDate);
    } catch (error) {
      console.warn('Finnhub also failed:', error);
      return [];
    }
  }

  /**
   * Get news sentiment with fallback (free first, then paid)
   */
  private async getNewsSentiment(symbol: string): Promise<{
    score: number;
    bullish: number;
    bearish: number;
    neutral: number;
    articleCount: number;
  }> {
    try {
      // Try free RSS News first
      const freeSentiment = await RSSNewsProvider.getSentimentScore(symbol);
      if (freeSentiment.articleCount > 0) {
        return freeSentiment;
      }
    } catch (error) {
      console.warn('RSS News failed, trying NewsData...', error);
    }

    try {
      // Fallback to paid NewsData
      const { NewsDataProvider } = await import('./data-providers/newsdata');
      return await NewsDataProvider.getSentimentScore(symbol);
    } catch (error) {
      console.warn('NewsData also failed:', error);
      return { score: 0, bullish: 0, bearish: 0, neutral: 100, articleCount: 0 };
    }
  }

  // Main analysis function
  async analyzeMarket(symbol: string, openTrades: any[] = []): Promise<MarketAnalysis> {
    // Get historical data for analysis
    await this.loadHistoricalData(symbol);
    
    // TRADING HOURS CHECK (UK optimized)
    const tradingHours = TradingHoursFilter.analyze(symbol);
    
    // PHASE 1: Check news impact
    const newsImpact = await EconomicCalendar.checkNewsImpact(symbol);
    
    // PHASE 1: Check correlation with existing positions
    let correlationWarning: string | undefined;
    if (openTrades.length > 0) {
      const correlatedPairs = CorrelationMonitor.getCorrelatedPairs(symbol);
      const hasCorrelated = openTrades.some(t => correlatedPairs.includes(t.pair));
      if (hasCorrelated) {
        correlationWarning = `Warning: Already have correlated positions (${correlatedPairs.filter(p => openTrades.some(t => t.pair === p)).join(', ')})`;
      }
    }
    
    // PHASE 2: COT Analysis
    const cotAnalysis = await COTAnalyzer.analyzeCOT(symbol);
    
    // PHASE 2: Regime Detection (ML-based with multi-timeframe)
    const regimeAnalysis = await MLRegimeDetector.detectRegimeML(this.historicalData, symbol);
    
    // Perform comprehensive analysis
    const technicalScore = await this.technicalAnalysis(symbol);
    const fundamentalScore = await this.fundamentalAnalysis(symbol);
    const sentimentScore = await this.sentimentAnalysis(symbol);
    
    // GPT-5.1 Chart Analysis (optional - enhances accuracy with visual pattern recognition)
    let gptChartAnalysis: MarketAnalysis['gptChartAnalysis'] | undefined;
    let gptChartScore = 50; // Default neutral score if GPT-5.1 is unavailable
    
    if (isOpenAIConfigured() && this.historicalData.length >= 20) {
      try {
        gptChartAnalysis = await this.getGPTChartAnalysis(symbol);
        if (gptChartAnalysis) {
          gptChartScore = gptChartAnalysis.score;
        }
      } catch (error) {
        console.warn('⚠️ GPT-5.1 chart analysis unavailable, continuing without it:', error);
        // Continue without GPT-5.1 - it's optional
      }
    }
    
    // Calculate overall score (weighted average)
    // UPDATED: Added GPT-5.1 chart analysis (15% weight) for enhanced accuracy
    // Adjusted other weights to accommodate GPT-5.1 integration
    let overallScore = 
      technicalScore * 0.50 +    // 50% technical (reduced from 60% to make room for GPT-5.1)
      fundamentalScore * 0.12 +  // 12% fundamental (reduced from 15%)
      sentimentScore * 0.08 +    // 8% sentiment (reduced from 10%)
      cotAnalysis.confidence * 0.08 + // 8% COT analysis (reduced from 10%)
      (regimeAnalysis.confidence / 100) * 5 + // 5% regime (unchanged)
      gptChartScore * 0.15; // 15% GPT-5.1 chart analysis (NEW - visual pattern recognition)

    // PHASE 2: Adjust score based on COT analysis
    if (cotAnalysis.recommendation === 'STRONG_BUY') {
      overallScore += 10;
    } else if (cotAnalysis.recommendation === 'STRONG_SELL') {
      overallScore -= 10;
    } else if (cotAnalysis.recommendation === 'BUY') {
      overallScore += 5;
    } else if (cotAnalysis.recommendation === 'SELL') {
      overallScore -= 5;
    }

    // PHASE 2: Adjust score based on regime
    // FIXED: Don't force HOLD for AVOID - just reduce score instead
    // This allows strong technical signals to still generate trades
    if (regimeAnalysis.suggestedStrategy === 'AVOID') {
      // Reduce score by 20% instead of forcing to 50
      // This allows scores above 62.5 to still reach 50+ after reduction
      overallScore *= 0.8;
    } else if (regimeAnalysis.suggestedStrategy === 'MEAN_REVERSION' && technicalScore > 60) {
      overallScore += 5; // Mean reversion works well in ranging markets
    } else if (regimeAnalysis.suggestedStrategy === 'MOMENTUM' && technicalScore > 70) {
      overallScore += 5; // Momentum works well in trending markets
    } else if (regimeAnalysis.suggestedStrategy === 'TREND_FOLLOWING' && technicalScore > 65) {
      overallScore += 5; // Trend following works well with strong trends
    }

    // PHASE 1: Adjust score based on news impact
    if (newsImpact.shouldAvoidTrading) {
      overallScore = 50; // Force HOLD if news is too close
    } else if (newsImpact.shouldReducePosition) {
      overallScore *= 0.9; // Slightly reduce confidence
    }
    
    // TRADING HOURS ADJUSTMENT (UK optimized)
    // Reduce confidence during poor trading hours
    if (!tradingHours.isOptimalTime) {
      const timeMultiplier = TradingHoursFilter.getTimeMultiplier(symbol);
      overallScore *= timeMultiplier;
      
      // Force HOLD during weekend or very poor conditions
      if (tradingHours.quality === 'POOR') {
        overallScore = 50;
      }
    }

    // Clamp score to 0-100
    overallScore = Math.max(0, Math.min(100, overallScore));

    // Generate recommendation
    const recommendation = this.generateRecommendation(overallScore);
    const confidence = this.calculateConfidence(overallScore, technicalScore);
    
    // Calculate optimal stop loss and take profit
    const { stopLoss, takeProfit } = this.calculateOptimalLevels(symbol, recommendation);
    
    // Calculate position size based on volatility (with ATR adjustment)
    const atr = this.calculateATR(this.historicalData);
    // CRITICAL FIX: Use realistic base ATR for EURUSD (70 pips = 0.007)
    // This prevents extreme volatility adjustments
    const baseATR = 0.007; // Base ATR for EURUSD (70 pips)
    const positionSize = await this.calculatePositionSizeWithVolatility(symbol, stopLoss, takeProfit, atr, baseATR);
    
    // PHASE 1: Generate enhanced reasoning
    const reasoning = this.generateReasoning(technicalScore, fundamentalScore, sentimentScore);
    const detailedReasoning = this.generateDetailedReasoning(symbol, technicalScore, fundamentalScore, sentimentScore, atr, regimeAnalysis);

    // Add trading hours warning to reasoning
    if (tradingHours.warningMessage) {
      reasoning.unshift(tradingHours.warningMessage);
    }
    if (!tradingHours.isOptimalTime && tradingHours.quality !== 'POOR') {
      reasoning.push(`⏰ Current session: ${tradingHours.currentSession}. ${tradingHours.recommendation}`);
    }

    const analysis: MarketAnalysis = {
      symbol,
      timestamp: new Date(),
      overallScore: Math.round(overallScore),
      recommendation,
      confidence: Math.round(confidence),
      technicalScore: Math.round(technicalScore),
      fundamentalScore: Math.round(fundamentalScore),
      sentimentScore: Math.round(sentimentScore),
      riskLevel: this.assessRiskLevel(symbol, recommendation),
      suggestedStopLoss: stopLoss,
      suggestedTakeProfit: takeProfit,
      suggestedPositionSize: positionSize,
      reasoning,
      newsImpact,
      correlationWarning,
      detailedReasoning,
      cotAnalysis,
      regimeAnalysis,
      tradingHours,
      gptChartAnalysis, // GPT-5.1 chart analysis (optional)
    };

    // Save analysis to Firestore (non-blocking, fire-and-forget)
    if (typeof window !== 'undefined') {
      try {
        const { saveAnalysisToFirestore } = await import('./firebase/analysis-storage');
        const currentPrice = this.historicalData.length > 0 
          ? this.historicalData[this.historicalData.length - 1].close 
          : 0;
        
        await saveAnalysisToFirestore(symbol, analysis, {
          price: currentPrice,
          indicators: {
            rsi: this.calculateRSI(this.historicalData.map(d => d.close)),
            macd: this.calculateMACD(this.historicalData.map(d => d.close)),
          },
          cotData: cotAnalysis,
          regime: regimeAnalysis.regime,
        });
      } catch (error) {
        // Non-critical - don't block analysis if Firestore fails
        console.warn('Failed to save analysis to Firestore (non-critical):', error);
      }
    }

    return analysis;
  }

  // Technical Analysis (50% weight) - Enhanced with Volume, Multi-Timeframe, Divergence, Patterns, Advanced Indicators
  private async technicalAnalysis(symbol: string): Promise<number> {
    if (this.historicalData.length < 20) return 50;

    const prices = this.historicalData.map(d => d.close);
    const currentPrice = prices[prices.length - 1];
    
    let score = 50; // Neutral starting point
    
    // ENHANCED: Add more robust data validation
    if (prices.length < 20 || prices.some(p => !isFinite(p) || p <= 0)) {
      console.warn('Invalid price data for technical analysis');
      return 50;
    }

    // 1. RSI Analysis (14-period)
    const rsi = this.calculateRSI(prices);
    if (rsi < 30) score += 15; // Oversold - bullish
    else if (rsi > 70) score -= 15; // Overbought - bearish
    else if (rsi > 40 && rsi < 60) score += 5; // Neutral zone

    // 2. MACD Analysis
    const macd = this.calculateMACD(prices);
    if (macd.histogram > 0 && macd.macd > macd.signal) score += 10;
    else if (macd.histogram < 0 && macd.macd < macd.signal) score -= 10;

    // 3. Bollinger Bands Position
    const bb = this.calculateBollingerBands(prices);
    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (bbPosition < 0.2) score += 10; // Near lower band - bullish
    else if (bbPosition > 0.8) score -= 10; // Near upper band - bearish

    // 4. Trend Analysis (50-period EMA)
    const ema50 = this.calculateEMA(prices, 50);
    const ema20 = this.calculateEMA(prices, 20);
    if (currentPrice > ema50 && ema20 > ema50) score += 10; // Uptrend
    else if (currentPrice < ema50 && ema20 < ema50) score -= 10; // Downtrend

    // 5. ADX (Average Directional Index) - Trend Strength
    const adx = this.calculateADX(this.historicalData);
    if (adx.adx > 25) {
      // Strong trend
      if (adx.diPlus > adx.diMinus) {
        score += 8; // Strong uptrend
      } else {
        score -= 8; // Strong downtrend
      }
    } else if (adx.adx < 20) {
      // Weak trend / ranging market
      score -= 5; // Reduce confidence in trending signals
    }

    // 6. Price Momentum (Rate of Change)
    const roc = this.calculateROC(prices, 10);
    if (roc > 0.5) score += 5; // Strong upward momentum
    else if (roc < -0.5) score -= 5; // Strong downward momentum

    // 7. Support/Resistance Levels
    const supportResistanceScore = this.analyzeSupportResistance(prices, currentPrice);
    score += supportResistanceScore;

    // 8. NEW: Volume Analysis
    try {
      const volumeAnalysis = VolumeAnalyzer.analyze(this.historicalData);
      
      // Volume confirmation
      if (volumeAnalysis.volumeConfirmation.confirmed) {
        const volumeStrength = volumeAnalysis.volumeConfirmation.strength / 100;
        if (score > 50) {
          score += volumeStrength * 5; // Confirm bullish signals
        } else if (score < 50) {
          score -= volumeStrength * 5; // Confirm bearish signals
        }
      }

      // Volume divergence
      if (volumeAnalysis.volumeDivergence.bullish) {
        score += (volumeAnalysis.volumeDivergence.strength / 100) * 8; // Bullish divergence
      } else if (volumeAnalysis.volumeDivergence.bearish) {
        score -= (volumeAnalysis.volumeDivergence.strength / 100) * 8; // Bearish divergence
      }

      // Volume trend
      if (volumeAnalysis.trend === 'increasing' && volumeAnalysis.volumeRatio > 1.2) {
        score += 3; // Increasing volume supports trend
      } else if (volumeAnalysis.trend === 'decreasing' && volumeAnalysis.volumeRatio < 0.8) {
        score -= 3; // Decreasing volume weakens trend
      }
    } catch (error) {
      console.warn('Volume analysis error:', error);
    }

    // 9. NEW: Multi-Timeframe Analysis
    try {
      const multiTimeframe = await MultiTimeframeAnalyzer.analyze(symbol);
      
      // Alignment bonus
      if (multiTimeframe.alignment === 'bullish' && multiTimeframe.alignmentStrength > 60) {
        score += (multiTimeframe.alignmentStrength / 100) * 10; // All timeframes bullish
      } else if (multiTimeframe.alignment === 'bearish' && multiTimeframe.alignmentStrength > 60) {
        score -= (multiTimeframe.alignmentStrength / 100) * 10; // All timeframes bearish
      }

      // Higher timeframe weight (D1 > H4 > H1)
      if (multiTimeframe.d1.trend === 'up' && score > 50) {
        score += 5; // D1 uptrend confirms
      } else if (multiTimeframe.d1.trend === 'down' && score < 50) {
        score -= 5; // D1 downtrend confirms
      }
    } catch (error) {
      console.warn('Multi-timeframe analysis error:', error);
    }

    // 10. NEW: Divergence Detection
    try {
      // Calculate RSI array for divergence detection (rolling RSI)
      const rsiArray: number[] = [];
      for (let i = 14; i < prices.length; i++) {
        const rsiValue = this.calculateRSI(prices.slice(Math.max(0, i - 14), i + 1));
        rsiArray.push(rsiValue);
      }

      // Calculate MACD array for divergence detection (rolling MACD)
      const macdArray: Array<{ macd: number; signal: number; histogram: number }> = [];
      for (let i = 26; i < prices.length; i++) {
        const macdValue = this.calculateMACD(prices.slice(Math.max(0, i - 26), i + 1));
        macdArray.push(macdValue);
      }

      // Align arrays with historical data
      const alignedHistoricalData = this.historicalData.slice(-rsiArray.length);
      const divergence = DivergenceDetector.detect(alignedHistoricalData, rsiArray, macdArray);

      // RSI divergence
      if (divergence.rsiDivergence.bullish) {
        score += (divergence.rsiDivergence.strength / 100) * 7; // Bullish RSI divergence
      } else if (divergence.rsiDivergence.bearish) {
        score -= (divergence.rsiDivergence.strength / 100) * 7; // Bearish RSI divergence
      }

      // MACD divergence
      if (divergence.macdDivergence.bullish) {
        score += (divergence.macdDivergence.strength / 100) * 7; // Bullish MACD divergence
      } else if (divergence.macdDivergence.bearish) {
        score -= (divergence.macdDivergence.strength / 100) * 7; // Bearish MACD divergence
      }
    } catch (error) {
      console.warn('Divergence detection error:', error);
    }

    // 11. NEW: Price Action Patterns
    try {
      const patternAnalysis = PatternDetector.detect(this.historicalData);

      // Pattern signals
      if (patternAnalysis.overallSignal === 'bullish' && patternAnalysis.signalStrength > 60) {
        score += (patternAnalysis.signalStrength / 100) * 6; // Bullish patterns
      } else if (patternAnalysis.overallSignal === 'bearish' && patternAnalysis.signalStrength > 60) {
        score -= (patternAnalysis.signalStrength / 100) * 6; // Bearish patterns
      }

      // Strongest pattern bonus
      if (patternAnalysis.strongestPattern) {
        const pattern = patternAnalysis.strongestPattern;
        if (pattern.confidence > 70) {
          if (pattern.bullish || (pattern as any).bullish) {
            score += 3; // Strong bullish pattern
          } else {
            score -= 3; // Strong bearish pattern
          }
        }
      }
    } catch (error) {
      console.warn('Pattern detection error:', error);
    }

    // 12. NEW: Advanced Technical Indicators
    try {
      // OBV (On-Balance Volume)
      const obv = AdvancedIndicators.calculateOBV(this.historicalData);
      if (obv.signal === 'buy' && score > 50) {
        score += 3; // OBV confirms bullish trend
      } else if (obv.signal === 'sell' && score < 50) {
        score -= 3; // OBV confirms bearish trend
      }

      // VWAP (Volume-Weighted Average Price)
      const vwap = AdvancedIndicators.calculateVWAP(this.historicalData);
      if (vwap.signal === 'buy') {
        score += 2; // Price below VWAP = potential buy
      } else if (vwap.signal === 'sell') {
        score -= 2; // Price above VWAP = potential sell
      }

      // Stochastic Oscillator
      const stochastic = AdvancedIndicators.calculateStochastic(this.historicalData);
      if (stochastic.signal === 'oversold' && score > 50) {
        score += 4; // Oversold + bullish trend = buy opportunity
      } else if (stochastic.signal === 'overbought' && score < 50) {
        score -= 4; // Overbought + bearish trend = sell opportunity
      }

      // Ichimoku Cloud
      const ichimoku = AdvancedIndicators.calculateIchimoku(this.historicalData);
      if (ichimoku.signal === 'bullish' && ichimoku.cloud === 'above') {
        score += 5; // Strong bullish signal
      } else if (ichimoku.signal === 'bearish' && ichimoku.cloud === 'below') {
        score -= 5; // Strong bearish signal
      }
    } catch (error) {
      console.warn('Advanced indicators error:', error);
    }

    // ENHANCED: Add Fibonacci retracement analysis
    try {
      if (this.historicalData.length >= 50) {
        const recentHigh = Math.max(...prices.slice(-50));
        const recentLow = Math.min(...prices.slice(-50));
        const range = recentHigh - recentLow;
        
        if (range > 0) {
          const fib236 = recentHigh - (range * 0.236);
          const fib382 = recentHigh - (range * 0.382);
          const fib500 = recentHigh - (range * 0.5);
          const fib618 = recentHigh - (range * 0.618);
          
          // Check if price is near Fibonacci levels (within 0.1% of level)
          const tolerance = range * 0.001;
          if (Math.abs(currentPrice - fib382) < tolerance || Math.abs(currentPrice - fib618) < tolerance) {
            // Price at key Fibonacci level - potential reversal
            if (score > 50) score += 2; // Slight bullish bias
            else if (score < 50) score -= 2; // Slight bearish bias
          }
        }
      }
    } catch (error) {
      console.warn('Fibonacci analysis error:', error);
    }
    
    // ENHANCED: Add pivot point analysis
    try {
      if (this.historicalData.length >= 20) {
        const yesterdayData = this.historicalData.slice(-20, -1);
        if (yesterdayData.length > 0) {
          const high = Math.max(...yesterdayData.map(d => d.high));
          const low = Math.min(...yesterdayData.map(d => d.low));
          const close = yesterdayData[yesterdayData.length - 1].close;
          
          const pivot = (high + low + close) / 3;
          const r1 = 2 * pivot - low;
          const s1 = 2 * pivot - high;
          
          // Price above pivot = bullish, below = bearish
          if (currentPrice > pivot && currentPrice < r1) {
            score += 2; // Between pivot and R1 - bullish
          } else if (currentPrice < pivot && currentPrice > s1) {
            score -= 2; // Between pivot and S1 - bearish
          }
        }
      }
    } catch (error) {
      console.warn('Pivot point analysis error:', error);
    }

    // ENHANCED: Final validation and normalization
    score = Math.max(0, Math.min(100, score));
    
    // Add confidence boost if multiple indicators agree
    const indicatorAgreement = this.calculateIndicatorAgreement(prices, currentPrice);
    if (indicatorAgreement > 0.7) {
      // High agreement - boost score slightly
      score = score > 50 ? Math.min(100, score + 2) : Math.max(0, score - 2);
    }
    
    return score;
  }
  
  /**
   * Calculate indicator agreement (how many indicators agree on direction)
   * ENHANCED: More comprehensive agreement calculation
   */
  private calculateIndicatorAgreement(prices: number[], currentPrice: number): number {
    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalSignals = 0;
    
    try {
      // RSI
      const rsi = this.calculateRSI(prices);
      if (rsi < 30) bullishSignals++;
      else if (rsi > 70) bearishSignals++;
      totalSignals++;
      
      // MACD
      const macd = this.calculateMACD(prices);
      if (macd.histogram > 0 && macd.macd > macd.signal) bullishSignals++;
      else if (macd.histogram < 0 && macd.macd < macd.signal) bearishSignals++;
      totalSignals++;
      
      // EMA
      const ema20 = this.calculateEMA(prices, 20);
      const ema50 = this.calculateEMA(prices, 50);
      if (currentPrice > ema50 && ema20 > ema50) bullishSignals++;
      else if (currentPrice < ema50 && ema20 < ema50) bearishSignals++;
      totalSignals++;
      
      // ADX
      const adx = this.calculateADX(this.historicalData);
      if (adx.adx > 25) {
        if (adx.diPlus > adx.diMinus) bullishSignals++;
        else bearishSignals++;
        totalSignals++;
      }
      
      // Bollinger Bands
      const bb = this.calculateBollingerBands(prices);
      const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
      if (bbPosition < 0.2) bullishSignals++;
      else if (bbPosition > 0.8) bearishSignals++;
      totalSignals++;
    } catch (error) {
      // Ignore errors
    }
    
    if (totalSignals === 0) return 0;
    
    // Calculate agreement ratio
    const maxSignals = Math.max(bullishSignals, bearishSignals);
    return maxSignals / totalSignals;
  }

  // Fundamental Analysis - Using Alpha Vantage Economic Data
  private async fundamentalAnalysis(symbol: string): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      let usdScore = 50;
      let gbpScore = 50;
      let jpyScore = 50;
      let eurScore = 50;
      let audScore = 50;
      let cadScore = 50;
      let chfScore = 50;
      let nzdScore = 50;
      
      // Get US economic indicators (affects USD pairs)
      if (symbol.includes('USD')) {
        const indicators = await AlphaVantageProvider.getUSEconomicIndicators();
        
        // Interest Rate Analysis
        if (indicators.interestRate) {
          // Higher rates = stronger currency
          if (indicators.interestRate.value > 5) usdScore += 10;
          else if (indicators.interestRate.value > 3) usdScore += 5;
          else if (indicators.interestRate.value < 1) usdScore -= 5;
        }
        
        // Inflation Analysis (CPI)
        if (indicators.inflation) {
          // Moderate inflation (2-3%) is good, too high or too low is bad
          if (indicators.inflation.value >= 2 && indicators.inflation.value <= 3) usdScore += 5;
          else if (indicators.inflation.value > 5) usdScore -= 10;
          else if (indicators.inflation.value < 1) usdScore -= 5;
        }
        
        // Unemployment
        if (indicators.unemployment) {
          // Lower unemployment = stronger economy
          if (indicators.unemployment.value < 4) usdScore += 10;
          else if (indicators.unemployment.value < 5) usdScore += 5;
          else if (indicators.unemployment.value > 6) usdScore -= 10;
        }
        
        // Clamp USD score
        usdScore = Math.max(0, Math.min(100, usdScore));
      }
      
      // Fundamental Analysis for all currencies
      if (symbol.includes('GBP')) {
        gbpScore = await this.analyzeGBPFundamentals();
      }
      
      if (symbol.includes('JPY')) {
        jpyScore = await this.analyzeJPYFundamentals();
      }
      
      if (symbol.includes('EUR')) {
        eurScore = await this.analyzeEURFundamentals();
      }
      
      if (symbol.includes('AUD')) {
        audScore = await this.analyzeAUDFundamentals();
      }
      
      if (symbol.includes('CAD')) {
        cadScore = await this.analyzeCADFundamentals();
      }
      
      if (symbol.includes('CHF')) {
        chfScore = await this.analyzeCHFFundamentals();
      }
      
      if (symbol.includes('NZD')) {
        nzdScore = await this.analyzeNZDFundamentals();
      }
      
      // Normalize symbol format (handle both EUR/USD and EURUSD)
      const normalizedSymbol = symbol.replace('/', '').toUpperCase();
      
      // Extract base and quote currencies
      let baseCurrency = '';
      let quoteCurrency = '';
      
      // Determine base currency (first 3 characters)
      if (normalizedSymbol.startsWith('EUR')) {
        baseCurrency = 'EUR';
      } else if (normalizedSymbol.startsWith('GBP')) {
        baseCurrency = 'GBP';
      } else if (normalizedSymbol.startsWith('USD')) {
        baseCurrency = 'USD';
      } else if (normalizedSymbol.startsWith('AUD')) {
        baseCurrency = 'AUD';
      } else if (normalizedSymbol.startsWith('NZD')) {
        baseCurrency = 'NZD';
      } else if (normalizedSymbol.startsWith('CAD')) {
        baseCurrency = 'CAD';
      } else if (normalizedSymbol.startsWith('CHF')) {
        baseCurrency = 'CHF';
      } else if (normalizedSymbol.startsWith('JPY')) {
        baseCurrency = 'JPY';
      }
      
      // Determine quote currency (last 3 characters)
      if (normalizedSymbol.endsWith('EUR')) {
        quoteCurrency = 'EUR';
      } else if (normalizedSymbol.endsWith('GBP')) {
        quoteCurrency = 'GBP';
      } else if (normalizedSymbol.endsWith('USD')) {
        quoteCurrency = 'USD';
      } else if (normalizedSymbol.endsWith('AUD')) {
        quoteCurrency = 'AUD';
      } else if (normalizedSymbol.endsWith('NZD')) {
        quoteCurrency = 'NZD';
      } else if (normalizedSymbol.endsWith('CAD')) {
        quoteCurrency = 'CAD';
      } else if (normalizedSymbol.endsWith('CHF')) {
        quoteCurrency = 'CHF';
      } else if (normalizedSymbol.endsWith('JPY')) {
        quoteCurrency = 'JPY';
      }
      
      // Get scores for base and quote currencies
      let baseScore = 50;
      let quoteScoreValue = 50;
      
      if (baseCurrency === 'USD') baseScore = usdScore;
      else if (baseCurrency === 'GBP') baseScore = gbpScore;
      else if (baseCurrency === 'JPY') baseScore = jpyScore;
      else if (baseCurrency === 'EUR') baseScore = eurScore;
      else if (baseCurrency === 'AUD') baseScore = audScore;
      else if (baseCurrency === 'CAD') baseScore = cadScore;
      else if (baseCurrency === 'CHF') baseScore = chfScore;
      else if (baseCurrency === 'NZD') baseScore = nzdScore;
      
      if (quoteCurrency === 'USD') quoteScoreValue = usdScore;
      else if (quoteCurrency === 'GBP') quoteScoreValue = gbpScore;
      else if (quoteCurrency === 'JPY') quoteScoreValue = jpyScore;
      else if (quoteCurrency === 'EUR') quoteScoreValue = eurScore;
      else if (quoteCurrency === 'AUD') quoteScoreValue = audScore;
      else if (quoteCurrency === 'CAD') quoteScoreValue = cadScore;
      else if (quoteCurrency === 'CHF') quoteScoreValue = chfScore;
      else if (quoteCurrency === 'NZD') quoteScoreValue = nzdScore;
      
      // Calculate final score: base strength - quote strength
      // Higher base score relative to quote = bullish (higher final score)
      score = 50 + (baseScore - 50) - (quoteScoreValue - 50);
      
      console.log(`📊 Fundamental score for ${symbol}: ${score} (USD: ${usdScore}, GBP: ${gbpScore}, JPY: ${jpyScore}, EUR: ${eurScore}, AUD: ${audScore}, CAD: ${cadScore}, CHF: ${chfScore}, NZD: ${nzdScore})`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Fundamental analysis error:', error);
      return 50; // Return neutral on error
    }
  }

  /**
   * Helper: Analyze economic indicators for a currency
   */
  private async analyzeEconomicIndicators(currency: string): Promise<number> {
    let score = 0;
    
    try {
      const indicators = await TradingEconomicsIndicatorsProvider.getAllIndicators(currency);
      
      // Interest Rate Analysis (most important)
      if (indicators.interestRate) {
        if (indicators.interestRate.rate > 5) score += 10;
        else if (indicators.interestRate.rate > 3) score += 5;
        else if (indicators.interestRate.rate < 1) score -= 5;
      }
      
      // Inflation Analysis (CPI)
      if (indicators.cpi) {
        if (indicators.cpi.value >= 2 && indicators.cpi.value <= 3) score += 5;
        else if (indicators.cpi.value > 5) score -= 10;
        else if (indicators.cpi.value < 1) score -= 5;
      }
      
      // GDP Growth
      if (indicators.gdp) {
        if (indicators.gdp.value > 2) score += 5;
        else if (indicators.gdp.value > 0) score += 2;
        else if (indicators.gdp.value < -1) score -= 10;
        else if (indicators.gdp.value < 0) score -= 5;
      }
      
      // Unemployment
      if (indicators.unemployment) {
        if (indicators.unemployment.value < 4) score += 10;
        else if (indicators.unemployment.value < 5) score += 5;
        else if (indicators.unemployment.value > 6) score -= 10;
      }
    } catch (error) {
      console.warn(`Economic indicators analysis error for ${currency}:`, error);
    }
    
    return score;
  }

  // NEW: Analyze GBP fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeGBPFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('GBP');
      
      // Get economic calendar events for UK (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for UK/GBP events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ukEvents = events.filter(e => 
        e.currency === 'GBP' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of ukEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          // If actual > forecast, positive for GBP
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 2; // Reduced weight since we have indicators now
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 2;
          }
        }
      }
      
      // Get GBP/USD rate to infer strength (relative to USD)
      const gbpUsdRate = await AlphaVantageProvider.getForexRate('GBP', 'USD');
      if (gbpUsdRate) {
        // If GBP/USD is above 1.25, GBP is relatively strong
        if (gbpUsdRate.rate > 1.30) score += 3;
        else if (gbpUsdRate.rate > 1.25) score += 2;
        else if (gbpUsdRate.rate < 1.20) score -= 3;
        else if (gbpUsdRate.rate < 1.15) score -= 5;
      }
      
      // Get news sentiment for GBP (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('GBP');
      if (sentiment.articleCount > 0) {
        // Sentiment score is -100 to +100, convert to 0-100
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.15; // 15% weight
      }
      
      console.log(`🇬🇧 GBP Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('GBP fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze JPY fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeJPYFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics (with JPY-specific adjustments)
      const indicators = await TradingEconomicsIndicatorsProvider.getAllIndicators('JPY');
      
      // Interest Rate Analysis (BOJ rates are typically very low/negative)
      if (indicators.interestRate) {
        // For JPY, very low rates are normal (often negative)
        if (indicators.interestRate.rate > 0) score += 5;
        else if (indicators.interestRate.rate > -0.5) score += 2;
        else if (indicators.interestRate.rate < -1) score -= 5;
      }
      
      // Inflation Analysis (CPI) - Japan has struggled with deflation
      if (indicators.cpi) {
        // For Japan, positive inflation (even low) is good (fights deflation)
        if (indicators.cpi.value >= 1 && indicators.cpi.value <= 2) score += 5;
        else if (indicators.cpi.value > 0 && indicators.cpi.value < 1) score += 2;
        else if (indicators.cpi.value < 0) score -= 10; // Deflation is bad
        else if (indicators.cpi.value > 3) score -= 5;
      }
      
      // GDP Growth
      if (indicators.gdp) {
        if (indicators.gdp.value > 2) score += 5;
        else if (indicators.gdp.value > 0) score += 2;
        else if (indicators.gdp.value < -1) score -= 10;
        else if (indicators.gdp.value < 0) score -= 5;
      }
      
      // Unemployment
      if (indicators.unemployment) {
        if (indicators.unemployment.value < 3) score += 10;
        else if (indicators.unemployment.value < 4) score += 5;
        else if (indicators.unemployment.value > 5) score -= 10;
      }
      
      // Get economic calendar events for Japan (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for Japan/JPY events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const jpyEvents = events.filter(e => 
        e.currency === 'JPY' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of jpyEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          // For JPY, stronger economy = stronger JPY (but JPY is often safe-haven)
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 2; // JPY reacts less to positive data (safe-haven status)
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3; // JPY weakens on negative data
          }
        }
      }
      
      // Get USD/JPY rate to infer JPY strength (inverse relationship)
      const usdJpyRate = await AlphaVantageProvider.getForexRate('USD', 'JPY');
      if (usdJpyRate) {
        // Lower USD/JPY = stronger JPY
        // If USD/JPY is below 140, JPY is relatively strong
        if (usdJpyRate.rate < 130) score += 5; // Very strong JPY
        else if (usdJpyRate.rate < 140) score += 3;
        else if (usdJpyRate.rate > 150) score -= 5; // Weak JPY
        else if (usdJpyRate.rate > 155) score -= 8;
      }
      
      // JPY is a safe-haven currency - check risk sentiment
      // If risk-off sentiment, JPY strengthens (but this is complex)
      // For now, we'll use news sentiment (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('JPY');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.15; // 15% weight (less than GBP)
      }
      
      console.log(`🇯🇵 JPY Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('JPY fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze EUR fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeEURFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('EUR');
      
      // Get economic calendar events for EU/Eurozone (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for EU/EUR events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const eurEvents = events.filter(e => 
        e.currency === 'EUR' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of eurEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 3;
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3;
          }
        }
      }
      
      // Get EUR/USD rate to infer strength (relative to USD)
      const eurUsdRate = await AlphaVantageProvider.getForexRate('EUR', 'USD');
      if (eurUsdRate) {
        if (eurUsdRate.rate > 1.10) score += 5;
        else if (eurUsdRate.rate > 1.05) score += 3;
        else if (eurUsdRate.rate < 1.00) score -= 5;
        else if (eurUsdRate.rate < 0.95) score -= 8;
      }
      
      // Get news sentiment for EUR (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('EUR');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.2;
      }
      
      console.log(`🇪🇺 EUR Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('EUR fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze AUD fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeAUDFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('AUD');
      
      // Get economic calendar events for Australia (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for AU/AUD events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const audEvents = events.filter(e => 
        e.currency === 'AUD' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of audEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 3;
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3;
          }
        }
      }
      
      // Get AUD/USD rate to infer strength (relative to USD)
      const audUsdRate = await AlphaVantageProvider.getForexRate('AUD', 'USD');
      if (audUsdRate) {
        if (audUsdRate.rate > 0.70) score += 5;
        else if (audUsdRate.rate > 0.65) score += 3;
        else if (audUsdRate.rate < 0.60) score -= 5;
        else if (audUsdRate.rate < 0.55) score -= 8;
      }
      
      // Get news sentiment for AUD (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('AUD');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.2;
      }
      
      console.log(`🇦🇺 AUD Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('AUD fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze CAD fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeCADFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('CAD');
      
      // Get economic calendar events for Canada (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for CA/CAD events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const cadEvents = events.filter(e => 
        e.currency === 'CAD' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of cadEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 3;
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3;
          }
        }
      }
      
      // Get USD/CAD rate to infer CAD strength (inverse relationship)
      const usdCadRate = await AlphaVantageProvider.getForexRate('USD', 'CAD');
      if (usdCadRate) {
        // Lower USD/CAD = stronger CAD
        if (usdCadRate.rate < 1.30) score += 5;
        else if (usdCadRate.rate < 1.35) score += 3;
        else if (usdCadRate.rate > 1.40) score -= 5;
        else if (usdCadRate.rate > 1.45) score -= 8;
      }
      
      // Get news sentiment for CAD (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('CAD');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.2;
      }
      
      console.log(`🇨🇦 CAD Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('CAD fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze CHF fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeCHFFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('CHF');
      
      // Get economic calendar events for Switzerland (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for CH/CHF events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const chfEvents = events.filter(e => 
        e.currency === 'CHF' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of chfEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 3;
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3;
          }
        }
      }
      
      // Get USD/CHF rate to infer CHF strength (inverse relationship)
      const usdChfRate = await AlphaVantageProvider.getForexRate('USD', 'CHF');
      if (usdChfRate) {
        // Lower USD/CHF = stronger CHF
        if (usdChfRate.rate < 0.85) score += 5;
        else if (usdChfRate.rate < 0.90) score += 3;
        else if (usdChfRate.rate > 0.95) score -= 5;
        else if (usdChfRate.rate > 1.00) score -= 8;
      }
      
      // Get news sentiment for CHF (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('CHF');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.2;
      }
      
      console.log(`🇨🇭 CHF Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('CHF fundamental analysis error:', error);
      return 50;
    }
  }

  // NEW: Analyze NZD fundamentals using economic calendar, forex rates, and economic indicators
  private async analyzeNZDFundamentals(): Promise<number> {
    try {
      let score = 50; // Neutral starting point
      
      // Get economic indicators from Trading Economics
      score += await this.analyzeEconomicIndicators('NZD');
      
      // Get economic calendar events for New Zealand (free RSS first, fallback to paid)
      const events = await this.getEconomicCalendarEvents();
      
      // Filter for NZ/NZD events in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const nzdEvents = events.filter(e => 
        e.currency === 'NZD' && 
        e.date >= thirtyDaysAgo &&
        e.impact === 'HIGH'
      );
      
      // Analyze recent high-impact events
      let positiveEvents = 0;
      let negativeEvents = 0;
      
      for (const event of nzdEvents) {
        if (event.actual !== undefined && event.forecast !== undefined) {
          if (event.actual > event.forecast) {
            positiveEvents++;
            score += 3;
          } else if (event.actual < event.forecast) {
            negativeEvents++;
            score -= 3;
          }
        }
      }
      
      // Get NZD/USD rate to infer strength (relative to USD)
      const nzdUsdRate = await AlphaVantageProvider.getForexRate('NZD', 'USD');
      if (nzdUsdRate) {
        if (nzdUsdRate.rate > 0.65) score += 5;
        else if (nzdUsdRate.rate > 0.60) score += 3;
        else if (nzdUsdRate.rate < 0.55) score -= 5;
        else if (nzdUsdRate.rate < 0.50) score -= 8;
      }
      
      // Get news sentiment for NZD (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment('NZD');
      if (sentiment.articleCount > 0) {
        const sentimentScore = (sentiment.score + 100) / 2;
        score += (sentimentScore - 50) * 0.2;
      }
      
      console.log(`🇳🇿 NZD Fundamentals: Score ${score} (${positiveEvents} positive, ${negativeEvents} negative events)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('NZD fundamental analysis error:', error);
      return 50;
    }
  }

  // Sentiment Analysis - Using NewsData.io
  private async sentimentAnalysis(symbol: string): Promise<number> {
    try {
      // Get news sentiment (free RSS first, fallback to paid)
      const sentiment = await this.getNewsSentiment(symbol);
      
      if (sentiment.articleCount === 0) {
        console.log(`📰 No news data for ${symbol}, returning neutral`);
        return 50;
      }
      
      // Convert -100 to 100 score to 0 to 100
      const score = (sentiment.score + 100) / 2;
      
      console.log(`📰 Sentiment for ${symbol}: ${sentiment.score} (${sentiment.bullish}% bullish, ${sentiment.bearish}% bearish, ${sentiment.articleCount} articles)`);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return 50; // Return neutral on error
    }
  }

  // Calculate optimal stop loss and take profit
  private calculateOptimalLevels(symbol: string, recommendation: string): { stopLoss: number; takeProfit: number } {
    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    const volatility = this.calculateVolatility(this.historicalData);
    
    // Base levels on volatility (ATR-based)
    const atr = this.calculateATR(this.historicalData);
    const stopDistance = atr * 1.5; // 1.5x ATR for stop loss
    const rewardDistance = atr * 3; // 3x ATR for take profit (1:2 risk-reward)

    let stopLoss, takeProfit;

    if (recommendation.includes('BUY')) {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + rewardDistance;
    } else if (recommendation.includes('SELL')) {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - rewardDistance;
    } else {
      // For HOLD, still calculate levels for potential entry
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + rewardDistance;
    }

    // Round to appropriate decimal places
    const decimalPlaces = symbol.includes('JPY') ? 2 : 4;
    return {
      stopLoss: Number(stopLoss.toFixed(decimalPlaces)),
      takeProfit: Number(takeProfit.toFixed(decimalPlaces))
    };
  }

  // Calculate position size based on volatility and risk (PHASE 1: Enhanced with ATR)
  private async calculatePositionSizeWithVolatility(
    symbol: string,
    stopLoss: number,
    takeProfit: number,
    currentATR: number,
    baseATR: number
  ): Promise<number> {
    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    
    // Use RiskCalculator with volatility adjustment
    const { RiskCalculator } = await import('./risk-calculator');
    const { TradingModeManager } = await import('./trading-mode');
    
    const result = await RiskCalculator.calculateTradeSize(
      currentPrice,
      stopLoss,
      symbol,
      currentATR,
      baseATR
    );
    
    // CRITICAL SAFETY: Cap position size at 200 lots maximum
    // Also check if result is valid
    if (!result.isValid || result.lotSize <= 0) {
      // CRITICAL FIX: If calculation failed, return safe default based on account balance
      // For small accounts, use minimum lot size (0.01)
      // For larger accounts, use a conservative default (0.1 lots)
      const balance = TradingModeManager.getCurrentBalance();
      if (balance <= 0 || balance < 1000) {
        // Small accounts: use minimum lot size
        return 0.01;
      } else {
        // Larger accounts: use conservative default (0.1 lots = $10k position)
        return 0.1;
      }
    }
    
    // Cap at 200 lots absolute maximum
    return Math.min(result.lotSize, 200);
  }

  // Legacy method for backward compatibility
  private calculatePositionSize(symbol: string, stopLoss: number, takeProfit: number): number {
    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    const riskDistance = Math.abs(currentPrice - stopLoss);
    const accountBalance = 100000; // Demo balance
    
    // Risk 1.5% of account per trade
    const riskAmount = accountBalance * 0.015;
    
    // Calculate position size
    const pipValue = riskAmount / (riskDistance * 10000);
    const lotSize = Math.max(0.01, (pipValue * 100000) / 10);
    
    return Number(lotSize.toFixed(2));
  }

  // Technical indicator calculations
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    const slice = prices.slice(-period);
    const mean = slice.reduce((sum, price) => sum + price, 0) / period;
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: mean + (stdDev * 2),
      middle: mean,
      lower: mean - (stdDev * 2)
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  }

  private calculateATR(prices: PriceData[], period: number = 14): number {
    if (prices.length < 2) {
      // Return default ATR for EURUSD if no data (60-80 pips = 0.006-0.008)
      return 0.007;
    }
    
    const trueRanges: number[] = [];
    
    // CRITICAL FIX: Ensure we have proper OHLC data
    // Start from index 1 to have previous close
    const startIndex = Math.max(1, prices.length - period - 1);
    
    for (let i = startIndex; i < prices.length; i++) {
      const high = prices[i].high || prices[i].close;
      const low = prices[i].low || prices[i].close;
      const previousClose = i > 0 ? (prices[i - 1].close || prices[i].close) : prices[i].close;
      
      // Validate that we have meaningful price differences
      if (high <= 0 || low <= 0 || previousClose <= 0) {
        continue; // Skip invalid data points
      }
      
      const tr = Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      );
      
      // CRITICAL: Validate TR is reasonable (EURUSD should be 0.0001 to 0.02)
      if (tr > 0 && tr < 0.1) {
        trueRanges.push(tr);
      }
    }
    
    if (trueRanges.length === 0) {
      // Return default ATR if calculation failed
      return 0.007; // 70 pips default for EURUSD
    }
    
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    
    // CRITICAL: Validate ATR is in reasonable range
    // EURUSD ATR should be 0.006-0.010 (60-100 pips) normally
    // If calculated ATR is way off, return default
    // CRITICAL FIX: Reject ATR < 0.001 (10 pips) as it's too small for EURUSD
    if (atr < 0.001 || atr > 0.02) {
      console.warn(`⚠️ Calculated ATR ${atr.toFixed(5)} is outside normal range (0.001-0.02). Using default 0.007 (70 pips).`);
      return 0.007; // Default to 70 pips
    }
    
    return atr;
  }

  private calculateVolatility(prices: PriceData[]): number {
    if (prices.length < 2) return 0.01;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const returnVal = (prices[i].close - prices[i-1].close) / prices[i-1].close;
      returns.push(returnVal);
    }
    
    if (returns.length === 0) return 0.01;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private analyzeSupportResistance(prices: number[], currentPrice: number): number {
    if (prices.length < 10) return 0;
    
    // Simplified support/resistance analysis
    // In reality, you'd use more sophisticated methods
    const recentHigh = Math.max(...prices.slice(-10));
    const recentLow = Math.min(...prices.slice(-10));
    
    const distanceToHigh = (recentHigh - currentPrice) / currentPrice;
    const distanceToLow = (currentPrice - recentLow) / currentPrice;
    
    if (distanceToHigh < 0.01) return -10; // Near resistance
    if (distanceToLow < 0.01) return 10;   // Near support
    
    return 0;
  }

  // NEW: Calculate ADX (Average Directional Index) - Trend Strength Indicator
  private calculateADX(priceData: PriceData[], period: number = 14): { adx: number; diPlus: number; diMinus: number } {
    if (priceData.length < period + 1) {
      return { adx: 0, diPlus: 0, diMinus: 0 };
    }

    const trueRanges: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    // Calculate True Range, +DM, -DM
    for (let i = 1; i < priceData.length; i++) {
      const high = priceData[i].high;
      const low = priceData[i].low;
      const prevHigh = priceData[i - 1].high;
      const prevLow = priceData[i - 1].low;
      const prevClose = priceData[i - 1].close;

      // True Range
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);

      // Directional Movement
      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }

    // Calculate smoothed averages
    const atr = this.calculateATR(priceData, period);
    const sliceStart = Math.max(0, trueRanges.length - period);
    const plusDMAvg = plusDM.slice(sliceStart).reduce((sum, val) => sum + val, 0) / period;
    const minusDMAvg = minusDM.slice(sliceStart).reduce((sum, val) => sum + val, 0) / period;

    // Calculate DI+ and DI-
    const diPlus = atr > 0 ? (plusDMAvg / atr) * 100 : 0;
    const diMinus = atr > 0 ? (minusDMAvg / atr) * 100 : 0;

    // Calculate DX
    const dx = (diPlus + diMinus) > 0 ? Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100 : 0;

    // ADX is smoothed DX (simplified - using current DX as approximation)
    const adx = dx;

    return { adx, diPlus, diMinus };
  }

  // NEW: Calculate Rate of Change (ROC) - Momentum Indicator
  private calculateROC(prices: number[], period: number = 10): number {
    if (prices.length < period + 1) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    if (pastPrice === 0) return 0;
    
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  private generateRecommendation(score: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 60) return 'BUY';
    if (score >= 40) return 'HOLD';
    if (score >= 20) return 'SELL';
    return 'STRONG_SELL';
  }

  private calculateConfidence(overallScore: number, technicalScore: number): number {
    // Improved confidence calculation - more reasonable scaling
    // Score 50 = 0%, Score 60 = 40%, Score 70 = 60%, Score 80 = 80%, Score 90+ = 95%+
    const distanceFromNeutral = Math.abs(overallScore - 50);
    
    // Use a more generous scaling: 0-50 distance maps to 0-100% confidence
    // This means score 60 = 40% confidence, score 70 = 60%, score 80 = 80%
    let baseConfidence = (distanceFromNeutral / 50) * 100;
    
    // Add bonus for strong technical alignment
    const technicalDistance = Math.abs(technicalScore - 50);
    let technicalBonus = 0;
    
    if (technicalDistance > 40) {
      technicalBonus = 15; // Very strong technical signal
    } else if (technicalDistance > 30) {
      technicalBonus = 10; // Strong technical signal
    } else if (technicalDistance > 20) {
      technicalBonus = 5; // Moderate technical signal
    }
    
    // Add bonus if technical and overall score agree (both bullish or both bearish)
    const scoreDirection = overallScore > 50 ? 1 : -1;
    const technicalDirection = technicalScore > 50 ? 1 : -1;
    if (scoreDirection === technicalDirection && technicalDistance > 15) {
      technicalBonus += 5; // Bonus for alignment
    }
    
    // Cap at 100%
    return Math.min(100, Math.max(0, baseConfidence + technicalBonus));
  }

  private assessRiskLevel(symbol: string, recommendation: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const volatility = this.calculateVolatility(this.historicalData);
    
    if (volatility < 0.005) return 'LOW';
    if (volatility < 0.01) return 'MEDIUM';
    return 'HIGH';
  }

  private generateReasoning(technical: number, fundamental: number, sentiment: number): string[] {
    const reasoning: string[] = [];
    
    if (technical > 70) reasoning.push('Strong technical bullish signals');
    else if (technical < 30) reasoning.push('Strong technical bearish signals');
    
    if (fundamental > 70) reasoning.push('Positive fundamental outlook');
    else if (fundamental < 30) reasoning.push('Negative fundamental factors');
    
    if (sentiment > 70) reasoning.push('Bullish market sentiment');
    else if (sentiment < 30) reasoning.push('Bearish market sentiment');
    
    if (reasoning.length === 0) reasoning.push('Mixed signals - neutral outlook');
    
    return reasoning;
  }

  // PHASE 1: Enhanced detailed reasoning
  private generateDetailedReasoning(
    symbol: string,
    technical: number,
    fundamental: number,
    sentiment: number,
    atr: number,
    regimeAnalysis?: any
  ): {
    technical: string[];
    fundamental: string[];
    sentiment: string[];
    risk: string[];
  } {
    const prices = this.historicalData.map(d => d.close);
    const currentPrice = prices[prices.length - 1];
    
    const technicalReasons: string[] = [];
    const fundamentalReasons: string[] = [];
    const sentimentReasons: string[] = [];
    const riskReasons: string[] = [];

    // Technical details
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const bb = this.calculateBollingerBands(prices);
    const ema50 = this.calculateEMA(prices, 50);
    const ema20 = this.calculateEMA(prices, 20);
    
    if (rsi < 30) technicalReasons.push(`RSI at ${rsi.toFixed(1)} - Oversold condition (bullish signal)`);
    else if (rsi > 70) technicalReasons.push(`RSI at ${rsi.toFixed(1)} - Overbought condition (bearish signal)`);
    else technicalReasons.push(`RSI at ${rsi.toFixed(1)} - Neutral zone`);
    
    if (macd.histogram > 0 && macd.macd > macd.signal) {
      technicalReasons.push(`MACD bullish crossover - Histogram: ${macd.histogram.toFixed(5)}`);
    } else if (macd.histogram < 0 && macd.macd < macd.signal) {
      technicalReasons.push(`MACD bearish crossover - Histogram: ${macd.histogram.toFixed(5)}`);
    }
    
    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (bbPosition < 0.2) technicalReasons.push(`Price near lower Bollinger Band (${bbPosition.toFixed(2)}) - Potential bounce`);
    else if (bbPosition > 0.8) technicalReasons.push(`Price near upper Bollinger Band (${bbPosition.toFixed(2)}) - Potential reversal`);
    
    // CRITICAL FIX: Check trend strength before claiming "uptrend/downtrend confirmed"
    // Only confirm trend if trend strength is > 40% (moderate or strong)
    const trendStrength = regimeAnalysis?.trendStrength || 0;
    if (currentPrice > ema50 && ema20 > ema50) {
      if (trendStrength > 40) {
        technicalReasons.push(`Price above EMA50 (${ema50.toFixed(5)}) and EMA20 (${ema20.toFixed(5)}) - Uptrend confirmed (${trendStrength.toFixed(0)}% strength)`);
      } else {
        technicalReasons.push(`Price above EMA50 (${ema50.toFixed(5)}) and EMA20 (${ema20.toFixed(5)}) - Weak uptrend (${trendStrength.toFixed(0)}% strength, not confirmed)`);
      }
    } else if (currentPrice < ema50 && ema20 < ema50) {
      if (trendStrength > 40) {
        technicalReasons.push(`Price below EMA50 (${ema50.toFixed(5)}) and EMA20 (${ema20.toFixed(5)}) - Downtrend confirmed (${trendStrength.toFixed(0)}% strength)`);
      } else {
        technicalReasons.push(`Price below EMA50 (${ema50.toFixed(5)}) and EMA20 (${ema20.toFixed(5)}) - Weak downtrend (${trendStrength.toFixed(0)}% strength, not confirmed)`);
      }
    } else {
      technicalReasons.push(`Price between EMA50 (${ema50.toFixed(5)}) and EMA20 (${ema20.toFixed(5)}) - No clear trend direction`);
    }

    // Fundamental details
    if (fundamental > 70) fundamentalReasons.push('Strong fundamental factors support bullish outlook');
    else if (fundamental < 30) fundamentalReasons.push('Weak fundamental factors suggest bearish outlook');
    else fundamentalReasons.push('Fundamental factors are neutral');

    // Sentiment details
    if (sentiment > 70) sentimentReasons.push('Market sentiment is bullish');
    else if (sentiment < 30) sentimentReasons.push('Market sentiment is bearish');
    else sentimentReasons.push('Market sentiment is neutral');

    // Risk details
    const volatility = this.calculateVolatility(this.historicalData);
    // CRITICAL FIX: Add current price for entry reference
    riskReasons.push(`Current Price: ${currentPrice.toFixed(5)}`);
    // CRITICAL FIX: Display ATR in pips for better readability
    // CRITICAL FIX: Correct volatility classification for EURUSD
    // Normal EURUSD ATR: 60-100 pips (0.006-0.010)
    // Low: < 50 pips, Medium: 50-100 pips, High: > 100 pips
    const atrInPips = atr * 10000; // Convert to pips (0.0001 = 1 pip)
    let volatilityLabel: string;
    if (atrInPips < 50) {
      volatilityLabel = 'Low';
    } else if (atrInPips <= 100) {
      volatilityLabel = 'Normal'; // Changed from "Medium" - 70 pips is normal for EURUSD
    } else {
      volatilityLabel = 'High';
    }
    riskReasons.push(`Current ATR: ${atrInPips.toFixed(1)} pips (${atr.toFixed(5)}) - ${volatilityLabel} volatility`);
    riskReasons.push(`Price volatility: ${(volatility * 100).toFixed(2)}%`);
    
    // Warn if ATR seems incorrect
    if (atr < 0.001) {
      riskReasons.push('⚠️ WARNING: ATR is unusually low. This may indicate data quality issues.');
    }
    
    if (atrInPips > 100) {
      riskReasons.push('⚠️ High volatility detected (>100 pips) - Position size will be reduced to maintain constant risk');
    }

    return {
      technical: technicalReasons,
      fundamental: fundamentalReasons,
      sentiment: sentimentReasons,
      risk: riskReasons
    };
  }

  /**
   * Get GPT-5.1 chart analysis and convert to score
   * This uses GPT-5.1's text analysis capabilities to analyze price data
   * Optionally uses chart vision if chart image is available (frontend only)
   * Returns a score (0-100) and analysis details
   */
  private async getGPTChartAnalysis(
    symbol: string,
    chartImageBase64?: string
  ): Promise<MarketAnalysis['gptChartAnalysis'] | undefined> {
    if (!isOpenAIConfigured() || this.historicalData.length < 20) {
      return undefined;
    }

    try {
      // If chart image is available (from frontend), use vision analysis for better accuracy
      if (chartImageBase64 && typeof window !== 'undefined') {
        try {
          const { analyzeChartImage } = await import('./openai-service');
          const visionAnalysis = await analyzeChartImage(chartImageBase64, symbol, 'H1');
          
          if (visionAnalysis) {
            // Convert vision analysis to score
            let score = 50;
            const trendStrength = visionAnalysis.trend?.strength || 0;
            const direction = visionAnalysis.trend?.direction || 'neutral';
            const recommendation = visionAnalysis.recommendation || '';
            
            // Parse recommendation from vision analysis
            if (recommendation.includes('STRONG_BUY') || recommendation.includes('BUY')) {
              score = direction === 'bullish' 
                ? 70 + (trendStrength / 100) * 30 
                : 50 + (trendStrength / 100) * 20;
            } else if (recommendation.includes('STRONG_SELL') || recommendation.includes('SELL')) {
              score = direction === 'bearish'
                ? 30 - (trendStrength / 100) * 30
                : 50 - (trendStrength / 100) * 20;
            } else {
              // HOLD or neutral
              score = direction === 'bullish'
                ? 50 + (trendStrength / 100) * 10
                : direction === 'bearish'
                ? 50 - (trendStrength / 100) * 10
                : 50;
            }
            
            score = Math.max(0, Math.min(100, score));
            
            return {
              score: Math.round(score),
              recommendation: recommendation || 'HOLD',
              trend: {
                direction: direction as 'bullish' | 'bearish' | 'neutral',
                strength: Math.round(trendStrength),
              },
              confidence: Math.round(trendStrength), // Use trend strength as confidence
            };
          }
        } catch (visionError) {
          console.debug('Chart vision analysis failed, falling back to text analysis:', visionError);
          // Fall through to text-based analysis
        }
      }
      
      // Fallback to text-based analysis (always available)
      // Prepare price data summary for GPT-5.1 analysis
      const prices = this.historicalData.map(d => d.close);
      const currentPrice = prices[prices.length - 1];
      const recentPrices = prices.slice(-50); // Last 50 periods
      const priceChange = ((currentPrice - recentPrices[0]) / recentPrices[0]) * 100;
      
      // Calculate basic indicators for context
      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      const ema20 = this.calculateEMA(prices, 20);
      const ema50 = this.calculateEMA(prices, 50);
      
      // Create a text-based analysis prompt for GPT-5.1
      const analysisPrompt = `Analyze this forex pair (${symbol}) based on the following data:

Current Price: ${currentPrice.toFixed(5)}
Price Change (last 50 periods): ${priceChange.toFixed(2)}%
RSI (14): ${rsi.toFixed(2)}
MACD: ${macd.macd.toFixed(5)} (Signal: ${macd.signal.toFixed(5)}, Histogram: ${macd.histogram.toFixed(5)})
EMA 20: ${ema20.toFixed(5)}
EMA 50: ${ema50.toFixed(5)}
Price vs EMA 20: ${currentPrice > ema20 ? 'Above' : 'Below'} (${((currentPrice - ema20) / ema20 * 100).toFixed(2)}%)
Price vs EMA 50: ${currentPrice > ema50 ? 'Above' : 'Below'} (${((currentPrice - ema50) / ema50 * 100).toFixed(2)}%)

Recent Price Action (last 20 periods):
${recentPrices.slice(-20).map((p, i) => `${i + 1}. ${p.toFixed(5)}`).join('\n')}

Based on this data, provide:
1. Trend direction (bullish/bearish/neutral)
2. Trend strength (0-100%)
3. Overall recommendation (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
4. Confidence level (0-100%)

Respond in JSON format:
{
  "trend": {
    "direction": "bullish|bearish|neutral",
    "strength": 0-100
  },
  "recommendation": "STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL",
  "confidence": 0-100
}`;

      // Call GPT-5.1 via OpenAI service (text-based analysis)
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [
            {
              role: 'system',
              content: 'You are an expert forex technical analyst. Analyze price data and provide accurate trend analysis and trading recommendations. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          temperature: 0.3,
          max_completion_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        console.warn('GPT-5.1 analysis request failed:', response.status);
        return undefined;
      }

      const data = await response.json();
      const jsonText = data.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(jsonText);

      // Convert GPT-5.1 recommendation to score (0-100)
      let score = 50; // Neutral starting point
      const trendStrength = analysis.trend?.strength || 0;
      const direction = analysis.trend?.direction || 'neutral';
      const recommendation = analysis.recommendation || 'HOLD';
      const confidence = analysis.confidence || 50;

      // Convert recommendation to score
      switch (recommendation) {
        case 'STRONG_BUY':
          score = 85 + (trendStrength / 100) * 15; // 85-100
          break;
        case 'BUY':
          score = 65 + (trendStrength / 100) * 20; // 65-85
          break;
        case 'HOLD':
          score = 40 + (trendStrength / 100) * 20; // 40-60
          break;
        case 'SELL':
          score = 15 + (trendStrength / 100) * 25; // 15-40
          break;
        case 'STRONG_SELL':
          score = 0 + (trendStrength / 100) * 15; // 0-15
          break;
        default:
          score = 50;
      }

      // Adjust score based on trend direction if recommendation is HOLD
      if (recommendation === 'HOLD') {
        if (direction === 'bullish') {
          score += 5; // Slight bullish bias
        } else if (direction === 'bearish') {
          score -= 5; // Slight bearish bias
        }
      }

      // Clamp score to 0-100
      score = Math.max(0, Math.min(100, score));

      return {
        score: Math.round(score),
        recommendation,
        trend: {
          direction: direction as 'bullish' | 'bearish' | 'neutral',
          strength: Math.round(trendStrength),
        },
        confidence: Math.round(confidence),
      };
    } catch (error) {
      console.warn('GPT-5.1 chart analysis error:', error);
      return undefined;
    }
  }

  private async loadHistoricalData(symbol: string): Promise<void> {
    try {
      // Try MT5 first (free, unlimited, direct from broker)
      let data = await MT5PriceDataProvider.getHistoricalData(symbol, 'H1', 100);
      
      // Fallback to TwelveData if MT5 doesn't have historical data yet
      if (data.length === 0) {
        data = await TwelveDataProvider.getHistoricalData(symbol, '1h', 100);
        if (data.length > 0) {
          console.log(`✅ Loaded ${data.length} candles for ${symbol} from TwelveData (fallback)`);
        }
      } else {
        console.log(`✅ Loaded ${data.length} candles for ${symbol} from MT5`);
      }
      
      if (data.length > 0) {
        this.historicalData = data;
      } else {
        console.warn(`⚠️ No historical data available for ${symbol}`);
        this.historicalData = [];
      }
    } catch (error) {
      console.error(`Error loading historical data for ${symbol}:`, error);
      this.historicalData = [];
    }
  }
}

export const aiTradingEngine = new AITradingEngine();

