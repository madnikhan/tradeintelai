'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBridgeUrl } from '@/config/bridge-config';
import { BridgeDownloadButton } from '@/components/BridgeDownloadButton';
import { BridgeDesktopDownloadButton } from '@/components/BridgeDesktopDownloadButton';

interface BridgeSetupBannerProps {
  onDismiss?: () => void;
}

export function BridgeSetupBanner({ onDismiss }: BridgeSetupBannerProps) {
  const [bridgeConnected, setBridgeConnected] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkBridge() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(getBridgeUrl('/health'), {
          signal: controller.signal,
          headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (!res.ok) {
          setBridgeConnected(false);
          return;
        }
        const data = await res.json();
        setBridgeConnected(data?.status === 'running');
      } catch {
        if (!cancelled) setBridgeConnected(false);
      }
    }

    checkBridge();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || bridgeConnected === true) return null;

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
            Download the bridge software and run it on a <strong>Windows PC</strong> with MetaTrader 5
            Desktop installed. The MT5 mobile app (Android/iPhone) cannot run the bridge.
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
            href="/onboarding"
            className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548] text-sm text-gray-200"
          >
            Setup guide
          </Link>
          <Link
            href="/docs/client-platforms"
            className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548] text-sm text-gray-200"
          >
            Platform info
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
