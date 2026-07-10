#!/usr/bin/env npx tsx
/**
 * Headless gated analysis for Auto Pilot daemon.
 * Usage: npx tsx mt5-bridge/auto-trader-worker.ts EURUSD [--mode auto|scan] [--json]
 */
import * as fs from 'fs';
import * as path from 'path';
import { headlessGatedAdapter } from '../lib/headless-gated-adapter';
import type { GatedAnalysisMode } from '../lib/gated-trading-engine';

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function parseArgs(): { symbol: string; mode: GatedAnalysisMode; json: boolean } {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
  const symbol = (args[0] || 'EURUSD').replace('/', '').toUpperCase();
  const modeFlag = process.argv.find((a) => a.startsWith('--mode='));
  const mode = (modeFlag?.split('=')[1] as GatedAnalysisMode) || 'scan';
  const json = flags.has('--json') || !process.stdout.isTTY;
  return { symbol, mode, json };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { symbol, mode, json } = parseArgs();

  try {
    const analysis = await headlessGatedAdapter.analyzeMarket(symbol, [], { mode });
    const payload = {
      ok: true,
      symbol,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      overallScore: analysis.overallScore,
      executionPermitted: analysis.gateStatus?.executionPermitted ?? false,
      executionBlockedBy: analysis.gateStatus?.executionBlockedBy ?? [],
      executionReason: analysis.gateStatus?.executionReason,
      suggestedStopLoss: analysis.suggestedStopLoss,
      suggestedTakeProfit: analysis.suggestedTakeProfit,
      suggestedPositionSize: analysis.suggestedPositionSize,
      dataHealth: analysis.dataHealth,
    };

    if (json) {
      console.log(JSON.stringify(payload));
    } else {
      console.log(`${symbol}: ${analysis.recommendation} conf=${analysis.confidence}% exec=${payload.executionPermitted}`);
      if (payload.executionBlockedBy.length) {
        console.log('  blocked:', payload.executionBlockedBy.join('; '));
      }
    }
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      console.log(JSON.stringify({ ok: false, symbol, error: message }));
    } else {
      console.error(`Error analyzing ${symbol}:`, message);
    }
    process.exit(1);
  }
}

main();
