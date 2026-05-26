'use client';

import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';

interface SignalCardProps {
  analysis: ExtendedMarketAnalysis | null;
  symbol: string;
  isAnalyzing?: boolean;
  onAnalyze?: () => void;
}

export function SignalCard({ analysis, symbol, isAnalyzing, onAnalyze }: SignalCardProps) {
  if (!analysis || analysis.symbol?.replace(/\//g, '') !== symbol.replace(/\//g, '')) {
    return (
      <div className="card animate-fade-in">
        <p className="label mb-1">Signal for {symbol}</p>
        <p className="text-secondary text-sm mb-4">Run analysis to get a trade recommendation.</p>
        {onAnalyze && (
          <button type="button" onClick={onAnalyze} disabled={isAnalyzing} className="btn btn-primary min-h-[44px] w-full sm:w-auto">
            {isAnalyzing ? 'Analyzing…' : 'Analyze market'}
          </button>
        )}
      </div>
    );
  }

  const rec = analysis.recommendation || 'HOLD';
  const permitted = analysis.gateStatus?.executionPermitted ?? false;
  const blockedBy = analysis.gateStatus?.executionBlockedBy ?? [];
  const isBuy = rec.includes('BUY');
  const isSell = rec.includes('SELL');

  const borderClass = isBuy
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : isSell
    ? 'border-rose-500/40 bg-rose-500/5'
    : 'border-yellow-500/40 bg-yellow-500/5';

  return (
    <div className={`card animate-fade-in border-2 ${borderClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="label mb-1">Signal · {symbol}</p>
          <p className={`text-3xl sm:text-4xl font-bold ${isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-yellow-400'}`}>
            {rec}
          </p>
          <p className="hint mt-2">
            {permitted
              ? 'Execution allowed — all gates passed'
              : 'Execution blocked — see Gate 4 below'}
          </p>
          {!permitted && blockedBy.length > 0 && (
            <ul className="mt-2 text-xs text-amber-400/90 space-y-1 list-disc list-inside max-w-lg">
              {blockedBy.slice(0, 3).map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-[140px]">
          <div className="flex justify-between text-sm">
            <span className="text-secondary">{permitted ? 'Alignment' : 'Analysis alignment'}</span>
            <span className="value">{analysis.confidence ?? 0}%</span>
          </div>
          <div className="h-2 bg-[#1e2738] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              style={{ width: `${Math.min(100, analysis.confidence ?? 0)}%` }}
            />
          </div>
          {analysis.gateStatus && (
            <span
              className={`badge text-xs w-fit ${permitted ? 'badge-success' : 'badge-warning'}`}
            >
              {permitted ? 'Executable: Yes' : 'Executable: No'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
