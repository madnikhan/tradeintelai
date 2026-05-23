'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { getAuthInstance } from '@/lib/firebase/config';

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { active, loading: subLoading, refresh } = useSubscription();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => refresh(), 2000);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!subLoading && !active && user) {
      router.push('/subscribe');
    }
  }, [active, subLoading, user, router]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/download/bridge', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tradeintel-bridge.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const saveBridgeUrl = () => {
    if (bridgeUrl.trim()) {
      localStorage.setItem('bridge_url', bridgeUrl.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (authLoading || subLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-[#0a0e17] text-white">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Welcome to TradeIntel AI</h1>
          <p className="text-gray-400 mt-2">Set up your MT5 bridge to connect your trading account.</p>
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 1 — Download bridge software</h2>
          <p className="text-sm text-gray-400">
            Includes Python bridge, MT5 EA, and setup scripts. Run on the PC where MetaTrader 5 is installed.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 font-medium disabled:opacity-50"
          >
            {downloading ? 'Preparing download…' : 'Download MT5 Bridge (.zip)'}
          </button>
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 2 — Install & run bridge</h2>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Install MT5 and attach MT5FileBridgeEA to a chart</li>
            <li>Run setup_colleague_bridge.py from the zip</li>
            <li>Expose port 8080 with Cloudflare Tunnel or ngrok</li>
          </ol>
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 3 — Connect dashboard</h2>
          <label className="block text-sm text-gray-400">Your bridge tunnel URL</label>
          <input
            type="url"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
            className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={saveBridgeUrl}
              className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548]"
            >
              {saved ? 'Saved ✓' : 'Save bridge URL'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 font-medium"
            >
              Open dashboard →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
