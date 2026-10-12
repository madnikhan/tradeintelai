/**
 * Shared SL/TP geometry checks for Copilot Execute and Auto Pilot.
 */

export type TradeSide = 'BUY' | 'SELL';

export interface TradeGeometryInput {
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  /** Optional min distance from entry (price units). */
  minStopDistance?: number;
  /** Minimum reward:risk (default 1.0). */
  minRewardRisk?: number;
}

export type TradeGeometryResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateTradeGeometry(
  input: TradeGeometryInput
): TradeGeometryResult {
  const { side, entry, stopLoss, takeProfit } = input;
  const minRr = input.minRewardRisk ?? 1.0;
  const minDist = input.minStopDistance ?? 0;

  if (!Number.isFinite(entry) || entry <= 0) {
    return { ok: false, error: 'Invalid entry price' };
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
    return { ok: false, error: 'Invalid stop loss (must be > 0)' };
  }
  if (!Number.isFinite(takeProfit) || takeProfit <= 0) {
    return { ok: false, error: 'Invalid take profit (must be > 0)' };
  }

  if (side === 'BUY') {
    if (stopLoss >= entry) {
      return { ok: false, error: 'BUY stop loss must be below entry' };
    }
    if (takeProfit <= entry) {
      return { ok: false, error: 'BUY take profit must be above entry' };
    }
  } else {
    if (stopLoss <= entry) {
      return { ok: false, error: 'SELL stop loss must be above entry' };
    }
    if (takeProfit >= entry) {
      return { ok: false, error: 'SELL take profit must be below entry' };
    }
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0) {
    return { ok: false, error: 'Stop distance is zero' };
  }
  if (minDist > 0 && risk < minDist) {
    return {
      ok: false,
      error: `Stop too close to entry (need ≥ ${minDist})`,
    };
  }
  const rr = reward / risk;
  if (rr < minRr) {
    return {
      ok: false,
      error: `Reward:risk ${rr.toFixed(2)} below minimum ${minRr}`,
    };
  }

  return { ok: true };
}
