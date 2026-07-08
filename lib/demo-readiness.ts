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
  /** Stretch KPI: 65% rolling win rate with 30+ closed trades */
  stretchTargetMet: boolean;
  metrics: DemoReadinessMetrics;
  failures: string[];
  stretchFailures: string[];
  goals: {
    label: string;
    current: string;
    target: string;
    met: boolean;
  }[];
  stretchGoals: {
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
): DemoReadinessResult {
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

  const stretchGoals = [
    {
      label: `Stretch win rate ≥ ${(TRADING_RULES.TARGET_WIN_RATE * 100).toFixed(0)}%`,
      current: `${metricsBase.winRate.toFixed(1)}%`,
      target: `${(TRADING_RULES.TARGET_WIN_RATE * 100).toFixed(0)}%`,
      met:
        closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET &&
        winRate >= TRADING_RULES.TARGET_WIN_RATE,
    },
    {
      label: `Stretch sample ≥ ${TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET} trades`,
      current: String(closed.length),
      target: String(TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET),
      met: closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET,
    },
    {
      label: `Stretch profit factor ≥ 2.0`,
      current: pf.toFixed(2),
      target: '2.0',
      met: closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET && pf >= 2,
    },
    {
      label: `Stretch resolved analyses ≥ 25`,
      current: '—',
      target: '25',
      met: false,
    },
  ];

  const stretchFailures: string[] = [];
  if (!stretchGoals[0].met && closed.length >= TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET) {
    stretchFailures.push(stretchGoals[0].label);
  }
  if (!stretchGoals[1].met) stretchFailures.push(stretchGoals[1].label);

  const stretchTargetMet =
    stretchGoals[0].met && stretchGoals[1].met && stretchGoals[2].met;

  return {
    ready,
    stretchTargetMet,
    metrics,
    failures,
    stretchFailures,
    goals,
    stretchGoals,
  };
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

  const stretchGoals = base.stretchGoals.map((g, i) => {
    if (i === 3) {
      return {
        ...g,
        current: String(accuracy.total),
        met: accuracy.total >= 25,
      };
    }
    return g;
  });

  const stretchFailures = [...base.stretchFailures];
  if (!stretchGoals[3].met && accuracy.total > 0) {
    stretchFailures.push(stretchGoals[3].label);
  }

  const stretchTargetMet =
    base.stretchTargetMet &&
    stretchGoals[3].met &&
    accuracy.total >= 25;

  return {
    ready: finalReady,
    stretchTargetMet,
    metrics,
    failures: options?.allowOverride ? [] : failures,
    stretchFailures: options?.allowOverride ? [] : stretchFailures,
    goals: base.goals,
    stretchGoals,
  };
}
