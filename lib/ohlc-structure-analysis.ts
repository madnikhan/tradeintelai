/**
 * Rule-based market structure from OHLC swing points (no GPT vision).
 * Used by scanner mode to feed Gate 1 without chart vision API calls.
 */

import type { PriceData } from '@/types/trading';
import type { GPTStructureAnalysis } from './gated-trading-engine';

function calculateTrendStrength(data: PriceData[]): number {
  if (data.length < 20) return 0;

  const prices = data.map((d) => d.close);
  const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 =
    prices.length >= 50
      ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50
      : sma20;

  const aboveSMA = prices.slice(-20).filter((p) => p > sma20).length;
  const trendRatio = aboveSMA / 20;
  let strength = Math.abs(trendRatio - 0.5) * 200;

  if (
    (sma20 > sma50 && trendRatio > 0.5) ||
    (sma20 < sma50 && trendRatio < 0.5)
  ) {
    strength = Math.min(100, strength * 1.2);
  }

  return Math.round(strength);
}

function calculateAdx(data: PriceData[]): number {
  if (data.length < 20) return 0;

  const period = 14;
  const recent = data.slice(-(period + 1));
  let plusDmSum = 0;
  let minusDmSum = 0;
  let trSum = 0;

  for (let i = 1; i < recent.length; i++) {
    const high = recent[i].high ?? recent[i].close;
    const low = recent[i].low ?? recent[i].close;
    const prevHigh = recent[i - 1].high ?? recent[i - 1].close;
    const prevLow = recent[i - 1].low ?? recent[i - 1].close;
    const prevClose = recent[i - 1].close;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDmSum += upMove > downMove && upMove > 0 ? upMove : 0;
    minusDmSum += downMove > upMove && downMove > 0 ? downMove : 0;
    trSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }

  if (trSum === 0) return 0;
  const plusDi = (plusDmSum / trSum) * 100;
  const minusDi = (minusDmSum / trSum) * 100;
  const diSum = plusDi + minusDi;
  if (diSum === 0) return 0;
  return Math.round((Math.abs(plusDi - minusDi) / diSum) * 100);
}

export function analyzeOhlcStructure(
  data: PriceData[],
  priceActionSR: { support: number[]; resistance: number[] }
): GPTStructureAnalysis | undefined {
  if (!data || data.length < 20) return undefined;

  const hasSR =
    priceActionSR.support.length > 0 || priceActionSR.resistance.length > 0;
  if (!hasSR) return undefined;

  const trendStrength = calculateTrendStrength(data);
  const adx = calculateAdx(data);
  const prices = data.map((d) => d.close);
  const current = prices[prices.length - 1];

  const supports = [...priceActionSR.support].sort((a, b) => a - b);
  const resistances = [...priceActionSR.resistance].sort((a, b) => b - a);

  let patternType = 'swing structure';
  let patternConfidence = 60;
  let marketStructure: GPTStructureAnalysis['marketStructure'] = 'RANGE';

  const lowestSupport = supports[0];
  const highestResistance = resistances[0];
  const rangePct =
    lowestSupport && highestResistance
      ? (highestResistance - lowestSupport) / lowestSupport
      : 0;

  const risingLows =
    supports.length >= 2 && supports[supports.length - 1] > supports[0];
  const fallingHighs =
    resistances.length >= 2 && resistances[resistances.length - 1] < resistances[0];

  if (risingLows && trendStrength >= 40) {
    patternType = 'ascending channel';
    patternConfidence = Math.min(78, 55 + trendStrength * 0.35);
    marketStructure = 'TREND_CONTINUATION';
  } else if (fallingHighs && trendStrength >= 40) {
    patternType = 'descending channel';
    patternConfidence = Math.min(78, 55 + trendStrength * 0.35);
    marketStructure = 'TREND_CONTINUATION';
  } else if (rangePct > 0 && rangePct < 0.025 && trendStrength < 45) {
    patternType = 'consolidation range';
    patternConfidence = 68;
    marketStructure = 'RANGE';
  } else if (trendStrength >= 45 && adx > 20) {
    patternType = trendStrength >= 50 ? 'trend continuation' : 'emerging trend';
    patternConfidence = Math.min(72, 50 + trendStrength * 0.4);
    marketStructure = 'TREND_CONTINUATION';
  } else if (hasSR) {
    patternConfidence = Math.min(68, 58 + adx * 0.3);
    marketStructure = trendStrength >= 40 ? 'TREND_CONTINUATION' : 'RANGE';
  }

  const nearSupport =
    lowestSupport && Math.abs(current - lowestSupport) / lowestSupport < 0.005;
  const nearResistance =
    highestResistance && Math.abs(current - highestResistance) / highestResistance < 0.005;
  if (nearSupport || nearResistance) {
    patternConfidence = Math.min(75, patternConfidence + 5);
  }

  const confidence = Math.round(patternConfidence * 0.7 + trendStrength * 0.3);

  return {
    marketStructure,
    alignment: 'NEUTRAL',
    confidence: Math.max(0, Math.min(100, confidence)),
    trendStrength,
    patterns: [
      {
        type: patternType,
        confidence: Math.round(patternConfidence),
        priceLevel: nearResistance ? highestResistance : nearSupport ? lowestSupport : undefined,
      },
    ],
    supportResistance: {
      support: supports.slice(0, 3),
      resistance: resistances.slice(0, 3),
    },
    reasoning: `OHLC: ${patternType} (${Math.round(patternConfidence)}%), trend ${trendStrength}%, ADX ${adx}`,
  };
}

export function getOhlcAdx(data: PriceData[]): number {
  return calculateAdx(data);
}
