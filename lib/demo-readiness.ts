/**
 * Demo → live readiness checks (TRADING_RULES thresholds).
 */

import { TRADING_RULES } from '@/config/trading-rules';
import { PerformanceAnalytics } from '@/lib/performance-analytics';
import type { Trade } from '@/types/trading';
import { getAnalysisAccuracy } from '@/lib/firebase/analysis-storage';

export interface DemoReadinessMetrics {
  closedTrades: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  consecutiveProfitableWeeks: number;
  resolvedAnalyses: number;
}

export interface DemoReadinessResult {
  ready: boolean;
  metrics: DemoReadinessMetrics;
  failures: string[];
  goals: {
    label: string;
    current: string;
    target: string;
    met: boolean;
  }[];
}

export function evaluateDemoReadiness(
  trades: Trade[],
  initialBalance: number,
  currentBalance: number
): Omit<DemoReadinessResult, 'resolvedAnalyses'> & { metrics: DemoReadinessMetrics } {
  const closed = trades.filter((t) => t.status === 'closed');
  const metricsBase = PerformanceAnalytics.calculateAdvancedMetrics(
    trades,
    initialBalance,
    currentBalance
  );

  const winRate = metricsBase.winRate / 100;
  const maxDd = metricsBase.maxDrawdownPercent / 100;
  const pf = metricsBase.profitFactor >= 999 ? 99 : metricsBase.profitFactor;
  const weeks = metricsBase.consecutiveProfitableWeeks;

  const metrics: DemoReadinessMetrics = {
    closedTrades: closed.length,
    winRatePercent: metricsBase.winRate,
    maxDrawdownPercent: metricsBase.maxDrawdownPercent,
    profitFactor: pf,
    consecutiveProfitableWeeks: weeks,
    resolvedAnalyses: 0,
  };

  const goals = [
    {
      label: `${TRADING_RULES.MIN_CONSECUTIVE_WEEKS} Profitable Weeks`,
      current: `${weeks} / ${TRADING_RULES.MIN_CONSECUTIVE_WEEKS}`,
      target: String(TRADING_RULES.MIN_CONSECUTIVE_WEEKS),
      met: weeks >= TRADING_RULES.MIN_CONSECUTIVE_WEEKS,
    },
    {
      label: `Win Rate ≥ ${(TRADING_RULES.MIN_WIN_RATE * 100).toFixed(0)}%`,
      current: `${metricsBase.winRate.toFixed(1)}%`,
      target: `${(TRADING_RULES.MIN_WIN_RATE * 100).toFixed(0)}%`,
      met: winRate >= TRADING_RULES.MIN_WIN_RATE,
    },
    {
      label: `Max Drawdown < ${(TRADING_RULES.MAX_DRAWDOWN * 100).toFixed(0)}%`,
      current: `${metricsBase.maxDrawdownPercent.toFixed(1)}%`,
      target: `< ${(TRADING_RULES.MAX_DRAWDOWN * 100).toFixed(0)}%`,
      met: closed.length === 0 || maxDd <= TRADING_RULES.MAX_DRAWDOWN,
    },
    {
      label: `Profit Factor > ${TRADING_RULES.MIN_PROFIT_FACTOR}`,
      current: pf.toFixed(2),
      target: String(TRADING_RULES.MIN_PROFIT_FACTOR),
      met: closed.length === 0 ? false : pf >= TRADING_RULES.MIN_PROFIT_FACTOR,
    },
    {
      label: `Min ${TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE} closed trades`,
      current: String(closed.length),
      target: String(TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE),
      met: closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE,
    },
  ];

  const failures: string[] = [];
  if (!goals[0].met) failures.push(goals[0].label);
  if (!goals[1].met && closed.length > 0) failures.push(goals[1].label);
  if (!goals[2].met && closed.length > 0) failures.push(goals[2].label);
  if (!goals[3].met && closed.length > 0) failures.push(goals[3].label);
  if (!goals[4].met) failures.push(goals[4].label);

  const ready =
    failures.length === 0 &&
    closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE;

  return { ready, metrics, failures, goals };
}

export async function assertCanGoLive(
  trades: Trade[],
  initialBalance: number,
  currentBalance: number,
  options?: { allowOverride?: boolean }
): Promise<DemoReadinessResult> {
  const base = evaluateDemoReadiness(trades, initialBalance, currentBalance);
  const accuracy = await getAnalysisAccuracy(undefined, {
    source: 'gated-engine',
    days: 30,
  });

  const metrics = {
    ...base.metrics,
    resolvedAnalyses: accuracy.total,
  };

  const failures = [...base.failures];
  if (accuracy.total < TRADING_RULES.MIN_RESOLVED_ANALYSES) {
    failures.push(
      `At least ${TRADING_RULES.MIN_RESOLVED_ANALYSES} resolved gated analyses (have ${accuracy.total})`
    );
  }

  const analysisOk = accuracy.total >= TRADING_RULES.MIN_RESOLVED_ANALYSES;

  const finalReady =
    options?.allowOverride === true ||
    (base.ready && analysisOk);

  return {
    ready: finalReady,
    metrics,
    failures: options?.allowOverride ? [] : failures,
    goals: base.goals,
  };
}
