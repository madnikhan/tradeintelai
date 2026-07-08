/**
 * In-memory cache for chart vision results so Trade tab analysis can feed Gate 1
 * without a second vision API call.
 */

import type { ChartAnalysis } from './ai-types';
import { convertToStructureAnalysis } from './ai-structure-analysis';
import type { GPTStructureAnalysis } from './gated-trading-engine';

export interface CachedChartVision {
  analysis: ChartAnalysis;
  imageBase64?: string;
  structure: GPTStructureAnalysis | undefined;
  updatedAt: number;
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.replace(/\//g, '').toUpperCase();
}

const cache = new Map<string, CachedChartVision>();

export function setChartVisionCache(
  symbol: string,
  analysis: ChartAnalysis,
  imageBase64?: string
): CachedChartVision {
  const structure = convertToStructureAnalysis(analysis);
  const entry: CachedChartVision = {
    analysis,
    imageBase64,
    structure,
    updatedAt: Date.now(),
  };
  cache.set(normalizeSymbolKey(symbol), entry);
  return entry;
}

export function getChartVisionCache(symbol: string): CachedChartVision | undefined {
  return cache.get(normalizeSymbolKey(symbol));
}

export function clearChartVisionCache(symbol?: string): void {
  if (symbol) {
    cache.delete(normalizeSymbolKey(symbol));
  } else {
    cache.clear();
  }
}
