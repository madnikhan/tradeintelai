import { describe, expect, it } from 'vitest';
import { validateTradeGeometry } from '@/lib/trade-geometry';
import { getExecuteBlockedButtonLabel } from '@/lib/bridge-status';
import { CHART_VISION_CACHE_TTL_MS } from '@/lib/chart-vision-cache';

describe('validateTradeGeometry', () => {
  it('accepts valid BUY geometry', () => {
    const r = validateTradeGeometry({
      side: 'BUY',
      entry: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects BUY with SL above entry', () => {
    const r = validateTradeGeometry({
      side: 'BUY',
      entry: 1.1,
      stopLoss: 1.11,
      takeProfit: 1.12,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects zero SL', () => {
    const r = validateTradeGeometry({
      side: 'SELL',
      entry: 1.1,
      stopLoss: 0,
      takeProfit: 1.08,
    });
    expect(r.ok).toBe(false);
  });
});

describe('getExecuteBlockedButtonLabel', () => {
  it('does not say SELECT MT5 ACCOUNT for unknown pairing', () => {
    expect(getExecuteBlockedButtonLabel('unknown')).toContain('SETUP');
    expect(getExecuteBlockedButtonLabel('unknown')).not.toContain('SELECT MT5');
  });

  it('says SELECT MT5 ACCOUNT only for no_account', () => {
    expect(getExecuteBlockedButtonLabel('no_account')).toContain('SELECT MT5');
  });
});

describe('chart vision TTL', () => {
  it('exports a positive TTL', () => {
    expect(CHART_VISION_CACHE_TTL_MS).toBeGreaterThan(60_000);
  });
});
