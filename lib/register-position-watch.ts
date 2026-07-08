/**
 * Register a successful trade with bridge watchdog (preferred) or browser PositionWatch fallback.
 */

import { PositionWatchService } from '@/lib/position-watch-service';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { formatPairForMT5 } from '@/config/trading-rules';
import {
  isBridgeWatchdogEnabled,
  registerWatchOnBridge,
} from '@/lib/bridge-watch-client';

export async function registerPositionWatch(params: {
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
}): Promise<void> {
  const symbol = formatPairForMT5(params.symbol);
  const analysisId =
    params.analysisId ?? gatedEngineAdapter.getLastAnalysisId(symbol);

  const profile = params.profile ?? (params.source === 'scalp' ? 'scalp' : 'default');

  if (isBridgeWatchdogEnabled() && params.ticket != null) {
    const onBridge = await registerWatchOnBridge({
      ticket: params.ticket,
      symbol,
      direction: params.direction,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      analysisId,
      profile,
      takeProfitDollars: params.takeProfitDollars,
    });
    if (onBridge) {
      return;
    }
  }

  const configOverrides =
    profile === 'scalp'
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
