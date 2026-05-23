/**
 * Trading Settings Utility
 * Provides access to customizable trading rules stored in localStorage
 * Falls back to default values from TRADING_RULES if not set
 */

import { TRADING_RULES } from '@/config/trading-rules';

/**
 * Get customizable max trades per day
 * Checks localStorage first, then falls back to default
 */
export function getMaxTradesPerDay(): number {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return TRADING_RULES.MAX_TRADES_PER_DAY;
  }

  const saved = localStorage.getItem('settings_max_trades_per_day');
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return TRADING_RULES.MAX_TRADES_PER_DAY;
}

/**
 * Get customizable max open trades
 * Checks localStorage first, then falls back to default
 */
export function getMaxOpenTrades(): number {
  if (typeof window === 'undefined') {
    return TRADING_RULES.MAX_OPEN_TRADES;
  }

  const saved = localStorage.getItem('settings_max_open_trades');
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return TRADING_RULES.MAX_OPEN_TRADES;
}

/**
 * Get customizable risk percentage
 * Checks localStorage first, then falls back to default
 */
export function getRiskPercentage(): number {
  if (typeof window === 'undefined') {
    return TRADING_RULES.RISK_PERCENTAGE;
  }

  const saved = localStorage.getItem('settings_risk_percentage');
  if (saved) {
    const parsed = parseFloat(saved);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed / 100; // Convert from percentage to decimal
    }
  }

  return TRADING_RULES.RISK_PERCENTAGE;
}

/**
 * Get customizable daily loss percent
 * Checks localStorage first, then falls back to default
 */
export function getDailyLossPercent(): number {
  if (typeof window === 'undefined') {
    return TRADING_RULES.DAILY_LOSS_PERCENT;
  }

  const saved = localStorage.getItem('settings_daily_loss');
  if (saved) {
    const parsed = parseFloat(saved);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed / 100; // Convert from percentage to decimal
    }
  }

  return TRADING_RULES.DAILY_LOSS_PERCENT;
}

/**
 * Get customizable minimum reward:risk ratio
 * Checks localStorage first, then falls back to default
 */
export function getMinRewardRiskRatio(): number {
  if (typeof window === 'undefined') {
    return TRADING_RULES.MIN_REWARD_RISK_RATIO;
  }

  const saved = localStorage.getItem('settings_reward_risk_ratio');
  if (saved) {
    const parsed = parseFloat(saved);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return TRADING_RULES.MIN_REWARD_RISK_RATIO;
}
