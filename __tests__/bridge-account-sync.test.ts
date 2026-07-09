import { describe, it, expect, beforeEach } from 'vitest';
import { syncAccountFromBridge } from '@/lib/bridge-account-sync';
import { accountManager } from '@/lib/account-manager';
import { getActiveAccountLogin } from '@/lib/trade-permissions';
import { TradingModeManager } from '@/lib/trading-mode';

describe('syncAccountFromBridge', () => {
  beforeEach(() => {
    for (const acc of accountManager.getAllAccounts()) {
      accountManager.removeAccount(acc.id);
    }
    TradingModeManager.setMt5AccountKind('unknown');
  });

  it('registers and auto-selects account when bridge returns login', async () => {
    const result = await syncAccountFromBridge({
      success: true,
      login: 17835928,
      server: 'ICMarkets-Demo',
      account_type: 'demo',
      balance: 10000,
      equity: 10050,
      currency: 'USD',
    });

    expect(result.bridgeConnected).toBe(true);
    expect(result.created).toBe(true);
    expect(result.autoSelected).toBe(true);
    expect(getActiveAccountLogin()).toBe(17835928);
    expect(TradingModeManager.getMt5AccountKind()).toBe('demo');
  });

  it('updates existing account without re-creating', async () => {
    accountManager.addAccount({
      name: 'Demo 17835928',
      login: 17835928,
      server: 'ICMarkets-Demo',
    });

    const result = await syncAccountFromBridge({
      success: true,
      login: 17835928,
      server: 'ICMarkets-Demo',
      account_type: 'demo',
      balance: 12000,
    });

    expect(result.created).toBe(false);
    expect(accountManager.getAllAccounts()).toHaveLength(1);
    expect(accountManager.findByLogin(17835928)?.balance).toBe(12000);
  });
});
