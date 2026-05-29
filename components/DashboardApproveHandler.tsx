'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';
import { ApproveExecuteSheet } from '@/components/ApproveExecuteSheet';
import { useAlertModeService } from '@/lib/alert-mode-service';
import { useTradingContext } from '@/context/TradingContext';

interface DashboardApproveHandlerProps {
  onTabChange: (tab: 'trade' | 'scan') => void;
}

export function DashboardApproveHandler({ onTabChange }: DashboardApproveHandlerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSymbol, setAiAnalysis } = useTradingContext();
  const [approveSheet, setApproveSheet] = useState<{
    symbol: string;
    displaySymbol: string;
    analysis: ExtendedMarketAnalysis;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useAlertModeService();

  useEffect(() => {
    const approve = searchParams.get('approve');
    const symbolParam = searchParams.get('symbol');
    const tab = searchParams.get('tab');
    if (tab === 'scan' || tab === 'trade') {
      onTabChange(tab);
    }
    if (!symbolParam || approve !== '1') return;

    const sym = symbolParam.replace('/', '');
    const displaySymbol = symbolParam.includes('/')
      ? symbolParam
      : `${sym.slice(0, 3)}/${sym.slice(3)}`;
    setSymbol(sym);

    const openSheet = (analysis: ExtendedMarketAnalysis) => {
      setAiAnalysis(analysis);
      setApproveSheet({ symbol: sym, displaySymbol, analysis });
    };

    const cached = gatedEngineAdapter.getCachedAnalysis(sym);
    if (cached?.gateStatus?.executionPermitted) {
      openSheet(cached);
    } else {
      void gatedEngineAdapter.analyzeMarket(sym, []).then((analysis) => {
        if (analysis.gateStatus?.executionPermitted) {
          openSheet(analysis);
        } else {
          setToast('No executable signal for this pair — check Scan or Trade tab.');
        }
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('approve');
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
  }, [searchParams, onTabChange, router, setSymbol, setAiAnalysis]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {approveSheet ? (
        <ApproveExecuteSheet
          symbol={approveSheet.displaySymbol}
          analysis={approveSheet.analysis}
          onClose={() => setApproveSheet(null)}
          onDone={(success, text) => setToast(success ? text : `Failed: ${text}`)}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-[#141c2b] border border-cyan-500/40 rounded-lg text-sm text-white shadow-lg max-w-sm text-center">
          {toast}
        </div>
      ) : null}
    </>
  );
}
