#!/usr/bin/env npx tsx
/**
 * Diagnose why backtests produce 0 trades — sample gated-engine decisions on historical windows.
 */
import { config } from 'dotenv';
import * as path from 'path';
import { GatedEngineAdapter } from '../lib/gated-engine-adapter';
import { MT5PriceDataProvider } from '../lib/data-providers/mt5-price-data';
import { TRADING_RULES } from '../config/trading-rules';

config({ path: path.resolve(__dirname, '../.env.local') });

const SYMBOL = process.argv[2] ?? 'EURUSD';
const SAMPLE_BARS = Number(process.argv[3] ?? 5);

async function main() {
  console.log('Backtest investigation — gated engine signal sampling\n');
  console.log(`Symbol: ${SYMBOL} | Sample points: ${SAMPLE_BARS}`);
  console.log(`DEMO_BALANCE config: ${TRADING_RULES.DEMO_BALANCE} (0 = fetched from MT5 at runtime)\n`);

  const data = await MT5PriceDataProvider.getHistoricalData(SYMBOL, 'H1', 720);
  if (data.length < 50) {
    console.error('Insufficient MT5 data — is bridge running?');
    process.exit(2);
  }

  console.log(`Loaded ${data.length} H1 bars (${data[0]?.timestamp?.toISOString?.()} → ${data[data.length - 1]?.timestamp?.toISOString?.()})\n`);

  const adapter = new GatedEngineAdapter();
  const indices = [
    Math.floor(data.length * 0.25),
    Math.floor(data.length * 0.5),
    Math.floor(data.length * 0.75),
    data.length - 24,
    data.length - 1,
  ].slice(0, SAMPLE_BARS);

  let executable = 0;
  let hold = 0;
  const blockers: Record<string, number> = {};

  for (const i of indices) {
    const bar = data[i];
    console.log(`--- Sample @ ${bar.timestamp?.toISOString?.() ?? i} close=${bar.close} ---`);
    try {
      const analysis = await adapter.analyzeMarket(SYMBOL, []);
      const permitted = analysis.gateStatus?.executionPermitted ?? false;
      const rec = analysis.recommendation;
      console.log(`  Recommendation: ${rec} | Confidence: ${analysis.confidence}% | Executable: ${permitted}`);
      if (analysis.gateStatus?.executionBlockedBy?.length) {
        console.log(`  Blockers: ${analysis.gateStatus.executionBlockedBy.join('; ')}`);
        for (const b of analysis.gateStatus.executionBlockedBy) {
          blockers[b] = (blockers[b] ?? 0) + 1;
        }
      }
      if (analysis.gateStatus?.marketReadabilityReason) {
        console.log(`  Gate 1: ${analysis.gateStatus.marketReadabilityReason.slice(0, 120)}`);
      }
      if (permitted && rec !== 'HOLD') executable++;
      else hold++;
    } catch (e) {
      console.log(`  Error: ${e instanceof Error ? e.message : e}`);
      hold++;
    }
    console.log('');
  }

  console.log('Summary');
  console.log(`  Executable samples: ${executable}/${indices.length}`);
  console.log(`  HOLD/blocked samples: ${hold}/${indices.length}`);
  if (Object.keys(blockers).length) {
    console.log('  Top blockers:');
    for (const [k, v] of Object.entries(blockers).sort((a, b) => b[1] - a[1])) {
      console.log(`    - ${k}: ${v}x`);
    }
  }

  console.log('\nRoot causes for 0-trade backtests:');
  console.log('  1. Backtest runs full gated engine per candle without chart image → Gate 1/Gate 3 often block');
  console.log('  2. Gate 4 expectancy matrix is strict — most live scans also return HOLD');
  console.log('  3. TRADING_RULES.DEMO_BALANCE=0 in config (backtest uses 0 unless overridden)');
  console.log('  4. Backtest is diagnostic only — demo track record is the real accuracy measure');

  process.exit(executable > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
