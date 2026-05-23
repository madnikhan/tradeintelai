/**
 * Client-side trade permission checks (Firestore mt5Accounts + local fallback).
 */

import {
  findAccountByLogin,
  getMemberRole,
  canTradeByRole,
} from '@/lib/firebase/mt5-accounts';
import { accountManager } from '@/lib/account-manager';

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
