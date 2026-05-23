/**
 * Islamic Trading Service
 * Automatically closes all positions before swap time to avoid haram interest charges
 * 
 * Swap is typically charged at 00:00 GMT (midnight GMT)
 * This service closes all positions 2 hours before swap time (22:00 GMT) for safety
 */

import { httpBridge } from './http-bridge-connector';
import { logger } from './logger';
import { getBridgeUrl } from '@/config/bridge-config';

export interface IslamicTradingConfig {
  enabled: boolean;
  swapTimeGMT: number; // Hour in GMT when swap is charged (0-23, default 0 = midnight)
  closeBeforeHours: number; // Hours before swap time to close positions (default 2)
  autoCloseEnabled: boolean; // Auto-close all positions before swap time
  warnBeforeHours: number; // Hours before swap time to show warning (default 3)
}

const DEFAULT_CONFIG: IslamicTradingConfig = {
  enabled: true,
  swapTimeGMT: 0, // 00:00 GMT (midnight)
  closeBeforeHours: 2, // Close 2 hours before swap (22:00 GMT)
  autoCloseEnabled: true,
  warnBeforeHours: 3, // Warn 3 hours before swap (21:00 GMT)
};

export class IslamicTradingService {
  private static config: IslamicTradingConfig = DEFAULT_CONFIG;
  private static checkInterval: NodeJS.Timeout | null = null;
  private static lastCloseTime: Date | null = null;
  private static isClosing: boolean = false;

  /**
   * Initialize Islamic trading service
   */
  static initialize(customConfig?: Partial<IslamicTradingConfig>): void {
    // Load config from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('islamic_trading_config');
      if (saved) {
        try {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch (e) {
          logger.warn('Failed to load Islamic trading config, using defaults');
        }
      }
    }

    // Apply custom config
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
      this.saveConfig();
    }

    if (!this.config.enabled) {
      logger.info('🕌 Islamic trading service is disabled');
      return;
    }

    logger.info('🕌 Islamic trading service initialized', {
      swapTimeGMT: this.config.swapTimeGMT,
      closeBeforeHours: this.config.closeBeforeHours,
      autoCloseEnabled: this.config.autoCloseEnabled,
    });

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Get current configuration
   */
  static getConfig(): IslamicTradingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<IslamicTradingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    
    if (this.config.enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }

