/**
 * Shared confidence / execute floors — Gate 4, Copilot Execute, Scan, Auto Pilot.
 */

/** Minimum confidence to permit gated execution (UI + API + daemon). */
export const MIN_GATED_EXECUTE_CONFIDENCE = 50;

/** Gate 4 floor when strong compensating signals exist (still below execute floor). */
export const MIN_GATED_GATE4_COMPENSATED = 45;

/** Legacy non-gated path (overall score + confidence). */
export const MIN_LEGACY_EXECUTE_SCORE = 65;
export const MIN_LEGACY_EXECUTE_CONFIDENCE = 55;
