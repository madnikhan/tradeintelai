/**
 * Sync MT5 closed positions → Firestore trades + analysis outcomes (no browser tab required).
 */

import { getBridgeUrl } from '@/config/bridge-config';
import { isFirebaseConfigured } from './firebase/config';
import {
  getTradesFromFirestore,
  saveTradeToFirestore,
} from './firebase/trade-history';
import { updateAnalysisOutcome } from './firebase/analysis-storage';
import type { Trade } from '@/types/trading';

function normalizeTicket(v: unknown): string {
  return v != null ? String(v) : '';
}

function matchClosedToOpen(
  closed: Record<string, unknown>,
  openTrades: Trade[]
): Trade | undefined {
  const ticket =
    normalizeTicket(closed.position_id) ||
    normalizeTicket(closed.order_id) ||
    normalizeTicket(closed.ticket);
  const symbol = String(closed.symbol || '').replace(/\//g, '').toUpperCase();

  return openTrades.find((t) => {
    if (t.status !== 'open') return false;
    const featTicket = normalizeTicket(t.features?.orderId);
    if (ticket && featTicket && ticket === featTicket) return true;
    if (t.pair.replace(/\//g, '').toUpperCase() === symbol && featTicket === ticket) {
      return true;
    }
    return false;
  });
}

/**
 * Poll bridge closed positions and resolve open Firestore trades + analysis outcomes.
 */
export async function syncClosedPositionOutcomes(): Promise<{
  updated: number;
  errors: string[];
}> {
  if (typeof window === 'undefined') {
    return { updated: 0, errors: [] };
  }

  const errors: string[] = [];
  let updated = 0;

  try {
    const res = await fetch(getBridgeUrl('/closed-positions'), {
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    if (!res.ok) {
      return { updated: 0, errors: [`closed-positions HTTP ${res.status}`] };
    }

    const data = await res.json();
    const positions: Record<string, unknown>[] = data.positions ?? [];
    if (!positions.length) return { updated: 0, errors: [] };

    const firestoreTrades = isFirebaseConfigured()
      ? await getTradesFromFirestore()
      : [];

    const openTrades = firestoreTrades.filter((t) => t.status === 'open');

    for (const pos of positions) {
      const match = matchClosedToOpen(pos, openTrades);
      if (!match) continue;

      const profit = Number(pos.profit ?? 0);
      const swap = Number(pos.swap ?? 0);
      const commission = Number(pos.commission ?? 0);
      const netPl = profit + swap + commission;
      const exitPrice = Number(pos.exit_price ?? pos.close_price ?? 0);
      const closeTime = pos.close_time
        ? new Date(String(pos.close_time))
        : new Date();

      const closedTrade: Trade = {
        ...match,
        status: 'closed',
        profitLoss: netPl,
        closePrice: exitPrice || undefined,
        closeTime,
        closeReason: 'mt5_sync',
      };

      if (isFirebaseConfigured()) {
        await saveTradeToFirestore(closedTrade);
      }

      const analysisId = match.features?.analysisId;
      if (analysisId && isFirebaseConfigured()) {
        await updateAnalysisOutcome(analysisId, match.id, {
          wasProfitable: netPl > 0,
          actualReturn: netPl,
          predictedReturn: match.rewardAmount,
        });
      }

      updated++;
    }

    if (updated > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('positionWatchClosed'));
      window.dispatchEvent(new CustomEvent('tradeOutcomesSynced', { detail: { updated } }));
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { updated, errors };
}

const SYNC_INTERVAL_MS = 60_000;
let syncTimer: ReturnType<typeof setInterval> | null = null;

/** Start background outcome sync while dashboard is mounted. */
export function startOutcomeSyncPolling(): () => void {
  if (typeof window === 'undefined') return () => {};

  const tick = () => {
    void syncClosedPositionOutcomes();
  };

  tick();
  if (!syncTimer) {
    syncTimer = setInterval(tick, SYNC_INTERVAL_MS);
  }

  return () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  };
}
