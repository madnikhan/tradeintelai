import * as net from 'net';
import type { AuditOptions, PrerequisitesResult } from './types';

const REQUIRED_ENV = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

const OPTIONAL_ENV = ['FIREBASE_SERVICE_ACCOUNT_PATH', 'TELEGRAM_BOT_TOKEN'] as const;

async function fetchOk(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status?: number; body?: unknown; reachable?: boolean }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    // Any HTTP response means the server is up (429 rate limit still counts)
    return { ok: res.ok, status: res.status, body, reachable: true };
  } catch {
    return { ok: false, reachable: false };
  }
}

function tcpConnect(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

export async function checkPrerequisites(options: AuditOptions): Promise<PrerequisitesResult> {
  const issues: string[] = [];
  const details: Record<string, string> = {};

  for (const key of REQUIRED_ENV) {
    if (!process.env[key]?.trim()) {
      issues.push(`Missing env: ${key}`);
      details[key] = 'missing';
    } else {
      details[key] = 'ok';
    }
  }

  for (const key of OPTIONAL_ENV) {
    details[key] = process.env[key]?.trim() ? 'ok' : 'optional-missing';
  }

  const bridgeHealth = await fetchOk(`${options.bridgeUrl}/health?quick=1`, 10_000);
  const bridge = bridgeHealth.ok;
  details.bridge = bridge ? 'reachable' : 'down';
  if (!bridge) {
    issues.push(`MT5 bridge not reachable at ${options.bridgeUrl} — run: npm run bridge`);
  }

  const devHealth = await fetchOk(`${options.devServerUrl}/api/gemini/health`, 8000);
  const devServer = devHealth.reachable === true;
  details.devServer = devServer ? `reachable (HTTP ${devHealth.status ?? '?'})` : 'down';
  if (!devServer) {
    const msg = `Next.js dev server not reachable at ${options.devServerUrl} — run: npm run dev`;
    if (options.requireDevServer) {
      issues.push(msg);
    } else {
      details.devServerHint = msg;
    }
  }

  const wsHost = new URL(options.bridgeUrl.replace(/^ws/, 'http')).hostname;
  const websocket = await tcpConnect(wsHost, 8081);
  details.websocket = websocket ? 'port-open' : 'optional-down';

  const env = issues.filter((i) => i.startsWith('Missing env')).length === 0;

  return {
    env,
    bridge,
    devServer,
    websocket,
    issues,
    details,
  };
}

export function prerequisitesBlockAudit(prereq: PrerequisitesResult, requireDevServer: boolean): boolean {
  if (!prereq.env) return true;
  if (!prereq.bridge) return true;
  if (requireDevServer && !prereq.devServer) return true;
  return false;
}
