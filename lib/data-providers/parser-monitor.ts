/**
 * Parser Performance Monitor
 * Tracks success rates, execution times, and event counts for all calendar parsers
 */

interface ParserStats {
  source: string;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  totalEvents: number;
  averageEvents: number;
  lastSuccess?: Date;
  lastFailure?: Date;
  lastError?: string;
  fallbackUsageCount?: number; // Track how many times fallback values were used
  lastFallbackUsage?: Date;
}

export class ParserMonitor {
  private static stats: Map<string, ParserStats> = new Map();
  private static readonly MAX_HISTORY = 100; // Keep last 100 runs

  /**
   * Record a parser execution
   */
  static recordExecution(
    source: string,
    success: boolean,
    executionTime: number,
    eventCount: number,
    error?: string,
    usedFallback?: boolean
  ): void {
    const existing = this.stats.get(source) || {
      source,
      successCount: 0,
      failureCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      totalEvents: 0,
      averageEvents: 0,
      fallbackUsageCount: 0,
    };

    if (success) {
      existing.successCount++;
      existing.lastSuccess = new Date();
      existing.totalEvents += eventCount;
      existing.averageEvents = existing.totalEvents / existing.successCount;
      
      // Track fallback usage
      if (usedFallback) {
        existing.fallbackUsageCount = (existing.fallbackUsageCount || 0) + 1;
        existing.lastFallbackUsage = new Date();
      }
    } else {
      existing.failureCount++;
      existing.lastFailure = new Date();
      existing.lastError = error;
    }

    existing.totalExecutionTime += executionTime;
    const totalRuns = existing.successCount + existing.failureCount;
    existing.averageExecutionTime = existing.totalExecutionTime / totalRuns;

    this.stats.set(source, existing);
  }

  /**
   * Record fallback usage (separate from execution record)
   */
  static recordFallbackUsage(source: string, currency?: string): void {
    const key = currency ? `${source}_${currency}` : source;
    const existing = this.stats.get(key) || {
      source: key,
      successCount: 0,
      failureCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      totalEvents: 0,
      averageEvents: 0,
      fallbackUsageCount: 0,
    };

    existing.fallbackUsageCount = (existing.fallbackUsageCount || 0) + 1;
    existing.lastFallbackUsage = new Date();
    this.stats.set(key, existing);
  }

  /**
   * Get fallback usage rate for a source
   */
  static getFallbackUsageRate(source: string): number {
    const stats = this.stats.get(source);
    if (!stats || !stats.successCount) return 0;
    const fallbackCount = stats.fallbackUsageCount || 0;
    return (fallbackCount / stats.successCount) * 100;
  }

  /**
   * Check if fallback usage is high (threshold: 30% of successful requests)
   */
  static isFallbackUsageHigh(source: string, threshold: number = 30): boolean {
    return this.getFallbackUsageRate(source) >= threshold;
  }

  /**
   * Get statistics for a source
   */
  static getStats(source: string): ParserStats | null {
    return this.stats.get(source) || null;
  }

  /**
   * Get all statistics
   */
  static getAllStats(): Record<string, ParserStats> {
    const result: Record<string, ParserStats> = {};
    this.stats.forEach((stats, source) => {
      result[source] = { ...stats };
    });
    return result;
  }

  /**
   * Get success rate for a source
   */
  static getSuccessRate(source: string): number {
    const stats = this.stats.get(source);
    if (!stats) return 0;
    const total = stats.successCount + stats.failureCount;
    if (total === 0) return 0;
    return (stats.successCount / total) * 100;
  }

  /**
   * Get overall health status
   */
  static getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    failing: string[];
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const failing: string[] = [];

    this.stats.forEach((stats, source) => {
      const successRate = this.getSuccessRate(source);
      if (successRate >= 80) {
        healthy.push(source);
      } else if (successRate >= 50) {
        degraded.push(source);
      } else {
        failing.push(source);
      }
    });

    return { healthy, degraded, failing };
  }

  /**
   * Reset statistics for a source
   */
  static reset(source?: string): void {
    if (source) {
      this.stats.delete(source);
    } else {
      this.stats.clear();
    }
  }

  /**
   * Get summary report
   */
  static getSummary(): {
    totalSources: number;
    healthy: number;
    degraded: number;
    failing: number;
    overallSuccessRate: number;
    stats: Record<string, ParserStats>;
  } {
    const health = this.getHealthStatus();
    const allStats = this.getAllStats();
    
    let totalSuccess = 0;
    let totalRuns = 0;
    Object.values(allStats).forEach(stats => {
      totalSuccess += stats.successCount;
      totalRuns += stats.successCount + stats.failureCount;
    });

    return {
      totalSources: this.stats.size,
      healthy: health.healthy.length,
      degraded: health.degraded.length,
      failing: health.failing.length,
      overallSuccessRate: totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0,
      stats: allStats,
    };
  }
}

