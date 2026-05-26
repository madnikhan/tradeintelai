import { describe, it, expect } from 'vitest';
import { GatedEngineAdapter } from '@/lib/gated-engine-adapter';
import type { GatedMarketAnalysis } from '@/lib/gated-trading-engine';

describe('GatedEngineAdapter', () => {
  const adapter = new GatedEngineAdapter();

  const baseGated = (): GatedMarketAnalysis => ({
    symbol: 'EURUSD',
    timestamp: new Date(),
    recommendation: 'HOLD',
    recommendationReason: 'Execution blocked',
    reasoning: [],
    marketReadability: {
      isReadable: false,
      confidence: 30,
      reason: 'Market unreadable',
      blockedBy: ['No S/R'],
      gate1Inputs: {
        trendStrength: 40,
        patternConfidence: 0,
        hasSupportResistance: false,
        hasStrongTrend: false,
        hasStrongPattern: false,
      },
    },
    directionalBias: {
      direction: 'NEUTRAL',
      strength: 0,
      reasoning: [],
      primaryTrend: 'NEUTRAL',
    },
    executionPermission: {
      canExecute: false,
      reason: 'Blocked',
      blockedBy: ['Gate 1 unreadable'],
      confidence: 25,
      technicalExecutionScore: 50,
    },
    componentScores: {
      technical: 50,
      fundamental: 50,
      sentiment: 50,
      cot: 50,
      regime: 50,
    },
    regimeAnalysis: {
      regime: 'LOW_VOLATILITY_RANGE',
      confidence: 40,
      trendStrength: 40,
      suggestedStrategy: 'RANGE_TRADING',
      reasoning: [],
    },
    tradingHours: {
      session: 'London',
      quality: 'GOOD',
      isActive: true,
    },
    newsImpact: { impact: 'LOW', events: [] },
    detailedReasoning: [],
  });

  it('maps HOLD when execution is blocked', () => {
    const gated = baseGated();
    const legacy = (adapter as any).convertToLegacyFormat(gated);
    expect(legacy.recommendation).toBe('HOLD');
    expect(legacy.gateStatus?.executionPermitted).toBe(false);
  });

  it('maps BUY when execution permitted with bullish bias', () => {
    const gated = baseGated();
    gated.marketReadability.isReadable = true;
    gated.marketReadability.reason = 'Readable';
    gated.directionalBias.direction = 'BULLISH';
    gated.directionalBias.strength = 70;
    gated.executionPermission.canExecute = true;
    gated.executionPermission.blockedBy = [];
    gated.recommendation = 'BUY';

    const legacy = (adapter as any).convertToLegacyFormat(gated);
    expect(legacy.gateStatus?.executionPermitted).toBe(true);
    expect(['BUY', 'STRONG_BUY']).toContain(legacy.recommendation);
  });

  it('never shows execution permitted when recommendation logic blocks', () => {
    const gated = baseGated();
    gated.executionPermission.canExecute = false;
    gated.recommendation = 'HOLD';
    const legacy = (adapter as any).convertToLegacyFormat(gated);
    expect(legacy.gateStatus?.executionPermitted).toBe(false);
    expect(legacy.recommendation).toBe('HOLD');
  });

  it('shows HOLD not BUY when bullish bias but Gate 4 blocks', () => {
    const gated = baseGated();
    gated.directionalBias.direction = 'BULLISH';
    gated.directionalBias.strength = 70;
    gated.executionPermission.canExecute = false;
    gated.recommendation = 'HOLD';
    const legacy = (adapter as any).convertToLegacyFormat(gated);
    expect(legacy.recommendation).toBe('HOLD');
    expect(legacy.gateStatus?.executionPermitted).toBe(false);
  });
});
