'use client';

import { useEffect, useState } from 'react';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { TRADING_RULES } from '@/config/trading-rules';

interface ScanAlertPreview {
  symbol: string;
  recommendation: string;
  score: number;
  executionPermitted: boolean;
}

const SCAN_CACHE_KEY = 'opportunityScanner_lastResults';

export function MobileAlertsPanel() {
  const [alerts, setAlerts] = useState<ScanAlertPreview[]>([]);

  useEffect(() => {
    const load = () => {
      const items: ScanAlertPreview[] = [];
      try {
        const raw = localStorage.getItem(SCAN_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ScanAlertPreview[];
          if (Array.isArray(parsed)) {
            items.push(...parsed.filter((a) => a.executionPermitted).slice(0, 5));
          }
        }
      } catch {
        /* ignore */
      }

      if (items.length === 0) {
        for (const pair of TRADING_RULES.TRADING_PAIRS.slice(0, 8)) {
          const sym = pair.replace('/', '');
          const cached = gatedEngineAdapter.getCachedAnalysis(sym);
          if (cached?.gateStatus?.executionPermitted) {
            items.push({
              symbol: pair,
              recommendation: cached.recommendation,
              score: cached.overallScore,
              executionPermitted: true,
            });
          }
        }
      }
      setAlerts(items.slice(0, 5));
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Executable signals from your last Scan (read-only preview). Enable Alert Mode below to get push/Telegram
        when new signals appear while this dashboard stays open.
      </p>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500">No executable signals cached — run Scan first.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.symbol}
              className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg text-sm"
            >
              <span className="text-white font-medium">{a.symbol}</span>
              <span className="text-cyan-400">{a.recommendation}</span>
              <span className="text-gray-400">{Math.round(a.score)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Persist scan results for alerts preview (call from OpportunityScanner). */
export function saveScanResultsForAlerts(
  results: Array<{
    symbol: string;
    recommendation: string;
    score: number;
    executionPermitted: boolean;
  }>
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(results.slice(0, 20)));
  } catch {
    /* ignore */
  }
}
