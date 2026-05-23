'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { SubscribeButton } from '@/components/SubscribeButton';
import { useSubscription } from '@/hooks/useSubscription';

export default function SubscribePage() {
  const { user, loading: authLoading } = useAuth();
  const { active, loading: subLoading, status } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!subLoading && active) {
      router.push('/dashboard');
    }
  }, [active, subLoading, router]);

  if (authLoading || subLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0a0e17] text-white">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold gradient-text">TradeIntel AI Pro</h1>
          <p className="text-gray-400 mt-2">Full access to AI trading tools + MT5 bridge software</p>
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-4xl font-bold">$50</span>
            <span className="text-gray-400">/ month</span>
          </div>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>✓ AI market analysis (Gemini + OpenAI)</li>
            <li>✓ Gated trading engine & chart vision</li>
            <li>✓ MT5 bridge installer download</li>
            <li>✓ Auto-renews monthly — cancel anytime</li>
          </ul>

          {status === 'past_due' || status === 'unpaid' ? (
            <p className="text-amber-400 text-sm">
              Payment failed or past due. Update your payment method to restore access.
            </p>
          ) : null}

          <SubscribeButton />
        </div>

        <p className="text-center text-xs text-gray-500">
          Secure payment via Stripe. You will be redirected to complete checkout.
        </p>
      </div>
    </main>
  );
}
