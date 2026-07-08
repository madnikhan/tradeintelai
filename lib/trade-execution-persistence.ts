/**
 * Persist executed trades + link analyses for win-rate feedback loop.
 */

import { RiskCalculator } from './risk-calculator';
import { buildTradeFeatures } from './trade-features';
import { gatedEngineAdapter } from './gated-engine-adapter';
import { storeTradeInHistory } from './trade-history';
import { markAnalysisActionTaken } from './firebase/analysis-storage';
import type { ExtendedMarketAnalysis } from './gated-engine-adapter';
import type { Trade, TradeDirection } from '@/types/trading';

function parseEntryPrice(analysis: ExtendedMarketAnalysis): number {
  const priceLine = analysis.detailedReasoning?.risk?.find((r) =>
    r.includes('Current Price:')
  );
  const parsed = priceLine?.match(/([\d.]+)/);
  if (parsed) return parseFloat(parsed[1]);
  return analysis.suggestedStopLoss ?? 0;
}

export function buildTradeFromExecution(params: {
  symbol: string;
  analysis: ExtendedMarketAnalysis;
  direction: TradeDirection;
  lotSize: number;
  orderId?: string | number;
  source?: 'ai' | 'manual' | 'scalp';
  analysisId?: string;
}): Trade {
  const { symbol, analysis, direction, lotSize, orderId, source = 'ai' } = params;
  const symbolNorm = symbol.replace(/\//g, '').toUpperCase();
  const analysisId =
    params.analysisId ?? gatedEngineAdapter.getLastAnalysisId(symbolNorm);
  const entryPrice = parseEntryPrice(analysis);
  const stopLoss = analysis.suggestedStopLoss!;
  const takeProfit = analysis.suggestedTakeProfit!;

  const riskCalc = RiskCalculator.calculateTradeSizeSync(entryPrice, stopLoss, symbolNorm);
  const tradeId = orderId != null ? `mt5_${orderId}` : `trade_${symbolNorm}_${Date.now()}`;

  return {
    id: tradeId,
    pair: symbolNorm,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    lotSize,
    riskAmount: riskCalc.riskAmount,
    rewardAmount: riskCalc.rewardAmount,
    status: 'open',
    profitLoss: 0,
    timestamp: new Date(),
    reason: `Gated ${source} execute`,
    features: buildTradeFeatures(analysis, {
      analysisId,
      orderId,
      source,
      symbol: symbolNorm,
    }),
  };
}

/** Save trade + mark analysis as acted upon (non-blocking). */
export async function persistExecutedTrade(params: {
  symbol: string;
  analysis: ExtendedMarketAnalysis;
  direction: TradeDirection;
  lotSize: number;
  orderId?: string | number;
  source?: 'ai' | 'manual' | 'scalp';
}): Promise<void> {
  const trade = buildTradeFromExecution(params);
  await storeTradeInHistory(trade);

  const analysisId = trade.features?.analysisId;
  if (analysisId) {
    await markAnalysisActionTaken(analysisId, trade.id, {
      predictedReturn: trade.rewardAmount,
    });
  }
}
