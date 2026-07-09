/**
 * Sync MT5 account from bridge /account response into local account manager.
 * Fixes "No active MT5 account selected" when bridge is connected but no account is registered.
 */

import { accountManager, type MT5Account } from '@/lib/account-manager';
import { httpBridge } from '@/lib/http-bridge-connector';
import { TradingModeManager } from '@/lib/trading-mode';

export interface BridgeAccountSyncResult {
  bridgeConnected: boolean;
  account: MT5Account | null;
  autoSelected: boolean;
  created: boolean;
}

function detectMt5Kind(accountInfo: {
  account_type?: string;
  server?: string;
}): 'demo' | 'live' | 'unknown' {
  if (accountInfo.account_type) {
    return accountInfo.account_type === 'demo' ? 'demo' : 'live';
  }
  if (accountInfo.server?.toLowerCase().includes('demo')) {
    return 'demo';
  }
  if (accountInfo.server) {
    return 'live';
  }
  return 'unknown';
}

function applyMt5KindFromBridge(accountInfo: {
  account_type?: string;
  server?: string;
}): void {
  const kind = detectMt5Kind(accountInfo);
  if (kind === 'unknown') return;
  TradingModeManager.setMt5AccountKind(kind);
  TradingModeManager.applyDetectedModeFromMt5(kind);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tradingModeChanged', {
        detail: { mode: TradingModeManager.getCurrentMode() },
      })
    );
  }
}

/**
 * Register bridge login locally and auto-select if none active.
 */
export async function syncAccountFromBridge(
  accountInfo?: Record<string, unknown>
): Promise<BridgeAccountSyncResult> {
  const info =
    accountInfo ?? (await httpBridge.getAccountInfo().catch(() => ({ success: false })));

  if (!info?.success || info.login == null) {
    return {
      bridgeConnected: false,
      account: accountManager.getActiveAccount(),
      autoSelected: false,
      created: false,
    };
  }

  const login = Number(info.login);
  if (!Number.isFinite(login)) {
    return {
      bridgeConnected: true,
      account: accountManager.getActiveAccount(),
      autoSelected: false,
      created: false,
    };
  }

  applyMt5KindFromBridge(info as { account_type?: string; server?: string });

  let account = accountManager.findByLogin(login);
  let created = false;

  if (!account) {
    const server = String(info.server || 'MT5');
    const name =
      String(info.name || '').trim() ||
      `${server.includes('Demo') || server.toLowerCase().includes('demo') ? 'Demo' : 'MT5'} ${login}`;
    account = accountManager.addAccount({
      name,
      login,
      server,
    });
    created = true;
  }

  accountManager.updateAccountData(login, {
    balance: typeof info.balance === 'number' ? info.balance : undefined,
    equity: typeof info.equity === 'number' ? info.equity : undefined,
    currency: typeof info.currency === 'string' ? info.currency : undefined,
  });

  const hadActive = Boolean(accountManager.getActiveAccount());
  let autoSelected = false;
  if (!hadActive) {
    accountManager.setActiveAccount(account.id);
    autoSelected = true;
  }

  if (autoSelected && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mt5AccountChanged'));
  }

  return {
    bridgeConnected: true,
    account: accountManager.getActiveAccount() ?? account,
    autoSelected,
    created,
  };
}
