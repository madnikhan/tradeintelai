/**
 * Client-side: notify server after trade execution.
 */

import { getAuthInstance } from '@/lib/firebase/config';
import type { TradeExecutedPayload } from '@/lib/notifications/types';

export async function notifyTradeExecutedClient(
  payload: TradeExecutedPayload
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const user = getAuthInstance().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/notifications/trade-executed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[notify] trade-executed failed:', e);
  }
}
