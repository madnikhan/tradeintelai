#!/usr/bin/env npx tsx
/**
 * Live Production Readiness & Accuracy Audit
 * Runs automated checks + generates LIVE_READINESS_REPORT.md with go/no-go verdict.
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { runChild } from './audit/run-child';
import { evaluateDemoReadiness } from '../lib/demo-readiness';
import { TRADING_RULES } from '../config/trading-rules';
import type { Trade } from '../types/trading';

config({ path: path.resolve(__dirname, '../.env.local') });

const ROOT = path.resolve(__dirname, '..');
const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')
  ? 'https://tradeintelai.vercel.app'
  : process.env.NEXT_PUBLIC_APP_URL ?? 'https://tradeintelai.vercel.app';

interface SectionResult {
  section: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'MANUAL';
  notes: string;
}

const results: SectionResult[] = [];

function add(section: string, status: SectionResult['status'], notes: string) {
  results.push({ section, status, notes });
}

async function ping(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; status: number; body?: unknown }> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const res = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : 'failed' };
  }
}

async function runAutomatedBaseline(): Promise<{ auditExit: number; validateExit: number }> {
  console.log('\n=== Phase 1: Automated baseline ===\n');
  const audit = await runChild('npm', ['run', 'audit:quick'], { cwd: ROOT, timeoutMs: 900_000, name: 'audit:quick' });
  add('Automated audit (audit:quick)', audit.exitCode === 0 ? 'PASS' : 'FAIL', `exit ${audit.exitCode}`);

  const validate = await runChild('npm', ['run', 'validate:production'], { cwd: ROOT, timeoutMs: 600_000, name: 'validate:production' });
  add('validate:production', validate.exitCode === 0 ? 'PASS' : 'FAIL', `exit ${validate.exitCode}`);

  return { auditExit: audit.exitCode, validateExit: validate.exitCode };
}

async function runTradeTabProxy(): Promise<void> {
  console.log('\n=== Phase 2: Trade tab (CLI proxy) ===\n');
  const compare = await runChild(
    'npx',
    ['tsx', 'scripts/compare-scan-trade-engines.ts', 'EURUSD'],
    { cwd: ROOT, timeoutMs: 300_000, name: 'compare-scan-trade' }
  );
  add('Trade/Scan engine parity (EURUSD)', compare.exitCode === 0 ? 'PASS' : 'FAIL', 'Scan vs Trade comparison');

  add('Trade tab — Gates 1-4 UI render', 'MANUAL', 'Analyze EURUSD in browser with chart visible');
  add('Trade tab — demo execute 0.01 lot', 'MANUAL', 'Execute from Trade/Scan if executable; confirm MT5 order');
  add('Position Watch SL/TP tracking', 'MANUAL', 'Keep dashboard tab open after execute');
}

async function runScanTabProxy(): Promise<void> {
  console.log('\n=== Phase 3: Scan tab (CLI proxy) ===\n');
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD'];
  let executable = 0;
  let scanned = 0;
  const { GatedEngineAdapter } = await import('../lib/gated-engine-adapter');
  const adapter = new GatedEngineAdapter();
  for (const sym of symbols) {
    try {
      const a = await adapter.analyzeMarket(sym, []);
      scanned++;
      if (a.gateStatus?.executionPermitted && a.recommendation !== 'HOLD') executable++;
      console.log(`  ${sym}: ${a.recommendation} executable=${a.gateStatus?.executionPermitted ?? false}`);
    } catch (e) {
      console.log(`  ${sym}: error ${e instanceof Error ? e.message : e}`);
    }
  }
  add(
    'Scan major pairs (6 forex/metals)',
    scanned === symbols.length ? 'PASS' : 'WARN',
    `${executable}/${scanned} executable — verify badges in Scan tab UI`
  );
}

async function runSettingsProxy(): Promise<void> {
  console.log('\n=== Phase 5: Settings & alerts (API proxy) ===\n');
  const bridge = await ping('http://localhost:8080/health?quick=1');
  add('HealthCheck — MT5 bridge', bridge.ok ? 'PASS' : 'FAIL', `HTTP ${bridge.status}`);

  const geminiLocal = await ping('http://localhost:3000/api/gemini/health');
  add(
    'HealthCheck — Gemini proxy',
    geminiLocal.ok || geminiLocal.status === 429 ? 'PASS' : 'WARN',
    geminiLocal.status === 429 ? 'Rate limited but reachable' : `HTTP ${geminiLocal.status}`
  );

  const openaiLocal = await ping('http://localhost:3000/api/openai/health');
  add('HealthCheck — OpenAI proxy', openaiLocal.ok ? 'PASS' : 'FAIL', `HTTP ${openaiLocal.status}`);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    add('Telegram bot token', 'PASS', 'Configured locally');
  } else {
    add('Telegram bot token', 'SKIP', 'Not in .env.local');
  }

  add('Scalping panel UI toggle', 'MANUAL', 'Settings → Scalping — verify toggle on demo only');
  add('Islamic panel swap window', 'MANUAL', 'Settings → Islamic — verify countdown');
  add('Telegram trade-executed on execute', 'MANUAL', 'Execute demo trade → check DM + channel');
  add('Mobile approve deep link', 'MANUAL', 'Open ?approve=1&symbol=EURUSD&tab=trade on dashboard');
}

async function runBacktestInvestigation(): Promise<void> {
  console.log('\n=== Backtest investigation ===\n');
  const inv = await runChild('npx', ['tsx', 'scripts/investigate-backtest.ts', 'EURUSD', '2'], {
    cwd: ROOT,
    timeoutMs: 300_000,
    name: 'investigate-backtest',
  });
  add(
    'Backtest signal sampling (Gate 1-4 on EURUSD)',
    inv.exitCode === 0 ? 'PASS' : 'WARN',
    inv.exitCode === 0 ? 'At least one executable sample' : 'All samples HOLD/blocked — expected without chart/GPT'
  );

  const bt = await runChild('npx', ['tsx', 'scripts/run-backtest-report.ts'], {
    cwd: ROOT,
    timeoutMs: 300_000,
    name: 'backtest-report',
  });
  add('30-day backtest report', bt.exitCode === 0 ? 'PASS' : 'WARN', 'See reports/backtest-report.md — 0 trades = strict gates, not infra failure');
}

async function runProductionEnvChecks(): Promise<void> {
  console.log('\n=== Phase 6: Production environment ===\n');

  const prodGemini = await ping(`${PRODUCTION_URL}/api/gemini/health`);
  add('Production /api/gemini/health', prodGemini.ok || prodGemini.status === 429 ? 'PASS' : 'WARN', `${PRODUCTION_URL} HTTP ${prodGemini.status}`);

  const prodOpenai = await ping(`${PRODUCTION_URL}/api/openai/health`);
  add('Production /api/openai/health', prodOpenai.ok ? 'PASS' : 'FAIL', `HTTP ${prodOpenai.status}`);

  const webhook = await ping(`${PRODUCTION_URL}/api/telegram/webhook`, 8000);
  // POST would need secret; GET may 405 — check deployment exists
  add(
    'Production Telegram webhook route',
    webhook.status === 405 || webhook.status === 403 || webhook.status === 200 ? 'PASS' : 'WARN',
    `HTTP ${webhook.status} (405/403 expected without POST body)`
  );

  add('Production tunnel bridge URL', 'MANUAL', 'Dashboard bridge_url must point to cloudflared/ngrok, not localhost');
  add('Stripe subscription flow', 'MANUAL', 'Test checkout on production with test card');
}

function evaluateDemoGoals(): void {
  console.log('\n=== Phase 4: Demo success goals (current) ===\n');
  const trades: Trade[] = [];
  const initial = 10_000;
  const current = 10_000;
  const readiness = evaluateDemoReadiness(trades, initial, current);
  add('Demo → Live readiness', readiness.ready ? 'PASS' : 'FAIL', readiness.failures.join('; ') || 'No trades logged in CLI audit');
  for (const g of readiness.goals) {
    add(`  Goal: ${g.label}`, g.met ? 'PASS' : 'FAIL', `${g.current} (target ${g.target})`);
  }
}

function deriveVerdict(): { tier: string; liveManual: string; liveAuto: string; demoTest: string } {
  const fails = results.filter((r) => r.status === 'FAIL');
  const demoReady = results.find((r) => r.section === 'Demo → Live readiness')?.status === 'PASS';

  const infraOk = !results.some(
    (r) => r.status === 'FAIL' && (r.section.includes('audit') || r.section.includes('bridge') || r.section.includes('validate'))
  );

  return {
    tier: infraOk ? 'Infrastructure APPROVED' : 'Infrastructure NEEDS FIX',
    demoTest: infraOk ? 'CONDITIONALLY APPROVED — complete MANUAL items in report' : 'NOT APPROVED — fix FAIL items first',
    liveManual: demoReady ? 'APPROVED for smallest manual live test (0.01 lot)' : 'NOT APPROVED — complete 2–4 week demo track first',
    liveAuto: 'NOT APPROVED — semi-manual system; requires human Execute + open browser for Position Watch',
  };
}

function writeReport(verdict: ReturnType<typeof deriveVerdict>): string {
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(reportsDir, `live-readiness-${stamp}.md`);
  const latestPath = path.join(ROOT, 'LIVE_READINESS_REPORT.md');

  const lines: string[] = [];
  lines.push('# Live Production Readiness Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Executive verdict');
  lines.push('');
  lines.push(`| Tier | Status |`);
  lines.push(`|------|--------|`);
  lines.push(`| Infrastructure | ${verdict.tier} |`);
  lines.push(`| Demo manual testing | ${verdict.demoTest} |`);
  lines.push(`| Live manual (0.01 lot) | ${verdict.liveManual} |`);
  lines.push(`| Live autotrading | ${verdict.liveAuto} |`);
  lines.push('');
  lines.push('## Section results');
  lines.push('');
  lines.push('| Section | Status | Notes |');
  lines.push('|---------|--------|-------|');
  for (const r of results) {
    lines.push(`| ${r.section} | ${r.status} | ${r.notes.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  lines.push('## Manual checklist (browser required)');
  lines.push('');
  lines.push('| # | Action | Result |');
  lines.push('|---|--------|--------|');
  const manual = [
    'Sign in — dashboard loads',
    'SystemStatus — all header dots green',
    'Trade tab — Gates 1–4 render for EURUSD',
    'Execute 0.01 demo lot — MT5 confirms order',
    'Position Watch — tracks SL/TP with tab open',
    'Scan tab — executable badges match Gate 4',
    'Performance — Demo Success Goals visible',
    'Settings — Scalping/Islamic/Telegram panels',
  ];
  manual.forEach((m, i) => lines.push(`| ${i + 1} | ${m} | _user to confirm_ |`));
  lines.push('');
  lines.push('## Live gate review');
  lines.push('');
  if (verdict.liveManual.startsWith('NOT')) {
    lines.push('**Live manual test: NOT APPROVED** until Demo Success Goals are met (see Performance tab).');
    lines.push('');
    lines.push('Required before live:');
    lines.push(`- ${TRADING_RULES.MIN_CLOSED_TRADES_FOR_LIVE}+ closed demo trades`);
    lines.push(`- ${(TRADING_RULES.MIN_WIN_RATE * 100).toFixed(0)}%+ win rate`);
    lines.push(`- Profit factor > ${TRADING_RULES.MIN_PROFIT_FACTOR}`);
    lines.push(`- Max drawdown < ${(TRADING_RULES.MAX_DRAWDOWN * 100).toFixed(0)}%`);
    lines.push(`- ${TRADING_RULES.MIN_CONSECUTIVE_WEEKS} consecutive profitable weeks`);
    lines.push(`- ${TRADING_RULES.MIN_RESOLVED_ANALYSES}+ resolved gated analyses`);
  } else {
    lines.push('**Live manual test: APPROVED** — proceed with 0.01 lot, one pair, Position Watch open.');
  }
  lines.push('');
  lines.push('**Live autotrading: NOT APPROVED** — system requires dashboard Execute; do not enable Scalping on live until 2+ stable demo weeks.');

  const md = lines.join('\n');
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(latestPath, md);
  return mdPath;
}

async function main(): Promise<number> {
  console.log('Live Production Readiness & Accuracy Audit');
  console.log('='.repeat(50));

  await runAutomatedBaseline();
  await runTradeTabProxy();
  await runScanTabProxy();
  evaluateDemoGoals();
  await runSettingsProxy();
  await runBacktestInvestigation();
  await runProductionEnvChecks();

  const verdict = deriveVerdict();
  const reportPath = writeReport(verdict);

  console.log('\n' + '='.repeat(50));
  console.log('VERDICT');
  console.log(`  Infrastructure: ${verdict.tier}`);
  console.log(`  Demo testing:   ${verdict.demoTest}`);
  console.log(`  Live manual:    ${verdict.liveManual}`);
  console.log(`  Live autotrade: ${verdict.liveAuto}`);
  console.log(`\nReport: ${reportPath}`);
  console.log(`Also:   ${path.join(ROOT, 'LIVE_READINESS_REPORT.md')}`);

  const hasFail = results.some((r) => r.status === 'FAIL' && !r.section.startsWith('  Goal'));
  return hasFail ? 1 : 0;
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
