'use client';

import { useCallback, useState } from 'react';
import { SignalCard } from '@/components/trading/SignalCard';
import { AITradingDashboard } from '@/components/AITradingDashboard';
import { TradePanel } from '@/components/TradePanel';
import { SmartScoreCard } from '@/components/SmartScoreCard';
import { RiskMonitor } from '@/components/RiskMonitor';
import { PositionWatchPanel } from '@/components/PositionWatchPanel';
import { useTradingContext } from '@/context/TradingContext';
import { AccordionItem } from '@/components/ui/Accordion';
import type { Account } from '@/types/trading';

interface TradeTabViewProps {
  account: Account;
}

export function TradeTabView({ account }: TradeTabViewProps) {
  const { symbol, aiAnalysis, setAiAnalysis } = useTradingContext();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysisChange = useCallback(
    (analysis: Parameters<typeof setAiAnalysis>[0]) => {
      setAiAnalysis(analysis);
    },
    [setAiAnalysis]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24 lg:pb-6">
      <SignalCard
        analysis={aiAnalysis}
        symbol={symbol}
        isAnalyzing={isAnalyzing}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="card animate-fade-in overflow-hidden p-0">
            <AITradingDashboard
              embedded
              onAnalysisChange={handleAnalysisChange}
              onAnalyzingChange={setIsAnalyzing}
            />
          </div>

          <AccordionItem title="Score breakdown" defaultOpen={false}>
            <SmartScoreCard analysis={aiAnalysis} symbol={symbol} compact />
          </AccordionItem>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="card animate-fade-in overflow-hidden">
            <TradePanel embedded />
          </div>
          <PositionWatchPanel />
          <div className="card animate-fade-in overflow-hidden">
            <RiskMonitor
              dailyProfitLoss={account.dailyProfitLoss}
              openTrades={account.openTrades}
              tradesToday={account.tradesToday}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
