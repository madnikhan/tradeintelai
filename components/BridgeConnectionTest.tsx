'use client';

import { useState } from 'react';
import { getBridgeBaseUrl, hasConfiguredBridgeUrl } from '@/config/bridge-config';
import { fetchBridgeStatusSnapshot, type BridgeStatusSnapshot } from '@/lib/bridge-status';

interface CheckRow {
  name: string;
  ok: boolean;
  detail: string;
}

function buildCheckRows(snapshot: BridgeStatusSnapshot): CheckRow[] {
  return [
    {
      name: 'Tunnel / HTTP',
      ok: snapshot.httpReachable,
      detail: snapshot.httpReachable
        ? 'Bridge health endpoint responded'
        : 'Cannot reach bridge URL — start bridge + tunnel',
    },
    {
      name: 'Firestore pairing',
      ok: snapshot.presenceState === 'online',
      detail:
        snapshot.presenceState === 'online'
          ? 'Home bridge paired and heartbeating'
          : `Status: ${snapshot.presenceState.replace(/_/g, ' ')}`,
    },
    {
      name: 'MT5 EA',
      ok: snapshot.mt5Connected,
      detail: snapshot.mt5Connected
        ? 'EA connected (mt5_connected from health)'
        : 'Attach MT5FileBridgeEA on a chart',
    },
    {
      name: 'Active account',
      ok: snapshot.activeAccountLogin != null,
      detail: snapshot.activeAccountLogin
        ? `Login ${snapshot.activeAccountLogin} selected`
        : 'Select account via profile icon',
    },
    {
      name: 'Live balance',
      ok: snapshot.balanceLoaded,
      detail: snapshot.balanceLoaded
        ? `Balance ${snapshot.balance}`
        : 'Account endpoint did not return balance',
    },
  ];
}

export function BridgeConnectionTest() {
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<BridgeStatusSnapshot | null>(null);
  const [checks, setChecks] = useState<CheckRow[] | null>(null);

  const runTest = async () => {
    setRunning(true);
    try {
      const result = await fetchBridgeStatusSnapshot();
      setSnapshot(result);
      setChecks(buildCheckRows(result));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#1e2738] bg-[#141c2b] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">Connection test</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Validates tunnel, pairing, EA, account, and balance in one click
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm disabled:opacity-50"
        >
          {running ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Dashboard bridge URL:{' '}
        <code className="text-gray-400 break-all">
          {hasConfiguredBridgeUrl() ? getBridgeBaseUrl() : 'not set (using localhost fallback)'}
        </code>
      </p>

      {checks && snapshot && (
        <div className="space-y-2">
          <p
            className={`text-sm font-medium ${
              snapshot.state === 'ready' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {snapshot.label}
            {snapshot.state === 'ready' ? ' — all checks passed' : ''}
          </p>
          {!snapshot.canExecute && snapshot.fixHint && (
            <p className="text-xs text-amber-200/80">{snapshot.fixHint}</p>
          )}
          <ul className="text-xs space-y-1.5">
            {checks.map((c) => (
              <li key={c.name} className="flex gap-2">
                <span className={c.ok ? 'text-emerald-400' : 'text-rose-400'}>
                  {c.ok ? '✓' : '✗'}
                </span>
                <span className="text-gray-400">
                  <span className="text-gray-300">{c.name}</span> — {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
