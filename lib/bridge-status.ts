/**
 * Unified bridge connectivity state — merges HTTP health, Firestore presence,
 * active MT5 account, and live balance into one source of truth.
 */

import { getBridgeUrl, hasConfiguredBridgeUrl, isUnreachableLocalBridgeOnRemoteDashboard } from '@/config/bridge-config';
import { syncAccountFromBridge } from '@/lib/bridge-account-sync';
import { getActiveAccountLogin } from '@/lib/trade-permissions';
import type { BridgePresenceState } from '@/lib/bridge-presence';

let cachedPresenceState: BridgePresenceState = 'unknown';
let cachedPresenceLoading = true;
let cachedBridgeUrl: string | null = null;

/** Updated by useBridgeStatus so execute path can read Firestore presence without React. */
export function setBridgePresenceCache(
  state: BridgePresenceState,
  loading: boolean,
  bridgeUrl: string | null
): void {
  cachedPresenceState = state;
  cachedPresenceLoading = loading;
  cachedBridgeUrl = bridgeUrl;
}

export type BridgeConnectivityState =
  | 'ready'
  | 'tunnel_ok_unpaired'
  | 'tunnel_down'
  | 'ea_disconnected'
  | 'no_account'
  | 'balance_pending'
  | 'unknown'
  | 'checking';

export interface HttpBridgeHealth {
  reachable: boolean;
  mt5Connected: boolean;
  status?: string;
}

export interface BridgeStatusInputs {
  http: HttpBridgeHealth;
  presenceState: BridgePresenceState;
  presenceLoading: boolean;
  activeAccountLogin: number | null;
  balanceLoaded: boolean;
  balance: number | null;
  bridgeUrl: string | null;
}

export interface BridgeStatusSnapshot {
  state: BridgeConnectivityState;
  label: string;
  headerLabel: string;
  fixHint: string;
  canExecute: boolean;
  httpReachable: boolean;
  mt5Connected: boolean;
  presenceState: BridgePresenceState;
  activeAccountLogin: number | null;
  balanceLoaded: boolean;
  balance: number | null;
  bridgeUrl: string | null;
}

const STATE_META: Record<
  Exclude<BridgeConnectivityState, 'checking'>,
  { label: string; headerLabel: string; fixHint: string; canExecute: boolean }
> = {
  ready: {
    label: 'Ready to trade',
    headerLabel: 'Ready',
    fixHint: '',
    canExecute: true,
  },
  tunnel_down: {
    label: 'Bridge offline',
    headerLabel: 'Offline',
    fixHint:
      'No tunnel URL configured. On your Mac: open TradeIntel Bridge → Connect dashboard (copies tunnel URL). Then Setup → save tunnel URL → Test connection → pair with npm run bridge:pair.',
    canExecute: false,
  },
  unknown: {
    label: 'Bridge status unknown',
    headerLabel: 'Setup needed',
    fixHint:
      'Sign in, refresh the page, and complete bridge pairing in Setup. If this persists, check Firebase connection in the browser console.',
    canExecute: false,
  },
  ea_disconnected: {
    label: 'MT5 EA disconnected',
    headerLabel: 'Setup needed',
    fixHint:
      'Attach MT5FileBridgeEA to a chart in MetaTrader 5 with "Allow live trading" enabled. Check the Experts tab for errors.',
    canExecute: false,
  },
  tunnel_ok_unpaired: {
    label: 'Bridge reachable — not paired',
    headerLabel: 'Setup needed',
    fixHint:
      'In Setup → Connect bridge, generate a pairing code and run npm run bridge:pair CODE https://YOUR-TUNNEL on your home PC.',
    canExecute: false,
  },
  no_account: {
    label: 'No MT5 account selected',
    headerLabel: 'Setup needed',
    fixHint:
      'Click the profile icon (top right) and activate your MT5 login, or open Setup → Accounts.',
    canExecute: false,
  },
  balance_pending: {
    label: 'Account balance not loaded',
    headerLabel: 'Setup needed',
    fixHint:
      'Bridge is up but MT5 account data is missing. Confirm the EA is running and refresh the dashboard.',
    canExecute: false,
  },
};

