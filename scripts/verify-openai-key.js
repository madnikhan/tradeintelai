#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

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
  };
}

const rawKey = process.env.OPENAI_API_KEY;
const key = rawKey?.trim()?.replace(/^["']|["']$/g, '');

if (!key) {
  console.error('❌ OPENAI_API_KEY is missing in .env.local');
  process.exit(1);
}

const fp = getFingerprint(rawKey);
console.log('Key fingerprint:', fp);
console.log(`Checking OpenAI key (suffix …${fp.suffix})`);

fetch('https://api.openai.com/v1/models', {
  headers: { Authorization: `Bearer ${key}` },
})
  .then(async (res) => {
    const text = await res.text();
    if (res.ok) {
      console.log('✅ OpenAI accepted this API key (status 200)');
      process.exit(0);
    }
    let msg = `HTTP ${res.status}`;
    try {
      const data = JSON.parse(text);
      msg = data?.error?.message || msg;
    } catch {
      if (text) msg = text.slice(0, 500);
    }
    console.error('❌ OpenAI rejected the key');
    console.error('   Status:', res.status);
    console.error('   Message:', msg);
    if (res.status === 429) {
      console.error('   Note: 429 = quota/rate limit (key may still be valid)');
    }
    process.exit(res.status === 429 ? 2 : 1);
  })
  .catch((err) => {
    console.error('❌ Network error:', err.message);
    process.exit(1);
  });
