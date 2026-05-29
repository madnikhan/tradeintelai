/**
 * Shared gated-trade execution (Trade tab + Scan quick execute).
 */

import { httpBridge } from '@/lib/http-bridge-connector';
import { registerPositionWatch } from '@/lib/register-position-watch';
import { TradingModeManager } from '@/lib/trading-mode';
import { notifyTradeExecutedClient } from '@/lib/notifications/client-notify';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';

export interface ExecuteGatedTradeParams {
  symbol: string;
  analysis: ExtendedMarketAnalysis;
  source?: 'ai' | 'manual' | 'scalp';
  skipModeMismatchCheck?: boolean;
}

export interface ExecuteGatedTradeResult {
  success: boolean;
  error?: string;
  message?: string;
  order_id?: string | number;
  orderId?: string | number;
  cancelled?: boolean;
}

function parseEntryPrice(analysis: ExtendedMarketAnalysis): number {
  const priceLine = analysis.detailedReasoning?.risk?.find((r) =>
    r.includes('Current Price:')
  );
  const parsed = priceLine?.match(/([\d.]+)/);
  if (parsed) return parseFloat(parsed[1]);
  return analysis.suggestedStopLoss;
}

export function validateGatedExecution(
  analysis: ExtendedMarketAnalysis
): { ok: true } | { ok: false; error: string } {
  if (analysis.gateStatus) {
    if (!analysis.gateStatus.executionPermitted) {
      const blockers = analysis.gateStatus.executionBlockedBy?.join('; ');
      return {
        ok: false,
        error: `Execution blocked by Gate 4. ${blockers || analysis.gateStatus.executionReason || 'Gate conditions not met.'}`,
      };
    }
    if (analysis.confidence < 50) {
      return {
        ok: false,
        error: `Confidence too low (${analysis.confidence}%, minimum 50%).`,
      };
    }
    if (analysis.recommendation === 'HOLD') {
      return { ok: false, error: 'AI recommends HOLD — execution blocked.' };
    }
  } else {
    const MIN_SCORE = 65;
    const MIN_CONFIDENCE = 55;
    if (analysis.overallScore < MIN_SCORE) {
      return {
        ok: false,
        error: `Signal too weak (${analysis.overallScore}/100, minimum ${MIN_SCORE}).`,
      };
    }
    if (analysis.confidence < MIN_CONFIDENCE) {
      return {
        ok: false,
        error: `Confidence too low (${analysis.confidence}%, minimum ${MIN_CONFIDENCE}%).`,
      };
    }
    if (analysis.recommendation === 'HOLD') {
      return { ok: false, error: 'AI recommends HOLD.' };
    }
  }

  if (!analysis.suggestedPositionSize || analysis.suggestedPositionSize <= 0) {
    return { ok: false, error: 'Invalid position size' };
  }
  if (!analysis.suggestedStopLoss || !analysis.suggestedTakeProfit) {
    return { ok: false, error: 'Invalid stop loss or take profit' };
  }

  return { ok: true };
}

/** App demo mode vs MT5 live account — optional confirm before order. */
export async function checkModeMismatch(): Promise<{ proceed: boolean }> {
  if (typeof window === 'undefined') return { proceed: true };
  if (!TradingModeManager.isDemoMode()) return { proceed: true };

  try {
    const accountInfo = await httpBridge.getAccountInfo();
    if (!accountInfo.success) return { proceed: true };
    const mt5Live =
      accountInfo.account_type === 'live' ||
      (accountInfo.server &&
        !accountInfo.server.toLowerCase().includes('demo'));
    if (!mt5Live) return { proceed: true };

    const proceed = window.confirm(
      'App is in DEMO mode but your connected MT5 account appears to be LIVE. Orders will execute on the live account. Continue?'
    );
    return { proceed };
  } catch {
    return { proceed: true };
  }
}

export async function executeGatedTrade(
  params: ExecuteGatedTradeParams
): Promise<ExecuteGatedTradeResult> {
  const { symbol, analysis, source = 'ai' } = params;

  const validation = validateGatedExecution(analysis);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  if (!params.skipModeMismatchCheck) {
    const { proceed } = await checkModeMismatch();
    if (!proceed) {
      return { success: false, cancelled: true, error: 'Cancelled by user' };
    }
  }

  const symbolNorm = symbol.replace(/\//g, '');
  const direction = analysis.recommendation.includes('BUY') ? 'BUY' : 'SELL';

  try {
    const result = await httpBridge.executeTrade({
      symbol: symbolNorm,
      type: direction,
      volume: Math.max(0.01, Math.min(analysis.suggestedPositionSize, 200)),
      stopLoss: analysis.suggestedStopLoss,
      takeProfit: analysis.suggestedTakeProfit,
    });

    if (result?.success) {
      registerPositionWatch({
        symbol: symbolNorm,
        direction,
        entryPrice: parseEntryPrice(analysis),
        stopLoss: analysis.suggestedStopLoss!,
        takeProfit: analysis.suggestedTakeProfit!,
        ticket: result.order_id ?? result.orderId,
        source,
        recommendation: analysis.recommendation,
      });

      void notifyTradeExecutedClient({
        symbol: symbolNorm,
        direction,
        lots: Math.max(0.01, Math.min(analysis.suggestedPositionSize, 200)),
        entry: parseEntryPrice(analysis),
        stopLoss: analysis.suggestedStopLoss!,
        takeProfit: analysis.suggestedTakeProfit!,
        orderId: result.order_id ?? result.orderId,
        score: analysis.overallScore,
        confidence: analysis.confidence,
        gatePassed: analysis.gateStatus?.executionPermitted ?? true,
      });
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Trade execution failed',
    };
  }
}
