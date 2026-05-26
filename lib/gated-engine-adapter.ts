/**
 * GATED ENGINE ADAPTER
 * 
 * Bridges the new gated trading engine with existing UI components
 * Converts GatedMarketAnalysis to MarketAnalysis format for backward compatibility
 */

import { GatedMarketAnalysis, GatedTradingEngine, MarketReadability } from './gated-trading-engine';
import { MarketAnalysis } from './ai-trading-engine';

// Extended MarketAnalysis with gate information
export interface ExtendedMarketAnalysis extends MarketAnalysis {
  gateStatus?: {
    marketReadable: boolean;
    marketReadabilityReason?: string; // 🔒 STRICT INVARIANT: Gate-1 reason verbatim (single source of truth)
    gate1Inputs?: { // 🔒 STRICT INVARIANT: Gate-1 inputs for UI desync detection
      trendStrength: number;
      patternConfidence: number;
      hasSupportResistance: boolean;
      hasStrongTrend: boolean;
      hasStrongPattern: boolean;
    };
    directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    biasStrength: number;
    gptStructure?: {
      marketStructure: string;
      alignment: 'CONFIRMS' | 'CONTRADICTS' | 'NEUTRAL';
      confidence: number;
    };
    executionPermitted: boolean;
    executionReason?: string;
    executionBlockedBy?: string[];
    expectancyData?: {
      estimatedWinRate: number;
      estimatedAvgWin: number;
      estimatedAvgLoss: number;
      estimatedExpectancy: number;
      unit?: 'pips' | 'points' | 'dollars';
      empiricalSampleSize?: number;
    };
  };
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.replace(/\//g, '').toUpperCase();
}

export class GatedEngineAdapter {
  private gatedEngine: GatedTradingEngine;
  private lastAnalysisIds = new Map<string, string>();
  private lastAnalysisBySymbol = new Map<string, ExtendedMarketAnalysis>();

  constructor() {
    this.gatedEngine = new GatedTradingEngine();
  }

  /** Last Firestore analysis id per symbol (for outcome linking on trade close). */
  getLastAnalysisId(symbol: string): string | undefined {
    return this.lastAnalysisIds.get(normalizeSymbolKey(symbol));
  }

  /** Latest full analysis from scan or Trade tab (for handoff without re-analyze). */
  getCachedAnalysis(symbol: string): ExtendedMarketAnalysis | undefined {
    return this.lastAnalysisBySymbol.get(normalizeSymbolKey(symbol));
  }
  
  /**
   * Analyze market using gated engine, convert to old format for UI
   */
  async analyzeMarket(
    symbol: string,
    openTrades: any[] = [],
    chartImageBase64?: string
  ): Promise<ExtendedMarketAnalysis> {
    // Get gated analysis
    const gatedAnalysis = await this.gatedEngine.analyzeMarket(symbol, openTrades, chartImageBase64);
    
    // Convert to old format with gate information
    const legacy = this.convertToLegacyFormat(gatedAnalysis);

    this.lastAnalysisBySymbol.set(normalizeSymbolKey(symbol), legacy);

    // Persist for accuracy tracking (production gated path)
    this.persistAnalysis(symbol, legacy).catch((err) => {
      console.warn('Failed to save gated analysis to Firestore:', err);
    });

    return legacy;
  }

  /**
   * Save analysis to Firestore for empirical accuracy tracking.
   */
  private async persistAnalysis(
    symbol: string,
    analysis: ExtendedMarketAnalysis
  ): Promise<void> {
    const { saveAnalysisToFirestore } = await import('./firebase/analysis-storage');
    const analysisId = await saveAnalysisToFirestore(symbol, analysis, {
      gateStatus: analysis.gateStatus,
      source: 'gated-engine',
    });
    if (analysisId) {
      this.lastAnalysisIds.set(normalizeSymbolKey(symbol), analysisId);
    }
  }
  
  /**
   * Get raw gated analysis (for advanced use cases)
   */
  async getGatedAnalysis(
    symbol: string,
    openTrades: any[] = [],
    chartImageBase64?: string
  ): Promise<GatedMarketAnalysis> {
    return await this.gatedEngine.analyzeMarket(symbol, openTrades, chartImageBase64);
  }
  
