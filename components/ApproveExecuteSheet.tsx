'use client';

import { useState } from 'react';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';
import { executeGatedTrade } from '@/lib/execute-gated-trade';

interface ApproveExecuteSheetProps {
  symbol: string;
  analysis: ExtendedMarketAnalysis;
  onClose: () => void;
  onDone: (success: boolean, message: string) => void;
}

export function ApproveExecuteSheet({
  symbol,
  analysis,
  onClose,
  onDone,
}: ApproveExecuteSheetProps) {
  const [busy, setBusy] = useState(false);

  const handleExecute = async () => {
    setBusy(true);
    const sym = symbol.replace('/', '');
    const result = await executeGatedTrade({ symbol: sym, analysis, source: 'ai' });
    setBusy(false);
    if (result.cancelled) {
      onClose();
      return;
    }
    onDone(result.success, result.success ? 'Trade executed' : result.error || 'Failed');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-[#141c2b] border border-[#1e2738] rounded-xl p-5 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white">Approve & Execute</h3>
        <p className="text-sm text-gray-300">
          {symbol} — <strong className="text-cyan-400">{analysis.recommendation}</strong>
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
          <div>SL: {analysis.suggestedStopLoss}</div>
          <div>TP: {analysis.suggestedTakeProfit}</div>
          <div>Lots: {analysis.suggestedPositionSize}</div>
          <div>Score: {Math.round(analysis.overallScore)}</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => void handleExecute()}
            disabled={busy}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
          >
            {busy ? 'Executing…' : 'Approve & Execute'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
