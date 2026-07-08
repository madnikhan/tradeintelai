import { validateGatedExecution } from '../../lib/execute-gated-trade';
import type { ExtendedMarketAnalysis } from '../../lib/gated-engine-adapter';
import type { AuditCollector } from './types';

function executableFixture(): ExtendedMarketAnalysis {
  return {
    symbol: 'EURUSD',
    recommendation: 'BUY',
    confidence: 72,
    overallScore: 78,
    suggestedStopLoss: 1.08,
    suggestedTakeProfit: 1.09,
    suggestedPositionSize: 0.01,
    gateStatus: {
      marketReadable: true,
      directionalBias: 'BULLISH',
      biasStrength: 70,
      executionPermitted: true,
      executionReason: 'All gates passed',
    },
  } as ExtendedMarketAnalysis;
}

function blockedFixture(): ExtendedMarketAnalysis {
  return {
    symbol: 'EURUSD',
    recommendation: 'HOLD',
    confidence: 40,
    overallScore: 45,
    suggestedStopLoss: 1.08,
    suggestedTakeProfit: 1.09,
    gateStatus: {
      marketReadable: false,
      directionalBias: 'NEUTRAL',
      biasStrength: 30,
      executionPermitted: false,
      executionBlockedBy: ['Gate 4: expectancy too low'],
    },
  } as ExtendedMarketAnalysis;
}

export async function runExecutionAudit(collector: AuditCollector): Promise<void> {
  const phase = 'Phase 5: Execution';
  const category = 'Execution Path';

  await collector.runTest(phase, category, 'validateGatedExecution allows executable analysis', async () => {
    const r = validateGatedExecution(executableFixture());
    if (!r.ok) throw new Error(r.error);
    return r;
  });

  await collector.runTest(phase, category, 'validateGatedExecution blocks HOLD', async () => {
    const r = validateGatedExecution(blockedFixture());
    if (r.ok) throw new Error('Expected validation to fail for HOLD');
    return { blocked: true, error: r.error };
  });
}
