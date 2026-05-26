/**
 * Register a successful trade with PositionWatchService (shared helper).
 */

import { PositionWatchService } from '@/lib/position-watch-service';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { formatPairForMT5 } from '@/config/trading-rules';

export function registerPositionWatch(params: {
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  ticket?: string | number;
  source?: 'ai' | 'manual' | 'scalp';
  recommendation?: string;
  analysisId?: string;
  profile?: 'default' | 'scalp';
  takeProfitDollars?: number;
}): void {
  const symbol = formatPairForMT5(params.symbol);
  const analysisId =
    params.analysisId ??
    gatedEngineAdapter.getLastAnalysisId(symbol);

  const configOverrides =
    params.profile === 'scalp'
      ? {
          maxHoldMs: 30 * 60 * 1000,
          stallNearTpMs: 15 * 60 * 1000,
          signalRecheckEnabled: false,
        }
      : undefined;

  PositionWatchService.register({
    symbol,
    ticket: params.ticket,
    direction: params.direction,
    entryPrice: params.entryPrice,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    source: params.source ?? 'manual',
    analysisId,
    recommendation: params.recommendation,
    takeProfitDollars: params.takeProfitDollars,
    configOverrides,
  });
  PositionWatchService.startPolling();
}
