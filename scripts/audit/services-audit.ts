import { ScalpingService } from '../../lib/scalping-service';
import { IslamicTradingService } from '../../lib/islamic-trading-service';
import { PositionWatchService } from '../../lib/position-watch-service';
import type { AuditCollector } from './types';

export async function runServicesAudit(collector: AuditCollector): Promise<void> {
  const phase = 'Phase 6: Services';
  const category = 'Auxiliary Services';

  await collector.runTest(phase, category, 'ScalpingService config', async () => {
    const config = ScalpingService.getConfig();
    if (config.takeProfitAmount <= 0) throw new Error('Invalid takeProfitAmount');
    const stats = ScalpingService.getStatistics();
    return { config, stats };
  });

  await collector.runTest(phase, category, 'IslamicTradingService swap window', async () => {
    const config = IslamicTradingService.getConfig();
    const until = IslamicTradingService.getTimeUntilClose();
    if (until.hours < 0 || until.minutes < 0) throw new Error('Invalid time until close');
    return { config, until };
  });

  await collector.runTest(phase, category, 'PositionWatchService register/stop', async () => {
    const before = PositionWatchService.getWatches().length;
    const watch = PositionWatchService.register({
      symbol: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.085,
      stopLoss: 1.08,
      takeProfit: 1.09,
      source: 'manual',
    });
    PositionWatchService.stop(watch.id);
    const after = PositionWatchService.getWatches().length;
    if (after !== before) throw new Error(`Watch count changed: ${before} -> ${after}`);
    return { registered: watch.id };
  });

  await collector.runTest(phase, category, 'Alert mode localStorage keys', async () => {
    return {
      note: 'Alert mode is browser-only (useAlertModeService); keys: alert_mode_enabled',
      keys: ['alert_mode_enabled', 'alert_mode_last_sent'],
    };
  });
}
