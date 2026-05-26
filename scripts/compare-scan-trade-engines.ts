#!/usr/bin/env npx tsx
/**
 * Compare legacy scanner engine vs gated trade engine per symbol.
 * Run: npx tsx scripts/compare-scan-trade-engines.ts [SYMBOL]
 */
import { aiTradingEngine } from '../lib/ai-trading-engine';
import { gatedEngineAdapter } from '../lib/gated-engine-adapter';

const pairs = process.argv[2]
  ? [process.argv[2].replace('/', '')]
  : ['EURUSD', 'GBPUSD', 'USDCAD', 'XAUUSD'];

async function main() {
  console.log('Scan vs Trade engine comparison\n');
  console.log(
    'Symbol'.padEnd(10),
    'Legacy'.padEnd(14),
    'Gated'.padEnd(14),
    'Executable'.padEnd(12),
    'Mismatch'
  );
  console.log('-'.repeat(70));

  let mismatches = 0;

  for (const symbol of pairs) {
    try {
      const legacy = await aiTradingEngine.analyzeMarket(symbol, []);
      const gated = await gatedEngineAdapter.analyzeMarket(symbol, []);
      const executable = gated.gateStatus?.executionPermitted ?? false;
      const legacyActionable =
        legacy.recommendation !== 'HOLD' && legacy.overallScore >= 65;
      const gatedActionable =
        gated.recommendation !== 'HOLD' && executable;
      const mismatch =
        (legacyActionable && !gatedActionable) ||
        (legacy.recommendation.includes('STRONG') && gated.recommendation === 'HOLD');

      if (mismatch) mismatches++;

      console.log(
        symbol.padEnd(10),
        `${legacy.recommendation}(${legacy.overallScore})`.padEnd(14),
        `${gated.recommendation}(${gated.overallScore})`.padEnd(14),
        (executable ? 'Yes' : 'No').padEnd(12),
        mismatch ? 'YES' : '-'
      );

      if (mismatch && gated.gateStatus?.executionBlockedBy?.length) {
        gated.gateStatus.executionBlockedBy.slice(0, 2).forEach((b) => {
          console.log(`  Gate 4: ${b}`);
        });
      }
    } catch (e) {
      console.log(symbol.padEnd(10), 'ERROR', (e as Error).message);
    }
  }

  console.log('-'.repeat(70));
  console.log(`Mismatches (legacy would trade, gated blocks): ${mismatches}/${pairs.length}`);
  process.exit(mismatches > 0 ? 1 : 0);
}

main();
