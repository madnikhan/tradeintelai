/**
 * Fallback Usage Monitor
 * Monitors and alerts when fallback values are used frequently
 */

import { ParserMonitor } from './parser-monitor';
import { logger } from '@/lib/logger';

export interface FallbackAlert {
  source: string;
  fallbackRate: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Check for high fallback usage and generate alerts
 */
export function checkFallbackUsage(threshold: number = 30): FallbackAlert[] {
  const alerts: FallbackAlert[] = [];
  const allStats = ParserMonitor.getAllStats();

  // Check each source for high fallback usage
  Object.entries(allStats).forEach(([source, stats]) => {
    if (!stats.successCount || !stats.fallbackUsageCount) return;

    const fallbackRate = ParserMonitor.getFallbackUsageRate(source);
    
    if (fallbackRate >= threshold) {
      const severity = fallbackRate >= 50 ? 'critical' : 'warning';
      alerts.push({
        source,
        fallbackRate,
        threshold,
        severity,
        message: `${source} is using fallback values ${fallbackRate.toFixed(1)}% of the time (threshold: ${threshold}%)`,
      });
    }
  });

  // Log alerts
  alerts.forEach(alert => {
    if (alert.severity === 'critical') {
      logger.error(`🚨 CRITICAL: ${alert.message}`);
    } else {
      logger.warn(`⚠️ WARNING: ${alert.message}`);
    }
  });

  return alerts;
}

/**
 * Get fallback usage summary for all Trading Economics endpoints
 */
export function getFallbackUsageSummary(): {
  sources: Record<string, {
    fallbackRate: number;
    fallbackCount: number;
    successCount: number;
    lastFallbackUsage?: Date;
  }>;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  alerts: FallbackAlert[];
} {
  const sources = [
    'tradingeconomics_interest_rate',
    'tradingeconomics_cpi',
    'tradingeconomics_gdp',
    'tradingeconomics_unemployment',
  ];

  const summary: Record<string, {
    fallbackRate: number;
    fallbackCount: number;
    successCount: number;
    lastFallbackUsage?: Date;
  }> = {};

  sources.forEach(source => {
    const stats = ParserMonitor.getStats(source);
    if (stats) {
      summary[source] = {
        fallbackRate: ParserMonitor.getFallbackUsageRate(source),
        fallbackCount: stats.fallbackUsageCount || 0,
        successCount: stats.successCount,
        lastFallbackUsage: stats.lastFallbackUsage,
      };
    }
  });

  // Check for alerts
  const alerts = checkFallbackUsage(30);

  // Determine overall health
  let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  if (criticalCount > 0) {
    overallHealth = 'critical';
  } else if (warningCount > 0) {
    overallHealth = 'degraded';
  }

  return {
    sources: summary,
    overallHealth,
    alerts,
  };
}

