'use client';

import { useState } from 'react';
import { getAuthInstance } from '@/lib/firebase/config';
import { getPostDownloadTip, type BridgePlatform } from '@/lib/bridge-install-tips';
import type { MacArch } from '@/lib/bridge-desktop-artifacts';

function detectPlatform(): BridgePlatform {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

function detectMacArch(): MacArch {
  if (typeof navigator === 'undefined') return 'arm64';
  const nav = navigator as Navigator & {
    userAgentData?: { architecture?: string };
  };
  const arch = nav.userAgentData?.architecture;
  if (arch === 'x86') return 'x64';
  if (arch === 'arm') return 'arm64';
  return 'arm64';
}

const LABELS: Record<BridgePlatform, string> = {
  windows: 'Download for Windows (.msi)',
  mac: 'Download for Mac (.dmg)',
  linux: 'Download for Linux (AppImage)',
};

interface BridgeDesktopDownloadButtonProps {
  className?: string;
}

export function BridgeDesktopDownloadButton({
  className = 'px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-sm font-medium disabled:opacity-50',
}: BridgeDesktopDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const platform = detectPlatform();
  const [macArch, setMacArch] = useState<MacArch>(() => detectMacArch());

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams({ platform });
      if (platform === 'mac') params.set('arch', macArch);

      const res = await fetch(`/api/download/bridge-desktop?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Desktop installer not available yet');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `tradeintel-bridge-${platform}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      alert(getPostDownloadTip(platform));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-2">
      {platform === 'mac' && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Mac type:</span>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="mac-arch"
              checked={macArch === 'arm64'}
              onChange={() => setMacArch('arm64')}
            />
            Apple Silicon (M1/M2/M3)
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="mac-arch"
              checked={macArch === 'x64'}
              onChange={() => setMacArch('x64')}
            />
            Intel Mac
          </label>
        </div>
      )}
      <button type="button" onClick={handleDownload} disabled={downloading} className={className}>
        {downloading ? 'Preparing download…' : LABELS[platform]}
      </button>
    </div>
  );
}
