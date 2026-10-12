/**
 * Headless gated analysis for Auto Pilot worker (Node / cloud API).
 * Aligns with Copilot: trade-mode thresholds, optional OHLC vision, empirical Gate 4, persist.
 */

import {
  GatedTradingEngine,
  GatedAnalyzeOptions,
  GatedMarketAnalysis,
} from './gated-trading-engine';
import type { ExtendedMarketAnalysis } from './gated-engine-adapter';

function normalizeSymbolKey(symbol: string): string {
  return symbol.replace(/\//g, '').toUpperCase();
}

function calculateDisplayScore(gated: GatedMarketAnalysis): number {
  // Match UI adapter: bias-strength based when executable, else component average
  if (gated.executionPermission.canExecute && gated.directionalBias.direction !== 'NEUTRAL') {
    return Math.round(gated.directionalBias.strength);
  }
  const { technical, fundamental, sentiment } = gated.componentScores;
  return Math.round((technical + fundamental + sentiment) / 3);
}

function convertToLegacyFormat(gated: GatedMarketAnalysis): ExtendedMarketAnalysis {
  const displayScore = calculateDisplayScore(gated);

  let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  if (!gated.executionPermission.canExecute || gated.recommendation === 'HOLD') {
    recommendation = 'HOLD';
  } else if (gated.directionalBias.direction === 'BULLISH') {
    recommendation = gated.directionalBias.strength > 60 ? 'STRONG_BUY' : 'BUY';
  } else if (gated.directionalBias.direction === 'BEARISH') {
    recommendation = gated.directionalBias.strength > 60 ? 'STRONG_SELL' : 'SELL';
  } else {
    recommendation = 'HOLD';
  }

  return {
    symbol: gated.symbol,
    timestamp: gated.timestamp,
    overallScore: displayScore,
    recommendation,
    confidence: gated.executionPermission.confidence,
    technicalScore: gated.componentScores.technical,
    fundamentalScore: gated.componentScores.fundamental,
    sentimentScore: gated.componentScores.sentiment,
    riskLevel: gated.riskLevel || 'MEDIUM',
    suggestedStopLoss: gated.suggestedStopLoss ?? 0,
    suggestedTakeProfit: gated.suggestedTakeProfit ?? 0,
    suggestedPositionSize: gated.suggestedPositionSize ?? 0,
    reasoning: [gated.recommendationReason],
    detailedReasoning: gated.detailedReasoning,
    gateStatus: {
      marketReadable: gated.marketReadability.isReadable,
      marketReadabilityReason: gated.marketReadability.reason,
      gate1Inputs: gated.marketReadability.gate1Inputs,
      directionalBias: gated.directionalBias.direction,
      biasStrength: gated.directionalBias.strength,
      gptStructure: gated.gptStructure
        ? {
            marketStructure: gated.gptStructure.marketStructure,
            alignment: gated.gptStructure.alignment,
            confidence: gated.gptStructure.confidence,
          }
        : undefined,
      executionPermitted: gated.executionPermission.canExecute,
      executionReason: gated.executionPermission.reason,
      executionBlockedBy: gated.executionPermission.blockedBy,
      expectancyData: gated.expectancyData,
    },
    dataHealth: gated.dataHealth,
  };
}

export interface HeadlessAnalyzeResult {
  analysis: ExtendedMarketAnalysis;
  analysisId: string;
  entryPrice: number | null;
}

export class HeadlessGatedAdapter {
  private engine = new GatedTradingEngine();
  private lastAnalysisIds = new Map<string, string>();

  getLastAnalysisId(symbol: string): string | undefined {
    return this.lastAnalysisIds.get(normalizeSymbolKey(symbol));
  }

  async analyzeMarket(
    symbol: string,
    openTrades: unknown[] = [],
    options?: GatedAnalyzeOptions & { useVision?: boolean; persist?: boolean }
  ): Promise<ExtendedMarketAnalysis> {
    const result = await this.analyzeWithMeta(symbol, openTrades, options);
    return result.analysis;
  }

  async analyzeWithMeta(
    symbol: string,
    openTrades: unknown[] = [],
    options?: GatedAnalyzeOptions & { useVision?: boolean; persist?: boolean }
  ): Promise<HeadlessAnalyzeResult> {
    const useVision = options?.useVision === true;
    const mode = options?.mode ?? (useVision ? 'trade' : 'scan');

    const gated = await this.engine.analyzeMarket(symbol, openTrades, undefined, {
      mode,
      generateChartFromOhlc: useVision,
      // Headless has no browser chart — always allow OHLC structure when vision/GPT absent
      allowOhlcStructureFallback: true,
      ...options,
    });

    const analysis = convertToLegacyFormat(gated);
    let analysisId = '';

    if (options?.persist !== false) {
      try {
        const { saveAnalysisToFirestore } = await import('./firebase/analysis-storage');
        analysisId = await saveAnalysisToFirestore(symbol, analysis as any, {
          gateStatus: analysis.gateStatus,
          source: 'auto-pilot',
        });
        if (analysisId) {
          this.lastAnalysisIds.set(normalizeSymbolKey(symbol), analysisId);
        }
      } catch (e) {
        console.warn('[headless] persistAnalysis failed:', e);
      }
    }

    const entryPrice = this.extractEntryPrice(gated);

    return { analysis, analysisId, entryPrice };
  }

  private extractEntryPrice(gated: GatedMarketAnalysis): number | null {
    // Prefer last OHLC close from detailed reasoning if present
    const riskLines = gated.detailedReasoning?.risk || [];
    for (const line of riskLines) {
      const m = line.match(/Current Price:\s*([\d.]+)/i);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }

  async analyzeToJson(
    symbol: string,
    options?: GatedAnalyzeOptions & { useVision?: boolean }
  ): Promise<string> {
    const { analysis, analysisId, entryPrice } = await this.analyzeWithMeta(
      symbol,
      [],
      options
    );
    return JSON.stringify({
      ok: true,
      symbol: normalizeSymbolKey(symbol),
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      overallScore: analysis.overallScore,
      executionPermitted: analysis.gateStatus?.executionPermitted ?? false,
      executionBlockedBy: analysis.gateStatus?.executionBlockedBy ?? [],
      executionReason: analysis.gateStatus?.executionReason,
      suggestedStopLoss: analysis.suggestedStopLoss,
      suggestedTakeProfit: analysis.suggestedTakeProfit,
      suggestedPositionSize: analysis.suggestedPositionSize,
      entryPrice,
      analysisId: analysisId || undefined,
      dataHealth: analysis.dataHealth,
    });
  }
}

export const headlessGatedAdapter = new HeadlessGatedAdapter();
