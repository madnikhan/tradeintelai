/**
 * Build trade feature snapshot from gated analysis at execution time.
 */

import { TradingHoursFilter } from './trading-hours';
import type { ExtendedMarketAnalysis } from './gated-engine-adapter';
import type { TradeFeatures } from '@/types/trading';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildTradeFeatures(
  analysis: ExtendedMarketAnalysis,
  opts: {
    analysisId?: string;
    orderId?: string | number;
    source?: 'ai' | 'manual' | 'scalp';
    symbol: string;
  }
): TradeFeatures {
  const gs = analysis.gateStatus;
  const hours = TradingHoursFilter.analyze(opts.symbol);
  const sl = analysis.suggestedStopLoss ?? 0;
  const tp = analysis.suggestedTakeProfit ?? 0;
  const entry =
    analysis.suggestedStopLoss && analysis.suggestedTakeProfit
      ? (sl + tp) / 2
      : sl || tp;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rrRatio = risk > 0 ? reward / risk : undefined;

  return {
    analysisId: opts.analysisId,
    orderId: opts.orderId,
    source: opts.source,
    gate1Readable: gs?.marketReadable,
    gate2Bias: gs?.directionalBias,
    gate3Alignment: gs?.gptStructure?.alignment,
    gate4Permitted: gs?.executionPermitted,
    regime: analysis.regimeAnalysis?.regime,
    tradingSession: hours.currentSession,
    dayOfWeek: DAY_NAMES[new Date().getUTCDay()],
    recommendation: analysis.recommendation,
    confidence: analysis.confidence,
    overallScore: analysis.overallScore,
    rrRatio,
    expectancy: gs?.expectancyData?.estimatedExpectancy,
  };
}
