/**
 * Logger Utility
 * Centralized logging with environment-based levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableProductionLogs: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LogConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'warn');

    this.config = {
      level: logLevel,
      enableConsole: isDevelopment || process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true',
      enableProductionLogs: process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enableConsole) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  // Special methods for common patterns
  logConnection(status: 'connected' | 'disconnected' | 'failed', details?: string): void {
    if (status === 'connected') {
      this.info('✅ Connected to MT5 HTTP Bridge', details || '');
    } else if (status === 'disconnected') {
      this.warn('⚠️ Disconnected from MT5 HTTP Bridge', details || '');
    } else {
      this.error('❌ Connection failed to MT5 HTTP Bridge', details || '');
    }
  }

  logTradeSync(count: number, closed: number, open: number): void {
    this.info(`✅ Synced ${count} trades from MT5 (${closed} closed, ${open} open)`);
  }

  logAccountMetrics(metrics: {
    dailyPL: number;
    unrealizedPL: number;
    monthlyPL: number;
    allTimePL: number;
    openTrades: number;
    totalTrades: number;
  }): void {
    this.debug('📊 Account metrics calculated:', {
      dailyPL: metrics.dailyPL,
      unrealizedPL: metrics.unrealizedPL,
      monthlyPL: metrics.monthlyPL,
      allTimePL: metrics.allTimePL,
      openTrades: metrics.openTrades,
      totalTrades: metrics.totalTrades,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for direct use
export default logger;

