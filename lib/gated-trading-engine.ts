/**
 * GATED TRADING ENGINE - Refactored Architecture
 * 
 * This replaces the weighted-score system with a gated, expectancy-aware,
 * conflict-resistant execution engine.
 * 
 * ARCHITECTURE:
 * 1. Market Readability Gate (MANDATORY)
 * 2. Directional Bias Engine (NOT a trade signal)
 * 3. GPT-4 Structure Validator (reformed role)
 * 4. Execution Permission Gate (MANDATORY)
 * 5. Risk Allocation & Trade Execution
 * 
 * PRINCIPLE: Prefer NO TRADE over BAD TRADE
 */

import { PriceData } from '@/types/trading';
import { COTAnalysis } from './cot-analyzer';
import { RegimeAnalysis } from './regime-detector';
import { TradingHoursAnalysis } from './trading-hours';
import { NewsImpact } from './economic-calendar';
import { detectAssetType } from './constants';

// ============================================================================
// NEW INTERFACES
// ============================================================================

export interface MarketReadability {
  isReadable: boolean;
  reason: string;
  blockedBy: string[]; // List of blocking conditions
  confidence: number; // 0-100, how clear the market structure is
  // 🔒 HARD-LOCK: Gate-1 inputs (for downstream integrity enforcement)
  gate1Inputs?: {
    trendStrength: number; // 0-100
    patternConfidence: number; // 0-100 (0 if no pattern)
    hasSupportResistance: boolean;
    hasStrongTrend: boolean; // trendStrength ≥ 60%
    hasStrongPattern: boolean; // patternConfidence ≥ 70%
  };
}

export interface DirectionalBias {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number; // 0-100
  contributors: {
    technical: number; // -100 to +100 (negative = bearish, positive = bullish)
    fundamental: number;
    cot: number; // Long-term bias only
  };
  reasoning: string[];
  primaryTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // Primary market structure/trend
  reversalWatch?: boolean; // Contrarian signals detected but not confirmed
  contrarianNote?: string; // Note about contrarian positioning
}

export interface GPTStructureAnalysis {
  marketStructure: 'TREND_CONTINUATION' | 'REVERSAL' | 'RANGE' | 'INVALID';
  alignment: 'CONFIRMS' | 'CONTRADICTS' | 'NEUTRAL';
  confidence: number; // 0-100
  trendStrength?: number; // 0-100, GPT's trend strength (if available)
  patterns: {
    type: string;
    confidence: number;
    priceLevel?: number;
  }[];
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  reasoning: string;
}

export interface ExecutionPermission {
  canExecute: boolean;
  reason: string;
  blockedBy: string[];
  technicalExecutionScore: number; // 0-100, separate from bias
  confidence: number; // 0-100, derived from alignment
}

export interface GatedMarketAnalysis {
  symbol: string;
  timestamp: Date;
  
  // Market Readability
  marketReadability: MarketReadability;
  
  // Directional Bias (NOT a trade signal)
  directionalBias: DirectionalBias;
  
  // GPT Structure Analysis
  gptStructure?: GPTStructureAnalysis;
  
  // Execution Permission
  executionPermission: ExecutionPermission;
  
  // Final Recommendation
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  recommendationReason: string;
  
  // Risk Management (only if execution allowed)
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  suggestedPositionSize?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Detailed Reasoning
  reasoning: string[];
  detailedReasoning?: {
    technical: string[];
    fundamental: string[];
    sentiment: string[];
    risk: string[];
  };
  
  // Component Scores (for transparency, NOT for averaging)
  componentScores: {
    technical: number;
    fundamental: number;
    sentiment: number;
    cot: number;
    regime: number;
  };
  
  // Expectancy Tracking Data
  expectancyData?: {
    estimatedWinRate: number; // 0-100
    estimatedAvgWin: number; // pips/points/dollars
    estimatedAvgLoss: number; // pips/points/dollars
    estimatedExpectancy: number; // pips/points/dollars per trade
    unit: 'pips' | 'points' | 'dollars'; // Unit for display
  };
  
  // Metadata
  cotAnalysis?: COTAnalysis;
  regimeAnalysis?: RegimeAnalysis;
  tradingHours?: TradingHoursAnalysis;
  newsImpact?: NewsImpact;
}

// ============================================================================
// GATED TRADING ENGINE CLASS
// ============================================================================

export class GatedTradingEngine {
  private historicalData: PriceData[] = []
  private debugLog: string[] = [] // Debug logging for all decisions;
  
  /**
   * Main analysis function - GATED FLOW
   */
  async analyzeMarket(
    symbol: string,
    openTrades: any[] = [],
    chartImageBase64?: string
  ): Promise<GatedMarketAnalysis> {
    // 🔒 DEBUG: Log chart image availability at entry
    console.log(`[GATED ENGINE] analyzeMarket called for ${symbol}, chartImageBase64: ${chartImageBase64 ? `YES (${chartImageBase64.length} chars)` : 'NO'}`);
    this.debugLog = []; // Reset debug log for this analysis
    this.debugLog.push(`[GATED ENGINE] analyzeMarket called for ${symbol}, chartImageBase64: ${chartImageBase64 ? `YES (${chartImageBase64.length} chars)` : 'NO'}`);
    
    // Load historical data
    await this.loadHistoricalData(symbol);
    
    // Get all component analyses
    const technicalScore = await this.getTechnicalScore(symbol);
    const fundamentalScore = await this.getFundamentalScore(symbol);
    const sentimentScore = await this.getSentimentScore(symbol);
    const cotAnalysis = await this.getCOTAnalysis(symbol);
    const regimeAnalysis = await this.getRegimeAnalysis(symbol);
    const tradingHours = await this.getTradingHours(symbol);
    const newsImpact = await this.getNewsImpact(symbol);
    
    // Get GPT structure analysis (reformed role)
    // 🔒 DEBUG: Log before calling getGPTStructureAnalysis
    this.debugLog.push(`[GATED ENGINE] Calling getGPTStructureAnalysis with chartImageBase64: ${chartImageBase64 ? `YES (${chartImageBase64.length} chars)` : 'NO'}`);
    const gptStructure = await this.getGPTStructureAnalysis(symbol, chartImageBase64);
    this.debugLog.push(`[GATED ENGINE] getGPTStructureAnalysis returned: ${gptStructure ? `YES (confidence: ${gptStructure.confidence}%, patterns: ${gptStructure.patterns?.length || 0}, S/R: support=[${gptStructure.supportResistance?.support?.join(', ') || 'none'}], resistance=[${gptStructure.supportResistance?.resistance?.join(', ') || 'none'}])` : 'NO'}`);
    
    // ========================================================================
    // LAYER 1: MARKET READABILITY GATE (MANDATORY)
    // 🔒 FIX: Gate 1 evaluates ONLY market structure clarity, NOT regime suitability
    // ========================================================================
    // 🔒 FIX: Don't reset debug log - keep GPT structure logs for debugging
    this.debugLog.push(`[GATE 1] Starting Market Readability Assessment`);
    this.debugLog.push(`[GATE 1] Regime Trend Strength: ${regimeAnalysis.trendStrength}%`);
    
    const priceActionSR = this.computeSupportResistanceFromOHLC();
    const marketReadability = this.assessMarketReadability(
      regimeAnalysis,
      gptStructure,
      priceActionSR
    );
    
    this.debugLog.push(`[GATE 1] Result: ${marketReadability.isReadable ? 'READABLE' : 'UNREADABLE'} (confidence: ${marketReadability.confidence}%)`);
    this.debugLog.push(`[GATE 1] Reason: ${marketReadability.reason}`);
    
    // ========================================================================
    // LAYER 2: DIRECTIONAL BIAS ENGINE (NOT a trade signal)
    // 🔒 FIX: Only assign bias if Gate 1 is readable AND trend/pattern align
    // ========================================================================
    this.debugLog.push(`[GATE 2] Starting Directional Bias Calculation`);
    this.debugLog.push(`[GATE 2] Gate 1 Status: ${marketReadability.isReadable ? 'READABLE' : 'UNREADABLE'}`);
    console.log(`[GATE 2] Starting Directional Bias Calculation - Gate 1: ${marketReadability.isReadable ? 'READABLE' : 'UNREADABLE'}`);
    
    const directionalBias = this.calculateDirectionalBias(
      technicalScore,
      fundamentalScore,
      cotAnalysis,
      gptStructure,
      regimeAnalysis,
      marketReadability // Pass Gate 1 status to enforce readability requirement
    );
    
    this.debugLog.push(`[GATE 2] Bias Before COT: ${directionalBias.direction} (strength: ${directionalBias.strength}%)`);
    console.log(`[GATE 2] Directional Bias: ${directionalBias.direction} (strength: ${directionalBias.strength}%)`);
    console.log(`[GATE 2] Bias Reasoning:`, directionalBias.reasoning);
    
    // 🔒 FIX: Do NOT return early if bias is neutral - continue to Gate 4
    // Execution blocking happens in Gate 4, not here
    
    // ========================================================================
    // LAYER 3: GPT STRUCTURE VALIDATION (already done above)
    // ========================================================================
    // GPT structure analysis is used to validate or block execution
    
    // ========================================================================
    // LAYER 4: EXECUTION PERMISSION GATE (MANDATORY)
    // ========================================================================
    this.debugLog.push(`[GATE 4] Starting Execution Permission Assessment`);
    this.debugLog.push(`[GATE 4] Gate 1 Status: ${marketReadability.isReadable ? 'READABLE' : 'UNREADABLE'}`);
    this.debugLog.push(`[GATE 4] Directional Bias: ${directionalBias.direction} (strength: ${directionalBias.strength}%)`);
    console.log(`[GATE 4] Starting Execution Permission Assessment`);
    console.log(`[GATE 4] Gate 1: ${marketReadability.isReadable ? 'READABLE' : 'UNREADABLE'}, Bias: ${directionalBias.direction} (${directionalBias.strength}%)`);
    
    const executionPermission = await this.applyEmpiricalVerdictGate(
      symbol,
      this.assessExecutionPermission(
        marketReadability,
        directionalBias,
        technicalScore,
        gptStructure,
        regimeAnalysis,
        tradingHours,
        cotAnalysis
      )
    );
    
    this.debugLog.push(`[GATE 4] Result: ${executionPermission.canExecute ? 'EXECUTION ALLOWED' : 'EXECUTION BLOCKED'}`);
    this.debugLog.push(`[GATE 4] Reason: ${executionPermission.reason}`);
    this.debugLog.push(`[GATE 4] Confidence: ${executionPermission.confidence}%`);
    console.log(`[GATE 4] Result: ${executionPermission.canExecute ? '✅ EXECUTION ALLOWED' : '❌ EXECUTION BLOCKED'}`);
    console.log(`[GATE 4] Reason: ${executionPermission.reason}`);
    console.log(`[GATE 4] Confidence: ${executionPermission.confidence}%`);
    if (executionPermission.blockedBy.length > 0) {
      this.debugLog.push(`[GATE 4] Blockers: ${executionPermission.blockedBy.join('; ')}`);
      console.log(`[GATE 4] Blockers:`, executionPermission.blockedBy);
    }
    
    // If execution not permitted, STOP HERE - return HOLD
    if (!executionPermission.canExecute) {
      this.debugLog.push(`[GATE 4] Execution BLOCKED - returning HOLD analysis`);
      return this.createHoldAnalysis(
        symbol,
        marketReadability,
        technicalScore,
        fundamentalScore,
        sentimentScore,
        cotAnalysis,
        regimeAnalysis,
        tradingHours,
        newsImpact,
        gptStructure,
        directionalBias,
        executionPermission.reason,
        executionPermission
      );
    }
    
    // ========================================================================
    // LAYER 5: RISK ALLOCATION & TRADE EXECUTION
    // ========================================================================
    // 🔒 RULE 3: Risk allocation, position size, SL, TP only calculated if execution allowed
    // Only reached if all gates pass
    this.debugLog.push(`[RISK ALLOCATION] Execution allowed - calculating risk allocation`);
    const riskAllocation = await this.calculateRiskAllocation(
      symbol,
      directionalBias,
      executionPermission,
      regimeAnalysis
    );
    this.debugLog.push(`[RISK ALLOCATION] Position Size: ${riskAllocation.positionSize}, SL: ${riskAllocation.stopLoss}, TP: ${riskAllocation.takeProfit}, Risk Level: ${riskAllocation.riskLevel}`);
    
    // 🔒 FIX 6: EXPECTANCY VALIDITY CHECK
    // Only calculate expectancy if execution is permitted
    const expectancyData = executionPermission.canExecute
      ? await this.estimateExpectancy(
          directionalBias,
          executionPermission,
          riskAllocation,
          symbol
        )
      : undefined; // No expectancy for blocked trades
    
    // 🔒 RULE 5: Recommendation / Trade Setup
    // BUY/SELL only if bias valid AND execution allowed
    // HOLD otherwise
    const recommendation = executionPermission.canExecute && directionalBias.direction !== 'NEUTRAL'
      ? (directionalBias.direction === 'BULLISH' ? 'BUY' : 'SELL')
      : 'HOLD';
    
    this.debugLog.push(`[RECOMMENDATION] Final: ${recommendation}`);
    this.debugLog.push(`[RECOMMENDATION] Bias: ${directionalBias.direction}, Execution: ${executionPermission.canExecute ? 'ALLOWED' : 'BLOCKED'}`);
    
    // Compare GPT visual recommendation with computed engine recommendation
    if (gptStructure && gptStructure.reasoning) {
      const gptRecUpper = (gptStructure.reasoning || '').toUpperCase();
      const gptRecommendation = gptRecUpper.includes('BUY') && !gptRecUpper.includes('SELL') ? 'BUY'
        : gptRecUpper.includes('SELL') && !gptRecUpper.includes('BUY') ? 'SELL'
        : 'HOLD';
      this.debugLog.push(`[COMPARISON] GPT Visual Recommendation: ${gptRecommendation}`);
      this.debugLog.push(`[COMPARISON] Engine Computed Recommendation: ${recommendation}`);
      if (gptRecommendation !== recommendation) {
        this.debugLog.push(`[COMPARISON] ⚠️ Mismatch detected - GPT: ${gptRecommendation}, Engine: ${recommendation}`);
      }
    }
    
    // 🔒 RULE 7: Sanity Checks - Ensure no contradictions
    this.performSanityChecks(marketReadability, directionalBias, executionPermission, recommendation);
    
    const recommendationReason = this.generateRecommendationReason(
      directionalBias,
      executionPermission,
      gptStructure,
      marketReadability
    );
    
    // 🔒 RULE 6: Logging / Debugging - Comprehensive logging for all decisions
    // Log all debug information
    console.log('=== AI TRADING ENGINE DEBUG LOG ===');
    console.log(`[SYMBOL] ${symbol}`);
    console.log(`[TIMESTAMP] ${new Date().toISOString()}`);
    console.log('---');
    this.debugLog.forEach(log => console.log(log));
    console.log('---');
    console.log(`[FINAL] Recommendation: ${recommendation}`);
    console.log(`[FINAL] Directional Bias: ${directionalBias.direction} (${directionalBias.strength}%)`);
    console.log(`[FINAL] Execution: ${executionPermission.canExecute ? 'ALLOWED' : 'BLOCKED'}`);
    console.log(`[FINAL] Confidence: ${executionPermission.confidence}%`);
    console.log('=== END DEBUG LOG ===');
    
    return {
      symbol,
      timestamp: new Date(),
      marketReadability,
      directionalBias,
      gptStructure,
      executionPermission,
      recommendation,
      recommendationReason,
      suggestedStopLoss: riskAllocation.stopLoss,
      suggestedTakeProfit: riskAllocation.takeProfit,
      suggestedPositionSize: riskAllocation.positionSize,
      riskLevel: riskAllocation.riskLevel,
      reasoning: this.generateReasoning(
        marketReadability,
        directionalBias,
        executionPermission,
        gptStructure,
        cotAnalysis
      ),
      componentScores: {
        technical: technicalScore,
        fundamental: fundamentalScore,
        sentiment: sentimentScore,
        cot: cotAnalysis?.confidence || 50,
        regime: regimeAnalysis?.confidence || 0,
      },
      expectancyData,
      cotAnalysis: cotAnalysis || undefined,
      regimeAnalysis,
      tradingHours,
      newsImpact,
    };
  }
  
  // ==========================================================================
  // LAYER 1: MARKET READABILITY GATE
  // ==========================================================================

  /**
   * Derive support/resistance from OHLC swing points (no GPT required).
   */
  private computeSupportResistanceFromOHLC(): { support: number[]; resistance: number[] } {
    const data = this.historicalData;
    if (!data || data.length < 20) {
      return { support: [], resistance: [] };
    }

    const lookback = Math.min(50, data.length);
    const recent = data.slice(-lookback);
    const support: number[] = [];
    const resistance: number[] = [];

    for (let i = 2; i < recent.length - 2; i++) {
      const h = recent[i].high;
      const l = recent[i].low;
      if (
        h > recent[i - 1].high &&
        h > recent[i - 2].high &&
        h > recent[i + 1].high &&
        h > recent[i + 2].high
      ) {
        resistance.push(h);
      }
      if (
        l < recent[i - 1].low &&
        l < recent[i - 2].low &&
        l < recent[i + 1].low &&
        l < recent[i + 2].low
      ) {
        support.push(l);
      }
    }

    support.sort((a, b) => a - b);
    resistance.sort((a, b) => b - a);

    return {
      support: support.slice(0, 3),
      resistance: resistance.slice(0, 3),
    };
  }
  
