import { HTTPBridgeConnector } from '../../lib/http-bridge-connector';
import type { AuditCollector, AuditOptions } from './types';

export async function runBridgeAudit(collector: AuditCollector, options: AuditOptions): Promise<void> {
  const phase = 'Phase 5: Bridge';
  const category = 'MT5 Bridge';
  const bridge = new HTTPBridgeConnector();

  await collector.runTest(phase, category, 'Bridge connect /health', async () => {
    const ok = await bridge.connect();
    if (!ok) throw new Error(`Cannot connect to ${options.bridgeUrl}`);
    return { connected: true };
  });

  await collector.runTest(phase, category, 'Bridge /account', async () => {
    const account = await bridge.getAccountInfo();
    if (!account) throw new Error('No account data');
    const balance = Number(account.balance ?? account.Balance ?? 0);
    const server = account.server ?? account.Server ?? account.company;
    if (balance <= 0) throw new Error(`Balance is ${balance} — expected > 0`);
    if (!server) throw new Error('Missing server name');
    return { balance, server };
  });

  await collector.runTest(phase, category, 'Bridge /positions', async () => {
    const positions = await bridge.getPositions();
    return { count: Array.isArray(positions) ? positions.length : 0 };
  });

  if (options.liveTrade) {
    collector.skip(phase, category, 'Live demo trade', 'Use manual Phase 9 checklist — live trade requires UI confirmation');
  }
}
