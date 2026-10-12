/**
 * In-memory cache for chart vision results so Trade tab analysis can feed Gate 1
 * without a second vision API call.
 */

import type { ChartAnalysis } from './ai-types';
import { convertToStructureAnalysis } from './ai-structure-analysis';
import type { GPTStructureAnalysis } from './gated-trading-engine';

/** Stale vision must not feed Gate 1 (default 15 minutes / ~1 H1 bar). */
export const CHART_VISION_CACHE_TTL_MS = 15 * 60 * 1000;

export interface CachedChartVision {
  analysis?: ChartAnalysis;
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

export function getChartVisionCache(
  symbol: string,
  maxAgeMs: number = CHART_VISION_CACHE_TTL_MS
): CachedChartVision | undefined {
  const key = normalizeSymbolKey(symbol);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > maxAgeMs) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

/** Cache Gate 1 structure from Scan-with-chart so Trade tab matches scan results. */
export function setChartVisionStructureCache(
  symbol: string,
  structure: GPTStructureAnalysis
): void {
  const key = normalizeSymbolKey(symbol);
  const existing = cache.get(key);
  cache.set(key, {
    analysis: existing?.analysis,
    imageBase64: existing?.imageBase64,
    structure,
    updatedAt: Date.now(),
  });
}

export function clearChartVisionCache(symbol?: string): void {
  if (symbol) {
    cache.delete(normalizeSymbolKey(symbol));
  } else {
    cache.clear();
  }
}