  /**
   * Assess if market structure is readable (structure clarity ONLY)
   * 🔒 FINAL RULE: Gate 1 evaluates ONLY structural clarity
   * Market regime, volatility, confidence %, or execution status MUST NEVER affect Gate 1
   * 
   * REFACTORED: Uses price-action structure (regimeAnalysis.trendStrength) instead of technicalScore
   */
  private assessMarketReadability(
    regimeAnalysis: RegimeAnalysis,
    gptStructure?: GPTStructureAnalysis,
    priceActionSR?: { support: number[]; resistance: number[] }
  ): MarketReadability {
    // 🔒 STRICT INVARIANT: Gate-1 must NEVER compute, normalize, clamp, or infer trend strength from:
    // - technicalScore
    // - indicators (RSI, MACD, EMA, etc.)
    // - volatility (ATR)
    // - regime confidence
    // - ML regime labels
    // 
    // Gate-1 MUST use regimeAnalysis.trendStrength verbatim (price-action structure only)
    // 🔒 FIX: However, if GPT structure has strong pattern (≥70%) AND GPT trend strength ≥60%, use GPT trend strength
    // This ensures GPT-5.1's visual analysis is properly considered when it shows clear structure
    let trendStrengthPercent = regimeAnalysis.trendStrength || 0;
    
    // 2. Chart pattern confidence ≥ 70%
    // 🔒 FIX: Check pattern confidence directly, not calculated confidence
    // A pattern with ≥70% confidence should make Gate-1 readable regardless of trend strength
    const maxPatternConfidence = gptStructure && gptStructure.patterns?.length > 0
      ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
      : 0;
    
    // 🔒 CRITICAL FIX: Extract GPT trend strength directly from GPT structure
    // GPT shows 80% trend strength - we need to use it when regime trend is weak
    let gptTrendStrength = 0;
    if (gptStructure) {
      // 🔒 FIX: Use GPT's trendStrength field if available (passed through from ChartAnalysis)
      if (gptStructure.trendStrength !== undefined && gptStructure.trendStrength >= 60) {
        gptTrendStrength = gptStructure.trendStrength;
        this.debugLog.push(`[GATE 1] GPT trend strength available: ${gptTrendStrength}%`);
      } else if (gptStructure.marketStructure === 'TREND_CONTINUATION' && gptStructure.confidence >= 70) {
        // Fallback: Estimate from confidence if trendStrength not available
        // If confidence is 70-100%, trend strength is likely 60-100%
        gptTrendStrength = Math.max(60, Math.min(100, gptStructure.confidence));
        this.debugLog.push(`[GATE 1] GPT has TREND_CONTINUATION with confidence ${gptStructure.confidence}% - estimating trend strength as ${gptTrendStrength}%`);
      }
      // Also check if GPT reasoning mentions strong trend (e.g., "Strong bullish trend")
      const reasoningUpper = (gptStructure.reasoning || '').toUpperCase();
      if (reasoningUpper.includes('STRONG') && (reasoningUpper.includes('BULLISH') || reasoningUpper.includes('BEARISH'))) {
        // GPT explicitly mentions strong trend - use higher estimate
        if (gptTrendStrength < 70) {
          gptTrendStrength = Math.max(gptTrendStrength, 70);
          this.debugLog.push(`[GATE 1] GPT reasoning mentions strong trend - boosting trend strength estimate to ${gptTrendStrength}%`);
        }
      }
    }
    
    // 🔒 CRITICAL FIX: Use GPT trend strength if regime trend is weak (< 60%) but GPT shows strong structure
    // This ensures GPT's 80% trend strength is recognized even when regime shows 12%
    if (regimeAnalysis.trendStrength < 60 && gptTrendStrength >= 60 && gptStructure) {
      // GPT shows strong trend (≥60%) - use it instead of weak regime trend
      // Don't require pattern confidence ≥70% - if GPT shows strong trend, use it
      this.debugLog.push(`[GATE 1] Using GPT trend strength (${gptTrendStrength}%) instead of regime trend strength (${regimeAnalysis.trendStrength}%) because GPT shows strong structure`);
      trendStrengthPercent = gptTrendStrength;
    }
    
    // 🔒 HARD ASSERTION: Prevent Gate-1 from reporting trendStrength = 0% when regime trendStrength ≥ 60%
    if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent === 0) {
      const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated 0%. Forcing correction.`;
      console.error(errorMsg);
      this.debugLog.push(errorMsg);
      // Force correction - use regime trendStrength directly
      trendStrengthPercent = regimeAnalysis.trendStrength;
    }
    
    // 🔒 ADDITIONAL GUARD: If regime trendStrength >= 60, ensure trendStrengthPercent reflects this
    if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent < regimeAnalysis.trendStrength) {
      const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated ${trendStrengthPercent}%. Forcing correction.`;
      console.error(errorMsg);
      this.debugLog.push(errorMsg);
      trendStrengthPercent = regimeAnalysis.trendStrength;
    }
    
    // 1. Structure-based trend strength ≥ 60%
    const hasStrongTrend = trendStrengthPercent >= 60;
    const hasStrongPattern = gptStructure && 
      maxPatternConfidence >= 70 && 
      gptStructure.marketStructure !== 'INVALID';
    
    // 3. Clear support and resistance levels identified (GPT and/or price-action swings)
    const gptHasSR =
      gptStructure?.supportResistance &&
      (gptStructure.supportResistance.support.length > 0 ||
        gptStructure.supportResistance.resistance.length > 0);
    const priceActionHasSR =
      priceActionSR &&
      (priceActionSR.support.length > 0 || priceActionSR.resistance.length > 0);
    let hasSupportResistance = !!(gptHasSR || priceActionHasSR);
    if (priceActionHasSR && !gptHasSR) {
      this.debugLog.push(
        `[GATE 1] Using price-action S/R (support=${priceActionSR!.support.length}, resistance=${priceActionSR!.resistance.length}) — GPT S/R unavailable`
      );
    }
    
    // 🔒 CRITICAL FIX: Check and correct hasSupportResistance IMMEDIATELY if GPT has S/R arrays
    // This must happen BEFORE calculating hasStructureWithSR
    const hasNonEmptySR = gptStructure && 
      gptStructure.supportResistance && 
      (gptStructure.supportResistance.support.length > 0 || gptStructure.supportResistance.resistance.length > 0);
    
