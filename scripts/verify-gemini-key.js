#!/usr/bin/env node
/**
 * Verify GEMINI_API_KEY from .env.local (key is never printed in full).
 * Usage: npm run verify:gemini
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

function getFingerprint(key) {
  if (!key?.trim()) return null;
  const trimmed = key.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return {
    length: unquoted.length,
    prefix: unquoted.slice(0, 7),
    suffix: unquoted.slice(-4),
    hasQuotes: trimmed !== unquoted,
    hasWhitespace: /\s/.test(unquoted),
  };
}

function countDuplicateKeyLines() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return 0;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  return lines.filter((line) => /^\s*GEMINI_API_KEY\s*=/.test(line)).length;
}

const rawKey = process.env.GEMINI_API_KEY;
const key = rawKey?.trim()?.replace(/^["']|["']$/g, '');
const duplicateLines = countDuplicateKeyLines();
const model = process.env.GEMINI_MODEL_TEXT?.trim() || 'gemini-2.0-flash';

if (!key) {
  console.error('❌ GEMINI_API_KEY is missing in .env.local');
  console.error('   Get a key at https://aistudio.google.com/apikey');
  process.exit(1);
}

const fp = getFingerprint(rawKey);
console.log('Key fingerprint:', fp);
if (duplicateLines > 1) {
  console.warn(`⚠️  Found ${duplicateLines} GEMINI_API_KEY lines in .env.local — only the last one is used`);
}

console.log(`Checking key (model: ${model}, suffix …${fp.suffix})`);

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(key);

genAI
  .getGenerativeModel({ model })
  .generateContent('Reply with exactly: OK')
  .then((result) => {
    const text = result.response.text()?.trim();
    if (text) {
      console.log('✅ Gemini accepted this API key');
      process.exit(0);
    }
    console.error('❌ Gemini returned empty response');
    process.exit(1);
  })
  .catch((err) => {
    const isQuota = err.message?.includes('429') || err.message?.toLowerCase().includes('quota');
    console.error('❌ Gemini rejected the key');
    console.error('   Message:', err.message);
    console.error('   Your .env.local suffix:', fp.suffix);
    if (isQuota) {
      console.error('   Note: 429 = quota exceeded (key may still be valid). Use Auto mode or OpenAI.');
      process.exit(2);
    }
    console.error('');
    console.error('   Fix: https://aistudio.google.com/apikey');
    console.error('   • .env.local: GEMINI_API_KEY=AIza... (no quotes, single line)');
    console.error('   • Restart: npm run dev');
    process.exit(1);
  });