export function deriveBridgeStatus(inputs: BridgeStatusInputs): BridgeStatusSnapshot {
  const {
    http,
    presenceState,
    presenceLoading,
    activeAccountLogin,
    balanceLoaded,
    balance,
    bridgeUrl,
  } = inputs;

  if (presenceLoading && !http.reachable) {
    return {
      state: 'checking',
      label: 'Checking bridge…',
      headerLabel: 'Checking…',
      fixHint: '',
      canExecute: false,
      httpReachable: http.reachable,
      mt5Connected: http.mt5Connected,
      presenceState,
      activeAccountLogin,
      balanceLoaded,
      balance,
      bridgeUrl,
    };
  }

  let state: Exclude<BridgeConnectivityState, 'checking'>;

  if (
    typeof window !== 'undefined' &&
    (!hasConfiguredBridgeUrl() || isUnreachableLocalBridgeOnRemoteDashboard())
  ) {
    state = 'tunnel_down';
  } else if (!http.reachable) {
    state = 'tunnel_down';
  } else if (presenceState === 'unknown') {
    state = 'unknown';
  } else if (!http.mt5Connected) {
    state = 'ea_disconnected';
  } else if (presenceState === 'not_paired' || presenceState === 'offline') {
    state = 'tunnel_ok_unpaired';
  } else if (presenceState === 'online_ea_disconnected') {
    state = 'ea_disconnected';
  } else if (!activeAccountLogin) {
    state = 'no_account';
  } else if (!balanceLoaded) {
    state = 'balance_pending';
  } else {
    state = 'ready';
  }

  const meta = STATE_META[state];
  return {
    state,
    label: meta.label,
    headerLabel: meta.headerLabel,
    fixHint: meta.fixHint,
    canExecute: meta.canExecute,
    httpReachable: http.reachable,
    mt5Connected: http.mt5Connected,
    presenceState,
    activeAccountLogin,
    balanceLoaded,
    balance,
    bridgeUrl,
  };
}

export async function fetchHttpBridgeHealth(): Promise<HttpBridgeHealth> {
  if (
    typeof window !== 'undefined' &&
    (!hasConfiguredBridgeUrl() || isUnreachableLocalBridgeOnRemoteDashboard())
  ) {
    return { reachable: false, mt5Connected: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(getBridgeUrl('/health?mt5=1'), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      cache: 'no-cache',
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { reachable: false, mt5Connected: false };
    }

    const data = await response.json();
    const running = data?.status === 'running';
    return {
      reachable: running,
      mt5Connected: Boolean(data?.mt5_connected),
      status: data?.status,
    };
  } catch {
    return { reachable: false, mt5Connected: false };
  }
}

export interface FetchBridgeStatusOptions {
  presenceState?: BridgePresenceState;
  presenceLoading?: boolean;
  bridgeUrl?: string | null;
}

/** Non-React bridge status check (execute path, Setup test button). */
export async function fetchBridgeStatusSnapshot(
  options: FetchBridgeStatusOptions = {}
): Promise<BridgeStatusSnapshot> {
  const presenceState = options.presenceState ?? cachedPresenceState;
  const presenceLoading = options.presenceLoading ?? cachedPresenceLoading;
  const bridgeUrl = options.bridgeUrl ?? cachedBridgeUrl;

  const [http, sync] = await Promise.all([
    fetchHttpBridgeHealth(),
    syncAccountFromBridge().catch(() => ({
      bridgeConnected: false,
      account: null,
      autoSelected: false,
      created: false,
    })),
  ]);

  let balanceLoaded = false;
  let balance: number | null = null;

  if (sync.bridgeConnected) {
    try {
      const { httpBridge } = await import('@/lib/http-bridge-connector');
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
      // balance stays unloaded
    }
  }

  return deriveBridgeStatus({
    http,
    presenceState,
    presenceLoading,
    activeAccountLogin: getActiveAccountLogin(),
    balanceLoaded,
    balance,
    bridgeUrl,
  });
}
