#!/usr/bin/env node
/**
 * Bulk sync .env.local → Vercel environment variables.
 *
 * Prerequisites:
 *   vercel login
 *   vercel link --project tradeintelai --yes
 *
 * Usage:
 *   npm run vercel:env-sync
 *   npm run vercel:env-sync -- --dry-run
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const PROJECT_FILE = path.join(ROOT, '.vercel', 'project.json');

const SKIP = new Set([
  'VERCEL_OIDC_TOKEN',
  'VERCEL_TOKEN',
  'VERCEL_PROJECT_ID',
  'VERCEL_ORG_ID',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
]);

const SKIP_PRODUCTION = new Set(['SUBSCRIPTION_SKIP_IN_DEV']);

// Default production-only to avoid duplicate Preview/Production rows in Vercel UI.
// Use VERCEL_ENV_TARGETS=production,preview if you need both.
const TARGETS = (process.env.VERCEL_ENV_TARGETS || 'production')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const dryRun = process.argv.includes('--dry-run');
const token = process.env.VERCEL_TOKEN?.trim();

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    env[key] = value;
  }

  return env;
}

function vercelArgs(extra) {
  const args = [...extra];
  if (token) args.push('-t', token);
  return args;
}

function runVercel(args, input = '') {
  if (dryRun) return { status: 0, stdout: '', stderr: '' };
  return spawnSync('vercel', vercelArgs(args), {
    cwd: ROOT,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function ensureAuth() {
  if (dryRun) return;
  const whoami = runVercel(['whoami']);
  const account = (whoami.stdout || '').trim();
  if (whoami.status !== 0 || !account) {
    console.error('Not logged in. Run: vercel login');
    process.exit(1);
  }
  console.log(`Vercel account: ${account}`);
}

function ensureLinked() {
  if (dryRun) return;

  if (!fs.existsSync(PROJECT_FILE)) {
    console.error(
      'Project not linked.\n\nRun:\n  vercel link --project tradeintelai --yes\n\nWarning: back up .env.local first — link may overwrite it.'
    );
    process.exit(1);
  }

  const probe = runVercel(['env', 'ls', 'production']);
  const out = `${probe.stdout || ''}\n${probe.stderr || ''}`;
  if (
    probe.status !== 0 ||
    out.includes("isn't linked") ||
    out.includes('deleted, transferred') ||
    out.includes("don't have access")
  ) {
    console.error(
      'Stale or invalid Vercel link.\n\nRun:\n  vercel link --project tradeintelai --yes\n\nWarning: back up .env.local first — link may overwrite it.'
    );
    process.exit(1);
  }

  const project = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
  console.log(`Linked project: ${project.projectName} (${project.projectId})\n`);
}

function loadVars() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error('Missing .env.local');
  }

  const vars = parseEnvFile(ENV_FILE);

  if (!vars.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const saPath = path.join(ROOT, 'firebase-service-account.json');
    if (fs.existsSync(saPath)) {
      vars.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8').trim();
    }
  } else {
    try {
      const parsed = JSON.parse(vars.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      vars.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(parsed);
    } catch {
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — sync may fail');
    }
  }

  if (!vars.NEXT_PUBLIC_APP_URL || vars.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    vars.NEXT_PUBLIC_APP_URL = 'https://tradeintelai.vercel.app';
    console.log('Using NEXT_PUBLIC_APP_URL=https://tradeintelai.vercel.app for Vercel');
  }

  return vars;
}

function syncVar(key, value, target) {
  const isPublic = key.startsWith('NEXT_PUBLIC_');
  // Vercel Hobby: sensitive secrets cannot target "development" — use production/preview only
  const sensitive = !isPublic && target !== 'development';
  const args = ['env', 'add', key, target, '--force', '-y'];
  if (sensitive) args.push('--sensitive');

  if (dryRun) {
    console.log(`[dry-run] ${key} → ${target} (${value.length} chars)`);
    return true;
  }

  const result = runVercel(args, value);
  if (result.status === 0) {
    console.log(`✓ ${key} → ${target}`);
    return true;
  }

  const err = (result.stderr || result.stdout || 'Unknown error').trim();
  const line = err.split('\n').find((l) => l.startsWith('Error:')) || err.split('\n').pop();
  console.error(`✗ ${key} → ${target}: ${line}`);
  return false;
}

function main() {
  ensureAuth();
  ensureLinked();

  const vars = loadVars();
  const keys = Object.keys(vars).filter((k) => !SKIP.has(k) && vars[k]);

  console.log(`Syncing ${keys.length} variables to: ${TARGETS.join(', ')}\n`);

  let ok = 0;
  let fail = 0;

  for (const key of keys.sort()) {
    for (const target of TARGETS) {
      if (target === 'production' && SKIP_PRODUCTION.has(key)) {
        console.log(`⊘ skip ${key} on production (dev-only)`);
        continue;
      }
      if (syncVar(key, vars[key], target)) ok++;
      else fail++;
    }
  }

  if (vars.STRIPE_PRICE_ID?.startsWith('prod_')) {
    console.log(
      '\n⚠️  STRIPE_PRICE_ID looks like a Product ID (prod_...). Use a Price ID (price_...) from Stripe Dashboard.'
    );
  }

  console.log(`\nDone: ${ok} synced, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
