/**
 * ML-Based Regime Detection
 * Uses statistical pattern recognition and classification to identify market regimes
 */

import { PriceData } from '@/types/trading';
import { RegimeDetector, RegimeAnalysis, MarketRegime } from './regime-detector';

interface RegimeFeatures {
  volatility: number;
  trendStrength: number;
  rangeStrength: number;
  momentum: number;
  volumeTrend: number;
  priceRange: number;
  adx: number; // Average Directional Index
  rsi: number; // Relative Strength Index
  emaAlignment: number; // EMA alignment score (0-100)
  supportResistance: number; // Support/resistance strength
}

interface RegimePattern {
  features: RegimeFeatures;
  regime: MarketRegime;
  confidence: number;
  timestamp: number;
}

interface MultiTimeframeRegime {
  h1: MarketRegime;
  h4: MarketRegime;
  d1: MarketRegime;
  alignment: 'aligned' | 'mixed' | 'conflicting';
  confidence: number;
}

interface RegimeTransition {
  from: MarketRegime;
  to: MarketRegime;
  strength: number; // 0-100
  timeframe: number; // Bars since transition started
}

export class MLRegimeDetector {
  private static PATTERN_DATABASE: RegimePattern[] = [];
  private static readonly MIN_PATTERNS = 10;
  private static readonly REGIME_HISTORY: Array<{ regime: MarketRegime; timestamp: number; confidence: number }> = [];
  private static readonly MAX_HISTORY = 100;
  private static readonly STORAGE_KEY = 'ml_regime_patterns';
  private static readonly MAX_PATTERNS = 500; // Limit database size
  private static initialized = false;

  /**
   * Initialize pattern database from localStorage
   */
  private static initializePatternDatabase(): void {
    if (this.initialized) return;
    
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.PATTERN_DATABASE = parsed;
            console.log(`✅ Loaded ${this.PATTERN_DATABASE.length} regime patterns from storage`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load pattern database from storage:', error);
      this.PATTERN_DATABASE = [];
    }
    
    this.initialized = true;
  }