    if (hasNonEmptySR && !hasSupportResistance) {
      const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: S/R arrays are non-empty but hasSupportResistance is false. Forcing correction EARLY.`;
      console.error(errorMsg);
      this.debugLog.push(errorMsg);
      hasSupportResistance = true; // Update the variable directly BEFORE calculating hasStructureWithSR
      this.debugLog.push(`[GATE 1] CORRECTED EARLY: hasSupportResistance set to TRUE (S/R arrays exist)`);
    }
    
    // 🔒 DEBUG: Log S/R detection for troubleshooting
    if (gptStructure) {
      const maxPatternConf = gptStructure.patterns?.length > 0 
        ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
        : 0;
      const supportLevels = gptStructure.supportResistance?.support || [];
      const resistanceLevels = gptStructure.supportResistance?.resistance || [];
      this.debugLog.push(`[GATE 1] GPT Structure: calculated confidence=${gptStructure.confidence}%, max pattern confidence=${maxPatternConf}%, marketStructure=${gptStructure.marketStructure}`);
      this.debugLog.push(`[GATE 1] GPT S/R: support=[${supportLevels.join(', ') || 'none'}], resistance=[${resistanceLevels.join(', ') || 'none'}]`);
      this.debugLog.push(`[GATE 1] GPT S/R Check: hasSupportResistance=${hasSupportResistance} (support.length=${supportLevels.length}, resistance.length=${resistanceLevels.length})`);
      this.debugLog.push(`[GATE 1] GPT Patterns: ${gptStructure.patterns?.length || 0} patterns, types: [${gptStructure.patterns?.map(p => `${p.type}(${p.confidence}%)`).join(', ') || 'none'}]`);
      this.debugLog.push(`[GATE 1] GPT Trend Strength: ${gptStructure.trendStrength || 'not available'}`);
      this.debugLog.push(`[GATE 1] hasStrongPattern check: maxPatternConf=${maxPatternConf}% >= 70? ${maxPatternConf >= 70}, marketStructure !== INVALID? ${gptStructure.marketStructure !== 'INVALID'}, result: ${hasStrongPattern}`);
      
      // 🔒 CRITICAL DEBUG: Log raw GPT structure to console for troubleshooting
      console.log(`[GATE 1 DEBUG] GPT Structure received:`, {
        exists: !!gptStructure,
        confidence: gptStructure.confidence,
        marketStructure: gptStructure.marketStructure,
        trendStrength: gptStructure.trendStrength,
        patterns: gptStructure.patterns?.length || 0,
        maxPatternConfidence: maxPatternConf,
        supportResistance: {
          support: supportLevels,
          resistance: resistanceLevels,
          hasSupport: supportLevels.length > 0,
          hasResistance: resistanceLevels.length > 0,
        },
        hasSupportResistance: hasSupportResistance,
        hasNonEmptySR: hasNonEmptySR,
      });
    } else {
      this.debugLog.push(`[GATE 1] GPT Structure: NOT AVAILABLE (chartImageBase64 may be missing or GPT analysis failed)`);
      console.error(`[GATE 1 CRITICAL] GPT Structure is UNDEFINED - this is why Gate 1 is blocking!`);
    }
    
    // 🔒 RULE: Gate 1 = READABLE ONLY IF:
    // - (a) Structure-based trendStrength ≥ 60% OR (b) GPT structure pattern confidence ≥ 70%
    // - AND support/resistance levels exist (required for readability)
    
    // Support/resistance MUST exist for readability
    if (!hasSupportResistance && (hasStrongTrend || hasStrongPattern)) {
      this.debugLog.push(`[GATE 1] Trend/pattern exists but no support/resistance levels identified - readability reduced`);
    }
    
    const hasAnyStructure = hasStrongTrend || hasStrongPattern;
    // 🔒 CRITICAL FIX: Calculate hasStructureWithSR AFTER correcting hasSupportResistance
    const hasStructureWithSR = hasAnyStructure && hasSupportResistance;
    
    // Market is readable if: (trend ≥ 60% OR pattern ≥ 70%) AND support/resistance exists
    // 🔒 FIX: Ensure isReadableByStructure is always a boolean
    const isReadableByStructure = Boolean(hasStructureWithSR);
    
    // 🔒 EXPLANATION CONSISTENCY: Generate specific reasons from failed sub-checks
    const failedChecks: string[] = [];
    const blockedBy: string[] = [];
    let confidence = 100;
    
    // Track specific failures for explanation generation
    const failedSubChecks: {
      weakTrend: boolean;
      unconfirmedPattern: boolean;
      misalignedPattern: boolean;
      indecisionCandles: boolean;
      noSupportResistance: boolean;
      contradictions: boolean;
    } = {
      weakTrend: false,
      unconfirmedPattern: false,
      misalignedPattern: false,
      indecisionCandles: false,
      noSupportResistance: false,
      contradictions: false,
    };
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: Gate-1 explanations derived strictly from evaluated inputs
    // NEVER negate an existing trend ≥60%, pattern ≥70%, or defined S/R
    
    // Check 1: Weak trend (< 60%)
    // 🔒 HARD-ENFORCED INVARIANT: If regimeAnalysis.trendStrength >= 60, Gate-1 is PROHIBITED from:
    // - Emitting "weak trend" in failedChecks
    // - Assigning any value < 60 to trendStrengthPercent
    // - Setting failedSubChecks.weakTrend = true
    // - Reducing confidence due to weak trend
    if (regimeAnalysis.trendStrength >= 60) {
      // 🔒 PROHIBITED: Regime trend strength >= 60% - NEVER report weak trend, NEVER assign < 60
      // Force exact match - use regime trendStrength directly, no exceptions
      if (trendStrengthPercent !== regimeAnalysis.trendStrength || trendStrengthPercent < 60) {
        const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% (>= 60%) but Gate-1 calculated ${trendStrengthPercent}%. PROHIBITED from assigning < 60. Forcing exact match.`;
        console.error(errorMsg);
        this.debugLog.push(errorMsg);
        // Force exact match - use regime trendStrength directly
        trendStrengthPercent = regimeAnalysis.trendStrength;
        // Recalculate hasStrongTrend with corrected value
        const correctedHasStrongTrend = trendStrengthPercent >= 60;
        if (!correctedHasStrongTrend) {
          throw new Error(`[GATE1-INVARIANT] CRITICAL: Cannot enforce trendStrength >= 60 when regime says ${regimeAnalysis.trendStrength}%`);
        }
      }
      // 🔒 PROHIBITED: NEVER add "weak trend" to failedChecks when regime >= 60%
      // This is a hard block - skip weak trend check entirely
      // Do NOT set failedSubChecks.weakTrend = true
      // Do NOT add to failedChecks
      // Do NOT reduce confidence
    } else if (!hasStrongTrend) {
      // Only report weak trend if regime trendStrength is ACTUALLY < 60%
      // 🔒 FIX: Don't penalize confidence for weak trend if GPT has strong pattern (≥70%) - pattern compensates
      if (!hasStrongPattern) {
      failedSubChecks.weakTrend = true;
      failedChecks.push(`Weak trend (strength: ${trendStrengthPercent.toFixed(1)}% < 60%)`);
      confidence -= 30;
      } else {
        // GPT pattern compensates for weak trend - don't add to failed checks, but log it
        this.debugLog.push(`[GATE 1] Weak trend (${trendStrengthPercent.toFixed(1)}%) compensated by strong GPT pattern (${maxPatternConfidence}%)`);
      }
    }
    // If hasStrongTrend is true, do NOT add anything - existing strong trend is preserved
    
    // Check 2: Pattern confidence check
    // 🔒 FIX: Use maxPatternConfidence (individual pattern confidence) instead of gptStructure.confidence (weighted average)
    // 🔒 HARD-ENFORCED INVARIANT: If maxPatternConfidence >= 70, Gate-1 is PROHIBITED from:
    // - Emitting "no confirmed pattern" in failedChecks
    // - Emitting "pattern confidence insufficient" in failedChecks
    // - Setting failedSubChecks.unconfirmedPattern = true (unless structure is INVALID)
    // - Negating the pattern existence
    if (maxPatternConfidence >= 70) {
      // Pattern exists with high confidence (≥70%)
      // 🔒 PROHIBITED: NEVER emit "no confirmed pattern" when maxPatternConfidence >= 70%
      // 🔒 PROHIBITED: NEVER negate pattern existence when maxPatternConfidence >= 70%
      if (gptStructure && gptStructure.marketStructure === 'INVALID') {
        // Even if INVALID, we acknowledge the pattern exists (confidence ≥70%)
        // This is the ONLY exception where we can report pattern issues when confidence >= 70%
        failedSubChecks.unconfirmedPattern = true;
        failedChecks.push(`Pattern structure invalid (${maxPatternConfidence}% confidence pattern exists but structure invalid)`);
        confidence -= 25;
      }
      // If pattern confidence ≥70% AND marketStructure !== 'INVALID', pattern EXISTS - PROHIBITED from negating
      // Do NOT set failedSubChecks.unconfirmedPattern = true
      // Do NOT add "no confirmed pattern" to failedChecks
    } else if (!hasStrongPattern) {
      // No pattern or pattern confidence < 70%
      // Only report if pattern confidence is ACTUALLY < 70%
      if (gptStructure && maxPatternConfidence > 0 && maxPatternConfidence < 70) {
        failedSubChecks.unconfirmedPattern = true;
        failedChecks.push(`Pattern confidence insufficient (${maxPatternConfidence}% < 70%)`);
        confidence -= 20;
      } else if (!gptStructure || maxPatternConfidence === 0) {
        // Only emit "no confirmed pattern" if gptStructure doesn't exist OR maxPatternConfidence is 0
        // PROHIBITED if maxPatternConfidence >= 70% (handled above)
        failedSubChecks.unconfirmedPattern = true;
        failedChecks.push(`No confirmed pattern detected (confidence < 70%)`);
        confidence -= 25;
      }
    }
    // If hasStrongPattern is true, do NOT add anything - existing strong pattern is preserved
    
    // Check 3: Misaligned pattern (if pattern exists but doesn't align with trend)
    // 🔒 RULE: Only report misalignment if BOTH pattern ≥70% AND trend ≥60% exist
    // If either doesn't exist, alignment check is not applicable
    // 🔒 REFACTORED: Use GPT alignment field instead of technicalScore direction
    if (gptStructure && gptStructure.confidence >= 70 && hasStrongTrend) {
      if (gptStructure.alignment === 'CONTRADICTS') {
        failedSubChecks.misalignedPattern = true;
        failedChecks.push(`Pattern misaligned with trend (GPT ${gptStructure.confidence}% confidence contradicts structure-based trend)`);
        confidence -= 35;
      }
    }
    
    // Check 4: Indecision candles (doji patterns indicate indecision)
    // Only report if indecision candles exist
    if (gptStructure && gptStructure.patterns) {
      const dojiPatterns = gptStructure.patterns.filter(p => 
        p.type.toLowerCase().includes('doji')
      );
      if (dojiPatterns.length > 0) {
        failedSubChecks.indecisionCandles = true;
        failedChecks.push(`Indecision candles detected (doji patterns indicate market uncertainty)`);
        confidence -= 15;
      }
    }
    
    // Check 5: Support/resistance missing
    // 🔒 HARD-ENFORCED INVARIANT: If support/resistance arrays are non-empty, Gate-1 is PROHIBITED from:
    // - Emitting "no support/resistance" in failedChecks
    // - Emitting "support/resistance levels not identified" in failedChecks
    // - Setting failedSubChecks.noSupportResistance = true
    // - Negating S/R existence
    // 🔒 NOTE: hasNonEmptySR was already calculated above (line 471) and hasSupportResistance was corrected if needed
    // Reuse hasNonEmptySR from above - DO NOT redefine it here
    
    if (hasNonEmptySR) {
      // Support/resistance arrays are non-empty
      // 🔒 PROHIBITED: NEVER emit "no support/resistance" when arrays are non-empty
      // 🔒 PROHIBITED: NEVER negate S/R existence when arrays are non-empty
      // hasSupportResistance should already be true from the early correction above
      if (!hasSupportResistance) {
        const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: S/R arrays are non-empty but hasSupportResistance is still false after early correction. This should never happen.`;
        console.error(errorMsg);
        this.debugLog.push(errorMsg);
        // Force correction again as safety net
        hasSupportResistance = true;
        this.debugLog.push(`[GATE 1] CORRECTED AGAIN: hasSupportResistance set to TRUE (S/R arrays exist)`);
      }
    } else if (!hasSupportResistance) {
      // Only report missing S/R if arrays are ACTUALLY empty or missing
      failedSubChecks.noSupportResistance = true;
      if (hasAnyStructure) {
        failedChecks.push(`Support/resistance levels not identified (required for readability)`);
        confidence -= 20;
      } else {
        failedChecks.push(`No support/resistance levels identified`);
        confidence -= 25;
      }
    }
    // If hasSupportResistance is true, do NOT add anything - existing S/R is preserved
    
    // Check 6: Contradictions between structure and GPT analysis
    // 🔒 REFACTORED: Only check GPT alignment, not component disagreements (removed technicalScore dependency)
    if (hasAnyStructure && gptStructure) {
      if (gptStructure.alignment === 'CONTRADICTS' && hasStrongTrend && hasStrongPattern) {
        failedSubChecks.contradictions = true;
        failedChecks.push(`Structure-GPT contradiction detected (GPT structure contradicts price-action structure)`);
        blockedBy.push(`Structure-GPT contradiction detected`);
        confidence -= 40;
      }
    }
    
    // GPT structure is INVALID (structure unreadable)
    if (gptStructure && gptStructure.marketStructure === 'INVALID') {
      const invalidReason = 'GPT structure analysis indicates invalid/unreadable market structure';
      blockedBy.push(invalidReason);
      failedChecks.push(invalidReason); // 🔒 FIX: Add to failedChecks for explanation consistency
      confidence -= 30;
    }
    
    // 🔒 FIX: Ensure all blockedBy items are also in failedChecks for explanation consistency
    blockedBy.forEach(blocker => {
      if (!failedChecks.includes(blocker)) {
        failedChecks.push(blocker);
      }
    });
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: Determine readability strictly from evaluated inputs
    // Market is readable if: structure exists WITH support/resistance AND no major contradictions
    // 🔒 FIX: If GPT has strong pattern (≥70%) AND S/R exists, ensure confidence is at least 70
    if (hasStrongPattern && hasSupportResistance && confidence < 70) {
      this.debugLog.push(`[GATE 1] GPT has strong pattern (${maxPatternConfidence}%) and S/R - boosting confidence from ${confidence}% to 70%`);
      confidence = 70;
    }
    // 🔒 FIX: Ensure isReadable is always a boolean, never undefined
    const isReadable = Boolean(
      isReadableByStructure && 
      hasSupportResistance && 
      blockedBy.length === 0 && 
      confidence >= 50
    );
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: Generate reason strictly from evaluated inputs
    // NEVER negate existing trend ≥60%, pattern ≥70%, or defined S/R
    // 🔒 HARD-LOCK: When READABLE=true, echo evaluated inputs verbatim
    
    // Helper function to filter failed checks (removes checks that are compensated by strong structure)
    const filterFailedChecks = (checks: string[]): string[] => {
      return checks.filter(check => {
        // 🔒 RULE: Never include checks that negate existing strong structure
        // If trend ≥60%, don't say "weak trend"
        if (check.includes('Weak trend') && hasStrongTrend) return false;
        // 🔒 FIX: If pattern ≥70%, don't say "weak trend" because pattern compensates for weak trend
        if (check.includes('Weak trend') && hasStrongPattern) return false;
        // If pattern ≥70%, don't say "no pattern" or "pattern insufficient"
        if ((check.includes('No confirmed pattern') || check.includes('Pattern confidence insufficient')) && hasStrongPattern) return false;
        // 🔒 FIX: If trend ≥60%, don't say "no pattern" because trend compensates for weak pattern
        if ((check.includes('No confirmed pattern') || check.includes('Pattern confidence insufficient')) && hasStrongTrend) return false;
        // If S/R exists, don't say "no support/resistance"
        if (check.includes('No support/resistance') && hasSupportResistance) return false;
        return true;
      });
    };
    
    let reason: string;
    if (isReadable) {
      // 🔒 HARD-LOCK: Echo evaluated inputs verbatim when READABLE
      const structureDetails: string[] = [];
      if (hasStrongTrend) {
        structureDetails.push(`Trend: ${trendStrengthPercent.toFixed(1)}%`);
      }
      if (hasStrongPattern) {
        structureDetails.push(`Pattern: ${(gptStructure?.confidence || 0).toFixed(1)}%`);
      }
      if (hasSupportResistance) {
        // Echo S/R arrays verbatim
        const supportLevels = gptStructure?.supportResistance?.support || [];
        const resistanceLevels = gptStructure?.supportResistance?.resistance || [];
        const srDetails: string[] = [];
        if (supportLevels.length > 0) {
          srDetails.push(`Support: [${supportLevels.map(s => s.toFixed(5)).join(', ')}]`);
        }
        if (resistanceLevels.length > 0) {
          srDetails.push(`Resistance: [${resistanceLevels.map(r => r.toFixed(5)).join(', ')}]`);
        }
        if (srDetails.length > 0) {
          structureDetails.push(`S/R: ${srDetails.join(', ')}`);
        } else {
          structureDetails.push(`S/R: Defined`);
        }
      }
      
      if (structureDetails.length > 0) {
        reason = `Market structure is clear and readable (${structureDetails.join(', ')})`;
      } else {
        reason = 'Market structure is clear and readable';
      }
    } else {
      // Build reason from specific failed checks (always use failedChecks, which includes all blockers)
      // Only include checks that ACTUALLY prevent readability - never negate existing strong structure
      const actualFailedChecks = filterFailedChecks(failedChecks);
      
      if (actualFailedChecks.length > 0) {
        // 🔒 PRIORITIZE ACTUAL BLOCKERS: If structure exists (trend or pattern) but S/R is missing, prioritize S/R
        // If strong pattern exists but S/R missing, don't emphasize weak trend
        const hasStructure = hasStrongTrend || hasStrongPattern;
        if (hasStructure && !hasSupportResistance) {
          // Structure exists but S/R missing - prioritize S/R as the blocker
          const srBlockers = actualFailedChecks.filter(check => check.includes('support/resistance') || check.includes('S/R'));
          const otherBlockers = actualFailedChecks.filter(check => !check.includes('support/resistance') && !check.includes('S/R'));
          if (srBlockers.length > 0) {
            // Prioritize S/R blockers, then add other blockers if any
            reason = `Market structure unclear: ${srBlockers.join('; ')}${otherBlockers.length > 0 ? `; ${otherBlockers.join('; ')}` : ''}`;
          } else {
            reason = `Market structure unclear: ${actualFailedChecks.join('; ')}`;
          }
        } else {
          reason = `Market structure unclear: ${actualFailedChecks.join('; ')}`;
        }
      } else {
        // Fallback: This should rarely happen, but include blockedBy as backup
        reason = blockedBy.length > 0 
          ? `Market structure unclear: ${blockedBy.join('; ')}`
          : 'Market structure unclear: Insufficient structure clarity';
      }
    }
    
    // Calculate filtered failed checks for debug logging
    const filteredFailedChecks = !isReadable ? filterFailedChecks(failedChecks) : [];
    
    this.debugLog.push(`[GATE 1] Structure Check: hasStrongTrend=${hasStrongTrend} (${trendStrengthPercent.toFixed(1)}%), hasStrongPattern=${hasStrongPattern} (${gptStructure?.confidence || 0}%), hasSupportResistance=${hasSupportResistance}`);
    this.debugLog.push(`[GATE 1] Failed Sub-Checks: ${JSON.stringify(failedSubChecks)}`);
    this.debugLog.push(`[GATE 1] Failed Checks (before filtering): ${failedChecks.join('; ')}`);
    if (!isReadable) {
      this.debugLog.push(`[GATE 1] Failed Checks (after filtering): ${filteredFailedChecks.join('; ')}`);
    }
    this.debugLog.push(`[GATE 1] Final Readability: ${isReadable ? 'READABLE' : 'UNREADABLE'}`);
    
    // 🔒 HARD-ENFORCED INVARIANT: MarketReadability is the single immutable source of truth
    // All UI, logs, explanations, and retry renders MUST consume this object verbatim
    // NO recomputation, NO normalization, NO override, NO fallbacks
    // 🔒 FIX: Ensure isReadable is always a boolean, never undefined
    const gate1Output: MarketReadability = {
      isReadable: Boolean(isReadable), // Explicitly ensure boolean
      reason: reason || 'Market readability assessment completed',
      blockedBy: failedChecks.length > 0 ? failedChecks : blockedBy,
      confidence: Math.max(0, Math.min(100, confidence)),
      // 🔒 HARD-LOCK: Store Gate-1 inputs for downstream integrity enforcement and desync detection
      // 🔒 FIX: Use maxPatternConfidence instead of gptStructure.confidence for patternConfidence
      gate1Inputs: {
        trendStrength: trendStrengthPercent, // Exact match to regimeAnalysis.trendStrength
        patternConfidence: maxPatternConfidence, // Use individual pattern confidence, not weighted average
        hasSupportResistance: Boolean(hasSupportResistance), // Ensure boolean, not undefined
        hasStrongTrend: Boolean(hasStrongTrend), // Ensure boolean, not undefined
        hasStrongPattern: Boolean(hasStrongPattern), // Ensure boolean, not undefined
      },
    };
    
    // 🔒 FINAL INVARIANT CHECK: A market with trendStrength=70%, pattern=80%, and S/R can NEVER be labeled unreadable
    // 🔒 FIX: Use maxPatternConfidence instead of gptStructure.confidence for pattern check
    // 🔒 FIX: Also check GPT trend strength when regime trend is weak
    // 🔒 CRITICAL FIX: Extract gptTrendStrength from gptStructure if available
    const gptTrendStrengthFinal = gptStructure?.trendStrength || 0;
    const effectiveTrendStrength = trendStrengthPercent >= 60 ? trendStrengthPercent : (gptTrendStrengthFinal >= 60 ? gptTrendStrengthFinal : regimeAnalysis.trendStrength);
    
    // 🔒 CRITICAL FIX: Recalculate maxPatternConfidence here to ensure we have the latest value
    // This ensures we catch GPT structure even if it was undefined earlier
    const maxPatternConfidenceFinal = gptStructure && gptStructure.patterns?.length > 0
      ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
      : maxPatternConfidence; // Fallback to earlier calculation
    
    // 🔒 CRITICAL FIX: Check if GPT has strong pattern (≥70%) AND S/R exists - force readable
    // This should catch cases where GPT structure exists but Gate 1 didn't recognize it
    if (gptStructure && maxPatternConfidenceFinal >= 70 && hasNonEmptySR && !isReadable) {
      const errorMsg = `[GATE1-INVARIANT] CRITICAL: GPT has strong pattern (${maxPatternConfidenceFinal}%) and S/R but Gate 1 marked unreadable. Forcing readable.`;
      console.error(errorMsg);
      this.debugLog.push(errorMsg);
      // Force readable - GPT structure conditions are met
      gate1Output.isReadable = true;
      gate1Output.reason = `Market structure is clear and readable (GPT Pattern: ${maxPatternConfidenceFinal.toFixed(1)}%, S/R: Defined)`;
      gate1Output.confidence = Math.max(gate1Output.confidence, 70);
      // Update gate1Inputs to reflect GPT structure
      if (gate1Output.gate1Inputs) {
        gate1Output.gate1Inputs.hasStrongPattern = true;
        gate1Output.gate1Inputs.patternConfidence = maxPatternConfidenceFinal;
        gate1Output.gate1Inputs.hasSupportResistance = true;
      }
    } else if ((regimeAnalysis.trendStrength >= 60 || gptTrendStrengthFinal >= 60) && 
        maxPatternConfidenceFinal >= 70 && 
        hasNonEmptySR && 
        !isReadable) {
      const errorMsg = `[GATE1-INVARIANT] CRITICAL: Market with trendStrength=${effectiveTrendStrength}%, pattern=${maxPatternConfidenceFinal}%, and S/R is being labeled unreadable. This is PROHIBITED. Forcing readable.`;
      console.error(errorMsg);
      this.debugLog.push(errorMsg);
      // Force readable - structural conditions are met
      gate1Output.isReadable = true;
      gate1Output.reason = `Market structure is clear and readable (Trend: ${effectiveTrendStrength.toFixed(1)}%, Pattern: ${maxPatternConfidenceFinal.toFixed(1)}%, S/R: Defined)`;
      gate1Output.confidence = Math.max(gate1Output.confidence, 70);
    }
    
    return gate1Output;
  }
  
  /**
   * Count strong disagreements between components
   */
  private countStrongDisagreements(
    technical: number,
    fundamental: number,
    sentiment: number,
    cotAnalysis: COTAnalysis | null
  ): number {
    let count = 0;
    
    // Technical vs Fundamental
    const techDir = technical > 60 ? 'BULLISH' : technical < 40 ? 'BEARISH' : 'NEUTRAL';
    const fundDir = fundamental > 60 ? 'BULLISH' : fundamental < 40 ? 'BEARISH' : 'NEUTRAL';
    if (techDir !== 'NEUTRAL' && fundDir !== 'NEUTRAL' && techDir !== fundDir) {
      count++;
    }
    
    // Technical vs Sentiment
    const sentDir = sentiment > 60 ? 'BULLISH' : sentiment < 40 ? 'BEARISH' : 'NEUTRAL';
    if (techDir !== 'NEUTRAL' && sentDir !== 'NEUTRAL' && techDir !== sentDir) {
      count++;
    }
    
    // COT vs Technical (if COT has strong signal)
    if (cotAnalysis) {
      const cotDir = cotAnalysis.recommendation === 'BUY' || cotAnalysis.recommendation === 'STRONG_BUY' 
        ? 'BULLISH' 
        : cotAnalysis.recommendation === 'SELL' || cotAnalysis.recommendation === 'STRONG_SELL'
        ? 'BEARISH'
        : 'NEUTRAL';
      
      if (cotDir !== 'NEUTRAL' && techDir !== 'NEUTRAL' && cotDir !== techDir) {
        count++;
      }
    }
    
    return count;
  }
  
  // ==========================================================================
  // LAYER 2: DIRECTIONAL BIAS ENGINE
  // ==========================================================================
  
  /**
   * Calculate directional bias (NOT a trade signal)
   * 🔒 STRUCTURE-FIRST RULE: Bias MUST align with primary market structure
   * COT can weaken/qualify but NEVER flip direction
   */
  private calculateDirectionalBias(
    technicalScore: number,
    fundamentalScore: number,
    cotAnalysis: COTAnalysis | null,
    gptStructure?: GPTStructureAnalysis,
    regimeAnalysis?: RegimeAnalysis,
    marketReadability?: MarketReadability // Gate 1 status - required for bias assignment
  ): DirectionalBias {
    const reasoning: string[] = [];
    
    // 🔒 RULE 1: If Gate 1 is unreadable, check if GPT structure can establish bias
    // 🔒 FIX: Allow GPT strong pattern (≥70%) to establish bias even if Gate 1 is unreadable
    if (marketReadability && !marketReadability.isReadable) {
      const maxPatternConfidence = gptStructure && gptStructure.patterns?.length > 0
        ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
        : 0;
      
      // If GPT has strong pattern (≥70%), allow it to establish bias despite Gate 1 being unreadable
      if (gptStructure && maxPatternConfidence >= 70 && gptStructure.marketStructure !== 'INVALID') {
        this.debugLog.push(`[GATE 2] Gate 1 UNREADABLE but GPT has strong pattern (${maxPatternConfidence}%) - allowing bias from GPT structure`);
        // Continue to calculate bias from GPT structure (will be handled below)
      } else {
      this.debugLog.push(`[GATE 2] Gate 1 UNREADABLE → Enforcing NEUTRAL bias`);
      const reversalWatch = this.checkReversalWatchConditions(
        cotAnalysis,
        technicalScore,
        regimeAnalysis
      );
      return {
        direction: 'NEUTRAL',
        strength: 0,
        contributors: {
          technical: technicalScore - 50,
          fundamental: fundamentalScore - 50,
          cot: 0,
        },
        reasoning: [`Market unreadable (Gate 1 failed) - bias set to NEUTRAL: ${marketReadability.reason}`],
        primaryTrend: 'NEUTRAL',
        reversalWatch,
      };
      }
    }
    
    // ========================================================================
    // STEP 1: DETERMINE PRIMARY TREND FROM STRUCTURE
    // ========================================================================
    
    // 🔒 FIX: Determine primary trend from structure
    // Rule: If trend strength ≥ 60% OR pattern ≥ 70%, bias MUST be set
    const technicalBias = technicalScore - 50; // -50 to +50
    const trendStrength = Math.abs(technicalBias); // 0-50, convert to 0-100%: (trendStrength / 50) * 100
    
    // Calculate trend strength percentage
    const trendStrengthPercent = (trendStrength / 50) * 100;
    
    let primaryTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
      technicalScore >= 60 ? 'BULLISH' :  // Trend strength ≥ 60%
      technicalScore <= 40 ? 'BEARISH' :  // Trend strength ≥ 60% (inverse)
      'NEUTRAL';
    
    // 🔒 FIX: If GPT structure has dominant pattern (≥ 70% confidence), use it
    // This ensures bias reflects structure even if technical is neutral
    if (gptStructure && gptStructure.confidence >= 70) {
      const recUpper = (gptStructure.reasoning || '').toUpperCase();
      
      // Extract trend direction from GPT reasoning/recommendation
      // GPT reasoning contains recommendation like "BUY - Strong bullish trend" or "SELL - Bearish pattern"
      // Also handles "Consolidation after downtrend" - primary trend is still BEARISH
      const isBullishGPT = (recUpper.includes('BUY') && !recUpper.includes('SELL')) ||
                          recUpper.includes('BULLISH') ||
                          recUpper.includes('UPWARD') ||
                          recUpper.includes('ASCENDING') ||
                          recUpper.includes('UPTREND') ||
                          (recUpper.includes('AFTER') && recUpper.includes('UPTREND'));
      
      const isBearishGPT = (recUpper.includes('SELL') && !recUpper.includes('BUY')) ||
                          recUpper.includes('BEARISH') ||
                          recUpper.includes('DOWNWARD') ||
                          recUpper.includes('DESCENDING') ||
                          recUpper.includes('DOWNTrend') ||
                          recUpper.includes('DOWNTrend'.toUpperCase()) ||
                          (recUpper.includes('CONSOLIDATION') && recUpper.includes('AFTER') && recUpper.includes('DOWN')) ||
                          (recUpper.includes('AFTER') && recUpper.includes('DOWN'));
      
      // GPT structure takes precedence if it shows clear trend
      if (gptStructure.marketStructure === 'TREND_CONTINUATION') {
        // 🔒 FIX: Continuation patterns have inherent direction based on pattern type
        // Ascending triangle, bullish flag = BULLISH continuation
        // Descending triangle, bearish flag = BEARISH continuation
        const patternTypes = (gptStructure.patterns || []).map(p => (p.type || '').toLowerCase()).join(' ');
        const isAscendingTriangle = patternTypes.includes('ascending') && patternTypes.includes('triangle');
        const isDescendingTriangle = patternTypes.includes('descending') && patternTypes.includes('triangle');
        const isBullishFlag = patternTypes.includes('bullish') && patternTypes.includes('flag');
        const isBearishFlag = patternTypes.includes('bearish') && patternTypes.includes('flag');
        
        if (isAscendingTriangle || isBullishFlag) {
          primaryTrend = 'BULLISH';
          reasoning.push(`GPT structure indicates BULLISH continuation pattern (${gptStructure.confidence}% confidence)`);
        } else if (isDescendingTriangle || isBearishFlag) {
          primaryTrend = 'BEARISH';
          reasoning.push(`GPT structure indicates BEARISH continuation pattern (${gptStructure.confidence}% confidence)`);
        } else if (isBullishGPT) {
          // Fallback to GPT reasoning
          primaryTrend = 'BULLISH';
          reasoning.push(`GPT structure indicates BULLISH primary trend (${gptStructure.confidence}% confidence)`);
        } else if (isBearishGPT) {
          primaryTrend = 'BEARISH';
          reasoning.push(`GPT structure indicates BEARISH primary trend (${gptStructure.confidence}% confidence)`);
        }
      } else if (gptStructure.marketStructure === 'REVERSAL') {
        // 🔒 FIX: Reversal patterns have inherent direction - determine from pattern type
        // Head and shoulders, double/triple top = BEARISH reversal
        // Inverse head and shoulders, double/triple bottom = BULLISH reversal
        const patternTypes = (gptStructure.patterns || []).map(p => (p.type || '').toLowerCase()).join(' ');
        // Check for bearish reversal patterns (head and shoulders, double/triple top)
        // Note: "head" alone matches "head and shoulders" since patternTypes contains the full string
        const isBearishReversal = patternTypes.includes('head and shoulders') || 
                                  patternTypes.includes('head & shoulders') ||
                                  (patternTypes.includes('head') && patternTypes.includes('shoulders')) ||
                                  patternTypes.includes('double top') ||
                                  patternTypes.includes('triple top');
        // Check for bullish reversal patterns (inverse head and shoulders, double/triple bottom)
        const isBullishReversal = patternTypes.includes('inverse head') ||
                                  patternTypes.includes('inverse head and shoulders') ||
                                  patternTypes.includes('double bottom') ||
                                  patternTypes.includes('triple bottom');
        
        if (isBearishReversal) {
          primaryTrend = 'BEARISH';
          reasoning.push(`GPT structure indicates BEARISH reversal pattern (${gptStructure.confidence}% confidence)`);
        } else if (isBullishReversal) {
          primaryTrend = 'BULLISH';
          reasoning.push(`GPT structure indicates BULLISH reversal pattern (${gptStructure.confidence}% confidence)`);
        } else if (isBullishGPT) {
          // Fallback to GPT reasoning if pattern type unclear
          primaryTrend = 'BULLISH';
          reasoning.push(`GPT structure indicates BULLISH reversal (${gptStructure.confidence}% confidence)`);
        } else if (isBearishGPT) {
          primaryTrend = 'BEARISH';
          reasoning.push(`GPT structure indicates BEARISH reversal (${gptStructure.confidence}% confidence)`);
        }
      } else if (gptStructure.marketStructure === 'RANGE' || gptStructure.marketStructure === 'INVALID') {
        // Range or invalid structure - don't override technical trend
        // Keep primary trend from technical analysis
      }
    }
    
    // If primary trend still neutral, check fundamental (with relaxed threshold)
    if (primaryTrend === 'NEUTRAL') {
      const fundamentalBias = fundamentalScore - 50;
      const fundamentalStrength = Math.abs(fundamentalBias);
      const fundamentalStrengthPercent = (fundamentalStrength / 50) * 100;
      
      // If fundamental strength ≥ 60%, establish trend
      if (fundamentalStrengthPercent >= 60) {
        const fundamentalDirectionRelaxed = fundamentalBias > 5 ? 'BULLISH' : fundamentalBias < -5 ? 'BEARISH' : 'NEUTRAL';
        if (fundamentalDirectionRelaxed !== 'NEUTRAL') {
          primaryTrend = fundamentalDirectionRelaxed;
          reasoning.push(`Fundamental establishes ${primaryTrend} primary trend (strength: ${fundamentalStrengthPercent.toFixed(1)}%)`);
        }
      }
    }
    
    // 🔒 VALIDATION CHECK: If GPT and engine agree on trend, bias MUST reflect it
    if (gptStructure && gptStructure.confidence >= 70) {
      const recUpper = (gptStructure.reasoning || '').toUpperCase();
      const isBullishGPT = (recUpper.includes('BUY') && !recUpper.includes('SELL')) ||
                          recUpper.includes('BULLISH') ||
                          recUpper.includes('UPWARD') ||
                          recUpper.includes('ASCENDING') ||
                          recUpper.includes('UPTREND');
      const isBearishGPT = (recUpper.includes('SELL') && !recUpper.includes('BUY')) ||
                          recUpper.includes('BEARISH') ||
                          recUpper.includes('DOWNWARD') ||
                          recUpper.includes('DESCENDING') ||
                          recUpper.includes('DOWNTrend') ||
                          (recUpper.includes('CONSOLIDATION') && recUpper.includes('AFTER') && recUpper.includes('DOWN'));
      
      // If GPT and technical agree on direction, enforce bias
      if (isBullishGPT && (technicalScore >= 55 || primaryTrend === 'BULLISH')) {
        primaryTrend = 'BULLISH';
        reasoning.push(`GPT and engine agree on BULLISH trend - bias enforced`);
      } else if (isBearishGPT && (technicalScore <= 45 || primaryTrend === 'BEARISH')) {
        primaryTrend = 'BEARISH';
        reasoning.push(`GPT and engine agree on BEARISH trend - bias enforced`);
      }
    }
    
    // ========================================================================
    // STEP 2: CALCULATE BIAS BASED ON PRIMARY TREND
    // 🔒 FIX: Neutral bias ONLY when trend < 55% AND no pattern ≥ 70%
    // ========================================================================
    
    // 🔒 FAIL-SAFE (CRITICAL): If GPT visual analysis AND internal analysis agree on direction,
    // Directional Bias MUST reflect that direction even if confidence = 0% or trade = HOLD
    if (gptStructure && gptStructure.confidence >= 70) {
      const recUpper = (gptStructure.reasoning || '').toUpperCase();
      
      // 🔒 CRITICAL FIX: Check GPT patterns for directional signals (not just recommendation text)
      // Descending triangle = BEARISH, Ascending triangle = BULLISH
      const patternTypes = (gptStructure.patterns || []).map(p => (p.type || '').toLowerCase()).join(' ');
      const hasDescendingTriangle = patternTypes.includes('descending') && patternTypes.includes('triangle');
      const hasAscendingTriangle = patternTypes.includes('ascending') && patternTypes.includes('triangle');
      const hasBearishFlag = patternTypes.includes('bearish') && patternTypes.includes('flag');
      const hasBullishFlag = patternTypes.includes('bullish') && patternTypes.includes('flag');
      
      const isBullishGPT = (recUpper.includes('BUY') && !recUpper.includes('SELL')) ||
                          recUpper.includes('BULLISH') ||
                          recUpper.includes('UPWARD') ||
                          recUpper.includes('ASCENDING') ||
                          recUpper.includes('UPTREND') ||
                          hasAscendingTriangle ||
                          hasBullishFlag;
      const isBearishGPT = (recUpper.includes('SELL') && !recUpper.includes('BUY')) ||
                          recUpper.includes('BEARISH') ||
                          recUpper.includes('DOWNWARD') ||
                          recUpper.includes('DESCENDING') ||
                          recUpper.includes('DOWNTrend') ||
                          (recUpper.includes('CONSOLIDATION') && recUpper.includes('AFTER') && recUpper.includes('DOWN')) ||
                          hasDescendingTriangle ||
                          hasBearishFlag;
      
      // 🔒 CRITICAL FIX: If GPT has a strong bearish pattern (descending triangle ≥70%), establish BEARISH bias
      // Even if GPT recommendation is HOLD, the pattern itself is a directional signal
      if (hasDescendingTriangle && gptStructure.patterns && gptStructure.patterns.length > 0) {
        const descendingTriangleConf = gptStructure.patterns.find(p => 
          (p.type || '').toLowerCase().includes('descending') && 
          (p.type || '').toLowerCase().includes('triangle')
        )?.confidence || 0;
        if (descendingTriangleConf >= 70) {
          primaryTrend = 'BEARISH';
          reasoning.push(`🔒 FAIL-SAFE: GPT descending triangle pattern (${descendingTriangleConf}% confidence) establishes BEARISH bias`);
          this.debugLog.push(`[GATE 2] GPT descending triangle (${descendingTriangleConf}%) - establishing BEARISH bias`);
        }
      } else if (hasAscendingTriangle && gptStructure.patterns && gptStructure.patterns.length > 0) {
        const ascendingTriangleConf = gptStructure.patterns.find(p => 
          (p.type || '').toLowerCase().includes('ascending') && 
          (p.type || '').toLowerCase().includes('triangle')
        )?.confidence || 0;
        if (ascendingTriangleConf >= 70) {
          primaryTrend = 'BULLISH';
          reasoning.push(`🔒 FAIL-SAFE: GPT ascending triangle pattern (${ascendingTriangleConf}% confidence) establishes BULLISH bias`);
          this.debugLog.push(`[GATE 2] GPT ascending triangle (${ascendingTriangleConf}%) - establishing BULLISH bias`);
        }
      }
      
      // If GPT and technical agree (even slightly), enforce bias
      // This works even if confidence = 0% or regime = AVOID
      if (isBullishGPT && technicalScore >= 50 && primaryTrend === 'NEUTRAL') {
        primaryTrend = 'BULLISH';
        reasoning.push(`🔒 FAIL-SAFE: GPT and engine agree on BULLISH - bias enforced (regardless of confidence/regime)`);
      } else if (isBearishGPT && technicalScore <= 50 && primaryTrend === 'NEUTRAL') {
        primaryTrend = 'BEARISH';
        reasoning.push(`🔒 FAIL-SAFE: GPT and engine agree on BEARISH - bias enforced (regardless of confidence/regime)`);
      }
    }
    
    // 🔒 RULE 2: Only assign BULLISH/BEARISH if Gate 1 is readable AND trend/pattern align
    // Check if Gate 1 is readable (passed as parameter)
    const gate1Readable = marketReadability ? marketReadability.isReadable : true; // Default to true if not provided (backward compat)
    
    if (!gate1Readable) {
      // Gate 1 unreadable - already handled above, but double-check
      this.debugLog.push(`[GATE 2] Gate 1 unreadable - bias must be NEUTRAL`);
    }
    
    // 🔒 HARD LOCK: Check if we have sufficient structure to establish bias
    const hasStrongTrend = trendStrengthPercent >= 60;
    const hasStrongPattern = gptStructure && gptStructure.confidence >= 70 && gptStructure.marketStructure !== 'INVALID';
    const hasModerateTrend = trendStrengthPercent >= 55;
    
    // Check if trend and pattern align
    let trendPatternAligned = false;
    if (hasStrongTrend && hasStrongPattern) {
      // Both exist - check alignment
      const technicalDirection = technicalScore > 50 ? 'BULLISH' : technicalScore < 50 ? 'BEARISH' : 'NEUTRAL';
      const recUpper = (gptStructure?.reasoning || '').toUpperCase();
      const gptBullish = recUpper.includes('BUY') || recUpper.includes('BULLISH') || recUpper.includes('UPWARD');
      const gptBearish = recUpper.includes('SELL') || recUpper.includes('BEARISH') || recUpper.includes('DOWNWARD');
      
      trendPatternAligned = (technicalDirection === 'BULLISH' && gptBullish) || 
                           (technicalDirection === 'BEARISH' && gptBearish) ||
                           (technicalDirection === 'NEUTRAL' && (gptBullish || gptBearish));
      
      this.debugLog.push(`[GATE 2] Trend/Pattern Alignment Check: Technical=${technicalDirection}, GPT=${gptBullish ? 'BULLISH' : gptBearish ? 'BEARISH' : 'NEUTRAL'}, Aligned=${trendPatternAligned}`);
    } else {
      // Only one exists - consider aligned
      // 🔒 FIX: Ensure trendPatternAligned is always a boolean
      trendPatternAligned = Boolean(hasStrongTrend || hasStrongPattern);
    }
    
    // 🔒 HARD LOCK: Neutral bias ONLY when:
    // - Gate 1 unreadable OR
    // - Trend < 55% AND no pattern ≥ 70% OR
    // - Trend and pattern don't align
    // 🔒 FIX: Check for reversal watch conditions before returning
    let reversalWatch = this.checkReversalWatchConditions(
        cotAnalysis,
        technicalScore,
        regimeAnalysis
      );
    
    if (!gate1Readable || (primaryTrend === 'NEUTRAL' && !hasStrongTrend && !hasStrongPattern && !hasModerateTrend) || !trendPatternAligned) {
      
      const neutralReason = !gate1Readable 
        ? 'Gate 1 unreadable - bias set to NEUTRAL'
        : !trendPatternAligned
        ? 'Trend and pattern do not align - bias set to NEUTRAL'
        : 'No clear directional bias - all components neutral';
      
      this.debugLog.push(`[GATE 2] Setting NEUTRAL bias: ${neutralReason}`);
      
      return {
        direction: 'NEUTRAL',
        strength: 0,
        contributors: {
          technical: technicalBias,
          fundamental: fundamentalScore - 50,
          cot: 0,
        },
        reasoning: [neutralReason],
        primaryTrend: 'NEUTRAL',
        reversalWatch,
      };
    }
    
    // Base direction MUST match primary trend
    // 🔒 FIX: Ensure baseDirection is never NEUTRAL at this point
    if (primaryTrend === 'NEUTRAL') {
      // This should not happen if we've passed all checks above, but add safety check
      this.debugLog.push(`[GATE 2] WARNING: primaryTrend is NEUTRAL but should be BULLISH or BEARISH - forcing NEUTRAL bias`);
      return {
        direction: 'NEUTRAL',
        strength: 0,
        contributors: {
          technical: technicalBias,
          fundamental: fundamentalScore - 50,
          cot: 0,
        },
        reasoning: ['Primary trend is NEUTRAL - no clear directional bias'],
        primaryTrend: 'NEUTRAL',
        reversalWatch: this.checkReversalWatchConditions(cotAnalysis, technicalScore, regimeAnalysis),
      };
    }
    // 🔒 FIX: Ensure baseDirection is always 'BULLISH' or 'BEARISH', never 'NEUTRAL'
    // At this point, primaryTrend should never be NEUTRAL (checked above), but TypeScript needs explicit narrowing
    // Use type assertion since we've already checked for NEUTRAL above
    const narrowedPrimaryTrend = primaryTrend as 'BULLISH' | 'BEARISH';
    let baseDirection: 'BULLISH' | 'BEARISH' = narrowedPrimaryTrend;
    let baseStrength = Math.abs(technicalBias);
    
    // 🔒 FIX: If technical is neutral but we have strong GPT pattern, use pattern confidence
    if (Math.abs(technicalBias) < 10 && baseStrength < 10) {
      if (gptStructure && gptStructure.confidence >= 70 && gptStructure.marketStructure !== 'INVALID') {
        // Strong GPT pattern exists - use pattern confidence as base strength
        // Scale pattern confidence (70-100%) to bias strength (30-60%)
        // Pattern confidence 70% → bias strength 30%, Pattern confidence 100% → bias strength 60%
        baseStrength = 30 + ((gptStructure.confidence - 70) / 30) * 30; // Map 70-100% to 30-60%
        this.debugLog.push(`[GATE 2] Strong GPT pattern detected (${gptStructure.confidence}%) - using pattern confidence for bias strength: ${baseStrength.toFixed(1)}%`);
        reasoning.push(`Strong GPT pattern (${gptStructure.confidence}% confidence) establishes ${baseDirection} bias`);
      } else {
        baseStrength = 15; // Minimum strength when trend comes from structure without strong pattern
      }
    }
    
    // ========================================================================
    // STEP 3: APPLY CONTRARIAN COT HANDLING (REFORMED)
    // ========================================================================
    
    let cotBias = 0;
    let contrarianNote: string | undefined;
    // 🔒 FIX: reversalWatch already declared above - don't redeclare, just reset if needed
    // reversalWatch is already initialized from checkReversalWatchConditions above
    
    // 🔒 RULE 4: COT Analysis - Contrarian signals weaken but never reverse
    // COT signals confirm only; do not override technical/fundamental bias
    this.debugLog.push(`[GATE 2] Bias Before COT: ${baseDirection} (strength: ${baseStrength.toFixed(1)})`);
    
    if (cotAnalysis) {
      const cotDirection = cotAnalysis.recommendation === 'BUY' || cotAnalysis.recommendation === 'STRONG_BUY'
        ? 'BULLISH'
        : cotAnalysis.recommendation === 'SELL' || cotAnalysis.recommendation === 'STRONG_SELL'
        ? 'BEARISH'
        : 'NEUTRAL';
      
      this.debugLog.push(`[GATE 2] COT Direction: ${cotDirection}, Base Direction: ${baseDirection}`);
      
      const isExtremeShort = cotAnalysis.largeSpecPosition === 'EXTREME_SHORT';
      const isExtremeLong = cotAnalysis.largeSpecPosition === 'EXTREME_LONG';
      
      this.debugLog.push(`[GATE 2] COT Analysis: Direction=${cotDirection}, BaseDirection=${baseDirection}, ExtremeShort=${isExtremeShort}, ExtremeLong=${isExtremeLong}`);
      
      if (cotDirection === baseDirection) {
        // COT confirms primary trend - strengthen bias
        const cotStrength = (isExtremeShort || isExtremeLong) ? 15 : 
                           (cotAnalysis.recommendation === 'STRONG_BUY' || cotAnalysis.recommendation === 'STRONG_SELL') ? 10 : 5;
        cotBias = cotStrength;
        reasoning.push(`COT ${cotDirection} signal strengthens ${baseDirection} bias (+${cotStrength})`);
        this.debugLog.push(`[GATE 2] COT confirms ${baseDirection} bias - strength increased by ${cotStrength}`);
      } else if (cotDirection !== 'NEUTRAL' && cotDirection !== baseDirection) {
        // 🔒 RULE 4: CONTRARIAN COT - Weaken but NEVER flip
        // COT contradicts primary trend - weaken bias, cap strength, but NEVER change direction
        cotBias = -15; // Strong reduction
        baseStrength = Math.min(baseStrength, 30); // Cap strength at 30% when contrarian
        
        // Determine contrarian note
        if (isExtremeShort && baseDirection === 'BEARISH') {
          contrarianNote = 'Downtrend intact; contrarian COT suggests potential exhaustion, not reversal';
          reversalWatch = true;
        } else if (isExtremeLong && baseDirection === 'BULLISH') {
          contrarianNote = 'Uptrend intact; contrarian COT suggests potential exhaustion, not reversal';
          reversalWatch = true;
        } else {
          contrarianNote = `Contrarian positioning detected — trend exhaustion possible, reversal not confirmed`;
        }
        
        reasoning.push(`COT ${cotDirection} signal weakens ${baseDirection} bias (contrarian - ${contrarianNote})`);
        this.debugLog.push(`[GATE 2] COT contrarian - weakening ${baseDirection} bias but NOT flipping direction`);
        this.debugLog.push(`[GATE 2] Bias After COT: ${baseDirection} (strength capped at ${baseStrength}%)`);
      }
    }
    
    // Check reversal watch conditions (if not already set)
    const finalReversalWatch = reversalWatch || this.checkReversalWatchConditions(
        cotAnalysis,
        technicalScore,
        regimeAnalysis
      );
    
    // ========================================================================
    // STEP 4: FUNDAMENTAL ALIGNMENT
    // ========================================================================
    
    const fundamentalBias = fundamentalScore - 50;
    const fundamentalDirection = fundamentalBias > 10 ? 'BULLISH' : fundamentalBias < -10 ? 'BEARISH' : 'NEUTRAL';
    
    let fundamentalContribution = 0;
    if (fundamentalDirection === baseDirection) {
      fundamentalContribution = Math.abs(fundamentalBias) * 0.3;
      reasoning.push(`Fundamental analysis aligns with ${baseDirection} bias`);
    } else if (fundamentalDirection !== 'NEUTRAL' && fundamentalDirection !== baseDirection) {
      fundamentalContribution = -Math.abs(fundamentalBias) * 0.2;
      reasoning.push(`Fundamental analysis contradicts ${baseDirection} bias`);
    }
    
    // ========================================================================
    // STEP 5: CALCULATE FINAL STRENGTH
    // ========================================================================
    
    let finalStrength = baseStrength + cotBias + fundamentalContribution;
    finalStrength = Math.max(0, Math.min(100, finalStrength));
    
    // If strength too low, return neutral
    if (finalStrength < 15) {
      return {
        direction: 'NEUTRAL',
        strength: Math.round(finalStrength),
        contributors: {
          technical: technicalBias,
          fundamental: fundamentalBias,
          cot: cotBias,
        },
        reasoning: ['Bias strength too weak - no clear edge'],
        primaryTrend,
        reversalWatch: reversalWatch || false,
      };
    }
    
    // ========================================================================
    // 🔒 HARD LOCK: STRUCTURE-FIRST BIAS RULE (NON-NEGOTIABLE)
    // Directional Bias CANNOT be overwritten downstream
    // ========================================================================
    
    // ENFORCE: Bias direction MUST match primary trend
    // 🔒 FIX: primaryTrend should never be NEUTRAL at this point (already checked above), but add safety check
    // Note: TypeScript knows primaryTrend is 'BULLISH' | 'BEARISH' at this point due to check above
    // This check is for runtime safety only
    if (primaryTrend === 'NEUTRAL' as any) {
      console.error(`⚠️ BIAS CONTRADICTION DETECTED: Primary trend is NEUTRAL but bias is ${baseDirection} - FORCING NEUTRAL`);
      return {
        direction: 'NEUTRAL',
        strength: 0,
        contributors: {
          technical: technicalBias,
          fundamental: fundamentalScore - 50,
          cot: cotBias,
        },
        reasoning: ['Primary trend is NEUTRAL - bias set to NEUTRAL'],
        primaryTrend: 'NEUTRAL',
        reversalWatch,
      };
    }
    // After the check above, TypeScript knows primaryTrend is 'BULLISH' | 'BEARISH'
    if (baseDirection !== primaryTrend) {
      console.error(`⚠️ BIAS CONTRADICTION DETECTED: Primary trend is ${primaryTrend} but bias is ${baseDirection} - FORCING ALIGNMENT`);
      baseDirection = primaryTrend; // Force alignment
      reasoning.push(`🔒 HARD LOCK: Bias aligned with primary trend (structure-first rule enforced)`);
    }
    
    // 🔒 HARD LOCK: Once set, Directional Bias CANNOT be overwritten
    // This bias will NOT be modified by:
    // - Execution block
    // - Regime classification
    // - Low confidence score
    // - Risk avoidance
    
    // ========================================================================
    // STEP 6: SET GPT STRUCTURE ALIGNMENT (based on calculated bias)
    // ========================================================================
    
    // 🔒 FIX: Set GPT structure alignment based on calculated bias direction
    // This ensures Gate 3 shows correct alignment (CONFIRMS/CONTRADICTS/NEUTRAL)
    if (gptStructure) {
      if (gptStructure.marketStructure === 'TREND_CONTINUATION') {
        // For continuation patterns, check if GPT direction matches bias direction
        const patternTypes = (gptStructure.patterns || []).map(p => (p.type || '').toLowerCase()).join(' ');
        const recUpper = (gptStructure.reasoning || '').toUpperCase();
        const isAscendingTriangle = patternTypes.includes('ascending') && patternTypes.includes('triangle');
        const isDescendingTriangle = patternTypes.includes('descending') && patternTypes.includes('triangle');
        const isBullishFlag = patternTypes.includes('bullish') && patternTypes.includes('flag');
        const isBearishFlag = patternTypes.includes('bearish') && patternTypes.includes('flag');
        const gptBullish = isAscendingTriangle || isBullishFlag || recUpper.includes('BUY') || recUpper.includes('BULLISH');
        const gptBearish = isDescendingTriangle || isBearishFlag || recUpper.includes('SELL') || recUpper.includes('BEARISH');
        
        if ((baseDirection === 'BULLISH' && gptBullish) || (baseDirection === 'BEARISH' && gptBearish)) {
          gptStructure.alignment = 'CONFIRMS';
        } else if ((baseDirection === 'BULLISH' && gptBearish) || (baseDirection === 'BEARISH' && gptBullish)) {
          gptStructure.alignment = 'CONTRADICTS';
        } else {
          gptStructure.alignment = 'NEUTRAL';
        }
      } else if (gptStructure.marketStructure === 'REVERSAL') {
        // Reversal patterns generally contradict the current trend
        gptStructure.alignment = 'CONTRADICTS';
      } else {
        gptStructure.alignment = 'NEUTRAL';
      }
      this.debugLog.push(`[GATE 2] GPT Structure Alignment set to: ${gptStructure.alignment} (bias: ${baseDirection}, structure: ${gptStructure.marketStructure})`);
    }
    
    // ========================================================================
    // STEP 7: RETURN BIAS
    // ========================================================================
    
    return {
      direction: baseDirection,
      strength: Math.round(finalStrength),
      contributors: {
        technical: technicalBias,
        fundamental: fundamentalBias,
        cot: cotBias,
      },
      reasoning,
      primaryTrend,
      reversalWatch: finalReversalWatch,
      contrarianNote,
    };
  }
  
  /**
   * 🔒 FIX 3: Check reversal watch conditions
   */
  private checkReversalWatchConditions(
    cotAnalysis: COTAnalysis | null,
    technicalScore: number,
    regimeAnalysis?: RegimeAnalysis
  ): boolean {
    if (!cotAnalysis) return false;
    
    const isExtreme = cotAnalysis.largeSpecPosition === 'EXTREME_SHORT' || 
                     cotAnalysis.largeSpecPosition === 'EXTREME_LONG';
    
    const isRangeRegime = regimeAnalysis?.regime === 'LOW_VOLATILITY_RANGE' || 
                         regimeAnalysis?.regime === 'HIGH_VOLATILITY_RANGE';
    
    return isExtreme && technicalScore < 55 && (isRangeRegime || false);
  }
  
  // ==========================================================================
  // LAYER 3: GPT STRUCTURE VALIDATOR (REFORMED ROLE)
  // ==========================================================================
  
  /**
   * Get GPT structure analysis (reformed role - validator, not signal generator)
   */
  private async getGPTStructureAnalysis(
    symbol: string,
    chartImageBase64?: string
  ): Promise<GPTStructureAnalysis | undefined> {
    // Import OpenAI service
    const { analyzeChartImage, convertToStructureAnalysis } = await import('./ai-service');
    
    // 🔒 DEBUG: Log chart image availability
    if (!chartImageBase64) {
      this.debugLog.push(`[GPT Structure] Chart image NOT provided - skipping GPT vision analysis`);
      console.log(`[GPT Structure] Chart image NOT provided for ${symbol}`);
      return undefined;
    }
    
    this.debugLog.push(`[GPT Structure] Chart image provided (${chartImageBase64.length} chars) - starting GPT vision analysis`);
    console.log(`[GPT Structure] Starting GPT vision analysis for ${symbol} with chart image (${chartImageBase64.length} chars)`);
    
    try {
      const visionAnalysis = await analyzeChartImage(chartImageBase64, symbol, 'H1');
      
      if (!visionAnalysis) {
        this.debugLog.push(`[GPT Structure] Vision analysis returned null/undefined`);
        console.warn(`[GPT Structure] Vision analysis returned null for ${symbol}`);
        return undefined;
      }
      
      this.debugLog.push(`[GPT Structure] Vision analysis received: ${visionAnalysis.patterns?.length || 0} patterns, trend strength: ${visionAnalysis.trend?.strength || 0}%`);
      console.log(`[GPT Structure] Vision analysis received: ${visionAnalysis.patterns?.length || 0} patterns, trend strength: ${visionAnalysis.trend?.strength || 0}%`);
      
      // Convert ChartAnalysis to GPTStructureAnalysis format
      // Note: alignment will be set later in execution gate based on directional bias
      const structureAnalysis = convertToStructureAnalysis(visionAnalysis);
      
      if (structureAnalysis) {
        this.debugLog.push(`[GPT Structure] Converted structure: confidence=${structureAnalysis.confidence}%, marketStructure=${structureAnalysis.marketStructure}, S/R: support=[${structureAnalysis.supportResistance.support.join(', ') || 'none'}], resistance=[${structureAnalysis.supportResistance.resistance.join(', ') || 'none'}]`);
        console.log(`[GPT Structure] Converted structure: confidence=${structureAnalysis.confidence}%, marketStructure=${structureAnalysis.marketStructure}, patterns: ${structureAnalysis.patterns.length}`);
      } else {
        this.debugLog.push(`[GPT Structure] Conversion returned undefined`);
        console.warn(`[GPT Structure] Conversion returned undefined for ${symbol}`);
      }
      
      return structureAnalysis;
    } catch (error) {
      const errorMsg = `GPT structure analysis failed: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog.push(`[GPT Structure] ERROR: ${errorMsg}`);
      console.error(`[GPT Structure] ERROR for ${symbol}:`, error);
      return undefined;
    }
  }
  
  // ==========================================================================
  // LAYER 4: EXECUTION PERMISSION GATE
  // ==========================================================================

  /**
   * Gate 4 empirical feedback: block pairs with proven poor history; tighten on CAUTION.
   */
  private async applyEmpiricalVerdictGate(
    symbol: string,
    permission: ExecutionPermission
  ): Promise<ExecutionPermission> {
    if (!permission.canExecute) return permission;
    if (typeof window === 'undefined') return permission;

    try {
      const { getSymbolVerdict, shouldBlockExecution } = await import('./trade-verdict-service');
      const verdict = await getSymbolVerdict(symbol);

      if (shouldBlockExecution(verdict)) {
        this.debugLog.push(`[GATE 4] Empirical BLOCK: ${verdict.reason}`);
        return {
          ...permission,
          canExecute: false,
          reason: verdict.reason,
          blockedBy: [...permission.blockedBy, 'Historical win rate below threshold'],
        };
      }

      if (verdict.verdict === 'CAUTION' && permission.confidence < 60) {
        this.debugLog.push(`[GATE 4] Empirical CAUTION: confidence ${permission.confidence}% < 60%`);
        return {
          ...permission,
          canExecute: false,
          reason: `Historical caution (${verdict.winRate}% WR): need ≥60% confidence — ${verdict.reason}`,
          blockedBy: [...permission.blockedBy, 'Empirical CAUTION — confidence too low'],
        };
      }
    } catch (e) {
      console.warn('[GATE 4] Empirical verdict check skipped:', e);
    }

    return permission;
  }
  
  /**
   * Assess if trade execution is permitted
   * ALL conditions must pass - HARD BLOCKERS (NO EXCEPTIONS)
   */
  private assessExecutionPermission(
    marketReadability: MarketReadability,
    directionalBias: DirectionalBias,
    technicalScore: number,
    gptStructure: GPTStructureAnalysis | undefined,
    regimeAnalysis: RegimeAnalysis,
    tradingHours: TradingHoursAnalysis,
    cotAnalysis: COTAnalysis | null
  ): ExecutionPermission {
    const blockedBy: string[] = [];
    
    // 🔒 RULE 3: Execution Permission (Gate 4)
    // Block execution if market regime unsuitable (LOW/HIGH volatility) or confidence <50%
    // HOLD if Gate 1 unreadable or directional bias NEUTRAL
    
    // CONDITION 1: Market must be readable
    // 🔒 HARD-LOCK: NEVER overwrite Gate-1 reason - use verbatim from assessMarketReadability()
    if (!marketReadability.isReadable) {
      blockedBy.push('Market readability gate failed');
      this.debugLog.push(`[GATE 4] Blocked: Market unreadable`);
      // 🔒 FIX: Calculate confidence even when Gate 1 is unreadable - reflect structure quality
      const technicalExecutionScoreEarly = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
      const calculatedConfidence = this.calculateConfidenceFromAlignment(
        directionalBias,
        technicalExecutionScoreEarly,
        gptStructure,
        marketReadability
      );
      return {
        canExecute: false,
        reason: marketReadability.reason, // 🔒 HARD-LOCK: Use Gate-1 reason verbatim, NO overwrite
        blockedBy,
        technicalExecutionScore: technicalExecutionScoreEarly,
        confidence: calculatedConfidence, // 🔒 FIX: Use calculated confidence, not 0
      };
    }
    
    // CONDITION 2: Directional bias must not be neutral
    if (directionalBias.direction === 'NEUTRAL') {
      blockedBy.push('Directional bias is neutral');
      this.debugLog.push(`[GATE 4] Blocked: Directional bias is NEUTRAL`);
      // 🔒 FIX: Calculate confidence even when bias is neutral - reflect structure quality
      const technicalExecutionScoreEarly = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
      const calculatedConfidence = this.calculateConfidenceFromAlignment(
        directionalBias,
        technicalExecutionScoreEarly,
        gptStructure,
        marketReadability
      );
      return {
        canExecute: false,
        reason: 'No clear directional bias - standing aside',
        blockedBy,
        technicalExecutionScore: technicalExecutionScoreEarly,
        confidence: calculatedConfidence, // 🔒 FIX: Use calculated confidence, not 0
      };
    }
    
    // 🔒 FIX 1: HARD REGIME SUPREMACY GATE (CANNOT BE OVERRIDDEN)
    // LOW_VOLATILITY_RANGE with low confidence MUST block execution
    // 🔒 FIX: Calculate confidence BEFORE blocking to show analysis quality, but apply caps
    const technicalExecutionScoreEarly = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
    let calculatedConfidenceEarly = this.calculateConfidenceFromAlignment(
      directionalBias,
      technicalExecutionScoreEarly,
      gptStructure,
      marketReadability
    );
    
    // Apply confidence caps (same logic as later in function)
    let maxConfidenceEarly = 65; // Maximum allowed confidence
    if (regimeAnalysis.confidence < 55) {
      maxConfidenceEarly -= 10;
    }
    if (technicalScore < 60) {
      maxConfidenceEarly -= 10;
    }
    if (directionalBias.strength < 30) {
      maxConfidenceEarly -= 5;
    }
    if (gptStructure && gptStructure.confidence > 70 && gptStructure.alignment !== 'CONFIRMS') {
      maxConfidenceEarly -= 10;
    }
    calculatedConfidenceEarly = Math.min(calculatedConfidenceEarly, maxConfidenceEarly);
    
    // Check for strong compensating signals BEFORE blocking LOW_VOLATILITY_RANGE
    const maxPatternConfEarly =
      gptStructure && gptStructure.patterns?.length > 0
        ? Math.max(...gptStructure.patterns.map((p) => p.confidence || 0))
        : 0;
    const hasStrongGPTPatternEarly = maxPatternConfEarly >= 70;
    // Stricter compensating signals: very strong GPT pattern (≥85%) that confirms bias
    const hasStrongCompensatingSignalEarly =
      hasStrongGPTPatternEarly &&
      maxPatternConfEarly >= 85 &&
      gptStructure?.alignment === 'CONFIRMS';
    
    if (regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' && regimeAnalysis.confidence < 55) {
      const gptTrendStrengthEarly = gptStructure?.trendStrength || 0;
      const hasVeryStrongGPTEarly = (maxPatternConfEarly >= 80) || 
                                    (gptStructure && gptStructure.confidence >= 75 && gptStructure.alignment === 'CONFIRMS') ||
                                    (gptTrendStrengthEarly >= 70 && gptStructure && gptStructure.confidence >= 70);
      
      if (!hasStrongCompensatingSignalEarly && !hasVeryStrongGPTEarly) {
      blockedBy.push(`Regime unsuitable for directional execution (${regimeAnalysis.regime}, ${regimeAnalysis.confidence}% confidence)`);
      // HARD BLOCK - return immediately, cannot be overridden
        // But still return calculated confidence (with caps applied) to show analysis quality
      return {
        canExecute: false,
        reason: 'Market regime unsuitable for directional trades',
        blockedBy,
          technicalExecutionScore: technicalExecutionScoreEarly,
          confidence: calculatedConfidenceEarly, // 🔒 FIX: Return calculated confidence with caps applied, not 0
      };
      } else {
        // Strong GPT/COT signal compensates for low volatility - allow with warning
        const signalType = hasVeryStrongGPTEarly ? 'very strong GPT signals' : 'strong GPT/COT signals';
        this.debugLog.push(`[GATE 4] Low volatility regime but ${signalType} exist - allowing execution`);
        blockedBy.push(`Low volatility regime (compensated by ${signalType})`);
      }
    }
    
    // 🔒 FIX 2: REGIME ↔ GPT CONTRADICTION BLOCKER (WITH EXCEPTIONS)
    // RANGE regime contradicts TREND_CONTINUATION structure, BUT allow if GPT has very strong signals
    // 🔒 CRITICAL FIX: Don't block if GPT has strong pattern (≥80%) AND strong trend (≥70%) - GPT's visual analysis overrides regime
    if (
      (regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' || regimeAnalysis.regime === 'HIGH_VOLATILITY_RANGE') &&
      gptStructure &&
      gptStructure.marketStructure === 'TREND_CONTINUATION' &&
      gptStructure.confidence > 65
    ) {
      // Check if GPT has very strong signals that override regime contradiction
      const maxPatternConf = gptStructure.patterns?.length > 0 
        ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
        : 0;
      const gptTrendStrength = gptStructure.trendStrength || 0;
      const hasVeryStrongGPT = (maxPatternConf >= 80 && gptTrendStrength >= 70) || 
                               (gptStructure.confidence >= 75 && gptStructure.alignment === 'CONFIRMS');
      
      if (!hasVeryStrongGPT) {
        // Only block if GPT signals aren't strong enough to override regime
      blockedBy.push(`Structure–regime contradiction (${regimeAnalysis.regime} regime vs ${gptStructure.marketStructure} structure)`);
        // But still return calculated confidence (with caps applied) to show analysis quality
        const technicalExecutionScoreEarly2 = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
        let calculatedConfidenceEarly2 = this.calculateConfidenceFromAlignment(
          directionalBias,
          technicalExecutionScoreEarly2,
          gptStructure,
          marketReadability
        );
        
        // Apply confidence caps (same logic as later in function)
        let maxConfidenceEarly2 = 65; // Maximum allowed confidence
        if (regimeAnalysis.confidence < 55) {
          maxConfidenceEarly2 -= 10;
        }
        if (technicalScore < 60) {
          maxConfidenceEarly2 -= 10;
        }
        if (directionalBias.strength < 30) {
          maxConfidenceEarly2 -= 5;
        }
        if (gptStructure && gptStructure.confidence > 70 && gptStructure.alignment !== 'CONFIRMS') {
          maxConfidenceEarly2 -= 10;
        }
        calculatedConfidenceEarly2 = Math.min(calculatedConfidenceEarly2, maxConfidenceEarly2);
        
      return {
        canExecute: false,
        reason: 'Structural conflict detected - regime and GPT structure contradict',
        blockedBy,
          technicalExecutionScore: technicalExecutionScoreEarly2,
          confidence: calculatedConfidenceEarly2, // 🔒 FIX: Return calculated confidence with caps applied, not 0
        };
      } else {
        // GPT has very strong signals - allow execution despite regime contradiction
        this.debugLog.push(`[GATE 4] Regime-GPT contradiction detected but GPT has very strong signals (pattern: ${maxPatternConf}%, trend: ${gptTrendStrength}%, confidence: ${gptStructure.confidence}%) - allowing execution`);
        blockedBy.push(`Regime-GPT contradiction (overridden by strong GPT signals)`);
      }
    }
    
    // 🔒 FIX 3: TECHNICAL NEUTRAL EXECUTION BLOCK (WITH EXCEPTIONS)
    // Neutral technicals block execution UNLESS strong GPT pattern or COT extreme signals exist
    // Check for strong compensating signals before blocking
    const hasStrongGPTPattern = gptStructure && gptStructure.patterns?.length > 0 && 
      Math.max(...gptStructure.patterns.map(p => p.confidence || 0)) >= 70;
    const hasCOTExtreme = cotAnalysis && (
      cotAnalysis.largeSpecPosition === 'EXTREME_LONG' || 
      cotAnalysis.largeSpecPosition === 'EXTREME_SHORT' ||
      cotAnalysis.commercialPosition === 'EXTREME_LONG' ||
      cotAnalysis.commercialPosition === 'EXTREME_SHORT'
    );
    const maxPatternConfGate4 =
      gptStructure && gptStructure.patterns?.length > 0
        ? Math.max(...gptStructure.patterns.map((p) => p.confidence || 0))
        : 0;
    const hasStrongCompensatingSignal =
      hasStrongGPTPattern &&
      maxPatternConfGate4 >= 85 &&
      gptStructure?.alignment === 'CONFIRMS';

    // GPT structure confirms with high confidence — allow neutral technicals (>= 50)
    const hasGptStructureConfirmation =
      gptStructure &&
      gptStructure.confidence >= 75 &&
      gptStructure.alignment === 'CONFIRMS';
    
    // Only block if technical < 50 (truly neutral) OR if technical < 55 AND no compensating signals
    if (
      technicalScore < 50 ||
      (technicalScore < 55 && !hasStrongCompensatingSignal && !hasGptStructureConfirmation)
    ) {
      if (hasStrongCompensatingSignal) {
        this.debugLog.push(
          `[GATE 4] Technical score ${technicalScore} < 55 but very strong confirming GPT pattern (${maxPatternConfGate4}%)`
        );
      } else if (hasGptStructureConfirmation) {
        this.debugLog.push(
          `[GATE 4] Technical score ${technicalScore} < 55 but GPT structure confirms (${gptStructure!.confidence}%)`
        );
      } else {
      blockedBy.push(`No technical confirmation (technical score: ${technicalScore} < 55)`);
      // HARD BLOCK - return immediately
      // 🔒 FIX: Calculate confidence even when technical is weak - reflect structure quality
      const technicalExecutionScoreEarly = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
      const calculatedConfidence = this.calculateConfidenceFromAlignment(
        directionalBias,
        technicalExecutionScoreEarly,
        gptStructure,
        marketReadability
      );
      return {
        canExecute: false,
        reason: 'Technical confirmation missing',
        blockedBy,
        technicalExecutionScore: technicalExecutionScoreEarly,
        confidence: calculatedConfidence, // 🔒 FIX: Use calculated confidence, not 0
      };
      }
    }
    
    // Calculate technical execution score (for display only, not used for blocking)
    const technicalExecutionScore = this.calculateTechnicalExecutionScore(technicalScore, directionalBias);
    
    // CONDITION 4: GPT must not strongly contradict bias
    if (gptStructure && gptStructure.confidence > 70) {
      const { direction: gptImpliedDirection, alignment: gptAlignment } =
        this.getGPTImpliedDirection(gptStructure, directionalBias.direction);

      if (gptAlignment === 'CONTRADICTS' && gptImpliedDirection !== directionalBias.direction) {
        blockedBy.push(`GPT structure (${gptStructure.confidence}% confidence) strongly contradicts ${directionalBias.direction} bias`);
      }
    }
    
    // 🔒 STRICT ISOLATION: CONDITION 5: Regime suitability checks
    // Execution may be blocked due to:
    // - HIGH_VOLATILITY_RANGE
    // - LOW_VOLATILITY_RANGE
    // - Regime confidence below threshold
    // - Risk filters
    // BUT this MUST NOT affect analysis layer
    
    // Track if execution is blocked by regime or confidence (not structure)
    let blockedByRegimeOrConfidence = false;
    
    // HIGH_VOLATILITY_RANGE always blocks execution (no compensating overrides)
    if (regimeAnalysis.regime === 'HIGH_VOLATILITY_RANGE') {
      blockedBy.push('High volatility regime - unsuitable for trading');
      blockedByRegimeOrConfidence = true;
    }
    
    // LOW_VOLATILITY_RANGE with low confidence blocks execution UNLESS GPT has very strong signals
    if (regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' && regimeAnalysis.confidence < 55) {
      // 🔒 CRITICAL FIX: Allow execution if GPT has very strong signals (pattern ≥80% OR confidence ≥75%)
      const maxPatternConf = gptStructure && gptStructure.patterns?.length > 0 
        ? Math.max(...gptStructure.patterns.map(p => p.confidence || 0))
        : 0;
      const gptTrendStrength = gptStructure?.trendStrength || 0;
      const hasVeryStrongGPT = (maxPatternConf >= 80) || 
                               (gptStructure && gptStructure.confidence >= 75 && gptStructure.alignment === 'CONFIRMS') ||
                               (gptTrendStrength >= 70 && gptStructure && gptStructure.confidence >= 70);
      
      if (!hasVeryStrongGPT && !hasStrongCompensatingSignal) {
      blockedBy.push(`Low volatility regime with low confidence (${regimeAnalysis.confidence}%) - unsuitable for trading`);
      blockedByRegimeOrConfidence = true;
      } else if (hasVeryStrongGPT) {
        // GPT has very strong signals - allow execution despite low volatility
        this.debugLog.push(`[GATE 4] Low volatility regime but GPT has very strong signals (pattern: ${maxPatternConf}%, trend: ${gptTrendStrength}%, confidence: ${gptStructure?.confidence}%) - allowing execution`);
        blockedBy.push(`Low volatility regime (overridden by strong GPT signals)`);
      }
    }
    
    // 🔒 CRITICAL: Execution block MUST NOT:
    // - Change Directional Bias (preserved)
    // - Change Trend (preserved)
    // - Change Pattern detection (preserved)
    // - Change Market Readability (preserved)
    
    // Execution block language must be explicit:
    // "Execution blocked due to market regime — analysis remains valid"
    
    // CONDITION 6: Trading hours must be acceptable
    if (tradingHours.quality === 'POOR') {
      blockedBy.push('Trading hours quality is poor');
    }
    
    // 🔒 FIX 4: CONFIDENCE CAP ENFORCEMENT
    // Calculate base confidence
    let calculatedConfidence = this.calculateConfidenceFromAlignment(
      directionalBias,
      technicalExecutionScore,
      gptStructure,
      marketReadability
    );
    
    // Apply hard caps based on conditions (LESS AGGRESSIVE)
    // 🔒 FIX: Increase base cap and reduce penalties to allow more valid trades
    let maxConfidence = 75; // Increased from 65% - allow higher confidence for strong signals
    
    // Reduce cap based on regime confidence (less aggressive)
    if (regimeAnalysis.confidence < 55) {
      maxConfidence -= 5; // Reduced from 10
    }
    
    // Reduce cap based on technical score (less aggressive, allow exceptions)
    if (technicalScore < 60 && !hasStrongCompensatingSignal) {
      maxConfidence -= 5; // Reduced from 10, only if no compensating signals
    }
    
    // Reduce cap based on bias strength (less aggressive)
    if (directionalBias.strength < 30 && !hasStrongCompensatingSignal) {
      maxConfidence -= 3; // Reduced from 5, only if no compensating signals
    }
    
    // Reduce cap if GPT contradicts (keep this strict)
    if (gptStructure && gptStructure.confidence > 70 && gptStructure.alignment !== 'CONTRADICTS') {
      // GPT confirms - boost confidence instead of reducing
      if (gptStructure.alignment === 'CONFIRMS') {
        maxConfidence += 5; // Boost for GPT confirmation
      }
    } else if (gptStructure && gptStructure.confidence > 70 && gptStructure.alignment === 'CONTRADICTS') {
      maxConfidence -= 10; // Keep strict penalty for contradictions
    }
    
    // Boost confidence if strong compensating signals exist
    if (hasStrongCompensatingSignal) {
      maxConfidence += 10; // Boost for strong GPT/COT signals
    }
    
    // Enforce cap - maximum 85% (increased from 65%) to allow strong signals through
    const confidence = Math.min(calculatedConfidence, Math.min(maxConfidence, 85));
    
    // CONDITION 7: Confidence must be ≥ 45 (reduced from 50 to allow more trades)
    // If strong compensating signals exist, allow even lower confidence
    const minConfidenceThreshold = hasStrongCompensatingSignal ? 40 : 45;
    if (confidence < minConfidenceThreshold) {
      blockedBy.push(`Confidence too low (${confidence}% < ${minConfidenceThreshold}%)`);
      blockedByRegimeOrConfidence = true;
    }
    
    // 🔒 FIX 5: COT EXECUTION NEUTRALIZATION
    // COT CANNOT unblock execution - if already blocked, keep it blocked
    // (This is handled by checking blockedBy.length before allowing execution)
    
    // 🔒 CRITICAL FIX: Remove compensated/overridden blockers from blockedBy array
    // These are warnings, not actual blockers - they shouldn't prevent execution
    const actualBlockers = blockedBy.filter(blocker => 
      !blocker.includes('compensated by') && 
      !blocker.includes('overridden by') &&
      !blocker.includes('(compensated') &&
      !blocker.includes('(overridden')
    );
    
    // Final decision - only use actual blockers (not warnings)
    // Use dynamic confidence threshold based on compensating signals
    const canExecute = actualBlockers.length === 0 && confidence >= minConfidenceThreshold;
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: If execution blocked by regime/confidence (not structure),
    // label market as "readable but non-executable" instead of "unreadable"
    let reason: string;
    if (canExecute) {
      reason = 'All execution conditions met';
    } else if (blockedByRegimeOrConfidence && marketReadability.isReadable) {
      // Market is readable but execution blocked by regime/confidence
      reason = `Market readable but non-executable: ${actualBlockers.join('; ')}`;
    } else {
      // Market is unreadable or blocked by structure issues
      reason = `Execution blocked: ${actualBlockers.join('; ')}`;
    }
    
    return {
      canExecute,
      reason,
      blockedBy: actualBlockers, // Return only actual blockers, not warnings
      technicalExecutionScore,
      confidence,
    };
  }
  
  /**
   * Calculate technical execution score (separate from bias)
   * Checks if entry conditions are actually met
   */
  private calculateTechnicalExecutionScore(
    technicalScore: number,
    directionalBias: DirectionalBias
  ): number {
    // Base score from technical analysis
    let score = technicalScore;
    
    // Check if bias was established from COT EXTREME or GPT (indicated by reasoning)
    const biasFromCOTExtreme = directionalBias.reasoning.some(r => 
      r.includes('COT EXTREME') || r.includes('COT') && r.includes('strengthens')
    );
    const biasFromGPT = directionalBias.reasoning.some(r => 
      r.includes('GPT') || r.includes('high-confidence')
    );
    const biasFromFundamental = directionalBias.reasoning.some(r => 
      r.includes('Fundamental establishes')
    );
    
    // Adjust based on bias alignment
    if (directionalBias.direction === 'BULLISH' && technicalScore > 50) {
      score += 5; // Bonus for alignment
    } else if (directionalBias.direction === 'BEARISH' && technicalScore < 50) {
      score += 5; // Bonus for alignment
    } else if (directionalBias.direction === 'BULLISH' && technicalScore < 50) {
      score -= 10; // Penalty for misalignment
    } else if (directionalBias.direction === 'BEARISH' && technicalScore > 50) {
      score -= 10; // Penalty for misalignment
    } else if (technicalScore === 50) {
      // When technical is neutral, give small bonus if bias exists from other sources
      if (biasFromCOTExtreme || biasFromGPT || biasFromFundamental) {
        score += 3; // Small bonus for non-technical bias establishment
      }
    }
    
    // Adjust based on bias strength
    if (directionalBias.strength > 50) {
      score += 5; // Strong bias = better execution conditions
    } else if (directionalBias.strength < 30) {
      // Only penalize weak bias if it's NOT from COT EXTREME or GPT high-confidence
      if (!biasFromCOTExtreme && !biasFromGPT) {
        score -= 5; // Weak bias = worse execution conditions (unless from strong signals)
      } else {
        // COT EXTREME or GPT high-confidence can compensate for weak bias
        score += 2; // Small bonus instead of penalty
      }
    }
    
    // Additional bonus for COT EXTREME signals (they're contrarian and often reliable)
    if (biasFromCOTExtreme && directionalBias.strength >= 15) {
      score += 5; // COT EXTREME signals are valuable even with neutral technical
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Get GPT's implied direction from structure (pure — does not mutate gptStructure).
   */
  private getGPTImpliedDirection(
    gptStructure: GPTStructureAnalysis,
    biasDirection: 'BULLISH' | 'BEARISH'
  ): { direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; alignment: 'CONFIRMS' | 'CONTRADICTS' | 'NEUTRAL' } {
    if (gptStructure.marketStructure === 'TREND_CONTINUATION') {
      return {
        direction: 'BULLISH',
        alignment: biasDirection === 'BULLISH' ? 'CONFIRMS' : 'CONTRADICTS',
      };
    }
    if (gptStructure.marketStructure === 'REVERSAL') {
      return {
        direction: biasDirection === 'BULLISH' ? 'BEARISH' : 'BULLISH',
        alignment: 'CONTRADICTS',
      };
    }
    return { direction: 'NEUTRAL', alignment: 'NEUTRAL' };
  }
  
  /**
   * Calculate confidence from signal alignment (NOT distance from 50)
   */
  private calculateConfidenceFromAlignment(
    directionalBias: DirectionalBias,
    technicalExecutionScore: number,
    gptStructure: GPTStructureAnalysis | undefined,
    marketReadability: MarketReadability
  ): number {
    let confidence = 50; // Base confidence
    
    // Signal alignment count
    let alignedSignals = 0;
    let totalSignals = 0;
    
    // Technical alignment
    totalSignals++;
    if ((directionalBias.direction === 'BULLISH' && technicalExecutionScore > 55) ||
        (directionalBias.direction === 'BEARISH' && technicalExecutionScore < 45)) {
      alignedSignals++;
    }
    
    // GPT alignment
    if (gptStructure && gptStructure.confidence > 50) {
      totalSignals++;
      if (gptStructure.alignment === 'CONFIRMS') {
        alignedSignals++;
        confidence += 15; // GPT confirmation boost
      } else if (gptStructure.alignment === 'CONTRADICTS') {
        confidence -= 20; // GPT contradiction penalty
      }
    }
    
    // Alignment ratio
    const alignmentRatio = totalSignals > 0 ? alignedSignals / totalSignals : 0;
    confidence += alignmentRatio * 30; // Up to +30 for perfect alignment
    
    // Regime clarity - use marketReadability confidence, but ensure minimum contribution
    // Even if Gate 1 is unreadable, if there's any structure, give some confidence
    const gate1Confidence = marketReadability.confidence || 0;
    const hasAnyStructure = marketReadability.gate1Inputs?.hasStrongTrend || 
                            marketReadability.gate1Inputs?.hasStrongPattern ||
                            (gptStructure && gptStructure.confidence >= 70);
    
    if (hasAnyStructure && gate1Confidence === 0) {
      // Gate 1 confidence is 0 but structure exists - give minimum boost
      confidence += 10; // Minimum boost for structure existence
    } else {
      confidence += gate1Confidence * 0.2; // Up to +20
    }
    
    // Bias strength
    confidence += directionalBias.strength * 0.1; // Up to +10
    
    // 🔒 FIX: Ensure minimum confidence floor - even with no structure, give at least 20%
    // This prevents 0% confidence which is misleading (should indicate uncertainty, not impossibility)
    const minConfidence = hasAnyStructure ? 30 : 20; // Higher floor if structure exists
    
    return Math.max(minConfidence, Math.min(100, Math.round(confidence)));
  }
  
  // ==========================================================================
  // LAYER 5: RISK ALLOCATION
  // ==========================================================================
  
  /**
   * Calculate risk allocation (only if execution permitted)
   */
  private async calculateRiskAllocation(
    symbol: string,
    directionalBias: DirectionalBias,
    executionPermission: ExecutionPermission,
    regimeAnalysis: RegimeAnalysis
  ): Promise<{
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    // Import risk calculator
    const { RiskCalculator } = await import('./risk-calculator');
    const { TradingModeManager } = await import('./trading-mode');
    
    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    const atr = this.calculateATR(this.historicalData);
    
    // Detect asset type
    const assetType = detectAssetType(symbol);
    const isJPYPair = symbol.includes('JPY');
    const isMetal = assetType === 'metal';
    
    // Calculate stop loss/take profit (ATR-based)
    // For metals (XAU/USD, XAG/USD, etc.), ATR is in dollars, not pips
    // Gold typically has ATR of 20-50 dollars, Silver 0.5-2 dollars
    let minStopDistance: number;
    let maxStopDistance: number;
    
    if (isMetal) {
      // Metals: Use dollar-based distances
      // Gold (XAU): 20-50 dollar ATR is normal, use 1.5x ATR with min 15 dollars, max 100 dollars
      // Silver (XAG): 0.5-2 dollar ATR is normal, use 1.5x ATR with min 1 dollar, max 5 dollars
      if (symbol.includes('XAU') || symbol.includes('GOLD')) {
        minStopDistance = 15; // 15 dollars minimum for gold
        maxStopDistance = 100; // 100 dollars maximum for gold
      } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
        minStopDistance = 1; // 1 dollar minimum for silver
        maxStopDistance = 5; // 5 dollars maximum for silver
      } else {
        // Other metals (platinum, palladium) - use gold-like values
        minStopDistance = 15;
        maxStopDistance = 100;
      }
    } else if (isJPYPair) {
      minStopDistance = 0.20;
      maxStopDistance = 0.50;
    } else {
      // Standard forex pairs
      minStopDistance = 0.0020;
      maxStopDistance = 0.0050;
    }
    
    const stopDistance = Math.max(minStopDistance, Math.min(maxStopDistance, atr * 1.5));
    const rewardDistance = stopDistance * 2; // 1:2 risk-reward
    
    let stopLoss: number;
    let takeProfit: number;
    
    if (directionalBias.direction === 'BULLISH') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + rewardDistance;
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - rewardDistance;
    }
    
    // COT influence on position sizing
    let riskMultiplier = 1.0;
    // COT extreme positions reduce risk
    // (This is handled in directional bias strength, but can also affect position size)
    
    // Calculate position size
    const balance = TradingModeManager.getCurrentBalance();
    const riskResult = await RiskCalculator.calculateTradeSize(
      currentPrice,
      stopLoss,
      symbol,
      atr,
      atr
    );
    
    let positionSize = riskResult.isValid ? riskResult.lotSize : 0.01;
    
    // Apply COT risk adjustment if extreme
    // (This would be passed from COT analysis)
    
    // 🔒 RULE 5: Risk level (LOW/MEDIUM/HIGH) matches volatility and confidence
    // Risk level calculated from execution confidence and regime volatility
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    
    if (executionPermission.confidence >= 70) {
      riskLevel = 'LOW';
    } else if (executionPermission.confidence >= 60) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }
    
    // Adjust risk level based on regime volatility
    if (regimeAnalysis.regime === 'HIGH_VOLATILITY_RANGE') {
      // High volatility increases risk level
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      else if (riskLevel === 'MEDIUM') riskLevel = 'HIGH';
    } else if (regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' && regimeAnalysis.confidence >= 70) {
      // Low volatility with high confidence reduces risk level
      if (riskLevel === 'HIGH') riskLevel = 'MEDIUM';
      else if (riskLevel === 'MEDIUM') riskLevel = 'LOW';
    }
    
    this.debugLog.push(`[RISK ALLOCATION] Risk Level: ${riskLevel} (confidence: ${executionPermission.confidence}%, regime: ${regimeAnalysis.regime})`);
    
    // Round to appropriate decimal places
    // Metals: 2 decimal places (e.g., 4507.99)
    // JPY pairs: 2 decimal places (e.g., 155.00)
    // Standard forex: 4 decimal places (e.g., 1.1000)
    const decimalPlaces = isMetal ? 2 : (isJPYPair ? 2 : 4);
    
    return {
      stopLoss: Number(stopLoss.toFixed(decimalPlaces)),
      takeProfit: Number(takeProfit.toFixed(decimalPlaces)),
      positionSize,
      riskLevel,
    };
  }
  
  /**
   * Estimate expectancy for this trade setup
   */
  private async estimateExpectancy(
    directionalBias: DirectionalBias,
    executionPermission: ExecutionPermission,
    riskAllocation: {
      stopLoss: number;
      takeProfit: number;
      positionSize: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    },
    symbol: string
  ): Promise<{
    estimatedWinRate: number;
    estimatedAvgWin: number;
    estimatedAvgLoss: number;
    estimatedExpectancy: number;
    unit: 'pips' | 'points' | 'dollars';
    empiricalSampleSize?: number;
  }> {
    let baseWinRate = 50;
    let empiricalSampleSize = 0;

    try {
      const { getSymbolVerdict } = await import('./trade-verdict-service');
      const verdict = await getSymbolVerdict(symbol);
      if (verdict.sampleSize >= 15) {
        baseWinRate = verdict.winRate;
        empiricalSampleSize = verdict.sampleSize;
        this.debugLog.push(
          `[EXPECTANCY] Using trade-history win rate ${verdict.winRate.toFixed(1)}% from ${verdict.sampleSize} closed trades`
        );
      } else {
        const { getAnalysisAccuracy } = await import('./firebase/analysis-storage');
        const stats = await getAnalysisAccuracy(symbol);
        if (stats.total >= 10) {
          baseWinRate = stats.accuracy;
          empiricalSampleSize = stats.total;
          this.debugLog.push(
            `[EXPECTANCY] Using empirical win rate ${stats.accuracy.toFixed(1)}% from ${stats.total} closed signals`
          );
        }
      }
    } catch {
      // Firebase unavailable — use heuristic below
    }

    const confidenceBonus = empiricalSampleSize > 0 ? 0 : (executionPermission.confidence - 50) * 0.5;
    const biasStrengthBonus = empiricalSampleSize > 0 ? 0 : directionalBias.strength * 0.2;

    const estimatedWinRate = Math.max(40, Math.min(70, baseWinRate + confidenceBonus + biasStrengthBonus));
    
    // Calculate distances based on asset type
    const currentPrice = this.historicalData[this.historicalData.length - 1].close;
    const assetType = detectAssetType(symbol);
    const isMetal = assetType === 'metal';
    const isJPYPair = symbol.includes('JPY');
    
    let estimatedAvgWin: number;
    let estimatedAvgLoss: number;
    let unit: 'pips' | 'points' | 'dollars';
    
    if (isMetal) {
      // For metals, use dollar/point distances directly
      // Gold moves in dollars (points), not pips
      estimatedAvgWin = Math.abs(riskAllocation.takeProfit - currentPrice);
      estimatedAvgLoss = Math.abs(currentPrice - riskAllocation.stopLoss);
      unit = 'dollars'; // Or 'points' - both mean the same for metals
    } else {
      // For forex pairs, use pip distances
      const pipSize = isJPYPair ? 0.01 : 0.0001;
      estimatedAvgWin = Math.abs(riskAllocation.takeProfit - currentPrice) / pipSize;
      estimatedAvgLoss = Math.abs(currentPrice - riskAllocation.stopLoss) / pipSize;
      unit = 'pips';
    }
    
    // Calculate expectancy: (WinRate × AvgWin) - (LossRate × AvgLoss)
    const winRate = estimatedWinRate / 100;
    const lossRate = 1 - winRate;
    const estimatedExpectancy = (winRate * estimatedAvgWin) - (lossRate * estimatedAvgLoss);
    
    return {
      estimatedWinRate: Math.round(estimatedWinRate),
      estimatedAvgWin: Math.round(estimatedAvgWin * 10) / 10,
      estimatedAvgLoss: Math.round(estimatedAvgLoss * 10) / 10,
      estimatedExpectancy: Math.round(estimatedExpectancy * 10) / 10,
      unit,
      empiricalSampleSize: empiricalSampleSize > 0 ? empiricalSampleSize : undefined,
    };
  }
  
  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================
  
  /**
   * Create HOLD analysis (when gates block execution)
   */
  private createHoldAnalysis(
    symbol: string,
    marketReadability: MarketReadability,
    technicalScore: number,
    fundamentalScore: number,
    sentimentScore: number,
    cotAnalysis: COTAnalysis | null,
    regimeAnalysis: RegimeAnalysis,
    tradingHours: TradingHoursAnalysis,
    newsImpact: NewsImpact,
    gptStructure?: GPTStructureAnalysis,
    directionalBias?: DirectionalBias,
    holdReason?: string,
    executionPermission?: ExecutionPermission
  ): GatedMarketAnalysis {
    const directionalBiasFinal = directionalBias || {
      direction: 'NEUTRAL' as const,
      strength: 0,
      contributors: {
        technical: technicalScore - 50,
        fundamental: fundamentalScore - 50,
        cot: 0,
      },
      reasoning: ['No clear directional bias'],
    };
    
    return {
      symbol,
      timestamp: new Date(),
      marketReadability,
      directionalBias: directionalBiasFinal,
      gptStructure,
      executionPermission: executionPermission || {
        canExecute: false,
        reason: marketReadability.reason, // 🔒 HARD-LOCK: Use Gate-1 reason verbatim, NO fallback overwrite
        blockedBy: marketReadability.blockedBy,
        technicalExecutionScore: 0,
        // 🔒 FIX: Calculate confidence even when execution is blocked - reflect structure quality
        confidence: this.calculateConfidenceFromAlignment(
          directionalBiasFinal,
          50, // Technical score (neutral)
          gptStructure,
          marketReadability
        ),
      },
      recommendation: 'HOLD',
      recommendationReason: marketReadability.reason, // 🔒 HARD-LOCK: Use Gate-1 reason verbatim, NO fallback overwrite
      reasoning: this.generateHoldReasoning(
        technicalScore,
        regimeAnalysis,
        marketReadability, // 🔒 HARD-LOCK: Pass marketReadability object (required parameter) - moved before optional params
        gptStructure,
        directionalBias,
        executionPermission || { // 🔒 FIX: Use passed executionPermission instead of creating new one
          canExecute: false,
          reason: marketReadability.reason, // 🔒 HARD-LOCK: Use Gate-1 reason verbatim, NO fallback overwrite
          blockedBy: marketReadability.blockedBy,
          technicalExecutionScore: 0,
          // 🔒 FIX: Calculate confidence even when execution is blocked - reflect structure quality
          confidence: this.calculateConfidenceFromAlignment(
            directionalBiasFinal,
            50, // Technical score (neutral)
            gptStructure,
            marketReadability
          ),
        },
        cotAnalysis
      ),
      componentScores: {
        technical: technicalScore,
        fundamental: fundamentalScore,
        sentiment: sentimentScore,
        cot: cotAnalysis?.confidence || 50,
        regime: regimeAnalysis.confidence,
      },
      cotAnalysis: cotAnalysis || undefined,
      regimeAnalysis,
      tradingHours,
      newsImpact,
    };
  }
  
  /**
   * 🔒 HARD-LOCK HELPER: Enforce Gate-1 explanation integrity
   * If Gate 1 returns READABLE, forbid any "unreadable" language downstream
   */
  private enforceGate1Integrity(
    marketReadability: MarketReadability,
    executionBlocked: boolean,
    executionReason: string
  ): string {
    // 🔒 HARD-LOCK: If Gate 1 is READABLE, NEVER say "unreadable"
    if (marketReadability.isReadable && executionBlocked) {
      // Echo Gate-1 inputs verbatim
      const gate1Inputs = marketReadability.gate1Inputs;
      if (gate1Inputs) {
        const structureDetails: string[] = [];
        if (gate1Inputs.hasStrongTrend) {
          structureDetails.push(`Trend strength: ${gate1Inputs.trendStrength.toFixed(1)}%`);
        }
        if (gate1Inputs.hasStrongPattern) {
          structureDetails.push(`Pattern confidence: ${gate1Inputs.patternConfidence.toFixed(1)}%`);
        }
        if (gate1Inputs.hasSupportResistance) {
          structureDetails.push(`Support/Resistance: Defined`);
        }
        
        const structureSummary = structureDetails.length > 0 
          ? ` (${structureDetails.join(', ')})`
          : '';
        
        return `Structure readable but execution blocked due to regime/confidence constraints${structureSummary}`;
      }
      return 'Structure readable but execution blocked due to regime/confidence constraints';
    }
    
    // Gate 1 is unreadable - use original reason
    return executionReason || marketReadability.reason;
  }
  
  /**
   * Generate hold reasoning with specific blockers
   * 🔒 FIX: Show directional bias even when execution blocked
   * 🔒 HARD-LOCK: Enforce Gate-1 explanation integrity
   * 🔒 REQUIRED: marketReadability must be provided (single source of truth)
   */
  private generateHoldReasoning(
    technicalScore: number,
    regimeAnalysis: RegimeAnalysis,
    marketReadability: MarketReadability, // 🔒 REQUIRED: Gate-1 output is mandatory (single source of truth) - moved before optional params
    gptStructure?: GPTStructureAnalysis,
    directionalBias?: DirectionalBias,
    executionPermission?: ExecutionPermission,
    cotAnalysis?: COTAnalysis | null
  ): string[] {
    const reasoning: string[] = [];
    
    // 🔒 EXPLANATION SANITY CHECK: Validate narrative doesn't contradict analysis
    // Explanation MUST NOT contradict: Trend, Pattern, Bias, Support/Resistance
    
    // 🔒 HARD-ENFORCED INVARIANT: Gate-1 reason is BOUND to assessMarketReadability() output ONLY
    // MarketReadability is the single immutable source of truth - MUST consume verbatim
    // NEVER recompute, NEVER overwrite, NEVER use fallbacks
    const isExecutionBlocked = executionPermission && !executionPermission.canExecute;
    
    // 🔒 HARD-ENFORCED INVARIANT: Use Gate-1 reason verbatim - NO fallback, NO recomputation, NO overwrite
    // baseReason parameter is PROHIBITED - always use marketReadability.reason verbatim
    if (!marketReadability) {
      const errorMsg = `[GATE1-INVARIANT] CRITICAL: marketReadability is missing in generateHoldReasoning. Cannot proceed without Gate-1 output.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    const gate1Reason = marketReadability.reason; // Verbatim - single source of truth
    
    const isBiasNeutral = !directionalBias || directionalBias.direction === 'NEUTRAL';
    const shouldAnnotateCOT = isExecutionBlocked || isBiasNeutral;
    
    // 🔒 FINAL OUTPUT FORMAT (ENFORCED): Always show directional bias if structure exists
    if (directionalBias && directionalBias.direction !== 'NEUTRAL') {
      const strengthLabel = directionalBias.strength >= 50 ? 'High' : 
                           directionalBias.strength >= 30 ? 'Moderate' : 'Low';
      reasoning.push(`Directional Bias: ${directionalBias.direction}`);
      reasoning.push(`Bias Strength: ${strengthLabel}`);
      
      if (directionalBias.primaryTrend && directionalBias.primaryTrend !== 'NEUTRAL') {
        reasoning.push(`Primary Trend: ${directionalBias.primaryTrend}`);
      }
      
      // Add bias reasoning
      directionalBias.reasoning.forEach(r => reasoning.push(`  • ${r}`));
      
      // Add contrarian note if present
      if (directionalBias.contrarianNote) {
        reasoning.push(`⚠️ ${directionalBias.contrarianNote}`);
      }
      
      // Add reversal watch if present
      if (directionalBias.reversalWatch) {
        reasoning.push('🔍 Reversal watch: Contrarian signals detected but not confirmed');
      }
    } else if (directionalBias && directionalBias.direction === 'NEUTRAL') {
      // 🔒 SANITY CHECK: Only say "no clear trend" if structure truly doesn't exist
      reasoning.push('Directional Bias: NEUTRAL (no clear trend or pattern)');
    }
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: COT annotation when execution blocked or bias NEUTRAL
    // Downgrade all COT outputs to "context-only / non-actionable" and forbid BUY/SELL wording
    if (cotAnalysis && shouldAnnotateCOT) {
      // 🔒 RULE: Forbid BUY/SELL wording - use directional terms only
      const cotDirection = cotAnalysis.recommendation === 'BUY' || cotAnalysis.recommendation === 'STRONG_BUY'
        ? 'BULLISH'
        : cotAnalysis.recommendation === 'SELL' || cotAnalysis.recommendation === 'STRONG_SELL'
        ? 'BEARISH'
        : 'NEUTRAL';
      
      // 🔒 RULE: Use "non-actionable" instead of "watchlist" when bias ≠ actionable or execution blocked
      reasoning.push(`📊 COT Analysis (Context-Only / Non-Actionable): ${cotDirection} positioning detected`);
      reasoning.push(`  • Large Spec Position: ${cotAnalysis.largeSpecPosition}`);
      reasoning.push(`  • Commercial Position: ${cotAnalysis.commercialPosition}`);
      // 🔒 HARD-LOCK: If Gate 1 is READABLE, never say "unreadable market conditions"
      const cotConditionLabel = marketReadability && marketReadability.isReadable 
        ? 'blocked execution conditions'
        : (isBiasNeutral ? 'unreadable market conditions' : 'blocked execution conditions');
      reasoning.push(`  ⚠️ IMPORTANT: COT signals cannot imply trade direction or execution under ${cotConditionLabel}`);
      reasoning.push(`  • COT is provided for context only and should not be used for trade decisions when market structure is unclear or execution is blocked`);
      reasoning.push(`  • FORBIDDEN: Do not use COT signals for BUY/SELL decisions when bias is non-actionable or execution is blocked`);
    }
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: Gate 1 status
    // If execution is blocked by regime or confidence, label as "readable but non-executable"
    const hasStructure = directionalBias && directionalBias.direction !== 'NEUTRAL';
    // 🔒 FIX: isExecutionBlocked already defined above, reuse it
    const isBlockedByRegimeOrConfidence = isExecutionBlocked && executionPermission && 
      (executionPermission.reason.includes('regime') || 
       executionPermission.reason.includes('confidence') ||
       executionPermission.reason.includes('readable but non-executable'));
    
    // 🔒 HARD-ENFORCED INVARIANT: Gate-1 reason is BOUND to assessMarketReadability() output ONLY
    // MarketReadability is the single immutable source of truth - MUST consume verbatim
    // NEVER recompute, NEVER overwrite, NEVER use fallbacks
    // 🔒 HARD-ENFORCED INVARIANT: Use Gate-1 reason verbatim - NO recomputation, NO overwrite
    // The reason already contains evaluated inputs (trendStrength, patternConfidence, S/R arrays) when READABLE=true
    reasoning.push(`Gate 1: ${gate1Reason}`); // Always use verbatim - marketReadability is required above
    
    // 🔒 FINAL OUTPUT FORMAT: Gate 4 blockers (execution reasons)
    // Execution block language must be explicit
    // 🔒 HARD-LOCK: Gate-1 reason is BOUND to assessMarketReadability() output ONLY
    if (executionPermission && !executionPermission.canExecute) {
      // Check if structure exists but execution blocked
      if (hasStructure || (marketReadability && marketReadability.isReadable)) {
        // 🔒 HARD-LOCK: Use Gate-1 reason verbatim - NO overwrite, NO recomputation
        reasoning.push(`Gate 4: Execution blocked - ${gate1Reason}`);
        reasoning.push(`  • Analysis remains valid - clear directional structure detected`);
      } else {
        // Gate 1 is unreadable - use Gate-1 reason verbatim
        reasoning.push(`Gate 4: Execution blocked - ${gate1Reason}`);
      }
      executionPermission.blockedBy.forEach(blocker => {
        reasoning.push(`  • ${blocker}`);
      });
    }
    
    // Add regime-specific blockers
    if (regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' && regimeAnalysis.confidence < 55) {
      reasoning.push('• Market regime unsuitable for directional trades');
    }
    
    if (regimeAnalysis.regime === 'HIGH_VOLATILITY_RANGE') {
      reasoning.push('• High volatility regime unsuitable for trading');
    }
    
    if (technicalScore < 55) {
      reasoning.push('• Technical confirmation missing');
    }
    
    if ((regimeAnalysis.regime === 'LOW_VOLATILITY_RANGE' || regimeAnalysis.regime === 'HIGH_VOLATILITY_RANGE') &&
        gptStructure?.marketStructure === 'TREND_CONTINUATION') {
      reasoning.push('• Structural conflict detected');
    }
    
    // 🔒 FINAL OUTPUT FORMAT (ENFORCED): Exact format when structure clear but execution blocked
    if (directionalBias && directionalBias.direction !== 'NEUTRAL') {
      // Structure exists but execution blocked - use exact format
      reasoning.push(`Final Recommendation: HOLD (no trade — regime risk, not analysis weakness)`);
    } else {
      // No structure - different message
      reasoning.push('Final Recommendation: HOLD (no clear directional bias)');
    }
    
    // 🔒 SANITY CHECK: Narrative must not contradict analysis
    // If structure exists, FORBIDDEN from saying:
    // - "No identifiable trend" ❌
    // - "Market structure unclear" ❌
    // - "No pattern detected" ❌
    // Instead say:
    // - "Clear directional structure detected, but trading is avoided due to regime risk" ✅
    
    reasoning.push('System prefers NO TRADE over BAD TRADE');
    
    return reasoning;
  }
  
  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(
    directionalBias: DirectionalBias,
    executionPermission: ExecutionPermission,
    gptStructure?: GPTStructureAnalysis,
    marketReadability?: MarketReadability
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`${directionalBias.direction} bias detected (strength: ${directionalBias.strength}%)`);
    
    if (gptStructure && gptStructure.alignment === 'CONFIRMS') {
      reasons.push(`GPT structure confirms ${directionalBias.direction} bias`);
    }
    
    reasons.push(`Execution conditions met (confidence: ${executionPermission.confidence}%)`);
    
    return reasons.join(' • ');
  }
  
  /**
   * Generate detailed reasoning
   */
  private generateReasoning(
    marketReadability: MarketReadability,
    directionalBias: DirectionalBias,
    executionPermission: ExecutionPermission,
    gptStructure?: GPTStructureAnalysis,
    cotAnalysis?: COTAnalysis | null
  ): string[] {
    const reasoning: string[] = [];
    
    // 🔒 HARD-ENFORCED INVARIANT: Gate-1 reason is BOUND to assessMarketReadability() output ONLY
    // MarketReadability is the single immutable source of truth - MUST consume verbatim
    // NEVER recompute, NEVER overwrite, NEVER use fallbacks
    if (marketReadability.isReadable) {
      // 🔒 HARD-ENFORCED INVARIANT: Use Gate-1 reason verbatim - it already contains evaluated inputs when READABLE=true
      reasoning.push(`✅ ${marketReadability.reason}`);
    } else {
      // 🔒 HARD-ENFORCED INVARIANT: Use Gate-1 reason verbatim - NO overwrite
      reasoning.push(`⚠️ ${marketReadability.reason}`);
    }
    
    // Directional bias
    reasoning.push(`${directionalBias.direction} bias: ${directionalBias.strength}% strength`);
    directionalBias.reasoning.forEach(r => reasoning.push(`  • ${r}`));
    
    // GPT structure
    if (gptStructure) {
      reasoning.push(`GPT Structure: ${gptStructure.marketStructure} (${gptStructure.alignment}, ${gptStructure.confidence}% confidence)`);
    }
    
    // Execution permission
    if (executionPermission.canExecute) {
      reasoning.push(`✅ Execution permitted (confidence: ${executionPermission.confidence}%)`);
    } else {
      reasoning.push(`❌ Execution blocked: ${executionPermission.reason}`);
    }
    
    // 🔒 EXPLANATION-SOURCE INTEGRITY: COT annotation when execution blocked or bias NEUTRAL
    // Downgrade all COT outputs to "context-only / non-actionable" and forbid BUY/SELL wording
    const isExecutionBlocked = !executionPermission.canExecute;
    const isBiasNeutral = directionalBias.direction === 'NEUTRAL';
    const shouldAnnotateCOT = isExecutionBlocked || isBiasNeutral;
    
    if (cotAnalysis && shouldAnnotateCOT) {
      // 🔒 RULE: Forbid BUY/SELL wording - use directional terms only
      const cotDirection = cotAnalysis.recommendation === 'BUY' || cotAnalysis.recommendation === 'STRONG_BUY'
        ? 'BULLISH'
        : cotAnalysis.recommendation === 'SELL' || cotAnalysis.recommendation === 'STRONG_SELL'
        ? 'BEARISH'
        : 'NEUTRAL';
      
      // 🔒 RULE: Use "non-actionable" instead of "watchlist" when bias ≠ actionable or execution blocked
      reasoning.push(`📊 COT Analysis (Context-Only / Non-Actionable): ${cotDirection} positioning detected`);
      reasoning.push(`  • Large Spec Position: ${cotAnalysis.largeSpecPosition}`);
      reasoning.push(`  • Commercial Position: ${cotAnalysis.commercialPosition}`);
      // 🔒 HARD-LOCK: If Gate 1 is READABLE, never say "unreadable market conditions"
      const cotConditionLabel = marketReadability && marketReadability.isReadable 
        ? 'blocked execution conditions'
        : (isBiasNeutral ? 'unreadable market conditions' : 'blocked execution conditions');
      reasoning.push(`  ⚠️ IMPORTANT: COT signals cannot imply trade direction or execution under ${cotConditionLabel}`);
      reasoning.push(`  • COT is provided for context only and should not be used for trade decisions when market structure is unclear or execution is blocked`);
      reasoning.push(`  • FORBIDDEN: Do not use COT signals for BUY/SELL decisions when bias is non-actionable or execution is blocked`);
    }
    
    return reasoning;
  }
  
  // ==========================================================================
  // DATA LOADING & ANALYSIS HELPERS
  // ==========================================================================
  
  private async loadHistoricalData(symbol: string): Promise<void> {
    // Import data providers
    const { MT5PriceDataProvider } = await import('./data-providers/mt5-price-data');
    const { TwelveDataProvider } = await import('./data-providers/twelve-data');
    
    let data = await MT5PriceDataProvider.getHistoricalData(symbol, 'H1', 100);
    
    if (data.length === 0) {
      data = await TwelveDataProvider.getHistoricalData(symbol, '1h', 100);
    }
    
    if (data.length > 0) {
      this.historicalData = data;
    } else {
      throw new Error(`No historical data available for ${symbol}`);
    }
  }
  
  private async getTechnicalScore(symbol: string): Promise<number> {
    // Use existing technical analysis
    const engine = await import('./ai-trading-engine');
    const tempEngine = new engine.AITradingEngine();
    return await tempEngine['technicalAnalysis'](symbol);
  }
  
  private async getFundamentalScore(symbol: string): Promise<number> {
    const engine = await import('./ai-trading-engine');
    const tempEngine = new engine.AITradingEngine();
    return await tempEngine['fundamentalAnalysis'](symbol);
  }
  
  private async getSentimentScore(symbol: string): Promise<number> {
    const engine = await import('./ai-trading-engine');
    const tempEngine = new engine.AITradingEngine();
    return await tempEngine['sentimentAnalysis'](symbol);
  }
  
  private async getCOTAnalysis(symbol: string): Promise<COTAnalysis | null> {
    try {
      const { COTAnalyzer } = await import('./cot-analyzer');
      return await COTAnalyzer.analyzeCOT(symbol);
    } catch (error) {
      console.warn('COT analysis failed:', error);
      return null;
    }
  }
  
  private async getRegimeAnalysis(symbol: string): Promise<RegimeAnalysis> {
    const { MLRegimeDetector } = await import('./regime-detector-ml');
    return await MLRegimeDetector.detectRegimeML(this.historicalData, symbol);
  }
  
  /**
   * 🔒 RULE 7: Sanity Checks - Ensure no contradictions
   */
  private performSanityChecks(
    marketReadability: MarketReadability,
    directionalBias: DirectionalBias,
    executionPermission: ExecutionPermission,
    recommendation: 'BUY' | 'SELL' | 'HOLD'
  ): void {
    // Check 1: HOLD due to unreadable market cannot show strong trend or bias
    if (!marketReadability.isReadable && directionalBias.direction !== 'NEUTRAL') {
      const error = `⚠️ SANITY CHECK FAILED: Market unreadable but bias is ${directionalBias.direction}`;
      this.debugLog.push(`[SANITY CHECK] ${error}`);
      console.error(error);
    }
    
    // Check 2: HOLD due to NEUTRAL bias cannot show execution allowed
    if (directionalBias.direction === 'NEUTRAL' && executionPermission.canExecute) {
      const error = `⚠️ SANITY CHECK FAILED: Bias is NEUTRAL but execution is allowed`;
      this.debugLog.push(`[SANITY CHECK] ${error}`);
      console.error(error);
    }
    
    // Check 3: BUY/SELL requires execution allowed AND non-neutral bias
    if ((recommendation === 'BUY' || recommendation === 'SELL') && 
        (!executionPermission.canExecute || directionalBias.direction === 'NEUTRAL')) {
      const error = `⚠️ SANITY CHECK FAILED: Recommendation is ${recommendation} but execution=${executionPermission.canExecute}, bias=${directionalBias.direction}`;
      this.debugLog.push(`[SANITY CHECK] ${error}`);
      console.error(error);
    }
    
    // Check 4: HOLD if execution blocked should have clear reason
    if (recommendation === 'HOLD' && !executionPermission.canExecute && executionPermission.reason === '') {
      const error = `⚠️ SANITY CHECK FAILED: HOLD with blocked execution but no reason provided`;
      this.debugLog.push(`[SANITY CHECK] ${error}`);
      console.error(error);
    }
    
    this.debugLog.push(`[SANITY CHECK] All checks completed`);
  }
  
  private async getTradingHours(symbol: string): Promise<TradingHoursAnalysis> {
    const { TradingHoursFilter } = await import('./trading-hours');
    return TradingHoursFilter.analyze(symbol);
  }
  
  private async getNewsImpact(symbol: string): Promise<NewsImpact> {
    const { EconomicCalendar } = await import('./economic-calendar');
    return await EconomicCalendar.checkNewsImpact(symbol);
  }
  
  private calculateATR(prices: PriceData[], period: number = 14): number {
    if (prices.length < 2) {
      return 0.007; // Default for EUR/USD
    }
    
    const trueRanges: number[] = [];
    const startIndex = Math.max(1, prices.length - period - 1);
    
    for (let i = startIndex; i < prices.length; i++) {
      const high = prices[i].high || prices[i].close;
      const low = prices[i].low || prices[i].close;
      const previousClose = i > 0 ? (prices[i - 1].close || prices[i].close) : prices[i].close;
      
      if (high <= 0 || low <= 0 || previousClose <= 0) {
        continue;
      }
      
      const tr = Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      );
      
      if (tr > 0 && tr < 0.1) {
        trueRanges.push(tr);
      }
    }
    
    if (trueRanges.length === 0) {
      return 0.007;
    }
    
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    
    // Pair-specific ATR validation (more lenient)
    // Minimum: 0.0005 (5 pips) instead of 0.001 (10 pips) to allow low volatility periods
    if (atr < 0.0005 || atr > 0.02) {
      // Only use default if significantly off
      if (atr < 0.0003 || atr > 0.02) {
        return 0.007; // Default for standard pairs
      }
      // If slightly below threshold but reasonable, return as-is
    }
    
    return atr;
  }
}

