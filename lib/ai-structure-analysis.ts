/**
 * Convert ChartAnalysis to StructureAnalysis format (for gated engine).
 */

import type { ChartAnalysis, StructureAnalysis } from '@/lib/ai-types';

export function convertToStructureAnalysis(
  chartAnalysis: ChartAnalysis | null
): StructureAnalysis | undefined {
  if (!chartAnalysis) {
    return undefined;
  }

  const recUpper = (chartAnalysis.recommendation || '').toUpperCase();
  const trendDir = chartAnalysis.trend?.direction || 'neutral';

  const patternTypes = (chartAnalysis.patterns || []).map(p => (p.type || '').toLowerCase()).join(' ');
  const individualPatterns = (chartAnalysis.patterns || []).map(p => (p.type || '').toLowerCase());

  const hasTriangle = individualPatterns.some(p => p.includes('triangle')) || recUpper.includes('TRIANGLE');
  const hasFlag = individualPatterns.some(p => p.includes('flag')) || recUpper.includes('FLAG');
  const hasPennant = individualPatterns.some(p => p.includes('pennant')) || recUpper.includes('PENNANT');

  const hasHeadAndShoulders = individualPatterns.some(p =>
    p.includes('head') && p.includes('shoulders') && !p.includes('inverse')
  );
  const hasDoubleTop = individualPatterns.some(p => p.includes('double') && p.includes('top'));
  const hasTripleTop = individualPatterns.some(p => p.includes('triple') && p.includes('top'));
  const hasReversalPattern =
    hasHeadAndShoulders ||
    hasDoubleTop ||
    hasTripleTop ||
    recUpper.includes('REVERSAL') ||
    (recUpper.includes('HEAD') && recUpper.includes('SHOULDERS'));

  const hasRangePattern =
    individualPatterns.some(p =>
      p.includes('range') || p.includes('sideways') || p.includes('consolidation')
    ) ||
    recUpper.includes('RANGE') ||
    recUpper.includes('SIDEWAYS') ||
    recUpper.includes('CONSOLIDATION');

  let marketStructure: StructureAnalysis['marketStructure'];

  const recSuggestsBullish =
    recUpper.includes('BUY') || recUpper.includes('BULLISH') || recUpper.includes('ASCENDING');
  const recSuggestsBearish =
    recUpper.includes('SELL') || recUpper.includes('BEARISH') || recUpper.includes('DESCENDING');
  const recMentionsTriangle =
    recUpper.includes('TRIANGLE') || recUpper.includes('ASCENDING') || recUpper.includes('DESCENDING');

  if (
    hasTriangle ||
    hasFlag ||
    hasPennant ||
    recUpper.includes('CONTINUATION') ||
    (trendDir === 'bullish' && recUpper.includes('BUY')) ||
    (trendDir === 'bearish' && recUpper.includes('SELL')) ||
    (recMentionsTriangle && (recSuggestsBullish || recSuggestsBearish))
  ) {
    if (recMentionsTriangle && hasReversalPattern) {
      console.warn(
        `[Structure Conversion] Recommendation mentions triangle (${chartAnalysis.recommendation}) but reversal pattern also detected. Prioritizing continuation.`
      );
    }
    marketStructure = 'TREND_CONTINUATION';
  } else if (hasReversalPattern) {
    marketStructure = 'REVERSAL';
  } else if (hasRangePattern) {
    marketStructure = 'RANGE';
  } else {
    marketStructure = 'INVALID';
  }

  const alignment: StructureAnalysis['alignment'] = 'NEUTRAL';

  const trendStrength = chartAnalysis.trend?.strength || 0;
  const patternConfidence =
    chartAnalysis.patterns?.length > 0
      ? Math.max(...chartAnalysis.patterns.map(p => p.confidence || 0))
      : 0;

  let confidence: number;
  if (patternConfidence >= 70) {
    confidence = Math.round(patternConfidence * 0.7 + trendStrength * 0.3);
  } else if (trendStrength >= 60) {
    confidence = Math.round(trendStrength * 0.7 + patternConfidence * 0.3);
  } else {
    confidence = Math.round(trendStrength * 0.6 + patternConfidence * 0.4);
  }

  const result: StructureAnalysis = {
    marketStructure,
    alignment,
    confidence: Math.max(0, Math.min(100, confidence)),
    trendStrength,
    patterns: (chartAnalysis.patterns || []).map(p => ({
      type: p.type || 'unknown',
      confidence: p.confidence || 0,
      priceLevel: p.priceLevel,
    })),
    supportResistance: chartAnalysis.supportResistance
      ? {
          support: (chartAnalysis.supportResistance.support || []).filter(s => s > 0 && !isNaN(s)),
          resistance: (chartAnalysis.supportResistance.resistance || []).filter(r => r > 0 && !isNaN(r)),
        }
      : { support: [], resistance: [] },
    reasoning: chartAnalysis.recommendation || 'No clear structure detected',
  };

  console.log(
    `[Structure Conversion] Pattern confidence: ${patternConfidence}%, Calculated confidence: ${result.confidence}%, Market structure: ${result.marketStructure}`
  );
  console.log(
    `[Structure Conversion] S/R: support=[${result.supportResistance.support.join(', ') || 'none'}], resistance=[${result.supportResistance.resistance.join(', ') || 'none'}]`
  );
  console.log(`[Structure Conversion] Pattern types: "${patternTypes}"`);
  console.log(`[Structure Conversion] Recommendation: "${chartAnalysis.recommendation}", Trend dir: ${trendDir}`);

  return result;
}
