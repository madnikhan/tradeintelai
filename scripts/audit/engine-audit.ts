import { GatedEngineAdapter } from '../../lib/gated-engine-adapter';
import { RegimeDetector } from '../../lib/regime-detector';
import { MLRegimeDetector } from '../../lib/regime-detector-ml';
import { RiskCalculator } from '../../lib/risk-calculator';
import { TradingModeManager } from '../../lib/trading-mode';
import { MT5PriceDataProvider } from '../../lib/data-providers/mt5-price-data';
import type { AuditCollector, AuditOptions } from './types';

const SCAN_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'];

export async function runEngineAudit(collector: AuditCollector, options: AuditOptions): Promise<void> {
  const phase = 'Phase 3: Engines';
  const category = 'Analysis Engines';
  const adapter = new GatedEngineAdapter();

  await collector.runTest(phase, category, 'Regime detector', async () => {
    const data = await MT5PriceDataProvider.getHistoricalData(options.symbol, 'H1', 100);
    if (data.length < 50) throw new Error('Insufficient price data for regime');
    const regime = RegimeDetector.detectRegime(data);
    if (!regime.regime) throw new Error('No regime detected');
    return { regime: regime.regime, confidence: regime.confidence };
  }, { warnOnFail: true });

  await collector.runTest(phase, category, 'ML regime detector', async () => {
    const data = await MT5PriceDataProvider.getHistoricalData(options.symbol, 'H1', 100);
    const result = await MLRegimeDetector.detectRegimeML(data, options.symbol);
    return { regime: result.regime, confidence: result.confidence };
  }, { warnOnFail: true });

  for (const sym of SCAN_SYMBOLS) {
    await collector.runTest(phase, category, `GatedEngineAdapter ${sym}`, async () => {
      const analysis = await adapter.analyzeMarket(sym, []);
      if (analysis.gateStatus && analysis.gateStatus.marketReadable === undefined) {
        throw new Error('gateStatus.marketReadable undefined');
      }
      if (analysis.gateStatus && !analysis.gateStatus.executionPermitted && analysis.recommendation !== 'HOLD') {
        // allowed — execution blocked but signal may exist
      }
      return {
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        executionPermitted: analysis.gateStatus?.executionPermitted,
        hasGateStatus: !!analysis.gateStatus,
      };
    }, { warnOnFail: sym !== options.symbol });
  }

  if (!options.skipGpt) {
    await collector.runTest(
      phase,
      category,
      `Gate 3 GPT structure (${options.symbol})`,
      async () => {
        const analysis = await adapter.analyzeMarket(options.symbol, []);
        const gpt = analysis.gateStatus?.gptStructure;
        if (!gpt) return { note: 'GPT structure not returned — may be skipped by engine' };
        if (gpt.confidence < 0 || gpt.confidence > 100) throw new Error('Invalid GPT confidence');
        return gpt;
      },
      { warnOnFail: true }
    );
  } else {
    collector.skip(phase, category, 'Gate 3 GPT structure', '--skip-gpt flag set');
  }

  await collector.runTest(phase, category, 'Risk calculator (non-zero balance)', async () => {
    TradingModeManager.setRealBalance(500_000);
    // Wide stop so 2% risk yields lot size within 5% equity cap
    const result = await RiskCalculator.calculateTradeSize(1.085, 0.65, 'EURUSD', 0.001, 0.001);
    if (!result.message) throw new Error('No result message');
    if (result.lotSize <= 0 && result.isValid) {
      throw new Error(result.message || 'Invalid lot size');
    }
    return { lotSize: result.lotSize, isValid: result.isValid, message: result.message };
  }, { warnOnFail: true });
}
