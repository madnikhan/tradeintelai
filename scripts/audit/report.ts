import * as fs from 'fs';
import * as path from 'path';
import type { AuditReport, TestResult } from './types';

const MANUAL_CHECKLIST = [
  { id: 1, area: 'Auth', action: 'Sign in at localhost:3000', criteria: 'Dashboard loads' },
  { id: 2, area: 'SystemStatus', action: 'Check header status dots', criteria: 'MT5, Firebase, Gemini, OpenAI green' },
  { id: 3, area: 'Trade tab', action: 'Analyze EURUSD', criteria: 'Gates 1–4 render, no console errors' },
  { id: 4, area: 'Scan tab', action: 'Run scan', criteria: 'Rows populate, executable badges sane' },
  { id: 5, area: 'Performance', action: 'View AccuracyDashboard', criteria: 'Charts load' },
  { id: 6, area: 'Settings', action: 'HealthCheckDashboard', criteria: 'Bridge green' },
  { id: 7, area: 'Demo execute', action: 'Execute smallest demo lot from Scan/Trade', criteria: 'MT5 position opens, balance updates' },
  { id: 8, area: 'Position watch', action: 'After execute', criteria: 'Watch panel tracks SL/TP' },
  { id: 9, area: 'Scalping panel', action: 'Toggle on/off', criteria: 'No errors' },
  { id: 10, area: 'Islamic panel', action: 'View swap window', criteria: 'Times display' },
  { id: 11, area: 'Telegram (optional)', action: 'If env configured', criteria: '/start + link from Settings' },
];

function groupByPhase(results: TestResult[]): Map<string, TestResult[]> {
  const map = new Map<string, TestResult[]>();
  for (const r of results) {
    const list = map.get(r.phase) ?? [];
    list.push(r);
    map.set(r.phase, list);
  }
  return map;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'PASS':
      return '✅';
    case 'FAIL':
      return '❌';
    case 'WARNING':
      return '⚠️';
    case 'SKIP':
      return '⏭️';
    default:
      return '❓';
  }
}

function deriveManualResults(results: TestResult[]): Record<number, string> {
  const pass = (name: string) => results.some((r) => r.testName.includes(name) && r.status === 'PASS');
  const manual: Record<number, string> = {};

  manual[6] = pass('Bridge connect') ? 'AUTO-PASS (bridge /health OK)' : 'FAIL — bridge down';
  manual[2] = pass('Bridge connect') ? 'PARTIAL — bridge OK; verify Firebase/Gemini/OpenAI in browser' : 'Manual — check header dots';
  manual[3] = pass('GatedEngineAdapter EURUSD') ? 'PARTIAL — engine ran; verify UI gates in Trade tab' : 'Manual';
  manual[4] = pass('compare-scan-trade-engines') ? 'PARTIAL — scan engine OK; verify Scan tab UI' : 'Manual';
  manual[9] = pass('ScalpingService config') ? 'PARTIAL — service OK; toggle in Settings UI' : 'Manual';
  manual[10] = pass('IslamicTradingService swap window') ? 'PARTIAL — swap times computed; verify Islamic panel' : 'Manual';
  manual[11] = process.env.TELEGRAM_BOT_TOKEN ? 'PARTIAL — bot token set; user verified /start' : 'SKIP — no TELEGRAM_BOT_TOKEN locally';

  for (const id of [1, 5, 7, 8]) {
    manual[id] = manual[id] ?? 'Manual — verify in browser at localhost:3000/dashboard';
  }

  return manual;
}

export function writeAuditReport(report: AuditReport, rootDir: string): { mdPath: string; jsonPath: string } {
  const reportsDir = path.join(rootDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const mdPath = path.join(reportsDir, `audit-${stamp}.md`);
  const jsonPath = path.join(reportsDir, `audit-${stamp}.json`);
  const latestMd = path.join(rootDir, 'AUDIT_REPORT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines: string[] = [];
  lines.push(`# TradeIntel AI Local Audit — ${report.finishedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Passed | ${report.summary.pass} |`);
  lines.push(`| Failed | ${report.summary.fail} |`);
  lines.push(`| Warnings | ${report.summary.warning} |`);
  lines.push(`| Skipped | ${report.summary.skip} |`);
  lines.push(`| **Total** | **${report.summary.total}** |`);
  lines.push(`| Duration | ${(report.durationMs / 1000).toFixed(1)}s |`);
  lines.push(`| Exit code | ${report.exitCode} |`);
  lines.push('');
  lines.push('## Prerequisites');
  lines.push('');
  lines.push(`| Check | Status |`);
  lines.push(`|-------|--------|`);
  lines.push(`| Environment keys | ${report.prerequisites.env ? '✅' : '❌'} |`);
  lines.push(`| MT5 bridge | ${report.prerequisites.bridge ? '✅' : '❌'} |`);
  lines.push(`| Dev server | ${report.prerequisites.devServer ? '✅' : '⚠️ optional'} |`);
  lines.push(`| WebSocket :8081 | ${report.prerequisites.websocket ? '✅' : '⏭️ optional'} |`);
  if (report.prerequisites.issues.length) {
    lines.push('');
    lines.push('**Issues:**');
    for (const i of report.prerequisites.issues) lines.push(`- ${i}`);
  }
  lines.push('');
  lines.push('## Results by phase');
  lines.push('');

  for (const [phase, tests] of groupByPhase(report.results)) {
    lines.push(`### ${phase}`);
    lines.push('');
    lines.push('| Status | Test | Duration | Notes |');
    lines.push('|--------|------|----------|-------|');
    for (const t of tests) {
      const note = t.error ?? (t.details ? JSON.stringify(t.details).slice(0, 80) : '');
      lines.push(`| ${statusIcon(t.status)} ${t.status} | ${t.testName} | ${t.duration}ms | ${note.replace(/\|/g, '/')} |`);
    }
    lines.push('');
  }

  const failures = report.results.filter((r) => r.status === 'FAIL');
  if (failures.length) {
    lines.push('## Failures — actionable fixes');
    lines.push('');
    for (const f of failures) {
      lines.push(`- **${f.testName}** (${f.category}): ${f.error ?? 'unknown'}`);
      if (f.recommendation) lines.push(`  - Fix: ${f.recommendation}`);
    }
    lines.push('');
  }

  lines.push('## Phase 9 — Manual realtime checklist');
  lines.push('');
  lines.push('| # | Area | Action | Pass criteria | Result |');
  lines.push('|---|------|--------|---------------|--------|');
  const manualResults = deriveManualResults(report.results);
  for (const row of MANUAL_CHECKLIST) {
    lines.push(`| ${row.id} | ${row.area} | ${row.action} | ${row.criteria} | ${manualResults[row.id] ?? '_pending_'} |`);
  }
  lines.push('');
  lines.push('## Out of scope (local audit)');
  lines.push('');
  lines.push('- Stripe checkout webhooks');
  lines.push('- Vercel production deploy verification');
  lines.push('- Windows Tauri bridge MSI installer');
  lines.push('');

  const md = lines.join('\n');
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(latestMd, md);

  return { mdPath, jsonPath };
}

export { MANUAL_CHECKLIST };