  /**
   * Convert GatedMarketAnalysis to MarketAnalysis (legacy format) with gate information
   */
  private convertToLegacyFormat(gated: GatedMarketAnalysis): ExtendedMarketAnalysis {
    // Calculate "overall score" for display (but it's NOT used for decisions)
    // This is just for UI compatibility - decisions are made by gates
    const displayScore = this.calculateDisplayScore(gated);
    
    // Determine recommendation
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    if (gated.recommendation === 'HOLD') {
      recommendation = 'HOLD';
    } else if (gated.directionalBias.direction === 'BULLISH') {
      recommendation = gated.directionalBias.strength > 60 ? 'STRONG_BUY' : 'BUY';
    } else {
      recommendation = gated.directionalBias.strength > 60 ? 'STRONG_SELL' : 'SELL';
    }
    
    // Convert GPT structure to old format (if exists)
    const gptChartAnalysis = gated.gptStructure ? {
      score: gated.directionalBias.direction === 'BULLISH' 
        ? 50 + gated.directionalBias.strength * 0.5
        : 50 - gated.directionalBias.strength * 0.5,
      recommendation: gated.directionalBias.direction === 'BULLISH' ? 'BUY' : 'SELL',
      trend: {
        direction: gated.directionalBias.direction.toLowerCase() as 'bullish' | 'bearish' | 'neutral',
        strength: gated.directionalBias.strength,
      },
      confidence: gated.gptStructure.confidence,
    } : undefined;
    
    return {
      symbol: gated.symbol,
      timestamp: gated.timestamp,
      overallScore: displayScore, // Display only - NOT used for decisions
      recommendation,
      confidence: gated.executionPermission.confidence,
      technicalScore: gated.componentScores.technical,
      fundamentalScore: gated.componentScores.fundamental,
      sentimentScore: gated.componentScores.sentiment,
      riskLevel: gated.riskLevel || 'MEDIUM',
      suggestedStopLoss: gated.suggestedStopLoss ?? 0,
      suggestedTakeProfit: gated.suggestedTakeProfit ?? 0,
      suggestedPositionSize: gated.suggestedPositionSize ?? 0,
      reasoning: this.generateLegacyReasoning(gated),
      detailedReasoning: gated.detailedReasoning,
      cotAnalysis: this.sanitizeCOTAnalysis(gated), // 🔒 FIX: Sanitize COT when non-actionable
      regimeAnalysis: gated.regimeAnalysis,
      tradingHours: gated.tradingHours,
      gptChartAnalysis,
      // Gate status information
      gateStatus: {
        marketReadable: gated.marketReadability.isReadable,
        // 🔒 HARD-ENFORCED INVARIANT: Gate-1 output is single source of truth - use verbatim, NO fallbacks, NO recomputation
        marketReadabilityReason: this.formatGate1Reason(gated.marketReadability),
        // 🔒 HARD-ENFORCED INVARIANT: Include Gate-1 inputs for runtime desync detection
        gate1Inputs: gated.marketReadability.gate1Inputs,
        directionalBias: gated.directionalBias.direction,
        biasStrength: gated.directionalBias.strength,
        gptStructure: gated.gptStructure ? {
          marketStructure: gated.gptStructure.marketStructure,
          alignment: gated.gptStructure.alignment,
          confidence: gated.gptStructure.confidence,
        } : undefined,
        executionPermitted: gated.executionPermission.canExecute,
        executionReason: gated.executionPermission.reason,
        executionBlockedBy: gated.executionPermission.blockedBy,
        expectancyData: gated.expectancyData,
      },
    };
  }
  
  /**
   * Calculate display score (for UI only, NOT for decisions)
   */
  private calculateDisplayScore(gated: GatedMarketAnalysis): number {
    // This is just for visual display - gates make the decisions
    if (gated.recommendation === 'HOLD') {
      return 50; // Neutral display
    }
    
    // Convert bias to score for display
    const baseScore = gated.directionalBias.direction === 'BULLISH' ? 60 : 40;
    const strengthAdjustment = (gated.directionalBias.strength - 50) * 0.3;
    
    return Math.max(0, Math.min(100, baseScore + strengthAdjustment));
  }
  
