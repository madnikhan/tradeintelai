/**
 * Shared scanner executable check — aligned with validateGatedExecution gate path
 * (listing only; does not require position size / SL / TP).
 */

import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';

export const SCANNER_MIN_CONFIDENCE_GATE = 50;
export const SCANNER_MIN_SCORE_LEGACY = 65;
export const SCANNER_MIN_CONFIDENCE_LEGACY = 55;

export interface ScannerOpportunityLike {
  executionPermitted: boolean;
  recommendation: string;
  confidence: number;
  score?: number;
}

/** Whether Scan tab should treat a row as executable (matches Trade tab gate rules). */
export function isScannerExecutableOpportunity(opp: ScannerOpportunityLike): boolean {
  return (
    opp.executionPermitted &&
    opp.recommendation !== 'HOLD' &&
    opp.confidence >= SCANNER_MIN_CONFIDENCE_GATE
  );
}

/** Same check from full gated analysis (e.g. diagnostic scripts). */
export function isScannerExecutableAnalysis(analysis: ExtendedMarketAnalysis): boolean {
  if (analysis.gateStatus) {
    return isScannerExecutableOpportunity({
      executionPermitted: analysis.gateStatus.executionPermitted,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
    });
  }
  return (
    analysis.overallScore >= SCANNER_MIN_SCORE_LEGACY &&
    analysis.confidence >= SCANNER_MIN_CONFIDENCE_LEGACY &&
    analysis.recommendation !== 'HOLD'
  );
}
