/**
 * Empirical win-rate verdicts per symbol/session from closed trades.
 */

import { getTradesFromFirestore } from './firebase/trade-history';
import { isFirebaseConfigured } from './firebase/config';
import type { Trade, TradeVerdict } from '@/types/trading';
import { TRADING_RULES } from '@/config/trading-rules';

export interface VerdictResult {
  symbol: string;
  session?: string;
  winRate: number;
  profitFactor: number;
  sampleSize: number;
  verdict: TradeVerdict;
  reason: string;
}

const MIN_SAMPLE_BLOCK = 15;
const MIN_SAMPLE_CAUTION = 8;
const BLOCK_WIN_RATE = 45;
const CAUTION_WIN_RATE = 55;
const TARGET_WIN_RATE = TRADING_RULES.TARGET_WIN_RATE * 100;

function computeMetrics(trades: Trade[]): {
  winRate: number;
  profitFactor: number;
  sampleSize: number;
} {
  const closed = trades.filter(
    (t) => t.status === 'closed' && t.profitLoss !== undefined
  );
  if (!closed.length) {
    return { winRate: 0, profitFactor: 0, sampleSize: 0 };
  }
  const wins = closed.filter((t) => (t.profitLoss ?? 0) > 0);
  const losses = closed.filter((t) => (t.profitLoss ?? 0) < 0);
  const totalWins = wins.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.profitLoss ?? 0), 0));
  const winRate = (wins.length / closed.length) * 100;
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99 : 0;
  return { winRate, profitFactor, sampleSize: closed.length };
}

function deriveVerdict(
  winRate: number,
  profitFactor: number,
  sampleSize: number,
  label: string
): Omit<VerdictResult, 'symbol' | 'session'> & { reason: string; verdict: TradeVerdict } {
  let verdict: TradeVerdict = 'INSUFFICIENT_DATA';
  let reason = `${label}: insufficient data (${sampleSize} trades)`;

  if (sampleSize >= MIN_SAMPLE_BLOCK && winRate < BLOCK_WIN_RATE) {
    verdict = 'BLOCK';
    reason = `${label}: ${winRate.toFixed(0)}% win rate (${sampleSize} trades) — historically weak`;
  } else if (sampleSize >= MIN_SAMPLE_CAUTION && winRate < CAUTION_WIN_RATE) {
    verdict = 'CAUTION';
    reason = `${label}: ${winRate.toFixed(0)}% win rate (${sampleSize} trades) — below target`;
  } else if (sampleSize >= MIN_SAMPLE_CAUTION) {
    verdict = 'ALLOW';
    reason = `${label}: ${winRate.toFixed(0)}% win rate (${sampleSize} trades)`;
  }

  return { winRate, profitFactor, sampleSize, verdict, reason };
}

function withinDays(trade: Trade, days: number): boolean {
  const ts = trade.closeTime ?? trade.timestamp;
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export async function getSymbolVerdict(
  symbol: string,
  days = 30
): Promise<VerdictResult> {
  const sym = symbol.replace(/\//g, '').toUpperCase();
  if (!isFirebaseConfigured()) {
    return {
      symbol: sym,
      winRate: 0,
      profitFactor: 0,
      sampleSize: 0,
      verdict: 'INSUFFICIENT_DATA',
      reason: 'Firebase not configured',
    };
  }

  const all = await getTradesFromFirestore();
  const filtered = all.filter(
    (t) =>
      t.pair.replace(/\//g, '').toUpperCase() === sym && withinDays(t, days)
  );
  const { winRate, profitFactor, sampleSize } = computeMetrics(filtered);
  const v = deriveVerdict(winRate, profitFactor, sampleSize, `${sym}`);
  return { ...v, symbol: sym };
}

export async function getSessionVerdict(
  symbol: string,
  session: string,
  days = 30
): Promise<VerdictResult> {
  const sym = symbol.replace(/\//g, '').toUpperCase();
  if (!isFirebaseConfigured()) {
    return {
      symbol: sym,
      session,
      winRate: 0,
      profitFactor: 0,
      sampleSize: 0,
      verdict: 'INSUFFICIENT_DATA',
      reason: 'Firebase not configured',
    };
  }

  const all = await getTradesFromFirestore();
  const filtered = all.filter(
    (t) =>
      t.pair.replace(/\//g, '').toUpperCase() === sym &&
      t.features?.tradingSession === session &&
      withinDays(t, days)
  );
  const { winRate, profitFactor, sampleSize } = computeMetrics(filtered);
  const v = deriveVerdict(winRate, profitFactor, sampleSize, `${sym} ${session}`);
  return { ...v, symbol: sym, session };
}

export async function getAllSymbolVerdicts(days = 30): Promise<VerdictResult[]> {
  if (!isFirebaseConfigured()) return [];

  const all = await getTradesFromFirestore();
  const recent = all.filter((t) => withinDays(t, days));
  const symbols = [...new Set(recent.map((t) => t.pair.replace(/\//g, '').toUpperCase()))];

  const results: VerdictResult[] = [];
  for (const sym of symbols) {
    const filtered = recent.filter(
      (t) => t.pair.replace(/\//g, '').toUpperCase() === sym
    );
    const { winRate, profitFactor, sampleSize } = computeMetrics(filtered);
    const v = deriveVerdict(winRate, profitFactor, sampleSize, sym);
    results.push({ ...v, symbol: sym });
  }
  return results.sort((a, b) => b.sampleSize - a.sampleSize);
}

export function shouldBlockExecution(verdict: VerdictResult): boolean {
  return verdict.verdict === 'BLOCK';
}

export function getTargetWinRatePercent(): number {
  return TARGET_WIN_RATE;
}
