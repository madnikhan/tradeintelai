'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';

type TradingContextValue = {
  symbol: string;
  setSymbol: (symbol: string) => void;
  aiAnalysis: ExtendedMarketAnalysis | null;
  setAiAnalysis: (analysis: ExtendedMarketAnalysis | null) => void;
};

const TradingContext = createContext<TradingContextValue | null>(null);

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const [symbol, setSymbolState] = useState('EURUSD');
  const [aiAnalysis, setAiAnalysis] = useState<ExtendedMarketAnalysis | null>(null);

  const setSymbol = useCallback((next: string) => {
    setSymbolState(next.replace(/\//g, '').toUpperCase());
  }, []);

  const value = useMemo(
    () => ({ symbol, setSymbol, aiAnalysis, setAiAnalysis }),
    [symbol, setSymbol, aiAnalysis]
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTradingContext(): TradingContextValue {
  const ctx = useContext(TradingContext);
  if (!ctx) {
    throw new Error('useTradingContext must be used within TradingProvider');
  }
  return ctx;
}
