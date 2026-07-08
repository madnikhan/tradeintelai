'use client';

import { useBridgePresence } from '@/context/BridgeContext';
import Link from 'next/link';

interface BridgePresenceBannerProps {
  compact?: boolean;
}

export function BridgePresenceBanner({ compact }: BridgePresenceBannerProps) {
  const { state, loading, bridgeUrl } = useBridgePresence();

  if (loading) return null;
  if (state === 'online') return null;

  const messages: Record<string, string> = {
    not_paired: 'Home bridge not paired — pair your laptop in Settings to trade remotely.',
    offline: 'Home bridge offline — start TradeIntel Bridge + MT5 on your home PC.',
    online_ea_disconnected: 'Home bridge online but MT5 EA disconnected — attach EA in MT5.',
    unknown: 'Bridge status unknown — check Settings.',
  };

  const text = messages[state] ?? messages.unknown;

  if (compact) {
    return (
      <p className="text-xs text-amber-400/90">{text}</p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-medium">Home bridge: {state.replace(/_/g, ' ')}</p>
      <p className="text-xs mt-1 text-amber-200/80">{text}</p>
      {bridgeUrl && state === 'offline' && (
        <p className="text-[10px] mt-1 text-gray-500 truncate">Last URL: {bridgeUrl}</p>
      )}
      <Link href="/dashboard?tab=settings" className="text-xs text-cyan-400 hover:underline mt-2 inline-block">
        Open Settings → Pair home bridge
      </Link>
    </div>
  );
}
