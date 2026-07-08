/**
 * Client helpers for bridge watchdog API + credentials.
 */

import { getBridgeUrl } from '@/config/bridge-config';

let cachedApiToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export function isBridgeWatchdogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BRIDGE_WATCHDOG !== 'false';
}

export function getCachedBridgeApiToken(): string | null {
  if (cachedApiToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedApiToken;
  }
  return null;
}

export async function fetchBridgeCredentials(idToken?: string): Promise<{
  paired: boolean;
  bridgeUrl?: string | null;
  apiToken?: string;
}> {
  if (typeof window === 'undefined') return { paired: false };

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  } else {
    const { getCurrentUser } = await import('@/lib/firebase/auth');
    const user = getCurrentUser();
    if (user) {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch('/api/bridge/credentials', { headers });
  if (!res.ok) return { paired: false };
  const data = await res.json();
  if (data.apiToken) {
    cachedApiToken = data.apiToken;
    tokenFetchedAt = Date.now();
    if (data.bridgeUrl && typeof window !== 'undefined') {
      localStorage.setItem('bridge_url', data.bridgeUrl);
    }
  }
  return data;
}

function bridgeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  const token = getCachedBridgeApiToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function registerWatchOnBridge(payload: {
  ticket?: string | number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  analysisId?: string;
  profile?: 'default' | 'scalp';
  takeProfitDollars?: number;
}): Promise<boolean> {
  if (!isBridgeWatchdogEnabled()) return false;
  if (!payload.ticket) return false;

  try {
    await fetchBridgeCredentials();
    const res = await fetch(getBridgeUrl('/watch/register'), {
      method: 'POST',
      headers: bridgeHeaders(),
      body: JSON.stringify({
        ticket: String(payload.ticket),
        symbol: payload.symbol,
        direction: payload.direction,
        entryPrice: payload.entryPrice,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        analysisId: payload.analysisId,
        profile: payload.profile ?? 'default',
        takeProfitDollars: payload.takeProfitDollars,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getBridgeWatchStatus(): Promise<{
  watches: unknown[];
  config: unknown;
} | null> {
  try {
    await fetchBridgeCredentials();
    const res = await fetch(getBridgeUrl('/watch/status'), {
      headers: bridgeHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { watches: data.watches ?? [], config: data.config ?? {} };
  } catch {
    return null;
  }
}

export async function updateBridgeWatchConfig(config: Record<string, unknown>): Promise<boolean> {
  try {
    await fetchBridgeCredentials();
    const res = await fetch(getBridgeUrl('/watch/config'), {
      method: 'POST',
      headers: bridgeHeaders(),
      body: JSON.stringify(config),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createBridgePairingCode(idToken?: string): Promise<{
  code?: string;
  expiresInMinutes?: number;
  error?: string;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  } else {
    const { getCurrentUser } = await import('@/lib/firebase/auth');
    const user = getCurrentUser();
    if (!user) return { error: 'Sign in required' };
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const res = await fetch('/api/bridge/pair', { method: 'POST', headers });
  const data = await res.json();
  if (!res.ok) return { error: data.error || 'Failed to create code' };
  return data;
}
