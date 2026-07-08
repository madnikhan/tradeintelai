#!/usr/bin/env npx tsx
/**
 * Smoke test bridge watchdog endpoints (bridge must be running).
 */
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.resolve(__dirname, '../.env.local') });

const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:8080';

async function main() {
  console.log('Bridge watchdog test:', bridgeUrl);

  const health = await fetch(`${bridgeUrl}/health?quick=1`);
  console.log('health:', health.status, await health.json().catch(() => ({})));

  const statusRes = await fetch(`${bridgeUrl}/watch/status`);
  console.log('watch/status:', statusRes.status);
  if (statusRes.ok) {
    const data = await statusRes.json();
    console.log('  watches:', (data.watches ?? []).length);
    console.log('  config.enabled:', data.config?.enabled);
  } else if (statusRes.status === 401) {
    console.log('  (auth required — pair bridge first)');
  }

  const configRes = await fetch(`${bridgeUrl}/watch/config`);
  console.log('watch/config GET:', configRes.status);

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
