#!/usr/bin/env npx tsx
/**
 * Run gated-engine backtests on major pairs; write JSON + markdown report.
 * Usage: npx tsx scripts/run-backtest-report.ts [--offline]
 */
import * as fs from 'fs';
import * as path from 'path';
import { BacktestingEngine } from '../lib/backtesting';
import { TRADING_RULES } from '../config/trading-rules';

const PAIRS = ['EURUSD', 'GBPUSD', 'USDCAD', 'XAUUSD'];
const offline = process.argv.includes('--offline');

async function runPair(symbol: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const engine = new BacktestingEngine(TRADING_RULES.DEMO_BALANCE);

  if (offline) {
    return {
      symbol,
      skipped: true,
      reason: 'offline mode — no historical fetch',
      metrics: null,
    };
  }

  try {
    const result = await engine.runBacktest({
      symbol,
      startDate: start,
      endDate: end,
      timeframe: 'H1',
      initialBalance: TRADING_RULES.DEMO_BALANCE,
      riskPercentage: TRADING_RULES.RISK_PERCENTAGE,
      maxOpenTrades: TRADING_RULES.MAX_OPEN_TRADES,
    });
    return {
      symbol,
      skipped: false,
      errors: result.errors,
      metrics: result.metrics,
      totalTrades: result.metrics.totalTrades,
    };
  } catch (e: unknown) {
    return {
      symbol,
      skipped: true,
      reason: e instanceof Error ? e.message : String(e),
      metrics: null,
    };
  }
}

async function main() {
  const results = [];
  for (const symbol of PAIRS) {
    console.log(`Backtest ${symbol}...`);
    results.push(await runPair(symbol));
  }

  const outDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'backtest-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const mdLines = [
    '# Backtest Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    offline ? '\n> Offline mode — pair runs skipped.\n' : '',
    '| Symbol | Trades | Win % | PF | Return % | Notes |',
    '|--------|--------|-------|-----|----------|-------|',
  ];

  for (const r of results) {
    if (r.skipped || !r.metrics) {
      mdLines.push(`| ${r.symbol} | — | — | — | — | ${'reason' in r ? r.reason : 'skipped'} |`);
    } else {
      mdLines.push(
        `| ${r.symbol} | ${r.metrics.totalTrades} | ${r.metrics.winRate.toFixed(1)} | ${r.metrics.profitFactor.toFixed(2)} | ${r.metrics.returnPercent.toFixed(1)} | ${r.errors?.length ? r.errors[0] : 'ok'} |`
      );
    }
  }

  const mdPath = path.join(outDir, 'backtest-report.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`Wrote ${jsonPath} and ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
