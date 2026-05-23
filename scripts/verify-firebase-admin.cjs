#!/usr/bin/env node
/**
 * Verify Firebase Admin service account can reach Firestore.
 * Usage: npm run verify:firebase-admin
 */

const fs = require('fs');
const path = require('path');

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

function loadServiceAccount() {
  const jsonPath = path.join(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(jsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  }

  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('No firebase-service-account.json or .env.local found');
    process.exit(1);
  }

  const env = parseEnvFile(envPath);
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY missing in .env.local');
    process.exit(1);
  }

  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

async function main() {
  const sa = loadServiceAccount();
  console.log(`Project: ${sa.project_id}`);
  console.log(`Client: ${sa.client_email}`);

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
  }

  try {
    await admin.firestore().doc('users/_verify/subscription/current').get();
    console.log('✅ Firestore Admin OK — service account is valid');
    process.exit(0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Firestore Admin FAILED:', msg.split('\n')[0]);
    console.error('\nFix: Firebase Console → Project Settings → Service accounts');
    console.error('→ Generate new private key → save as firebase-service-account.json');
    console.error('→ npm run vercel:env-sync (or paste JSON into Vercel FIREBASE_SERVICE_ACCOUNT_KEY)');
    process.exit(1);
  }
}

main();
