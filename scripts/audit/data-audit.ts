import { MT5PriceDataProvider } from '../../lib/data-providers/mt5-price-data';
import { TwelveDataProvider } from '../../lib/data-providers/twelve-data';
import { TradingEconomicsIndicatorsProvider } from '../../lib/data-providers/tradingeconomics-indicators';
import { COTDataProvider } from '../../lib/data-providers/cot-data';
import { COTAnalyzer } from '../../lib/cot-analyzer';
import { EconomicCalendar } from '../../lib/economic-calendar';
import { TradingHoursFilter } from '../../lib/trading-hours';
import type { AuditCollector } from './types';

function validOhlc(data: { open: number; high: number; low: number; close: number }[]): boolean {
  return data.every((b) => b.high >= b.low && b.open > 0 && b.close > 0);
}

export async function runDataAudit(collector: AuditCollector, symbol: string): Promise<void> {
  const phase = 'Phase 2: Data Layer';
  const category = 'Data Providers';

  await collector.runTest(
    phase,
    category,
    'MT5 OHLC',
    async () => {
      try {
        const data = await MT5PriceDataProvider.getHistoricalData(symbol, 'H1', 100);
        if (data.length < 50) throw new Error(`Only ${data.length} bars`);
        if (!validOhlc(data)) throw new Error('Invalid OHLC values');
        return { source: 'MT5', count: data.length };
      } catch (mt5Err) {
        const data = await TwelveDataProvider.getHistoricalData(symbol, '1h', 100);
        if (data.length < 50) throw mt5Err;
        return { source: 'TwelveData (fallback)', count: data.length, mt5Error: String(mt5Err) };
      }
    },
    { warnOnFail: true }
  );

  await collector.runTest(phase, category, 'Trading Economics interest rate (USD)', async () => {
    const rate = await TradingEconomicsIndicatorsProvider.getInterestRate('USD');
    if (!rate || rate.rate < 0 || rate.rate > 20) throw new Error('Invalid interest rate');
    return rate;
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'Trading Economics CPI (USD)', async () => {
    const cpi = await TradingEconomicsIndicatorsProvider.getCPI('USD');
    if (!cpi || cpi.value < 0 || cpi.value > 15) throw new Error('Invalid CPI');
    return cpi;
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'COT data provider', async () => {
    const cotData = await COTDataProvider.getCOTData('EUR', 52);
    if (cotData.length === 0) return { count: 0, note: 'CFTC may be unavailable' };
    return { count: cotData.length, latest: cotData[0]?.date };
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'COT analyzer', async () => {
    const analysis = await COTAnalyzer.analyzeCOT('EURUSD');
    if (!analysis) throw new Error('COT analyzer returned null');
    return { sentiment: analysis.sentiment, confidence: analysis.confidence };
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'Economic calendar', async () => {
    const events = await EconomicCalendar.getUpcomingEvents('USD', 168);
    return { eventCount: events.length };
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'Trading hours filter', async () => {
    const hours = TradingHoursFilter.analyze(symbol);
    return { symbol, quality: hours.quality, session: hours.currentSession };
  });
}
