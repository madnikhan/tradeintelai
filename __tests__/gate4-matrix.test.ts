import { describe, it, expect } from 'vitest';

/**
 * Gate 4 decision matrix (unit-level expectations).
 * Full integration tests require MT5 data; these document invariants.
 */

type Gate4Input = {
  marketReadable: boolean;
  biasNeutral: boolean;
  technicalScore: number;
  regime: string;
  highVol: boolean;
};

function shouldBlockExecution(input: Gate4Input): boolean {
  if (!input.marketReadable) return true;
  if (input.biasNeutral) return true;
  if (input.highVol || input.regime === 'HIGH_VOLATILITY_RANGE') return true;
  if (input.technicalScore < 50) return true;
  return false;
}

describe('Gate 4 matrix', () => {
  it('blocks when market unreadable', () => {
    expect(
      shouldBlockExecution({
        marketReadable: false,
        biasNeutral: false,
        technicalScore: 70,
        regime: 'TRENDING_UP',
        highVol: false,
      })
    ).toBe(true);
  });

  it('blocks when bias neutral', () => {
    expect(
      shouldBlockExecution({
        marketReadable: true,
        biasNeutral: true,
        technicalScore: 70,
        regime: 'TRENDING_UP',
        highVol: false,
      })
    ).toBe(true);
  });

  it('blocks high volatility regime', () => {
    expect(
      shouldBlockExecution({
        marketReadable: true,
        biasNeutral: false,
        technicalScore: 70,
        regime: 'HIGH_VOLATILITY_RANGE',
        highVol: true,
      })
    ).toBe(true);
  });

  it('allows when readable, directional, and technical confirms', () => {
    expect(
      shouldBlockExecution({
        marketReadable: true,
        biasNeutral: false,
        technicalScore: 60,
        regime: 'TRENDING_UP',
        highVol: false,
      })
    ).toBe(false);
  });

  it('blocks weak technical score', () => {
    expect(
      shouldBlockExecution({
        marketReadable: true,
        biasNeutral: false,
        technicalScore: 45,
        regime: 'TRENDING_UP',
        highVol: false,
      })
    ).toBe(true);
  });
});

describe('with-auth route helpers', () => {
  it('identifies test routes', async () => {
    const { isTestApiRoute, isProtectedApiRoute } = await import('@/lib/api-route-guards');
    expect(isTestApiRoute('/api/test/calendar-parsers')).toBe(true);
    expect(isProtectedApiRoute('/api/ic-markets/trade')).toBe(true);
    expect(isProtectedApiRoute('/api/test/foo')).toBe(false);
  });
});
