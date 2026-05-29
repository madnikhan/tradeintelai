'use client';

import { useEffect, useRef } from 'react';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { TRADING_RULES } from '@/config/trading-rules';
import { getAuthInstance } from '@/lib/firebase/config';

const ALERT_MODE_KEY = 'alert_mode_enabled';
const LAST_ALERTS_KEY = 'alert_mode_last_sent';
const INTERVAL_MS = 5 * 60 * 1000;

function getLastSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LAST_ALERTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLastSent(key: string) {
  const map = getLastSent();
  map[key] = Date.now();
  localStorage.setItem(LAST_ALERTS_KEY, JSON.stringify(map));
}

async function notifyExecutableSignal(
  symbol: string,
  recommendation: string,
  score: number
): Promise<void> {
  const user = getAuthInstance().currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  await fetch('/api/notifications/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'executable_signal',
      payload: { symbol, recommendation, score, confidence: score },
    }),
  });
}

async function runAlertScan(): Promise<void> {
  const pairs = TRADING_RULES.TRADING_PAIRS.slice(0, 6);
  for (const pair of pairs) {
    const sym = pair.replace('/', '');
    try {
      const analysis = await gatedEngineAdapter.analyzeMarket(sym, []);
      if (!analysis.gateStatus?.executionPermitted) continue;
      const dedupeKey = `${sym}_${analysis.recommendation}`;
      const last = getLastSent();
      if (last[dedupeKey] && Date.now() - last[dedupeKey] < INTERVAL_MS) continue;

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('TradeIntel — Executable Signal', {
          body: `${pair} ${analysis.recommendation} (${Math.round(analysis.overallScore)})`,
          icon: '/icon-192x192.png',
        });
      }

      await notifyExecutableSignal(pair, analysis.recommendation, analysis.overallScore);
      setLastSent(dedupeKey);
      await new Promise((r) => setTimeout(r, 2000));
    } catch {
      /* skip pair */
    }
  }
}

export function useAlertModeService() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const enabled = localStorage.getItem(ALERT_MODE_KEY) === 'true';
    if (!enabled) return;

    void runAlertScan();
    timerRef.current = setInterval(() => void runAlertScan(), INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}

export function isAlertModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ALERT_MODE_KEY) === 'true';
}

export function setAlertModeEnabled(enabled: boolean): void {
  localStorage.setItem(ALERT_MODE_KEY, enabled ? 'true' : 'false');
}
