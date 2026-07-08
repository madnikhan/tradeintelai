import type { AuditCollector, AuditOptions } from './types';

async function ping(
  baseUrl: string,
  path: string,
  timeoutMs = 15_000
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export async function runApiHealthAudit(collector: AuditCollector, options: AuditOptions): Promise<void> {
  const phase = 'Phase 4: API Routes';
  const category = 'Local API';

  if (!options.devServerUrl) {
    collector.skip(phase, category, 'All API routes', 'Dev server not running');
    return;
  }

  const base = options.devServerUrl;

  await collector.runTest(phase, category, 'GET /api/gemini/health', async () => {
    const r = await ping(base, '/api/gemini/health');
    if (r.status === 429) return { rateLimited: true, note: 'Quota exceeded — server reachable' };
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.body;
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'GET /api/openai/health', async () => {
    const r = await ping(base, '/api/openai/health');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.body;
  });

  await collector.runTest(phase, category, 'GET /api/health/tradingeconomics', async () => {
    const r = await ping(base, '/api/health/tradingeconomics');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.body;
  });

  await collector.runTest(phase, category, 'GET /api/cot/data?symbol=EURUSD', async () => {
    const r = await ping(base, '/api/cot/data?symbol=EURUSD', 20_000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { status: r.status, hasData: r.body != null };
  });

  await collector.runTest(
    phase,
    category,
    'GET /api/proxy/twelve-data',
    async () => {
      const r = await ping(
        base,
        '/api/proxy/twelve-data?symbol=EUR/USD&interval=1h&outputsize=5',
        20_000
      );
      if (r.status === 429) return { rateLimited: true };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.body;
    },
    { warnOnFail: true }
  );

  await collector.runTest(phase, category, 'GET /api/test/calendar-parsers', async () => {
    const r = await ping(base, '/api/test/calendar-parsers', 30_000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.body;
  });

  await collector.runTest(phase, category, 'GET /api/test/cot-parsers', async () => {
    const r = await ping(base, '/api/test/cot-parsers', 30_000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.body;
  });

  if (process.env.AUDIT_FIREBASE_ID_TOKEN) {
    await collector.runTest(phase, category, 'GET /api/telegram/status (auth)', async () => {
      const r = await fetch(`${base}/api/telegram/status`, {
        headers: { Authorization: `Bearer ${process.env.AUDIT_FIREBASE_ID_TOKEN}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    });
  } else {
    collector.skip(phase, category, 'Protected routes (Firebase token)', 'Set AUDIT_FIREBASE_ID_TOKEN to test');
  }
}
