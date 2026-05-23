'use client';

import { useState } from 'react';
import { openBillingPortal } from '@/hooks/useSubscription';

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const url = await openBillingPortal();
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white text-sm"
    >
      {loading ? 'Opening…' : 'Manage billing'}
    </button>
  );
}
