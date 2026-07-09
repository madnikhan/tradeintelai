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
  console.log('Scanner pair diagnosis (scan mode + OHLC structure)\n');
  console.log(`Pairs: ${pairs.length}`);
  console.log(
    'Pair'.padEnd(10),
    'G1'.padEnd(4),
    'Trend'.padEnd(6),
    'Pat'.padEnd(5),
    'Tech'.padEnd(5),
    'Bias'.padEnd(14),
    'G4'.padEnd(4),
    'Conf'.padEnd(6),
    'Score'.padEnd(6),
    'Signal'.padEnd(12),
    'ScanExec'
  );
  console.log('-'.repeat(100));

  let scanExecutable = 0;
  let tradeExecutable = 0;
  let gate1Readable = 0;
  let technicalFallback = 0;
  const techScores: number[] = [];

  for (const pair of pairs) {
    const symbol = pair.replace('/', '');
    try {
      const analysis = await gatedEngineAdapter.analyzeMarket(symbol, [], undefined, {
        mode: 'scan',
      });
      const gs = analysis.gateStatus;
      const dh = analysis.dataHealth;
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
      if (gs?.marketReadable) gate1Readable++;
      if (dh?.technicalUsedFallback) technicalFallback++;
      techScores.push(analysis.technicalScore);

      const trend = gs?.gate1Inputs?.trendStrength ?? 0;
      const pat = gs?.gate1Inputs?.patternConfidence ?? 0;

      console.log(
        pair.padEnd(10),
        (gs?.marketReadable ? 'OK' : 'NO').padEnd(4),
        `${trend}%`.padEnd(6),
        `${pat}%`.padEnd(5),
        String(analysis.technicalScore).padEnd(5),
        `${gs?.directionalBias ?? '?'} ${gs?.biasStrength ?? 0}%`.padEnd(14),
        (gs?.executionPermitted ? 'YES' : 'NO').padEnd(4),
        `${analysis.confidence}%`.padEnd(6),
        String(analysis.overallScore).padEnd(6),
        analysis.recommendation.padEnd(12),
        scanOk ? 'YES' : 'NO'
      );

      if (gs?.marketReadabilityReason && !gs.marketReadable) {
        console.log(`  gate1: ${gs.marketReadabilityReason.slice(0, 120)}`);
      }
      if (!gs?.executionPermitted && gs?.executionBlockedBy?.length) {
        gs.executionBlockedBy.slice(0, 1).forEach((b) => console.log(`  blocked: ${b}`));
      }
      if (dh) {
        console.log(
          `  data: ${dh.ohlcBars} bars (${dh.ohlcSource}), ohlcStruct=${dh.usedOhlcStructure}, techFallback=${dh.technicalUsedFallback}`
        );
      }

      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.log(pair.padEnd(10), 'ERROR', (e as Error).message);
    }
  }

  const uniqueTech = new Set(techScores);
  console.log('-'.repeat(100));
  console.log(`Gate 1 readable: ${gate1Readable}/${pairs.length}`);
  console.log(`Scanner executable (Gate 4 + conf>=${SCANNER_MIN_CONFIDENCE_GATE}%): ${scanExecutable}/${pairs.length}`);
  console.log(`Trade executable (incl. SL/TP/size): ${tradeExecutable}/${pairs.length}`);
  console.log(`Technical score fallback (no OHLC): ${technicalFallback}/${pairs.length}`);
  console.log(`Distinct technical scores: ${uniqueTech.size} (${[...uniqueTech].sort((a, b) => a - b).join(', ')})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
