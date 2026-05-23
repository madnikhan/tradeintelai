'use client';

import { useState } from 'react';
import { startCheckout } from '@/hooks/useSubscription';

export function SubscribeButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await startCheckout();
      if (url) window.location.href = url;
      else setError('No checkout URL returned');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className={
          className ||
          'w-full px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold disabled:opacity-50'
        }
      >
        {loading ? 'Redirecting to Stripe…' : 'Subscribe — $50/month'}
      </button>
      {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