  /**
   * Save pattern database to localStorage
   */
  private static savePatternDatabase(): void {
    try {
      if (typeof window !== 'undefined') {
        // Keep only most recent patterns (limit size)
        const patternsToSave = this.PATTERN_DATABASE
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.MAX_PATTERNS);
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patternsToSave));
        this.PATTERN_DATABASE = patternsToSave;
      }
    } catch (error) {
      console.warn('Failed to save pattern database to storage:', error);
    }
  }

  /**
   * ML-based regime detection using pattern recognition
   * Enhanced with multi-timeframe alignment and regime transition detection
   */
  static async detectRegimeML(priceData: PriceData[], symbol?: string): Promise<RegimeAnalysis> {
    // Initialize pattern database from storage
    this.initializePatternDatabase();
    
    // Fallback to standard detection if insufficient data
    if (priceData.length < 52) {
      return RegimeDetector.detectRegime(priceData);
    }

    // Extract enhanced features
    const features = this.extractEnhancedFeatures(priceData);

    // Classify using pattern matching
    const classification = this.classifyRegime(features, priceData);

    // NEW: Multi-timeframe regime alignment
    let multiTimeframe: MultiTimeframeRegime | null = null;
    if (symbol) {
      try {
        multiTimeframe = await this.analyzeMultiTimeframeRegime(symbol);
        // Boost confidence if timeframes are aligned
        if (multiTimeframe && multiTimeframe.alignment === 'aligned') {
          classification.confidence = Math.min(100, classification.confidence * 1.15);
        }
      } catch (error) {
        console.warn('Multi-timeframe regime analysis failed:', error);
      }
    }

    // NEW: Detect regime transitions
    const transition = this.detectRegimeTransition(classification.regime, classification.confidence);

    // NEW: Historical pattern matching
    const patternMatch = this.matchHistoricalPattern(features);

    // Calculate confidence based on feature clarity, alignment, and pattern matching
    const confidence = this.calculateEnhancedConfidence(
      features,
      classification,
      multiTimeframe,
      transition,
      patternMatch
    );

    // Adjust regime if transition detected
    let finalRegime = classification.regime;
    if (transition && transition.strength > 50) {
      // If strong transition detected, use the new regime
      finalRegime = transition.to;
    }

    // Generate enhanced reasoning
    const reasoning = this.generateEnhancedReasoning(
      features,
      classification,
      multiTimeframe,
      transition,
      patternMatch
    );

    // Store in history for transition detection
    this.addToHistory(finalRegime, confidence);

    // Store pattern in database if confidence is high enough
    if (confidence >= 60 && classification.confidence >= 60) {
      this.storePattern(features, finalRegime, confidence);
    }

    return {
      regime: finalRegime,
      confidence: Math.round(confidence),
      volatility: features.volatility,
      trendStrength: Math.round(features.trendStrength),
      rangeStrength: Math.round(features.rangeStrength),
      suggestedStrategy: this.mapRegimeToStrategy(finalRegime),
      reasoning,
    };
  }

  /**
   * Extract enhanced features from price data
   */
  private static extractEnhancedFeatures(data: PriceData[]): RegimeFeatures {
    // Volatility (ATR normalized)
    const volatility = this.calculateVolatility(data);

    // Trend strength (0-100)
    const trendStrength = this.calculateTrendStrength(data);

    // Range strength (0-100)
    const rangeStrength = this.calculateRangeStrength(data);

    // Momentum (rate of change)
    const momentum = this.calculateMomentum(data);

    // Volume trend (-100 to 100)
    const volumeTrend = this.calculateVolumeTrend(data);

    // Price range (normalized)
    const priceRange = this.calculatePriceRange(data);

    // NEW: ADX (Average Directional Index)
    const adx = this.calculateADX(data);

    // NEW: RSI (Relative Strength Index)
    const rsi = this.calculateRSI(data);

    // NEW: EMA Alignment
    const emaAlignment = this.calculateEMAAlignment(data);

    // NEW: Support/Resistance Strength
    const supportResistance = this.calculateSupportResistanceStrength(data);

    return {
      volatility,
      trendStrength,
      rangeStrength,
      momentum,
      volumeTrend,
      priceRange,
      adx,
      rsi,
      emaAlignment,
      supportResistance,
    };
  }

  /**
   * Classify regime using enhanced feature-based pattern matching
   */
  private static classifyRegime(features: RegimeFeatures, data: PriceData[]): {
    regime: MarketRegime;
    confidence: number;
  } {
    // Use decision tree-like logic based on enhanced features
    let regime: MarketRegime = 'UNKNOWN';
    let confidence = 0;

    // NEW: Use ADX to confirm trend strength
    const isStrongTrend = features.adx > 25 && features.trendStrength > 60;
    const isWeakTrend = features.adx < 20 || features.trendStrength < 40;

    // High volatility + strong trend (confirmed by ADX) = HIGH_VOLATILITY_TREND
    if (features.volatility > 0.002 && isStrongTrend) {
      regime = features.momentum > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
      confidence = Math.min(100, (features.trendStrength + features.adx + features.volatility * 1000) / 3);
    }
    // Low volatility + weak trend + strong range = LOW_VOLATILITY_RANGE
    else if (features.volatility < 0.001 && isWeakTrend && features.rangeStrength > 60) {
      regime = 'LOW_VOLATILITY_RANGE';
      confidence = Math.min(100, (features.rangeStrength + features.supportResistance + (1 - features.volatility * 1000)) / 3);
    }
    // High volatility + weak trend = HIGH_VOLATILITY_RANGE
    else if (features.volatility > 0.002 && isWeakTrend) {
      regime = 'HIGH_VOLATILITY_RANGE';
      confidence = Math.min(100, (features.volatility * 1000 + features.rangeStrength) / 2);
    }
    // Strong trend (confirmed by ADX and EMA alignment) = TRENDING
    else if (isStrongTrend && features.emaAlignment > 50) {
      regime = features.momentum > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
      confidence = Math.min(100, (features.trendStrength + features.adx + features.emaAlignment) / 3);
    }
    // Moderate trend = check EMA alignment
    else if (features.trendStrength > 50 && features.emaAlignment > 40) {
      regime = features.momentum > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
      confidence = features.trendStrength * 0.8; // Slightly reduce confidence
    }
    // Default to range
    else {
      regime = features.volatility > 0.0015 ? 'HIGH_VOLATILITY_RANGE' : 'LOW_VOLATILITY_RANGE';
      confidence = Math.min(100, (features.rangeStrength + features.supportResistance) / 2);
    }

    // Boost confidence if volume confirms
    if (regime.includes('TRENDING') && Math.abs(features.volumeTrend) > 20) {
      confidence = Math.min(100, confidence * 1.1);
    }

    // Boost confidence if RSI confirms (not overbought/oversold in trending markets)
    if (regime.includes('TRENDING')) {
      if (regime === 'TRENDING_UP' && features.rsi < 70) {
        confidence = Math.min(100, confidence * 1.05);
      } else if (regime === 'TRENDING_DOWN' && features.rsi > 30) {
        confidence = Math.min(100, confidence * 1.05);
      }
    }

    return { regime, confidence: Math.round(confidence) };
  }

  /**
   * Calculate volatility (ATR)
   */
  private static calculateVolatility(data: PriceData[]): number {
    if (data.length < 14) return 0.001;

    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high || data[i].close;
      const low = data[i].low || data[i].close;
      const prevClose = data[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / 14;
    return atr;
  }

  /**
   * Calculate trend strength (0-100)
   */
  private static calculateTrendStrength(data: PriceData[]): number {
    if (data.length < 20) return 50;

    const prices = data.map(d => d.close);
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.length >= 50 
      ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50
      : sma20;

    // Calculate how many prices are above/below SMA
    const aboveSMA = prices.slice(-20).filter(p => p > sma20).length;
    const trendRatio = aboveSMA / 20;

    // Strong trend if most prices on one side
    const strength = Math.abs(trendRatio - 0.5) * 200; // 0-100

    // Boost if SMAs are aligned
    if ((sma20 > sma50 && trendRatio > 0.5) || (sma20 < sma50 && trendRatio < 0.5)) {
      return Math.min(100, strength * 1.2);
    }

    return strength;
  }

  /**
   * Calculate range strength (0-100)
   */
  private static calculateRangeStrength(data: PriceData[]): number {
    if (data.length < 20) return 50;

    const recent = data.slice(-20);
    const highs = recent.map(d => d.high || d.close);
    const lows = recent.map(d => d.low || d.close);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;
    const avgPrice = recent.reduce((sum, d) => sum + d.close, 0) / recent.length;

    // Range strength = how much price oscillates within range
    const oscillations = this.countOscillations(recent);
    const strength = Math.min(100, (oscillations / 20) * 100);

    return strength;
  }

  /**
   * Count price oscillations (up-down-up pattern)
   */
  private static countOscillations(data: PriceData[]): number {
    let count = 0;
    for (let i = 2; i < data.length; i++) {
      const p1 = data[i - 2].close;
      const p2 = data[i - 1].close;
      const p3 = data[i].close;
      
      // Check for oscillation pattern
      if ((p1 < p2 && p2 > p3) || (p1 > p2 && p2 < p3)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate momentum
   */
  private static calculateMomentum(data: PriceData[]): number {
    if (data.length < 10) return 0;

    const recent = data.slice(-10);
    const older = data.slice(-20, -10);
    
    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, d) => sum + d.close, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.close, 0) / older.length;

    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  /**
   * Calculate volume trend
   */
  private static calculateVolumeTrend(data: PriceData[]): number {
    if (data.length < 10) return 0;

    const recent = data.slice(-10);
    const older = data.slice(-20, -10);
    
    if (older.length === 0) return 0;

    const recentVol = recent.reduce((sum, d) => sum + (d.volume || 1), 0) / recent.length;
    const olderVol = older.reduce((sum, d) => sum + (d.volume || 1), 0) / older.length;

    if (olderVol === 0) return 0;
    return ((recentVol - olderVol) / olderVol) * 100;
  }

  /**
   * Calculate price range (normalized)
   */
  private static calculatePriceRange(data: PriceData[]): number {
    if (data.length < 20) return 0;

    const recent = data.slice(-20);
    const highs = recent.map(d => d.high || d.close);
    const lows = recent.map(d => d.low || d.close);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const avgPrice = recent.reduce((sum, d) => sum + d.close, 0) / recent.length;

    if (avgPrice === 0) return 0;
    return (maxHigh - minLow) / avgPrice;
  }

  /**
   * Analyze multi-timeframe regime alignment
   */
  private static async analyzeMultiTimeframeRegime(symbol: string): Promise<MultiTimeframeRegime | null> {
    try {
      const { MultiTimeframeAnalyzer } = await import('./technical-analysis/multi-timeframe-analyzer');
      const { MT5PriceDataProvider } = await import('./data-providers/mt5-price-data');
      
      // Fetch data from all timeframes
      const [h1Data, h4Data, d1Data] = await Promise.all([
        MT5PriceDataProvider.getHistoricalData(symbol, 'H1', 100).catch(() => []),
        MT5PriceDataProvider.getHistoricalData(symbol, 'H4', 100).catch(() => []),
        MT5PriceDataProvider.getHistoricalData(symbol, 'D1', 100).catch(() => []),
      ]);

      if (h1Data.length < 20 || h4Data.length < 20 || d1Data.length < 20) {
        return null;
      }

      // Detect regime for each timeframe
      const h1Regime = RegimeDetector.detectRegime(h1Data);
      const h4Regime = RegimeDetector.detectRegime(h4Data);
      const d1Regime = RegimeDetector.detectRegime(d1Data);

      // Determine alignment
      const regimes = [h1Regime.regime, h4Regime.regime, d1Regime.regime];
      const uniqueRegimes = new Set(regimes);
      
      let alignment: 'aligned' | 'mixed' | 'conflicting';
      if (uniqueRegimes.size === 1) {
        alignment = 'aligned';
      } else if (uniqueRegimes.size === 2) {
        alignment = 'mixed';
      } else {
        alignment = 'conflicting';
      }

      // Calculate alignment confidence
      const avgConfidence = (h1Regime.confidence + h4Regime.confidence + d1Regime.confidence) / 3;
      const alignmentBonus = alignment === 'aligned' ? 20 : alignment === 'mixed' ? 10 : 0;
      const confidence = Math.min(100, avgConfidence + alignmentBonus);

      return {
        h1: h1Regime.regime,
        h4: h4Regime.regime,
        d1: d1Regime.regime,
        alignment,
        confidence: Math.round(confidence),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect regime transitions
   */
  private static detectRegimeTransition(currentRegime: MarketRegime, currentConfidence: number): RegimeTransition | null {
    if (this.REGIME_HISTORY.length < 5) {
      return null;
    }

    // Get recent history
    const recent = this.REGIME_HISTORY.slice(-10);
    const previousRegime = recent[0]?.regime;
    
    if (!previousRegime || previousRegime === currentRegime) {
      return null;
    }

    // Calculate transition strength
    const confidenceChange = currentConfidence - (recent[0]?.confidence || 50);
    const strength = Math.min(100, Math.abs(confidenceChange) + (currentConfidence > 70 ? 20 : 0));

    // Count how many times regime changed
    let changeCount = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i]?.regime !== recent[i - 1]?.regime) {
        changeCount++;
      }
    }

    // Strong transition if regime changed and confidence is high
    if (strength > 30) {
      return {
        from: previousRegime,
        to: currentRegime,
        strength: Math.round(strength),
        timeframe: changeCount,
      };
    }

    return null;
  }

  /**
   * Match historical patterns
   */
  private static matchHistoricalPattern(features: RegimeFeatures): { match: boolean; confidence: number; regime?: MarketRegime } {
    // Ensure database is initialized
    this.initializePatternDatabase();
    
    if (this.PATTERN_DATABASE.length < this.MIN_PATTERNS) {
      return { match: false, confidence: 0 };
    }

    // Find similar patterns
    const similarities = this.PATTERN_DATABASE.map(pattern => {
      const similarity = this.calculateFeatureSimilarity(features, pattern.features);
      return { similarity, pattern };
    });

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    const bestMatch = similarities[0];

    // If similarity is high enough, return match
    if (bestMatch.similarity > 0.7) {
      return {
        match: true,
        confidence: Math.round(bestMatch.similarity * 100),
        regime: bestMatch.pattern.regime,
      };
    }

    return { match: false, confidence: 0 };
  }

  /**
   * Calculate feature similarity (0-1)
   */
  private static calculateFeatureSimilarity(f1: RegimeFeatures, f2: RegimeFeatures): number {
    // Normalize differences
    const volDiff = 1 - Math.min(1, Math.abs(f1.volatility - f2.volatility) / 0.002);
    const trendDiff = 1 - Math.abs(f1.trendStrength - f2.trendStrength) / 100;
    const rangeDiff = 1 - Math.abs(f1.rangeStrength - f2.rangeStrength) / 100;
    const momentumDiff = 1 - Math.min(1, Math.abs(f1.momentum - f2.momentum) / 10);
    
    // Weighted average
    return (volDiff * 0.3 + trendDiff * 0.3 + rangeDiff * 0.2 + momentumDiff * 0.2);
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  private static calculateADX(data: PriceData[]): number {
    if (data.length < 28) return 25; // Default neutral ADX

    const period = 14;
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i].high || data[i].close;
      const low = data[i].low || data[i].close;
      const prevHigh = data[i - 1].high || data[i - 1].close;
      const prevLow = data[i - 1].low || data[i - 1].close;
      const prevClose = data[i - 1].close;

      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      tr.push(trueRange);
    }

    // Calculate smoothed values
    const atr = this.smooth(tr.slice(-period), period);
    const plusDI = this.smooth(plusDM.slice(-period), period) / atr * 100;
    const minusDI = this.smooth(minusDM.slice(-period), period) / atr * 100;

    // Calculate DX and ADX
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    return Math.min(100, dx);
  }

  /**
   * Calculate RSI (Relative Strength Index) using Wilder's Smoothing Method
   * 🔒 FIXED: Now uses proper Wilder's smoothing instead of simple average
   */
  private static calculateRSI(data: PriceData[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    const prices = data.map(d => d.close);
    const changes: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // First period: Simple average
    let gains = 0;
    let losses = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        gains += changes[i];
      } else {
        losses += Math.abs(changes[i]);
      }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Subsequent periods: Wilder's smoothing
    for (let i = period; i < changes.length; i++) {
      const currentGain = changes[i] > 0 ? changes[i] : 0;
      const currentLoss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      
      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate EMA Alignment score (0-100)
   */
  private static calculateEMAAlignment(data: PriceData[]): number {
    if (data.length < 50) return 50;

    const prices = data.map(d => d.close);
    const ema5 = this.calculateEMAValue(prices, 5);
    const ema10 = this.calculateEMAValue(prices, 10);
    const ema20 = this.calculateEMAValue(prices, 20);
    const ema50 = this.calculateEMAValue(prices, 50);

    // Check if EMAs are aligned (bullish or bearish)
    const bullishAlignment = ema5 > ema10 && ema10 > ema20 && ema20 > ema50;
    const bearishAlignment = ema5 < ema10 && ema10 < ema20 && ema20 < ema50;

    if (bullishAlignment || bearishAlignment) {
      // Calculate alignment strength based on spacing
      const spacing1 = Math.abs(ema5 - ema10) / ema10;
      const spacing2 = Math.abs(ema10 - ema20) / ema20;
      const spacing3 = Math.abs(ema20 - ema50) / ema50;
      const avgSpacing = (spacing1 + spacing2 + spacing3) / 3;
      return Math.min(100, avgSpacing * 10000);
    }

    return 0;
  }

  /**
   * Calculate Support/Resistance Strength (0-100)
   */
  private static calculateSupportResistanceStrength(data: PriceData[]): number {
    if (data.length < 20) return 0;

    const prices = data.map(d => d.close);
    const highs = data.map(d => d.high || d.close);
    const lows = data.map(d => d.low || d.close);

    // Find recent support and resistance levels
    const recent = data.slice(-20);
    const maxHigh = Math.max(...recent.map(d => d.high || d.close));
    const minLow = Math.min(...recent.map(d => d.low || d.close));
    const currentPrice = prices[prices.length - 1];

    // Count how many times price touched these levels
    let touchCount = 0;
    const tolerance = (maxHigh - minLow) * 0.02; // 2% tolerance

    for (const bar of recent) {
      const high = bar.high || bar.close;
      const low = bar.low || bar.close;
      if (Math.abs(high - maxHigh) < tolerance || Math.abs(low - minLow) < tolerance) {
        touchCount++;
      }
    }

    // Strength based on touch count and current position
    const touchStrength = (touchCount / recent.length) * 100;
    const positionStrength = currentPrice > (maxHigh + minLow) / 2 ? 50 : 50;
    
    return Math.min(100, touchStrength * 0.7 + positionStrength * 0.3);
  }

  /**
   * Smooth array (simple moving average)
   */
  private static smooth(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Calculate EMA value
   */
  private static calculateEMAValue(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  }

  /**
   * Calculate enhanced ML confidence
   */
  private static calculateEnhancedConfidence(
    features: RegimeFeatures,
    classification: { regime: MarketRegime; confidence: number },
    multiTimeframe: MultiTimeframeRegime | null,
    transition: RegimeTransition | null,
    patternMatch: { match: boolean; confidence: number }
  ): number {
    // Base confidence from classification
    let confidence = classification.confidence;

    // Boost confidence if features are clear
    const featureClarity = (
      Math.abs(features.trendStrength - 50) / 50 +
      Math.abs(features.rangeStrength - 50) / 50 +
      Math.abs(features.adx - 25) / 25 // ADX clarity
    ) / 3;

    confidence = confidence * 0.6 + featureClarity * 100 * 0.2;

    // Boost if multi-timeframe aligned
    if (multiTimeframe && multiTimeframe.alignment === 'aligned') {
      confidence = Math.min(100, confidence + 10);
    }

    // Boost if pattern matched
    if (patternMatch.match) {
      confidence = Math.min(100, confidence + patternMatch.confidence * 0.1);
    }

    // Adjust for transition (reduce confidence during transitions)
    if (transition && transition.strength < 70) {
      confidence = confidence * 0.9; // Slightly reduce during weak transitions
    }

    return Math.min(100, confidence);
  }

  /**
   * Generate enhanced reasoning
   */
  private static generateEnhancedReasoning(
    features: RegimeFeatures,
    classification: { regime: MarketRegime; confidence: number },
    multiTimeframe: MultiTimeframeRegime | null,
    transition: RegimeTransition | null,
    patternMatch: { match: boolean; confidence: number; regime?: MarketRegime }
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`ML Classification: ${classification.regime} (${classification.confidence}% confidence)`);
    reasoning.push(`Volatility: ${(features.volatility * 1000).toFixed(2)} (${features.volatility > 0.002 ? 'High' : features.volatility < 0.001 ? 'Low' : 'Medium'})`);
    reasoning.push(`Trend Strength: ${features.trendStrength.toFixed(0)}%`);
    reasoning.push(`Range Strength: ${features.rangeStrength.toFixed(0)}%`);
    reasoning.push(`ADX: ${features.adx.toFixed(1)} (${features.adx > 25 ? 'Strong Trend' : features.adx < 20 ? 'Weak Trend' : 'Moderate'})`);
    reasoning.push(`RSI: ${features.rsi.toFixed(1)}`);
    reasoning.push(`EMA Alignment: ${features.emaAlignment.toFixed(0)}%`);

    if (multiTimeframe) {
      reasoning.push(`Multi-Timeframe: H1=${multiTimeframe.h1}, H4=${multiTimeframe.h4}, D1=${multiTimeframe.d1}`);
      reasoning.push(`Alignment: ${multiTimeframe.alignment} (${multiTimeframe.confidence}% confidence)`);
    }

    if (transition) {
      reasoning.push(`⚠️ Regime Transition Detected: ${transition.from} → ${transition.to} (${transition.strength}% strength)`);
    }

    if (patternMatch.match && patternMatch.regime) {
      reasoning.push(`📊 Historical Pattern Match: ${patternMatch.regime} (${patternMatch.confidence}% similarity)`);
    }

    if (Math.abs(features.volumeTrend) > 20) {
      reasoning.push(`Volume Trend: ${features.volumeTrend > 0 ? 'Increasing' : 'Decreasing'} (${features.volumeTrend.toFixed(1)}%)`);
    }

    return reasoning;
  }

  /**
   * Add to history for transition detection
   */
  private static addToHistory(regime: MarketRegime, confidence: number): void {
    this.REGIME_HISTORY.push({
      regime,
      timestamp: Date.now(),
      confidence,
    });

    // Keep only recent history
    if (this.REGIME_HISTORY.length > this.MAX_HISTORY) {
      this.REGIME_HISTORY.shift();
    }
  }

  /**
   * Store pattern in database for future matching
   */
  private static storePattern(features: RegimeFeatures, regime: MarketRegime, confidence: number): void {
    // Check if similar pattern already exists (avoid duplicates)
    const similarityThreshold = 0.85; // Only store if significantly different
    const isDuplicate = this.PATTERN_DATABASE.some(pattern => {
      const similarity = this.calculateFeatureSimilarity(features, pattern.features);
      return similarity > similarityThreshold && pattern.regime === regime;
    });

    if (!isDuplicate) {
      const pattern: RegimePattern = {
        features: { ...features }, // Deep copy
        regime,
        confidence,
        timestamp: Date.now(),
      };

      this.PATTERN_DATABASE.push(pattern);

      // Save to storage periodically (every 10 patterns to avoid excessive writes)
      if (this.PATTERN_DATABASE.length % 10 === 0) {
        this.savePatternDatabase();
      }
    }
  }

  /**
   * Ensure patterns are saved (call before shutdown or periodically)
   */
  static ensurePatternsSaved(): void {
    if (this.PATTERN_DATABASE.length > 0) {
      this.savePatternDatabase();
    }
  }

  /**
   * Train pattern database from historical price data
   * This can be called to populate the database with historical patterns
   */
  static async trainFromHistoricalData(
    historicalData: Array<{ symbol: string; data: PriceData[] }>,
    minConfidence: number = 60
  ): Promise<number> {
    this.initializePatternDatabase();
    
    let patternsAdded = 0;
    
    for (const { symbol, data } of historicalData) {
      if (data.length < 52) continue; // Skip insufficient data
      
      try {
        // Extract features
        const features = this.extractEnhancedFeatures(data);
        
        // Classify regime
        const classification = this.classifyRegime(features, data);
        
        // Only store if confidence is high enough
        if (classification.confidence >= minConfidence) {
          const wasDuplicate = this.PATTERN_DATABASE.some(pattern => {
            const similarity = this.calculateFeatureSimilarity(features, pattern.features);
            return similarity > 0.85 && pattern.regime === classification.regime;
          });
          
          if (!wasDuplicate) {
            this.PATTERN_DATABASE.push({
              features: { ...features },
              regime: classification.regime,
              confidence: classification.confidence,
              timestamp: Date.now(),
            });
            patternsAdded++;
          }
        }
      } catch (error) {
        console.warn(`Failed to process historical data for ${symbol}:`, error);
      }
    }
    
    // Save to storage
    this.savePatternDatabase();
    
    console.log(`✅ Trained pattern database: Added ${patternsAdded} new patterns (Total: ${this.PATTERN_DATABASE.length})`);
    return patternsAdded;
  }

  /**
   * Get pattern database statistics
   */
  static getPatternDatabaseStats(): {
    totalPatterns: number;
    patternsByRegime: Record<MarketRegime, number>;
    oldestPattern: number | null;
    newestPattern: number | null;
  } {
    this.initializePatternDatabase();
    
    const patternsByRegime: Record<MarketRegime, number> = {
      LOW_VOLATILITY_RANGE: 0,
      HIGH_VOLATILITY_TREND: 0,
      TRENDING_UP: 0,
      TRENDING_DOWN: 0,
      HIGH_VOLATILITY_RANGE: 0,
      UNKNOWN: 0,
    };
    
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    
    for (const pattern of this.PATTERN_DATABASE) {
      patternsByRegime[pattern.regime] = (patternsByRegime[pattern.regime] || 0) + 1;
      
      if (oldestTimestamp === null || pattern.timestamp < oldestTimestamp) {
        oldestTimestamp = pattern.timestamp;
      }
      if (newestTimestamp === null || pattern.timestamp > newestTimestamp) {
        newestTimestamp = pattern.timestamp;
      }
    }
    
    return {
      totalPatterns: this.PATTERN_DATABASE.length,
      patternsByRegime,
      oldestPattern: oldestTimestamp,
      newestPattern: newestTimestamp,
    };
  }

  /**
   * Clear pattern database (useful for resetting or testing)
   */
  static clearPatternDatabase(): void {
    this.PATTERN_DATABASE = [];
    this.initialized = false;
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear pattern database from storage:', error);
    }
    
    console.log('✅ Pattern database cleared');
  }

  /**
   * Generate ML reasoning
   */
  private static generateMLReasoning(features: RegimeFeatures, classification: { regime: MarketRegime; confidence: number }): string[] {
    const reasoning: string[] = [];

    reasoning.push(`ML Classification: ${classification.regime} (${classification.confidence}% confidence)`);
    reasoning.push(`Volatility: ${(features.volatility * 1000).toFixed(2)} (${features.volatility > 0.002 ? 'High' : features.volatility < 0.001 ? 'Low' : 'Medium'})`);
    reasoning.push(`Trend Strength: ${features.trendStrength.toFixed(0)}%`);
    reasoning.push(`Range Strength: ${features.rangeStrength.toFixed(0)}%`);
    reasoning.push(`Momentum: ${features.momentum > 0 ? '+' : ''}${features.momentum.toFixed(2)}%`);

    if (Math.abs(features.volumeTrend) > 20) {
      reasoning.push(`Volume Trend: ${features.volumeTrend > 0 ? 'Increasing' : 'Decreasing'} (${features.volumeTrend.toFixed(1)}%)`);
    }

    return reasoning;
  }

  /**
   * Map regime to strategy
   */
  private static mapRegimeToStrategy(regime: MarketRegime): 'MEAN_REVERSION' | 'MOMENTUM' | 'BREAKOUT' | 'TREND_FOLLOWING' | 'AVOID' {
    switch (regime) {
      case 'LOW_VOLATILITY_RANGE':
        return 'MEAN_REVERSION';
      case 'HIGH_VOLATILITY_TREND':
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        return 'TREND_FOLLOWING';
      case 'HIGH_VOLATILITY_RANGE':
        return 'AVOID';
      default:
        return 'TREND_FOLLOWING';
    }
  }
}

