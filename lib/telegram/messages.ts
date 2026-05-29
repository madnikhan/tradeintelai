import type { TradeExecutedPayload } from '@/lib/notifications/types';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  'https://tradeintelai.vercel.app';

export function formatTradeExecutedDm(p: TradeExecutedPayload): string {
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const order = p.orderId != null ? `#${p.orderId}` : '—';
  return [
    'TradeIntel AI — Trade Executed',
    `Pair: ${p.symbol}`,
    `Direction: ${p.direction}`,
    `Lots: ${p.lots}`,
    `Entry: ${p.entry}`,
    `SL: ${p.stopLoss} | TP: ${p.takeProfit}`,
    `Order: ${order}`,
    `Time: ${time} UTC`,
    `Dashboard: ${DASHBOARD_URL}/dashboard`,
  ].join('\n');
}

export function formatTradeExecutedChannel(p: TradeExecutedPayload): string {
  const gate = p.gatePassed !== false ? 'Passed' : '—';
  const score = p.score != null ? String(Math.round(p.score)) : '—';
  return [
    'TradeIntel AI Signal Executed',
    `${p.symbol} ${p.direction} @ ${p.entry}`,
    `SL ${p.stopLoss} | TP ${p.takeProfit}`,
    `Score: ${score} | Gate 4: ${gate}`,
  ].join('\n');
}

export function formatExecutableSignalChannel(
  symbol: string,
  recommendation: string,
  score: number
): string {
  return [
    'TradeIntel AI — Executable Signal',
    `${symbol} ${recommendation}`,
    `Score: ${Math.round(score)}`,
    `Dashboard: ${DASHBOARD_URL}/dashboard?tab=scan`,
  ].join('\n');
}