  /**
   * Save configuration to localStorage
   */
  private static saveConfig(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('islamic_trading_config', JSON.stringify(this.config));
    }
  }

  /**
   * Start monitoring for swap time
   */
  private static startMonitoring(): void {
    this.stopMonitoring(); // Clear any existing interval

    // Check every minute
    this.checkInterval = setInterval(() => {
      this.checkAndClosePositions();
    }, 60000); // Check every 60 seconds

    // Also check immediately
    this.checkAndClosePositions();
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if it's time to close positions and close them if needed
   */
  private static async checkAndClosePositions(): Promise<void> {
    if (!this.config.enabled || !this.config.autoCloseEnabled) {
      return;
    }

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentTimeMinutes = utcHour * 60 + utcMinute;

    // Calculate close time (swap time - closeBeforeHours)
    let closeTimeMinutes = (this.config.swapTimeGMT * 60) - (this.config.closeBeforeHours * 60);
    if (closeTimeMinutes < 0) {
      closeTimeMinutes += 24 * 60; // Wrap to previous day
    }

    // Calculate warning time
    let warnTimeMinutes = (this.config.swapTimeGMT * 60) - (this.config.warnBeforeHours * 60);
    if (warnTimeMinutes < 0) {
      warnTimeMinutes += 24 * 60;
    }

    // Check if we should warn
    if (currentTimeMinutes >= warnTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
      const minutesUntilClose = closeTimeMinutes - currentTimeMinutes;
      if (minutesUntilClose <= this.config.warnBeforeHours * 60) {
        this.showWarning(minutesUntilClose);
      }
    }

    // Check if it's time to close
    if (currentTimeMinutes >= closeTimeMinutes) {
      // Check if we already closed today (avoid multiple closes)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (!this.lastCloseTime || this.lastCloseTime < today) {
        await this.closeAllPositions();
        this.lastCloseTime = now;
      }
    }
  }

  /**
   * Show warning before closing positions
   */
  private static showWarning(minutesUntilClose: number): void {
    const hours = Math.floor(minutesUntilClose / 60);
    const minutes = minutesUntilClose % 60;
    
    const message = `🕌 Islamic Trading: Positions will auto-close in ${hours}h ${minutes}m to avoid swap charges`;
    
    // Dispatch custom event for UI to show notification
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('islamic-trading-warning', {
        detail: { message, minutesUntilClose }
      }));
    }

    logger.info(message);
  }

  /**
   * Close all open positions
   */
  static async closeAllPositions(): Promise<{
    success: boolean;
    closedCount: number;
    errors: string[];
  }> {
    if (this.isClosing) {
      logger.warn('🕌 Position closing already in progress');
      return { success: false, closedCount: 0, errors: ['Closing already in progress'] };
    }

    this.isClosing = true;
    const errors: string[] = [];
    let closedCount = 0;

    try {
      logger.info('🕌 Starting auto-close of all positions to avoid swap charges...');

      // Get open positions from MT5
      const response = await fetch(getBridgeUrl('/open-positions'), {
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch open positions: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.positions || data.positions.length === 0) {
        logger.info('🕌 No open positions to close');
        this.isClosing = false;
        return { success: true, closedCount: 0, errors: [] };
      }

      logger.info(`🕌 Found ${data.positions.length} open positions, closing all...`);

      // Close each position using httpBridge
      for (const position of data.positions) {
        try {
          const ticket = position.ticket || position.position_id;
          const closeResult = await httpBridge.closePosition(ticket);
          if (closeResult.success) {
            closedCount++;
            logger.info(`✅ Closed position ${ticket} (${position.symbol})`);
          } else {
            errors.push(`Failed to close ${ticket}: ${closeResult.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          errors.push(`Error closing position ${position.ticket || position.position_id}: ${error.message}`);
        }
      }

      const message = `🕌 Auto-closed ${closedCount} position(s) to avoid swap charges. ${errors.length > 0 ? `Errors: ${errors.length}` : 'All positions closed successfully.'}`;
      logger.info(message);

      // Dispatch event for UI notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('islamic-trading-closed', {
          detail: { closedCount, errors, message }
        }));
      }

      return {
        success: errors.length === 0,
        closedCount,
        errors,
      };
    } catch (error: any) {
      const errorMsg = `Failed to close positions: ${error.message}`;
      logger.error(`🕌 ${errorMsg}`, error);
      errors.push(errorMsg);

      // Dispatch error event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('islamic-trading-error', {
          detail: { error: errorMsg }
        }));
      }

      return {
        success: false,
        closedCount,
        errors,
      };
    } finally {
      this.isClosing = false;
    }
  }


  /**
   * Get time until positions will be closed
   */
  static getTimeUntilClose(): {
    hours: number;
    minutes: number;
    seconds: number;
    willCloseToday: boolean;
  } {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcSecond = now.getUTCSeconds();
    const currentTimeMinutes = utcHour * 60 + utcMinute;

    // Calculate close time
    let closeTimeMinutes = (this.config.swapTimeGMT * 60) - (this.config.closeBeforeHours * 60);
    if (closeTimeMinutes < 0) {
      closeTimeMinutes += 24 * 60; // Wrap to previous day
    }

    let minutesUntilClose = closeTimeMinutes - currentTimeMinutes;
    const willCloseToday = minutesUntilClose >= 0;

    if (minutesUntilClose < 0) {
      minutesUntilClose += 24 * 60; // Next day
    }

    return {
      hours: Math.floor(minutesUntilClose / 60),
      minutes: minutesUntilClose % 60,
      seconds: 60 - utcSecond,
      willCloseToday,
    };
  }

  /**
   * Manually trigger close all positions (for testing or manual use)
   */
  static async manualCloseAll(): Promise<{
    success: boolean;
    closedCount: number;
    errors: string[];
  }> {
    logger.info('🕌 Manual close all positions requested');
    return this.closeAllPositions();
  }
}


