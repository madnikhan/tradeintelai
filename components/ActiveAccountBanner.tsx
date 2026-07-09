'use client';

import { useEffect, useState } from 'react';
import { getActiveAccountLogin } from '@/lib/trade-permissions';
import { syncAccountFromBridge } from '@/lib/bridge-account-sync';
import Link from 'next/link';

interface ActiveAccountBannerProps {
  compact?: boolean;
}

/**
 * Shown when bridge responds but no MT5 account is selected for execution.
 */
export function ActiveAccountBanner({ compact }: ActiveAccountBannerProps) {
  const [bridgeOk, setBridgeOk] = useState(false);
  const [activeLogin, setActiveLogin] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = async () => {
    try {
      const sync = await syncAccountFromBridge();
      setBridgeOk(sync.bridgeConnected);
      setActiveLogin(getActiveAccountLogin());
    } catch {
      setBridgeOk(false);
      setActiveLogin(getActiveAccountLogin());
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onAccount = () => setActiveLogin(getActiveAccountLogin());
    window.addEventListener('mt5AccountChanged', onAccount);
    return () => window.removeEventListener('mt5AccountChanged', onAccount);
  }, []);

  if (checking) return null;
  if (!bridgeOk || activeLogin) return null;

  if (compact) {
    return (
      <p className="text-xs text-amber-400/90">
        MT5 connected — select account (profile icon) to execute trades.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 mb-4">
      <p className="font-medium">MT5 bridge connected — no account selected for execution</p>
      <p className="text-xs mt-1 text-amber-200/80">
        Click the profile icon (top right) and activate your MT5 login, or open Setup to pair your bridge.
        Quick Execute and Execute BUY require an active account even when gates pass.
      </p>
      <Link
        href="/dashboard?tab=settings"
        className="text-xs text-cyan-400 hover:underline mt-2 inline-block"
      >
        Open Setup → Accounts
      </Link>
    </div>
  );
}

export function useActiveMt5AccountLogin(): number | null {
  const [login, setLogin] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getActiveAccountLogin() : null
  );

  useEffect(() => {
    const update = () => setLogin(getActiveAccountLogin());
    void syncAccountFromBridge().then(update);
    window.addEventListener('mt5AccountChanged', update);
    return () => window.removeEventListener('mt5AccountChanged', update);
  }, []);

  return login;
}

export const EXECUTE_ACCOUNT_TOOLTIP =
  'Select MT5 account — click profile icon (top right) or open Setup';
