'use client';

import { useBridgeStatus } from '@/hooks/useBridgeStatus';

/**
 * @deprecated Use BridgeStatusBar — kept for execute tooltip export compatibility.
 */
export function ActiveAccountBanner() {
  return null;
}

export function useActiveMt5AccountLogin(): number | null {
  return useBridgeStatus().activeAccountLogin;
}

export const EXECUTE_ACCOUNT_TOOLTIP =
  'Select MT5 account — click profile icon (top right) or open Setup';
