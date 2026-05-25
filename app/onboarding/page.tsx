'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useSubscription, verifyCheckoutSession } from '@/hooks/useSubscription';
import { saveUserBridgeSettings } from '@/lib/firebase/user-bridge-settings';
import { markBridgeSetupComplete } from '@/lib/bridge-setup-status';
import { BridgeDownloadButton } from '@/components/BridgeDownloadButton';
import { BridgeDesktopDownloadButton } from '@/components/BridgeDesktopDownloadButton';
import Link from 'next/link';

function OnboardingContent() {
  const { user, loading: authLoading } = useAuth();
  const { active, loading: subLoading, refresh } = useSubscription();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [bridgeUrl, setBridgeUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [activating, setActivating] = useState(!!sessionId);
  const [activateError, setActivateError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !sessionId) return;

    let cancelled = false;

    async function verifyAndRefresh() {
      if (!sessionId) return;
      setActivating(true);
      setActivateError(null);
      try {
        await verifyCheckoutSession(sessionId);
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) {
          setActivateError(e instanceof Error ? e.message : 'Activation failed');
        }
      } finally {
        if (!cancelled) setActivating(false);
      }
    }

    verifyAndRefresh();
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, refresh]);

  useEffect(() => {
    if (sessionId) return;
    const timer = setTimeout(() => refresh(), 2000);
    return () => clearTimeout(timer);
  }, [sessionId, refresh]);

  useEffect(() => {
    if (activating || subLoading || !user || active) return;
    const timer = setTimeout(() => refresh(), 3000);
    return () => clearTimeout(timer);
  }, [activating, subLoading, active, user, refresh]);

  useEffect(() => {
    if (sessionId || activateError) return;
    if (activating || subLoading || !user || active) return;
    const timer = setTimeout(() => router.push('/subscribe'), 4000);
    return () => clearTimeout(timer);
  }, [activating, subLoading, active, user, router, sessionId, activateError]);

  const saveBridgeUrl = async () => {
    const url = bridgeUrl.trim();
    if (!url) return;
    localStorage.setItem('bridge_url', url);
    await saveUserBridgeSettings({
      bridgeUrl: url,
      bridgeMode: 'direct',
      bridgeSetupComplete: true,
    });
    markBridgeSetupComplete();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (authLoading || subLoading || activating) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0e17] text-white gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
        <p className="text-gray-400 text-sm">
          {activating ? 'Activating your subscription…' : 'Loading…'}
        </p>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0e17] text-white gap-4 p-6">
        <p className="text-gray-400">
          {activateError ? 'Subscription activation failed' : 'Checking subscription status…'}
        </p>
        {activateError && (
          <>
            <p className="text-rose-400 text-sm text-center max-w-md">{activateError}</p>
            <button
              type="button"
              onClick={() => router.push('/subscribe')}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-sm font-medium"
            >
              Return to subscribe
            </button>
          </>
        )}
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
          <h2 className="text-lg font-semibold">Step 1 — Download TradeIntel Bridge app</h2>
          <p className="text-sm text-gray-400">
            The desktop app includes Python, secure tunnel, and bridge files — no separate installs.
            Run it on the PC where MetaTrader 5 Desktop is installed (Windows recommended).
          </p>
          <p className="text-xs text-gray-500">
            MT5 mobile app (Android/iPhone) is not supported.{' '}
            <Link href="/docs/client-platforms" className="text-cyan-400 hover:underline">
              Read platform guide
            </Link>
          </p>
          <BridgeDesktopDownloadButton className="px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 font-medium disabled:opacity-50" />
          <details className="text-sm text-gray-400 border border-[#1e2738] rounded-lg p-4 space-y-2">
            <summary className="cursor-pointer text-cyan-400 font-medium">
              Install help — macOS &quot;damaged&quot; or Windows SmartScreen
            </summary>
            <div className="space-y-3 pt-2 text-xs text-gray-400">
              <div>
                <p className="font-semibold text-gray-300 mb-1">macOS</p>
                <p>
                  If macOS says the app is <strong className="text-amber-400">damaged</strong>, the download is fine — the app is unsigned. After installing to Applications, run:
                </p>
                <code className="block mt-1 p-2 bg-[#141c2b] rounded text-[11px] break-all">
                  xattr -dr com.apple.quarantine &quot;/Applications/TradeIntel Bridge.app&quot;
                </code>
                <p className="mt-1">Or right-click the app → <strong>Open</strong> (first time). Current DMG is for <strong>Apple Silicon</strong> (M1/M2/M3).</p>
              </div>
              <div>
                <p className="font-semibold text-gray-300 mb-1">Windows</p>
                <p>
                  SmartScreen may warn the MSI is unrecognized → <strong>More info</strong> → <strong>Run anyway</strong>.
                </p>
              </div>
            </div>
          </details>
          <BridgeDownloadButton label="Download ZIP (advanced — scripts only)" className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548] text-sm" />
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 2 — Set up MT5 Expert Advisor</h2>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Open the TradeIntel Bridge app and click <strong>Copy EA to Experts</strong></li>
            <li>In MT5 MetaEditor, compile MT5FileBridgeEA (F7) and attach to a chart</li>
            <li>Enable <strong>Algo Trading</strong> in MT5</li>
          </ol>
        </div>

        <div className="card border-[#1e2738] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 3 — Connect dashboard</h2>
          <p className="text-sm text-gray-400">
            In the TradeIntel Bridge app, click <strong>Connect dashboard</strong>. Your browser opens
            with the dashboard linked automatically.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 font-medium"
          >
            Open dashboard →
          </button>
          <p className="text-xs text-gray-500 pt-2">
            Advanced (ZIP / manual tunnel): optional manual URL below.
          </p>
          <label className="block text-sm text-gray-400">Manual bridge tunnel URL (optional)</label>
          <input
            type="url"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
            className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveBridgeUrl}
              className="px-4 py-2 rounded-lg bg-[#1e2738] hover:bg-[#2a3548]"
            >
              {saved ? 'Saved ✓' : 'Save bridge URL'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-white">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
        </main>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
