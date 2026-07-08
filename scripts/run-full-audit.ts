#!/usr/bin/env npx tsx
/**
 * Full Local A–Z System Audit
 *
 * Usage:
 *   npm run audit:full
 *   npm run audit:quick
 *   npx tsx scripts/run-full-audit.ts [--skip-backtest] [--skip-gpt] [--deep] [--require-dev-server]
 */
import { config } from 'dotenv';
import * as path from 'path';
import { AuditCollector, type AuditOptions, type AuditReport } from './audit/types';
import { checkPrerequisites, prerequisitesBlockAudit } from './audit/prerequisites';
import { runChild } from './audit/run-child';
import { runDataAudit } from './audit/data-audit';
import { runEngineAudit } from './audit/engine-audit';
import { runApiHealthAudit } from './audit/api-health';
import { runBridgeAudit } from './audit/bridge-audit';
import { runExecutionAudit } from './audit/execution-audit';
import { runServicesAudit } from './audit/services-audit';
import { writeAuditReport } from './audit/report';

config({ path: path.resolve(__dirname, '../.env.local') });

const ROOT = path.resolve(__dirname, '..');

function parseArgs(): AuditOptions {
  const argv = process.argv.slice(2);
  const getFlag = (name: string) => argv.includes(name);
  const getVal = (name: string, fallback: string) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  return {
    skipBacktest: getFlag('--skip-backtest'),
    skipGpt: getFlag('--skip-gpt'),
    liveTrade: getFlag('--live-trade'),
    requireDevServer: getFlag('--require-dev-server'),
    deep: getFlag('--deep'),
    symbol: getVal('--symbol', 'EURUSD'),
    devServerUrl: getVal('--dev-url', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    bridgeUrl: getVal('--bridge-url', process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'http://localhost:8080'),
  };
}

async function runSubprocessPhase(
  collector: AuditCollector,
  phase: string,
  category: string,
  testName: string,
  command: string,
  args: string[],
  timeoutMs?: number,
  opts?: { warnExitCodes?: number[] }
): Promise<void> {
  await collector.runTest(
    phase,
    category,
    testName,
    async () => {
      const result = await runChild(command, args, { cwd: ROOT, timeoutMs, name: testName });
      if (result.exitCode !== 0) {
        if (opts?.warnExitCodes?.includes(result.exitCode)) {
          return {
            exitCode: result.exitCode,
            warning: 'Non-zero exit treated as warning',
            duration: result.duration,
          };
        }
        throw new Error(`Exit code ${result.exitCode}${result.stderr ? `: ${result.stderr.slice(-200)}` : ''}`);
      }
      return { exitCode: 0, duration: result.duration };
    },
    opts?.warnExitCodes ? { warnOnFail: true } : undefined
  );
}

async function main(): Promise<number> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const options = parseArgs();
  const collector = new AuditCollector();

  console.log('🔍 TradeIntel AI — Full Local A–Z Audit');
  console.log('='.repeat(60));
  console.log(`Started: ${startedAt}`);
  console.log(`Symbol: ${options.symbol} | Bridge: ${options.bridgeUrl} | Dev: ${options.devServerUrl}`);
  console.log('');

  // Phase 0
  console.log('📋 Phase 0: Prerequisites\n');
  const prerequisites = await checkPrerequisites(options);
  for (const [k, v] of Object.entries(prerequisites.details)) {
    console.log(`  ${k}: ${v}`);
  }
  if (prerequisites.issues.length) {
    for (const issue of prerequisites.issues) console.log(`  ⚠️ ${issue}`);
  }

  collector.results.push({
    phase: 'Phase 0: Prerequisites',
    category: 'Infrastructure',
    testName: 'Environment keys',
    status: prerequisites.env ? 'PASS' : 'FAIL',
    duration: 0,
  });
  collector.results.push({
    phase: 'Phase 0: Prerequisites',
    category: 'Infrastructure',
    testName: 'MT5 bridge reachable',
    status: prerequisites.bridge ? 'PASS' : 'FAIL',
    duration: 0,
  });
  collector.results.push({
    phase: 'Phase 0: Prerequisites',
    category: 'Infrastructure',
    testName: 'Dev server reachable',
    status: prerequisites.devServer ? 'PASS' : options.requireDevServer ? 'FAIL' : 'WARNING',
    duration: 0,
    details: prerequisites.devServer ? prerequisites.details.devServer : prerequisites.details.devServerHint,
  });

  if (prerequisitesBlockAudit(prerequisites, options.requireDevServer)) {
    console.log('\n❌ Prerequisites failed — fix issues above and re-run.');
    const report = buildReport(startedAt, startMs, options, prerequisites, collector, 2);
    writeAuditReport(report, ROOT);
    return 2;
  }

  // Phase 0b — verify scripts
  await runSubprocessPhase(collector, 'Phase 0: Prerequisites', 'Env verify', 'verify:gemini', 'npm', [
    'run',
    'verify:gemini',
  ], 60_000, { warnExitCodes: [2] });
  await runSubprocessPhase(collector, 'Phase 0: Prerequisites', 'Env verify', 'verify:openai', 'npm', [
    'run',
    'verify:openai',
  ], 60_000);
  await runSubprocessPhase(
    collector,
    'Phase 0: Prerequisites',
    'Env verify',
    'verify:firebase-admin',
    'npm',
    ['run', 'verify:firebase-admin'],
    60_000
  );

  // Phase 1
  console.log('\n🧪 Phase 1: Unit Tests\n');
  await runSubprocessPhase(collector, 'Phase 1: Unit Tests', 'Vitest', 'npm test', 'npm', ['test'], 120_000);
  await runSubprocessPhase(
    collector,
    'Phase 1: Unit Tests',
    'Gate 1 regression',
    'test-gate1-regression',
    'npx',
    ['tsx', 'scripts/test-gate1-regression.ts'],
    60_000
  );
  await runSubprocessPhase(
    collector,
    'Phase 1: Unit Tests',
    'Indicator fixes',
    'test-indicator-fixes',
    'npx',
    ['tsx', 'scripts/test-indicator-fixes.ts'],
    60_000
  );

  // Phase 2–3
  console.log('\n📊 Phase 2: Data Layer\n');
  await runDataAudit(collector, options.symbol);

  console.log('\n⚙️ Phase 3: Analysis Engines\n');
  await runEngineAudit(collector, options);

  // Phase 4 (skip if no dev server)
  if (prerequisites.devServer) {
    console.log('\n🌐 Phase 4: API Routes\n');
    await runApiHealthAudit(collector, options);
  } else {
    collector.skip('Phase 4: API Routes', 'Local API', 'All routes', 'Dev server not running — start npm run dev');
  }

  // Phase 5
  console.log('\n🔗 Phase 5: Bridge & Execution\n');
  await runBridgeAudit(collector, options);
  await runExecutionAudit(collector);

  // Phase 6
  console.log('\n🛠️ Phase 6: Auxiliary Services\n');
  await runServicesAudit(collector);

  if (prerequisites.bridge) {
    await runSubprocessPhase(
      collector,
      'Phase 6: Auxiliary Services',
      'Scalping',
      'test-scalping-monitor',
      'npx',
      ['tsx', 'scripts/test-scalping-monitor.ts'],
      120_000
    );
  }

  // Phase 7
  console.log('\n🔬 Phase 7: Integration\n');
  await runSubprocessPhase(
    collector,
    'Phase 7: Integration',
    'Comprehensive audit',
    'comprehensive-system-audit',
    'npx',
    ['tsx', 'scripts/comprehensive-system-audit.ts'],
    600_000
  );

  await runSubprocessPhase(
    collector,
    'Phase 7: Integration',
    'Engine parity',
    'compare-scan-trade-engines',
    'npx',
    ['tsx', 'scripts/compare-scan-trade-engines.ts', options.symbol],
    300_000
  );

  if (options.deep) {
    await runSubprocessPhase(
      collector,
      'Phase 7: Integration',
      'Deep integration',
      'test-whole-system',
      'npx',
      ['tsx', 'scripts/test-whole-system.ts'],
      600_000
    );
    await runSubprocessPhase(
      collector,
      'Phase 7: Integration',
      'AI engine',
      'test-ai-engine',
      'npx',
      ['tsx', 'scripts/test-ai-engine.ts'],
      600_000
    );
  }

  // Backtest
  if (!options.skipBacktest) {
    console.log('\n📈 Phase 7b: Backtest\n');
    const offline = !prerequisites.bridge;
    await runSubprocessPhase(
      collector,
      'Phase 7: Integration',
      'Backtest',
      offline ? 'backtest-offline' : 'backtest-live',
      'npx',
      ['tsx', 'scripts/run-backtest-report.ts', ...(offline ? ['--offline'] : [])],
      600_000
    );
  } else {
    collector.skip('Phase 7: Integration', 'Backtest', 'Backtest report', '--skip-backtest');
  }

  const exitCode = collector.hasFailures() ? 1 : 0;
  const report = buildReport(startedAt, startMs, options, prerequisites, collector, exitCode);
  const { mdPath, jsonPath } = writeAuditReport(report, ROOT);

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.warning} warn, ${report.summary.skip} skip`);
  console.log(`Report: ${mdPath}`);
  console.log(`JSON:   ${jsonPath}`);
  console.log(`Exit:   ${exitCode}`);
  console.log('\nComplete Phase 9 manual checklist in AUDIT_REPORT.md');

  return exitCode;
}

function buildReport(
  startedAt: string,
  startMs: number,
  options: AuditOptions,
  prerequisites: AuditReport['prerequisites'],
  collector: AuditCollector,
  exitCode: number
): AuditReport {
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    options,
    prerequisites,
    results: collector.results,
    summary: collector.getSummary(),
    exitCode,
  };
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Audit crashed:', err);
    process.exit(1);
  });
