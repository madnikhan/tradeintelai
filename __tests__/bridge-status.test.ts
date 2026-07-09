import { describe, it, expect } from 'vitest';
import { deriveBridgeStatus } from '@/lib/bridge-status';

describe('deriveBridgeStatus', () => {
  const base = {
    presenceLoading: false,
    activeAccountLogin: 52556154,
    balanceLoaded: true,
    balance: 95.55,
    bridgeUrl: 'https://tunnel.trycloudflare.com',
  };

  it('returns ready when all checks pass', () => {
    const s = deriveBridgeStatus({
      ...base,
      http: { reachable: true, mt5Connected: true },
      presenceState: 'online',
    });
    expect(s.state).toBe('ready');
    expect(s.canExecute).toBe(true);
    expect(s.headerLabel).toBe('Ready');
  });

  it('returns tunnel_down when HTTP fails', () => {
    const s = deriveBridgeStatus({
      ...base,
      http: { reachable: false, mt5Connected: false },
      presenceState: 'online',
    });
    expect(s.state).toBe('tunnel_down');
    expect(s.canExecute).toBe(false);
  });

  it('returns tunnel_ok_unpaired when HTTP works but not paired', () => {
    const s = deriveBridgeStatus({
      ...base,
      http: { reachable: true, mt5Connected: true },
      presenceState: 'not_paired',
    });
    expect(s.state).toBe('tunnel_ok_unpaired');
  });

  it('returns no_account when login missing', () => {
    const s = deriveBridgeStatus({
      ...base,
      activeAccountLogin: null,
      http: { reachable: true, mt5Connected: true },
      presenceState: 'online',
    });
    expect(s.state).toBe('no_account');
  });
});
