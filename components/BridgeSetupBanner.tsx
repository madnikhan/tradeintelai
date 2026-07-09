'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBridgeUrl } from '@/config/bridge-config';
import { BridgeDownloadButton } from '@/components/BridgeDownloadButton';
import { BridgeDesktopDownloadButton } from '@/components/BridgeDesktopDownloadButton';
import { useBridgeStatus } from '@/hooks/useBridgeStatus';

interface BridgeSetupBannerProps {
  onDismiss?: () => void;
}

/** Large setup CTA — only when tunnel is completely unreachable. */
export function BridgeSetupBanner({ onDismiss }: BridgeSetupBannerProps) {
  const { state, loading } = useBridgeStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (state !== 'tunnel_down') {
      setDismissed(false);
    }
  }, [state]);

  if (dismissed || loading || state !== 'tunnel_down') return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-amber-200">Set up your MT5 bridge</h2>
          <p className="text-sm text-gray-300">
            The dashboard cannot reach your bridge at{' '}
            <code className="text-xs bg-[#0d1321] px-1 rounded">{getBridgeUrl('/health')}</code>.
            Start TradeIntel Bridge on your home PC and connect via Cloudflare tunnel.
          </p>
          <p className="text-xs text-gray-400">
            Mobile users: run the bridge on a Windows VPS or always-on PC, then open this dashboard
            in your phone browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <BridgeDesktopDownloadButton />
          <BridgeDownloadButton label="ZIP (advanced)" className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548] text-sm text-gray-200" />
          <Link
            href="/dashboard?tab=settings"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm text-white"
          >
            Open Setup
          </Link>
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548] text-sm text-gray-200"
          >
            Setup guide
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
