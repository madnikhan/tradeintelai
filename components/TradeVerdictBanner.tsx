'use client';

import { useEffect, useState } from 'react';
import { getSymbolVerdict, type VerdictResult } from '@/lib/trade-verdict-service';
import { TRADING_RULES } from '@/config/trading-rules';

interface TradeVerdictBannerProps {
  symbol: string;
  compact?: boolean;
  className?: string;
}

const VERDICT_STYLES: Record<string, string> = {
  ALLOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  CAUTION: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  BLOCK: 'bg-red-500/15 text-red-400 border-red-500/30',
  INSUFFICIENT_DATA: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const EDGE_LABELS: Record<string, string> = {
  ALLOW: 'Strong',
  CAUTION: 'Weak',
  BLOCK: 'Poor',
  INSUFFICIENT_DATA: 'No data',
};

export function TradeVerdictBanner({
  symbol,
  compact = false,
  className = '',
}: TradeVerdictBannerProps) {
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSymbolVerdict(symbol).then((v) => {
      if (!cancelled) setVerdict(v);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const targetPct = (TRADING_RULES.TARGET_WIN_RATE * 100).toFixed(0);
  const v = verdict?.verdict ?? 'INSUFFICIENT_DATA';
  const style = VERDICT_STYLES[v] ?? VERDICT_STYLES.INSUFFICIENT_DATA;

  if (compact) {
    if (!verdict || v === 'INSUFFICIENT_DATA') {
      return (
        <span className={`text-[10px] text-gray-500 ${className}`}>Edge: —</span>
      );
    }
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border ${style} ${className}`}
        title={verdict.reason}
      >
        Edge: {EDGE_LABELS[v]}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${style} ${className}`}
      role="status"
    >
      <div className="font-medium">
        Historical edge: {EDGE_LABELS[v]}
        {verdict && verdict.sampleSize > 0 && (
          <span className="font-normal opacity-80">
            {' '}
            — {verdict.winRate.toFixed(0)}% WR ({verdict.sampleSize} trades, 30d)
          </span>
        )}
      </div>
      {verdict && verdict.sampleSize > 0 ? (
        <p className="text-xs mt-1 opacity-90">{verdict.reason}</p>
      ) : (
        <p className="text-xs mt-1 opacity-80">
          Execute trades to build per-pair history. Target: {targetPct}% win rate over{' '}
          {TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET}+ closed trades.
        </p>
      )}
      {verdict?.verdict === 'BLOCK' && (
        <p className="text-xs mt-1 font-medium">Gate 4 may block execution on this pair.</p>
      )}
    </div>
  );
}
