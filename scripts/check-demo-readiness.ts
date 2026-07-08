#!/usr/bin/env npx tsx
/**
 * Check demo → live readiness goals (run daily during demo track).
 * Usage: npm run readiness:demo
 */
import { config } from 'dotenv';
import * as path from 'path';
import { evaluateDemoReadiness } from '../lib/demo-readiness';
import { TRADING_RULES } from '../config/trading-rules';
import type { Trade } from '../types/trading';

config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  // CLI cannot load browser trade history — pass trades via future Firestore hook.
  // For now evaluate structure and print targets.
  const trades: Trade[] = [];
  const initial = 10_000;
  const current = 10_000;
  const result = evaluateDemoReadiness(trades, initial, current);

  console.log('Demo → Live Readiness Check');
  console.log('='.repeat(50));
  console.log(`Base ready (live manual): ${result.ready ? 'YES' : 'NO'}`);
  console.log(`Stretch target (65% KPI): ${result.stretchTargetMet ? 'YES' : 'NO'}`);
  console.log('');
  console.log('Base goals (required for live manual):');
  for (const g of result.goals) {
    console.log(`  ${g.met ? '✅' : '❌'} ${g.label}: ${g.current} (target ${g.target})`);
  }
  console.log('');
  console.log('Stretch goals (4–8 week demo proof track):');
  for (const g of result.stretchGoals) {
    console.log(`  ${g.met ? '✅' : '⬜'} ${g.label}: ${g.current} (target ${g.target})`);
  }
  if (result.failures.length) {
    console.log('\nBase blockers:');
    for (const f of result.failures) console.log(`  - ${f}`);
  }
  if (result.stretchFailures.length) {
    console.log('\nStretch gaps (demo track — not blocking base):');
    for (const f of result.stretchFailures) console.log(`  - ${f}`);
  }
  console.log('\nRun this daily during a 4–8 week demo-only period.');
  console.log(
    `Base: ${TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE} trades, ${(TRADING_RULES.MIN_WIN_RATE * 100).toFixed(0)}% WR, PF>${TRADING_RULES.MIN_PROFIT_FACTOR}`
  );
  console.log(
    `Stretch: ${TRADING_RULES.MIN_CLOSED_TRADES_FOR_TARGET}+ trades, ${(TRADING_RULES.TARGET_WIN_RATE * 100).toFixed(0)}% rolling WR, PF≥2.0, 25+ resolved analyses`
  );
  process.exit(result.ready ? 0 : 1);
}

main();
