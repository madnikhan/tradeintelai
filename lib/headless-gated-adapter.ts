/**
 * Headless gated analysis for Auto Pilot worker (no browser, no Firestore persist).
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

export class HeadlessGatedAdapter {
  private engine = new GatedTradingEngine();

  async analyzeMarket(
    symbol: string,
    openTrades: unknown[] = [],
    options?: GatedAnalyzeOptions
  ): Promise<ExtendedMarketAnalysis> {
    const gated = await this.engine.analyzeMarket(
      symbol,
      openTrades,
      undefined,
      {
        mode: options?.mode ?? 'scan',
        ...options,
        generateChartFromOhlc: false,
      }
    );
    return convertToLegacyFormat(gated);
  }

  async analyzeToJson(
    symbol: string,
    options?: GatedAnalyzeOptions
  ): Promise<string> {
    const result = await this.analyzeMarket(symbol, [], options);
    return JSON.stringify({
      symbol: normalizeSymbolKey(symbol),
      recommendation: result.recommendation,
      confidence: result.confidence,
      overallScore: result.overallScore,
      executionPermitted: result.gateStatus?.executionPermitted ?? false,
      executionBlockedBy: result.gateStatus?.executionBlockedBy ?? [],
      executionReason: result.gateStatus?.executionReason,
      suggestedStopLoss: result.suggestedStopLoss,
      suggestedTakeProfit: result.suggestedTakeProfit,
      suggestedPositionSize: result.suggestedPositionSize,
      dataHealth: result.dataHealth,
    });
  }
}

export const headlessGatedAdapter = new HeadlessGatedAdapter();
