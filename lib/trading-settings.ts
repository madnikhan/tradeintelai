/**
 * Trading Settings Utility
 * Provides access to customizable trading rules stored in localStorage
 * Falls back to default values from TRADING_RULES if not set
 */

import { TRADING_RULES } from '@/config/trading-rules';

const AUTO_SCAN_KEY = 'settings_auto_scan';
const SCAN_INTERVAL_KEY = 'settings_scan_interval';
const NOTIFICATIONS_KEY = 'settings_notifications';
const AUTO_SCAN_MIGRATION_KEY = 'settings_auto_scan_migrated_v2';

/** One-time migration: disable auto-scan for existing sessions (saves AI credits). */
export function migrateScanSettingsToManual(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(AUTO_SCAN_MIGRATION_KEY) === 'done') return;
  localStorage.setItem(AUTO_SCAN_KEY, 'false');
  localStorage.setItem(AUTO_SCAN_MIGRATION_KEY, 'done');
}

export function getAutoScanEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  migrateScanSettingsToManual();
  const saved = localStorage.getItem(AUTO_SCAN_KEY);
  if (saved === null) return false;
  return saved === 'true';
}

export function setAutoScanEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_SCAN_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('scan-settings-changed'));
}

export function getScanIntervalMinutes(): number {
  if (typeof window === 'undefined') return 5;
  const saved = localStorage.getItem(SCAN_INTERVAL_KEY);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) return parsed;
  }
  return 5;
}

export function setScanIntervalMinutes(minutes: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SCAN_INTERVAL_KEY, String(Math.min(60, Math.max(1, minutes))));
  window.dispatchEvent(new CustomEvent('scan-settings-changed'));
}

export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(NOTIFICATIONS_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
}

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
