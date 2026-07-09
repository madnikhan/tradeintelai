'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBridgePresence } from '@/context/BridgeContext';
import {
  deriveBridgeStatus,
  fetchHttpBridgeHealth,
  setBridgePresenceCache,
  type BridgeStatusSnapshot,
} from '@/lib/bridge-status';
import { syncAccountFromBridge } from '@/lib/bridge-account-sync';
import { getActiveAccountLogin } from '@/lib/trade-permissions';
import { httpBridge } from '@/lib/http-bridge-connector';

const CHECK_INTERVAL_MS = 30_000;

export function useBridgeStatus(): BridgeStatusSnapshot & {
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { state: presenceState, loading: presenceLoading, bridgeUrl } = useBridgePresence();
  const [snapshot, setSnapshot] = useState<BridgeStatusSnapshot>(() =>
    deriveBridgeStatus({
      http: { reachable: false, mt5Connected: false },
      presenceState: 'unknown',
      presenceLoading: true,
      activeAccountLogin: null,
      balanceLoaded: false,
      balance: null,
      bridgeUrl: null,
    })
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setBridgePresenceCache(presenceState, presenceLoading, bridgeUrl);
    const http = await fetchHttpBridgeHealth();
    await syncAccountFromBridge().catch(() => undefined);

    let balanceLoaded = false;
    let balance: number | null = null;

    if (http.reachable) {
      try {
        const info = await httpBridge.getAccountInfo();
        if (
          info?.success &&
          info.balance !== undefined &&
          info.balance !== null &&
          !Number.isNaN(Number(info.balance))
        ) {
          balanceLoaded = true;
          balance = Number(info.balance);
        }
      } catch {
        // ignore
      }
    }

    setSnapshot(
      deriveBridgeStatus({
        http,
        presenceState,
        presenceLoading,
        activeAccountLogin: getActiveAccountLogin(),
        balanceLoaded,
        balance,
        bridgeUrl,
      })
    );
    setLoading(false);
  }, [presenceState, presenceLoading, bridgeUrl]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), CHECK_INTERVAL_MS);
    const onAccount = () => void refresh();
    window.addEventListener('mt5AccountChanged', onAccount);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mt5AccountChanged', onAccount);
    };
  }, [refresh]);

  return { ...snapshot, loading, refresh };
}