  /**
   * Generate legacy reasoning format
   */
  private generateLegacyReasoning(gated: GatedMarketAnalysis): string[] {
    const reasoning: string[] = [];
    
    // 🔒 HARD-LOCK: Market readability - enforce Gate-1 integrity
    if (!gated.marketReadability.isReadable) {
      // Gate 1 is unreadable - use original reason
      reasoning.push(`⚠️ Market Unreadable: ${gated.marketReadability.reason}`);
      reasoning.push('System prefers NO TRADE over BAD TRADE');
      return reasoning;
    }
    
    // 🔒 HARD-LOCK: If Gate 1 is READABLE, echo inputs verbatim
    // (This is handled in the reasoning below - never say "unreadable" if Gate 1 is readable)
    
    // Directional bias with primary trend information
    if (gated.directionalBias.primaryTrend && gated.directionalBias.primaryTrend !== 'NEUTRAL') {
      reasoning.push(`${gated.directionalBias.direction} bias detected (strength: ${gated.directionalBias.strength}%)`);
      reasoning.push(`Primary trend: ${gated.directionalBias.primaryTrend}`);
    } else {
      reasoning.push(`${gated.directionalBias.direction} bias detected (strength: ${gated.directionalBias.strength}%)`);
    }
    
    gated.directionalBias.reasoning.forEach(r => reasoning.push(`  • ${r}`));
    
    // Add contrarian note if present
    if (gated.directionalBias.contrarianNote) {
      reasoning.push(`⚠️ ${gated.directionalBias.contrarianNote}`);
    }
    
    // Add reversal watch if present
    if (gated.directionalBias.reversalWatch) {
      reasoning.push('🔍 Reversal watch: Contrarian signals detected but not confirmed');
    }
    
    // GPT structure
    if (gated.gptStructure) {
      if (gated.gptStructure.alignment === 'CONFIRMS') {
        reasoning.push(`✅ GPT structure confirms ${gated.directionalBias.direction} bias`);
      } else if (gated.gptStructure.alignment === 'CONTRADICTS') {
        reasoning.push(`⚠️ GPT structure contradicts ${gated.directionalBias.direction} bias`);
      }
    }
    
    // Execution permission
    if (gated.executionPermission.canExecute) {
      reasoning.push(`✅ Execution permitted (confidence: ${gated.executionPermission.confidence}%)`);
      
      // Expectancy data
      if (gated.expectancyData) {
        reasoning.push(`Expected Win Rate: ${gated.expectancyData.estimatedWinRate}%`);
        reasoning.push(`Expected Expectancy: ${gated.expectancyData.estimatedExpectancy} ${gated.expectancyData.unit || 'pips'}/trade`);
      }
    } else {
      reasoning.push(`❌ Execution blocked: ${gated.executionPermission.reason}`);
      gated.executionPermission.blockedBy.forEach(blocker => {
        reasoning.push(`  • ${blocker}`);
      });
    }
    
    return reasoning;
  }
  
  /**
   * 🔒 EXPLANATION-SOURCE INTEGRITY: Sanitize COT analysis when bias ≠ actionable or execution blocked
   * Downgrade COT outputs to "context-only / non-actionable" and forbid BUY/SELL wording
   */
  private sanitizeCOTAnalysis(gated: GatedMarketAnalysis) {
    if (!gated.cotAnalysis) return undefined;
    
    const isBiasNonActionable = gated.directionalBias.direction === 'NEUTRAL';
    const isExecutionBlocked = !gated.executionPermission.canExecute;
    const shouldSanitize = isBiasNonActionable || isExecutionBlocked;
    
    if (!shouldSanitize) {
      // COT is actionable - return as-is
      return gated.cotAnalysis;
    }
    
    // 🔒 RULE: Forbid BUY/SELL wording - convert to directional terms only
    // Create sanitized COT analysis with "HOLD" recommendation and updated reasoning
    const sanitizedReasoning = [
      ...gated.cotAnalysis.reasoning,
      `⚠️ COT Analysis (Context-Only / Non-Actionable): ${gated.cotAnalysis.sentiment} positioning detected`,
      `  • Large Spec Position: ${gated.cotAnalysis.largeSpecPosition}`,
      `  • Commercial Position: ${gated.cotAnalysis.commercialPosition}`,
      `  ⚠️ IMPORTANT: COT signals cannot imply trade direction or execution under ${isBiasNonActionable ? 'unreadable market conditions' : 'blocked execution conditions'}`,
      `  • COT is provided for context only and should not be used for trade decisions when market structure is unclear or execution is blocked`,
      `  • FORBIDDEN: Do not use COT signals for BUY/SELL decisions when bias is non-actionable or execution is blocked`,
    ];
    
    return {
      ...gated.cotAnalysis,
      recommendation: 'HOLD' as const, // 🔒 FORBIDDEN: Change BUY/SELL to HOLD
      reasoning: sanitizedReasoning,
    };
  }
  
  /**
   * 🔒 STRICT INVARIANT: Format Gate-1 reason with inputs for UI display
   * MUST use marketReadability.reason verbatim - NO fallbacks, NO recomputation
   * Gate-1 output is the single source of truth
   */
  private formatGate1Reason(marketReadability: MarketReadability): string {
    // 🔒 HARD-LOCK: Use marketReadability.reason verbatim - it already contains evaluated inputs
    // NEVER recompute, NEVER add fallbacks, NEVER override
    // If Gate-1 is readable, reason already contains "Market structure is clear and readable (Trend: X%, Pattern: Y%, S/R: ...)"
    // If Gate-1 is unreadable, reason already contains specific failed checks
    return marketReadability.reason;
  }
}

export const gatedEngineAdapter = new GatedEngineAdapter();

