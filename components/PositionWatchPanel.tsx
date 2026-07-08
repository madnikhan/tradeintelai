'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PositionWatchService,
  type WatchedPosition,
  type PositionWatchEvent,
} from '@/lib/position-watch-service';
import {
  DEFAULT_POSITION_WATCH_CONFIG,
  type PositionWatchConfig,
} from '@/config/trading-rules';
import {
  getBridgeWatchStatus,
  updateBridgeWatchConfig,
  isBridgeWatchdogEnabled,
} from '@/lib/bridge-watch-client';

interface BridgeWatchRow {
  ticket: string;
  symbol: string;
  direction: string;
  status: string;
  lastProfit: number;
  lastDistanceToTpPercent: number;
  openedAt?: string;
}

export function PositionWatchPanel() {
  const [watches, setWatches] = useState<WatchedPosition[]>([]);
  const [bridgeWatches, setBridgeWatches] = useState<BridgeWatchRow[]>([]);
  const [serverSide, setServerSide] = useState(false);
  const [config, setConfig] = useState<PositionWatchConfig>(PositionWatchService.getConfig());
  const [banner, setBanner] = useState<string | null>(null);

  const refreshBridge = useCallback(async () => {
    if (!isBridgeWatchdogEnabled()) return;
    const status = await getBridgeWatchStatus();
    if (status) {
      setServerSide(true);
      setBridgeWatches((status.watches as BridgeWatchRow[]) ?? []);
      const cfg = status.config as Record<string, unknown>;
      if (cfg && typeof cfg === 'object') {
        setConfig((prev) => ({
          ...prev,
          enabled: cfg.enabled !== false,
          smartExitEnabled: cfg.smartExitEnabled !== false,
          maxHoldMs: Number(cfg.maxHoldMs) || prev.maxHoldMs,
        }));
      }
    }
  }, []);

  const refresh = useCallback(() => {
    setWatches(PositionWatchService.getWatches());
    void refreshBridge();
  }, [refreshBridge]);

  useEffect(() => {
    refresh();
    const unsub = PositionWatchService.subscribe((event: PositionWatchEvent) => {
      refresh();
      if (event.type === 'closed' && event.message) {
        const p = event.position;
        setBanner(`Exited ${p.symbol} — ${event.message}`);
        setTimeout(() => setBanner(null), 12000);
      }
    });
    if (!isBridgeWatchdogEnabled()) {
      PositionWatchService.startPolling();
    }
    const interval = setInterval(() => void refreshBridge(), 10000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refresh, refreshBridge]);

  const updateConfig = (partial: Partial<PositionWatchConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    PositionWatchService.configure(next);
    void updateBridgeWatchConfig({
      enabled: next.enabled,
      smartExitEnabled: next.smartExitEnabled,
      maxHoldMs: next.maxHoldMs,
      stallNearTpMs: next.stallNearTpMs,
      givebackFraction: next.givebackFraction,
      lossExtension: next.lossExtension,
      signalRecheckEnabled: next.signalRecheckEnabled,
    });
  };

  const formatDuration = (openedAt: Date | string) => {
    const d = openedAt instanceof Date ? openedAt : new Date(openedAt);
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const displayWatches =
    serverSide && bridgeWatches.length > 0
      ? bridgeWatches
      : watches.map((w) => ({
          ticket: String(w.ticket ?? ''),
          symbol: w.symbol,
          direction: w.direction,
          status: w.status,
          lastProfit: w.lastProfit,
          lastDistanceToTpPercent: w.lastDistanceToTpPercent,
          openedAt: w.openedAt.toISOString(),
        }));

  return (
    <div className="card border-cyan-500/20 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
          <span>👁</span> Open Trade Monitor
        </h3>
        <span className="text-xs text-gray-500">
          {serverSide ? 'Server-side on home bridge' : 'Browser fallback (dashboard open)'}
        </span>
      </div>

      {banner && (
        <div className="mb-3 p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm">
          {banner}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            className="rounded"
          />
          <span className="text-gray-400">Enable monitoring</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.smartExitEnabled}
            onChange={(e) => updateConfig({ smartExitEnabled: e.target.checked })}
            className="rounded"
          />
          <span className="text-gray-400">Smart exit</span>
        </label>
      </div>

      {displayWatches.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">
          No watched positions. Trades register on the home bridge after execution.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-[#1e2738]">
                <th className="py-2 pr-2">Pair</th>
                <th className="py-2 pr-2">Ticket</th>
                <th className="py-2 pr-2">Open</th>
                <th className="py-2 pr-2">→ TP</th>
                <th className="py-2 pr-2">P/L</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayWatches.map((w) => (
                <tr key={w.ticket || w.symbol} className="border-b border-[#1e2738]/50">
                  <td className="py-2 pr-2 font-mono">
                    {w.direction} {w.symbol}
                  </td>
                  <td className="py-2 pr-2 text-gray-400">{w.ticket || '—'}</td>
                  <td className="py-2 pr-2">
                    {w.openedAt ? formatDuration(w.openedAt) : '—'}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={
                        w.lastDistanceToTpPercent >= 80
                          ? 'text-emerald-400'
                          : 'text-gray-300'
                      }
                    >
                      {w.lastDistanceToTpPercent?.toFixed?.(0) ?? '—'}%
                    </span>
                  </td>
                  <td
                    className={`py-2 pr-2 font-mono ${
                      w.lastProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {w.lastProfit >= 0 ? '+' : ''}
                    {(w.lastProfit ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 text-xs text-cyan-400/80">{w.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-3">
        Monitoring runs on your home laptop bridge — works even when this browser tab is closed.
      </p>
    </div>
  );
}
