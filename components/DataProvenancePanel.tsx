'use client';

import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';
import { AccordionItem } from '@/components/ui/Accordion';

interface DataProvenancePanelProps {
  analysis?: ExtendedMarketAnalysis | null;
  balance?: number | null;
  balanceLoaded?: boolean;
  compact?: boolean;
}

function formatOhlcSource(analysis?: ExtendedMarketAnalysis | null): string {
  const dh = analysis?.dataHealth;
  if (!dh) return 'Unknown';
  const bars = dh.ohlcBars ?? 0;
  const src = dh.ohlcSource === 'mt5' ? 'MT5 bridge (live)' : 'TwelveData API';
  return `${src} — ${bars} H1 bars`;
}

function formatTechnical(analysis?: ExtendedMarketAnalysis | null): string {
  const dh = analysis?.dataHealth;
  if (!dh) return 'Unknown';
  if (dh.technicalUsedFallback) {
    return 'Neutral fallback (50) — insufficient OHLC bars';
  }
  return `Computed from OHLC — score ${analysis?.technicalScore ?? 'n/a'}`;
}

function formatStructure(analysis?: ExtendedMarketAnalysis | null): string {
  const dh = analysis?.dataHealth;
  if (!dh) return 'Unknown';
  if (dh.usedChartVision) return 'Chart vision (API credits)';
  if (dh.usedOhlcStructure) return 'OHLC rule-based structure (no vision credits)';
  return 'Indicators only (trade tab default)';
}

function formatFundamentals(): string {
  return 'Trading Economics scrape for non-USD; USD leg uses stubbed Alpha Vantage → neutral 50 until wired';
}

function formatSentiment(analysis?: ExtendedMarketAnalysis | null): string {
  const score = analysis?.sentimentScore;
  if (score == null) return 'Unknown';
  if (score === 50) return 'RSS news — neutral 50 (no articles or fallback)';
  return `RSS news — sentiment score ${score}`;
}

export function DataProvenancePanel({
  analysis,
  balance,
  balanceLoaded,
  compact,
}: DataProvenancePanelProps) {
  const rows = [
    { label: 'OHLC', value: formatOhlcSource(analysis) },
    { label: 'Technical', value: formatTechnical(analysis) },
    { label: 'Fundamentals', value: formatFundamentals() },
    { label: 'Sentiment', value: formatSentiment(analysis) },
    { label: 'Gate 1 structure', value: formatStructure(analysis) },
    {
      label: 'MT5 balance',
      value: balanceLoaded && balance != null ? `Live — ${balance}` : 'Not loaded from bridge',
    },
  ];

  const body = (
    <dl className="space-y-2 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-gray-500">{row.label}</dt>
          <dd className="text-gray-300">{row.value}</dd>
        </div>
      ))}
      {analysis?.dataHealth?.analysisMode && (
        <p className="text-[10px] text-gray-500 pt-1">
          Analysis mode: {analysis.dataHealth.analysisMode}
          {analysis.dataHealth.analysisMode === 'scan' && ' (relaxed Gate 1 thresholds)'}
        </p>
      )}
    </dl>
  );

  if (compact) {
    return body;
  }

  return (
    <AccordionItem title="Where this data came from" defaultOpen={false}>
      <div className="pt-2">{body}</div>
    </AccordionItem>
  );
}
