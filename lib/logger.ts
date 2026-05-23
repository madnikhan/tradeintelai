/**
 * Enhanced Logger Utility
 * Centralized logging with environment-based levels, structured logging, and persistence
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableProductionLogs: boolean;
  enablePersistence: boolean;
  maxLogEntries: number;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LogConfig;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000; // Keep last 1000 log entries in memory

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'warn');

    this.config = {
      level: logLevel,
      enableConsole: isDevelopment || process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true',
      enableProductionLogs: process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true',
      enablePersistence: process.env.NEXT_PUBLIC_ENABLE_LOG_PERSISTENCE === 'true',
      maxLogEntries: parseInt(process.env.NEXT_PUBLIC_MAX_LOG_ENTRIES || '1000', 10),
    };

    // Load persisted logs on initialization (client-side only)
    if (typeof window !== 'undefined' && this.config.enablePersistence) {
      this.loadPersistedLogs();
    }
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

  private createLogEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context,
    };
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }

    // Persist logs if enabled (client-side only)
    if (typeof window !== 'undefined' && this.config.enablePersistence) {
      this.persistLogs();
    }
  }

  private persistLogs(): void {
    try {
      const logsToPersist = this.logBuffer.slice(-100); // Only persist last 100 entries
      localStorage.setItem('trading_logs', JSON.stringify(logsToPersist));
    } catch (error) {
      // Silently fail if localStorage is not available or quota exceeded
      console.warn('Failed to persist logs:', error);
    }
  }

  private loadPersistedLogs(): void {
    try {
      const persisted = localStorage.getItem('trading_logs');
      if (persisted) {
        const logs = JSON.parse(persisted) as LogEntry[];
        this.logBuffer = logs;
      }
    } catch (error) {
      console.warn('Failed to load persisted logs:', error);
    }
  }

  debug(message: string, data?: any, context?: string): void {
    const entry = this.createLogEntry('debug', message, data, context);
    this.addToBuffer(entry);
    
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), data || '');
    }
  }

  info(message: string, data?: any, context?: string): void {
    const entry = this.createLogEntry('info', message, data, context);
    this.addToBuffer(entry);
    
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), data || '');
    }
  }


  error(message: string, data?: any, context?: string): void {
    const entry = this.createLogEntry('error', message, data, context);
    this.addToBuffer(entry);
    
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), data || '');
    }

    // Dispatch error event for notification system (client-side only)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('log-error', {
        detail: { message, data, context }
      }));
    }
  }

  warn(message: string, data?: any, context?: string): void {
    const entry = this.createLogEntry('warn', message, data, context);
    this.addToBuffer(entry);
    
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data || '');
    }

    // Dispatch warning event for notification system (client-side only)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('log-warning', {
        detail: { message, data, context }
      }));
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(level?: LogLevel, limit: number = 100): LogEntry[] {
    let logs = this.logBuffer;
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    return logs.slice(-limit);
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trading_logs');
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
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

