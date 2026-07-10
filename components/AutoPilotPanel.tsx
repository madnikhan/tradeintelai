'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAuthInstance } from '@/lib/firebase/config';
import type { AutoPilotConfig, AutoPilotDaemonStatus } from '@/lib/auto-pilot/types';
import { DEFAULT_AUTO_PILOT_CONFIG } from '@/lib/auto-pilot/types';
import { AUTO_PILOT_PRESETS } from '@/lib/auto-pilot/presets';
import { DemoSuccessGoals } from '@/components/DemoSuccessGoals';
import type { Trade } from '@/types/trading';
import { TRADING_RULES } from '@/config/trading-rules';

interface AutoPilotPanelProps {
  trades: Trade[];
  account: Account;
}

export function AutoPilotPanel({ trades, account }: AutoPilotPanelProps) {
  const [config, setConfig] = useState<AutoPilotConfig>(DEFAULT_AUTO_PILOT_CONFIG);
  const [status, setStatus] = useState<AutoPilotDaemonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error('Sign in required');
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [cfgRes, stRes] = await Promise.all([
        fetch('/api/auto-pilot/config', { headers }),
        fetch('/api/auto-pilot/status', { headers }),
      ]);
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setConfig(data.config ?? DEFAULT_AUTO_PILOT_CONFIG);
      }
      if (stRes.ok) {
        const data = await stRes.json();
        setStatus(data.status ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Auto Pilot');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const saveConfig = async (updates: Partial<AutoPilotConfig>) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = { ...config, ...updates };
      const headers = await authHeaders();
      const res = await fetch('/api/auto-pilot/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      const data = await res.json();
      setConfig(data.config);
      setMessage('Settings saved. Restart Auto Pilot in Bridge Desktop to apply.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const preset = AUTO_PILOT_PRESETS[config.preset];

  if (loading && !status) {
    return (
      <div className="p-4 text-secondary text-sm">Loading Auto Pilot…</div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span>🤖</span> Auto Pilot
        </h2>
        <p className="text-sm text-secondary mt-1">
          Sniper-like full-auto MT5 forex. Runs 24/7 via Bridge Desktop daemon on Windows VPS (recommended).
          Copilot manual mode remains on Trade / Scan tabs.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
        <strong>VPS required for production.</strong> Mac + Wine supports Copilot only; Auto Pilot needs
        Windows with MT5 running and Bridge Desktop → Start Auto Pilot.
      </div>

      {status && (
        <div className="rounded-lg border border-[#1e2738] bg-[#0d1321] p-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-3">
            <span className={status.running ? 'text-emerald-400' : 'text-secondary'}>
              {status.running ? '● Daemon running' : '○ Daemon stopped'}
            </span>
            {status.dryRun && <span className="text-amber-400">Dry run</span>}
            <span className="text-secondary">Platform: {status.platform}</span>
            <span className={status.licenseValid ? 'text-emerald-400' : 'text-red-400'}>
              License: {status.licenseValid ? 'OK' : 'Invalid'}
            </span>
          </div>
          {status.blockedReason && (
            <p className="text-amber-300">Blocked: {status.blockedReason}</p>
          )}
          {status.lastError && (
            <p className="text-red-300">Last error: {status.lastError}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-secondary">
            <span>Trades today: {status.tradesToday ?? 0}</span>
            <span>Open: {status.openPositions ?? 0}</span>
            <span>Daily P/L: ${(status.dailyPnlUsd ?? 0).toFixed(2)}</span>
            <span>Last scan: {status.lastScanAt ? new Date(status.lastScanAt).toLocaleTimeString() : '—'}</span>
          </div>
        </div>
      )}

      {!status?.running && (
        <p className="text-sm text-secondary">
          Open <strong>TradeIntel Bridge</strong> desktop app → Start Auto Pilot. Config below syncs to daemon via{' '}
          <code className="text-cyan-400">mt5-bridge/data/auto-pilot-config.json</code> (export from Save).
        </p>
      )}

      <DemoSuccessGoals
        trades={trades}
        initialBalance={TRADING_RULES.DEMO_BALANCE > 0 ? TRADING_RULES.DEMO_BALANCE : 10000}
        currentBalance={account.balance}
      />

      <div className="space-y-4 rounded-lg border border-[#1e2738] bg-[#0d1321] p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => saveConfig({ enabled: e.target.checked })}
            disabled={saving}
            className="w-4 h-4"
          />
          <span className="text-white font-medium">Enable Auto Pilot (config flag)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.dryRun}
            onChange={(e) => saveConfig({ dryRun: e.target.checked })}
            disabled={saving}
            className="w-4 h-4"
          />
          <span className="text-white">Dry run (log trades, do not send orders)</span>
        </label>

        <div>
          <label className="block text-sm text-secondary mb-1">Strategy preset</label>
          <select
            value={config.preset}
            onChange={(e) =>
              saveConfig({
                preset: e.target.value as AutoPilotConfig['preset'],
                minConfidence: AUTO_PILOT_PRESETS[e.target.value as AutoPilotConfig['preset']].minConfidence,
              })
            }
            disabled={saving}
            className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white"
          >
            {Object.values(AUTO_PILOT_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-secondary mt-1">
            Scan every {preset.scanIntervalSec}s · min confidence {preset.minConfidence}% · max{' '}
            {preset.maxOpenTrades} open
          </p>
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1">Pairs (comma-separated)</label>
          <input
            type="text"
            defaultValue={config.pairs.join(', ')}
            onBlur={(e) =>
              saveConfig({
                pairs: e.target.value.split(',').map((s) => s.trim().replace('/', '')).filter(Boolean),
              })
            }
            className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-secondary mb-1">Risk % per trade</label>
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={config.riskPercentPerTrade}
              onChange={(e) => saveConfig({ riskPercentPerTrade: Number(e.target.value) })}
              className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">Min confidence %</label>
            <input
              type="number"
              min={50}
              max={95}
              value={config.minConfidence}
              onChange={(e) => saveConfig({ minConfidence: Number(e.target.value) })}
              className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        <fieldset className="space-y-2 border-t border-[#1e2738] pt-4">
          <legend className="text-sm font-medium text-white">Kill switches</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-secondary mb-1">Max daily loss ($)</label>
              <input
                type="number"
                min={10}
                value={config.killSwitches.maxDailyLossUsd}
                onChange={(e) =>
                  saveConfig({
                    killSwitches: {
                      ...config.killSwitches,
                      maxDailyLossUsd: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">Max open trades</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.killSwitches.maxOpenTrades}
                onChange={(e) =>
                  saveConfig({
                    killSwitches: {
                      ...config.killSwitches,
                      maxOpenTrades: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-[#1a2332] border border-[#1e2738] rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.killSwitches.demoOnlyUntilReady}
              onChange={(e) =>
                saveConfig({
                  killSwitches: {
                    ...config.killSwitches,
                    demoOnlyUntilReady: e.target.checked,
                  },
                })
              }
            />
            Demo-only until demo success goals met
          </label>
        </fieldset>

        <button
          type="button"
          onClick={() => saveConfig({})}
          disabled={saving}
          className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & sync config'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {message && <p className="text-emerald-400 text-sm">{message}</p>}
    </div>
  );
}
