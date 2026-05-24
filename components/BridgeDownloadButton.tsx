'use client';

import { useState } from 'react';
import Link from 'next/link';
import { downloadBridgeZip } from '@/lib/bridge-download';

interface BridgeDownloadButtonProps {
  className?: string;
  label?: string;
}

export function BridgeDownloadButton({
  className = 'px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-sm font-medium disabled:opacity-50',
  label = 'Download MT5 Bridge (.zip)',
}: BridgeDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadBridgeZip();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button type="button" onClick={handleDownload} disabled={downloading} className={className}>
      {downloading ? 'Preparing download…' : label}
    </button>
  );
}
