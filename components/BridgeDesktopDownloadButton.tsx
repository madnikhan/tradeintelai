'use client';

import { useState } from 'react';
import { getAuthInstance } from '@/lib/firebase/config';

function detectPlatform(): 'windows' | 'mac' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

const LABELS: Record<string, string> = {
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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/download/bridge-desktop?platform=${platform}`, {
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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button type="button" onClick={handleDownload} disabled={downloading} className={className}>
      {downloading ? 'Preparing download…' : LABELS[platform]}
    </button>
  );
}
