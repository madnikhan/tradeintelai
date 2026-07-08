#!/usr/bin/env npx tsx
/**
 * Diagnose scanner results for the 11 custom pairs from production screenshots.
 * Run: npx tsx scripts/diagnose-scanner-pairs.ts [PAIR ...]
 */
import { gatedEngineAdapter } from '../lib/gated-engine-adapter';
import { validateGatedExecution } from '../lib/execute-gated-trade';
import {
  isScannerExecutableOpportunity,
  SCANNER_MIN_CONFIDENCE_GATE,
} from '../lib/scanner-executable';

const DEFAULT_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'XAU/USD',
];

const pairs =
  process.argv.length > 2
    ? process.argv.slice(2).map((p) => (p.includes('/') ? p : `${p.slice(0, 3)}/${p.slice(3)}`))
    : DEFAULT_PAIRS;

async function main() {
  console.log('Scanner pair diagnosis\n');
  console.log(`Pairs: ${pairs.length}`);
  console.log(
    'Pair'.padEnd(10),
    'G1'.padEnd(4),
    'Bias'.padEnd(14),
    'G4'.padEnd(4),
    'Conf'.padEnd(6),
    'Score'.padEnd(6),
    'Signal'.padEnd(12),
    'ScanExec'.padEnd(9),
    'TradeExec'
  );
  console.log('-'.repeat(90));

  let scanExecutable = 0;
  let tradeExecutable = 0;

  for (const pair of pairs) {
    const symbol = pair.replace('/', '');
    try {
      const analysis = await gatedEngineAdapter.analyzeMarket(symbol, []);
      const gs = analysis.gateStatus;
      const opp = {
        executionPermitted: gs?.executionPermitted ?? false,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        score: analysis.overallScore,
      };
      const scanOk = isScannerExecutableOpportunity(opp);
      const tradeVal = validateGatedExecution(analysis);
      const tradeOk = tradeVal.ok;

      if (scanOk) scanExecutable++;
      if (tradeOk) tradeExecutable++;

      console.log(
        pair.padEnd(10),
        (gs?.marketReadable ? 'OK' : 'NO').padEnd(4),
        `${gs?.directionalBias ?? '?'} ${gs?.biasStrength ?? 0}%`.padEnd(14),
        (gs?.executionPermitted ? 'YES' : 'NO').padEnd(4),
        `${analysis.confidence}%`.padEnd(6),
        String(analysis.overallScore).padEnd(6),
        analysis.recommendation.padEnd(12),
        (scanOk ? 'YES' : 'NO').padEnd(9),
        tradeOk ? 'YES' : 'NO'
      );

      if (!gs?.executionPermitted && gs?.executionBlockedBy?.length) {
        gs.executionBlockedBy.slice(0, 2).forEach((b) => console.log(`  blocked: ${b}`));
      } else if (!tradeOk && !tradeVal.ok) {
        console.log(`  trade: ${tradeVal.error}`);
      }

      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.log(pair.padEnd(10), 'ERROR', (e as Error).message);
    }
  }

  console.log('-'.repeat(90));
  console.log(`Scanner executable (Gate 4 + conf>=${SCANNER_MIN_CONFIDENCE_GATE}%): ${scanExecutable}/${pairs.length}`);
  console.log(`Trade executable (incl. SL/TP/size): ${tradeExecutable}/${pairs.length}`);
  console.log('\nLegacy strict filter (score>=65, conf>=55): would need per-row check in UI — use isScannerExecutableAnalysis()');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
