/**
 * Client-side trade permission checks (Firestore mt5Accounts + local fallback).
 */

import {
  findAccountByLogin,
  getMemberRole,
  canTradeByRole,
} from '@/lib/firebase/mt5-accounts';
import { accountManager } from '@/lib/account-manager';
import { assertCanGoLive, type DemoReadinessResult } from '@/lib/demo-readiness';
import type { Trade } from '@/types/trading';
import { TRADING_RULES } from '@/config/trading-rules';

export interface TradePermissionResult {
  allowed: boolean;
  error?: string;
  bridgeUrl?: string;
  accountLogin?: number;
}

/**
 * Resolve active account login from local account manager.
 */
export function getActiveAccountLogin(): number | null {
  const active = accountManager.getActiveAccount();
  return active?.login ?? null;
}

/**
 * Ensure the current user may trade on the given MT5 login; set bridge URL when found in Firestore.
 */
export async function assertCanTrade(accountLogin?: number | null): Promise<TradePermissionResult> {
  const login = accountLogin ?? getActiveAccountLogin();
  if (!login) {
    return { allowed: false, error: 'No active MT5 account selected' };
  }

  try {
    const record = await findAccountByLogin(login);
    if (record) {
      const role = await getMemberRole(record.id);
      if (!canTradeByRole(role)) {
        return {
          allowed: false,
          error: `You do not have trade permission for account ${login}`,
          accountLogin: login,
        };
      }

      if (record.bridgeUrl && typeof window !== 'undefined') {
        localStorage.setItem('bridge_url', record.bridgeUrl);
      }

      return {
        allowed: true,
        bridgeUrl: record.bridgeUrl,
        accountLogin: login,
      };
    }
  } catch {
    // Fall through to local-only mode when Firestore unavailable
  }

  const local = accountManager.findByLogin(login);
  if (!local) {
    return {
      allowed: false,
      error: `Account ${login} is not registered`,
      accountLogin: login,
    };
  }

  return { allowed: true, accountLogin: login };
}

export { assertCanGoLive, type DemoReadinessResult };

/**
 * Block switching to live until demo success criteria are met (unless override).
 */
export async function assertCanGoLiveMode(
  trades: Trade[],
  initialBalance: number,
  currentBalance: number,
  options?: { allowOverride?: boolean }
): Promise<DemoReadinessResult> {
  return assertCanGoLive(trades, initialBalance, currentBalance, options);
}

export function getDemoCriteriaSummary(): {
  minWinRate: number;
  maxDrawdown: number;
  minProfitFactor: number;
  minWeeks: number;
  minClosedTrades: number;
  minResolvedAnalyses: number;
} {
  return {
    minWinRate: TRADING_RULES.MIN_WIN_RATE,
    maxDrawdown: TRADING_RULES.MAX_DRAWDOWN,
    minProfitFactor: TRADING_RULES.MIN_PROFIT_FACTOR,
    minWeeks: TRADING_RULES.MIN_CONSECUTIVE_WEEKS,
    minClosedTrades: TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE,
    minResolvedAnalyses: TRADING_RULES.MIN_RESOLVED_ANALYSES,
  };
}
