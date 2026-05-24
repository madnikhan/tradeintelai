'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAuthInstance } from '@/lib/firebase/config';
import { useAuth } from '@/components/AuthProvider';
import type { SubscriptionStatus } from '@/lib/stripe/types';

export interface SubscriptionState {
  status: SubscriptionStatus;
  active: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function fetchWithAuth(path: string, options?: RequestInit) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
    if (user.email) headers['x-user-email'] = user.email;
  }
  return fetch(path, { ...options, headers });
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('none');
  const [active, setActive] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setActive(false);
      setStatus('none');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/stripe/subscription-status');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load subscription');
      }
      setStatus(data.status || 'none');
      setActive(!!data.active || !!data.bypassed);
      setCurrentPeriodEnd(data.currentPeriodEnd ?? null);
      setCancelAtPeriodEnd(!!data.cancelAtPeriodEnd);
      if (data.warning) {
        console.warn(data.warning);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Subscription check failed');
      if (process.env.NODE_ENV === 'development') {
        setActive(true);
        setStatus('active');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    active,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    loading,
    error,
    refresh,
  };
}

export async function startCheckout(): Promise<string | null> {
  const res = await fetchWithAuth('/api/stripe/create-checkout-session', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Checkout failed');
  if (data.bypassed && data.url) return data.url;
  return data.url ?? null;
}

export async function verifyCheckoutSession(sessionId: string): Promise<void> {
  const res = await fetchWithAuth('/api/stripe/verify-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not activate subscription');
}

export async function syncSubscriptionFromStripeApi(): Promise<{ active: boolean }> {
  const res = await fetchWithAuth('/api/stripe/sync-subscription', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not sync subscription');
  return { active: !!data.active };
}

export async function openBillingPortal(): Promise<string | null> {
  const res = await fetchWithAuth('/api/stripe/create-portal-session', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Billing portal failed');
  return data.url ?? null;
}
