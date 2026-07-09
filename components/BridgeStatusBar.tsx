'use client';

import Link from 'next/link';
import { useBridgeStatus } from '@/hooks/useBridgeStatus';

interface BridgeStatusBarProps {
  compact?: boolean;
}

/**
 * Single connectivity warning — hidden when bridge state is `ready`.
 */
export function BridgeStatusBar({ compact }: BridgeStatusBarProps) {
  const { state, label, fixHint, loading } = useBridgeStatus();

  if (loading || state === 'ready' || state === 'checking') {
    return null;
  }

  if (compact) {
    return (
      <p className="text-xs text-amber-400/90">
        {label} — {fixHint}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-medium">{label}</p>
      <p className="text-xs mt-1 text-amber-200/80">{fixHint}</p>
      <Link
        href="/dashboard?tab=settings"
        className="text-xs text-cyan-400 hover:underline mt-2 inline-block"
      >
        Open Setup → Connect bridge
      </Link>
    </div>
  );
}
