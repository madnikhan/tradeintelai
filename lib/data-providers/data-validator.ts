/**
 * Data Validation Utilities
 * Validates economic data freshness and value ranges
 */

import { logger } from '@/lib/logger';

export interface ValidationResult {
  isValid: boolean;
  isStale: boolean;
  isOutOfRange: boolean;
  warnings: string[];
  confidence: number; // 0-100, reduced if stale or out of range
}

/**
 * Maximum age for economic data (in days)
 */
const MAX_DATA_AGE = {
  INTEREST_RATE: 30, // Interest rates change monthly
  CPI: 60, // CPI updates monthly
  GDP: 120, // GDP updates quarterly
  UNEMPLOYMENT: 60, // Unemployment updates monthly
};

/**
 * Valid value ranges for economic indicators
 */
const VALUE_RANGES = {
  INTEREST_RATE: { min: 0, max: 20 }, // 0-20% is reasonable for major currencies
  CPI: { min: -5, max: 20 }, // -5% (deflation) to 20% (hyperinflation)
  GDP: { min: -10, max: 15 }, // -10% (recession) to +15% (boom)
  UNEMPLOYMENT: { min: 0, max: 30 }, // 0-30% is reasonable range
};

/**
 * Validate data freshness
 */
export function validateDataFreshness(
  dateString: string | null | undefined,
  dataType: 'INTEREST_RATE' | 'CPI' | 'GDP' | 'UNEMPLOYMENT'
): { isStale: boolean; ageDays: number; maxAgeDays: number } {
  if (!dateString) {
    return { isStale: true, ageDays: Infinity, maxAgeDays: MAX_DATA_AGE[dataType] };
  }

  try {
    const dataDate = new Date(dateString);
    const now = new Date();
    const ageMs = now.getTime() - dataDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const maxAgeDays = MAX_DATA_AGE[dataType];

    return {
      isStale: ageDays > maxAgeDays,
      ageDays: Math.round(ageDays),
      maxAgeDays,
    };
  } catch (error) {
    logger.warn(`⚠️ Failed to parse date: ${dateString}`, error);
    return { isStale: true, ageDays: Infinity, maxAgeDays: MAX_DATA_AGE[dataType] };
  }
}

/**
 * Validate value is within reasonable range
 */
export function validateValueRange(
  value: number | null | undefined,
  dataType: 'INTEREST_RATE' | 'CPI' | 'GDP' | 'UNEMPLOYMENT'
): { isOutOfRange: boolean; range: { min: number; max: number } } {
  if (value === null || value === undefined || isNaN(value)) {
    return { isOutOfRange: true, range: VALUE_RANGES[dataType] };
  }

  const range = VALUE_RANGES[dataType];
  const isOutOfRange = value < range.min || value > range.max;

  return { isOutOfRange, range };
}

/**
 * Comprehensive validation of economic data
 */
export function validateEconomicData(
  value: number | null | undefined,
  dateString: string | null | undefined,
  dataType: 'INTEREST_RATE' | 'CPI' | 'GDP' | 'UNEMPLOYMENT',
  currency?: string
): ValidationResult {
  const warnings: string[] = [];
  let confidence = 100;

  // Validate value range
  const valueValidation = validateValueRange(value, dataType);
  if (valueValidation.isOutOfRange) {
    warnings.push(
      `Value ${value} is outside reasonable range (${valueValidation.range.min}-${valueValidation.range.max})`
    );
    confidence -= 30; // Significant penalty for out-of-range values
  }

  // Validate data freshness
  const freshnessValidation = validateDataFreshness(dateString, dataType);
  if (freshnessValidation.isStale) {
    warnings.push(
      `Data is stale: ${freshnessValidation.ageDays} days old (max: ${freshnessValidation.maxAgeDays} days)`
    );
    // Reduce confidence based on how stale the data is
    const stalenessRatio = freshnessValidation.ageDays / freshnessValidation.maxAgeDays;
    confidence -= Math.min(40, Math.round(stalenessRatio * 40)); // Up to 40% penalty
  } else if (freshnessValidation.ageDays > freshnessValidation.maxAgeDays * 0.7) {
    // Warn if data is getting close to stale threshold (70% of max age)
    warnings.push(
      `Data is getting stale: ${freshnessValidation.ageDays} days old (max: ${freshnessValidation.maxAgeDays} days)`
    );
    confidence -= 10; // Small penalty for approaching stale threshold
  }

  const isValid = !valueValidation.isOutOfRange && !freshnessValidation.isStale;
  confidence = Math.max(0, Math.min(100, confidence)); // Clamp to 0-100

  // Log warnings if any
  if (warnings.length > 0 && currency) {
    logger.warn(`⚠️ Data validation warnings for ${currency} ${dataType}:`, warnings);
  }

  return {
    isValid,
    isStale: freshnessValidation.isStale,
    isOutOfRange: valueValidation.isOutOfRange,
    warnings,
    confidence,
  };
}

/**
 * Check if fallback value was used (for monitoring)
 */
export function isFallbackValue(
  value: number,
  currency: string,
  dataType: 'INTEREST_RATE' | 'CPI' | 'GDP' | 'UNEMPLOYMENT'
): boolean {
  // Define fallback values for each currency and data type
  const fallbackValues: Record<string, Record<string, number>> = {
    INTEREST_RATE: {
      USD: 5.25,
      EUR: 4.0,
      GBP: 5.0,
      JPY: 0.1,
      AUD: 4.35,
      CAD: 5.0,
      CHF: 1.75,
      NZD: 5.5,
    },
    CPI: {
      USD: 3.2,
      EUR: 2.5,
      GBP: 3.0,
      JPY: 2.0,
      AUD: 3.5,
      CAD: 2.8,
      CHF: 1.5,
      NZD: 4.0,
    },
    GDP: {
      USD: 2.5,
      EUR: 1.5,
      GBP: 1.8,
      JPY: 1.2,
      AUD: 2.2,
      CAD: 2.0,
      CHF: 1.0,
      NZD: 2.3,
    },
    UNEMPLOYMENT: {
      USD: 3.7,
      EUR: 6.5,
      GBP: 4.2,
      JPY: 2.6,
      AUD: 3.8,
      CAD: 5.2,
      CHF: 2.1,
      NZD: 3.9,
    },
  };

  const fallbackValue = fallbackValues[dataType]?.[currency];
  if (fallbackValue === undefined) {
    return false; // Unknown currency, can't determine if fallback
  }

  // Check if value matches fallback exactly (with small tolerance for floating point)
  return Math.abs(value - fallbackValue) < 0.01;
}

