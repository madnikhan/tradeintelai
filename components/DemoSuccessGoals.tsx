'use client';

import { useEffect, useState } from 'react';
import { evaluateDemoReadiness } from '@/lib/demo-readiness';
import { TRADING_RULES } from '@/config/trading-rules';
import type { Trade } from '@/types/trading';

interface DemoSuccessGoalsProps {
  trades: Trade[];
  initialBalance: number;
  currentBalance: number;
}

export function DemoSuccessGoals({
  trades,
  initialBalance,
  currentBalance,
}: DemoSuccessGoalsProps) {
  const [goals, setGoals] = useState<
    { label: string; current: string; target: string; met: boolean }[]
  >([]);
  const [stretchGoals, setStretchGoals] = useState<
    { label: string; current: string; target: string; met: boolean }[]
  >([]);

  useEffect(() => {
    const result = evaluateDemoReadiness(trades, initialBalance, currentBalance);
    setGoals(result.goals);
    setStretchGoals(result.stretchGoals);
  }, [trades, initialBalance, currentBalance]);

  const allMet = goals.length > 0 && goals.every((g) => g.met);

  return (
    <div className="card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 animate-fade-in">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-400">
        <span>🎯</span> Demo Success Goals
        {allMet && (
          <span className="text-xs font-normal text-emerald-400 ml-2">
            Criteria met — review checklist before live
          </span>
        )}
      </h3>
      <div className="space-y-3">
        {goals.map((g) => (
          <div key={g.label} className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">{g.label}</span>
            <span
              className={`font-bold font-mono text-sm ${
                g.met ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {g.current}
              {!g.met && (
                <span className="text-gray-500 font-normal ml-1">(target {g.target})</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {stretchGoals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-2">
          <p className="text-xs text-amber-300/80 font-medium">
            65% stretch track ({TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET}+ trades)
          </p>
          {stretchGoals.map((g) => (
            <div key={g.label} className="flex justify-between items-center">
              <span className="text-gray-500 text-xs">{g.label}</span>
              <span
                className={`font-mono text-xs ${
                  g.met ? 'text-emerald-400' : 'text-gray-400'
                }`}
              >
                {g.current}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-600 mt-3">
        Live requires {TRADING_RULES.MIN_CONSECUTIVE_WEEKS} profitable weeks,{' '}
        {(TRADING_RULES.MIN_WIN_RATE * 100).toFixed(0)}% win rate, drawdown &lt;{' '}
        {(TRADING_RULES.MAX_DRAWDOWN * 100).toFixed(0)}%, PF &gt; {TRADING_RULES.MIN_PROFIT_FACTOR}.
      </p>
    </div>
  );
}
