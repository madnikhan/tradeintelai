/**
 * Scalping Service
 * 
 * Automatically executes trades with small take profit targets (e.g., $0.50)
 * After taking profit, re-analyzes the market and re-enters if conditions are favorable
 * 
 * Strategy:
 * 1. Detect strong signals (high confidence)
 * 2. Execute trade with small take profit (e.g., $0.50)
 * 3. Monitor position for take profit hit
 * 4. After profit, re-analyze market
 * 5. Re-enter if signal is still strong
 * 6. Repeat until max scalps reached or signal weakens
 */

import { GatedEngineAdapter } from './gated-engine-adapter';
import { httpBridge } from './http-bridge-connector';
import { RiskCalculator } from './risk-calculator';
import { TradingModeManager } from './trading-mode';
import { logger } from './logger';

export interface ScalpingConfig {
  enabled: boolean;
  takeProfitAmount: number; // Dollar amount (e.g., 0.50 for $0.50)
  minSignalStrength: number; // Minimum confidence to scalp (0-100)
  maxScalpsPerDay: number; // Maximum scalping trades per day
  reEntryDelay: number; // Delay in seconds before re-entering after profit
  maxReEntries: number; // Maximum re-entries per original signal
  minReEntrySignalStrength: number; // Minimum signal strength to re-enter
}

export interface ScalpingTrade {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  takeProfitPrice: number;
  stopLoss: number;
  lotSize: number;
  takeProfitAmount: number; // Target profit in dollars
  orderId?: string;
  status: 'pending' | 'open' | 'closing' | 'profit_taken' | 'stopped' | 'closed';
  createdAt: Date;
  profitTakenAt?: Date;
  profitAmount?: number;
  reEntryCount: number;
  parentTradeId?: string; // For re-entries
}

export class ScalpingService {
  private static config: ScalpingConfig = {
    enabled: false,
    takeProfitAmount: 0.50, // $0.50 default
    minSignalStrength: 75, // 75% confidence minimum
    maxScalpsPerDay: 20,
    reEntryDelay: 5, // 5 seconds
    maxReEntries: 5,
    minReEntrySignalStrength: 70, // 70% for re-entry
  };

  private static activeScalps: Map<string, ScalpingTrade> = new Map();
  private static scalpsToday: number = 0;
  private static lastScalpDate: string = '';

  /**
   * Initialize scalping service
   */
  static initialize(config?: Partial<ScalpingConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Load saved config from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scalping_config');
      if (saved) {
        try {
          const savedConfig = JSON.parse(saved);
          this.config = { ...this.config, ...savedConfig };
        } catch (e) {
          console.error('Failed to load scalping config:', e);
        }
      }

      // Load daily count
      const today = new Date().toDateString();
      if (this.lastScalpDate !== today) {
        this.scalpsToday = 0;
        this.lastScalpDate = today;
      } else {
        const savedCount = localStorage.getItem('scalps_today');
        if (savedCount) {
          this.scalpsToday = parseInt(savedCount, 10) || 0;
        }
      }
    }

    logger.info('Scalping service initialized', { config: this.config });
  }

  /**
   * Update scalping configuration
   */
  static updateConfig(updates: Partial<ScalpingConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('scalping_config', JSON.stringify(this.config));
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): ScalpingConfig {
    return { ...this.config };
  }

  /**
   * Check if a signal is strong enough for scalping
   */
  static isSignalStrongEnough(analysis: any): boolean {
    if (!this.config.enabled) {
      logger.debug('Scalping disabled - not checking signal');
      return false;
    }

    // Check confidence
    const confidence = analysis.confidence || 0;
    logger.debug(`Scalping signal check - Confidence: ${confidence}%, Required: ${this.config.minSignalStrength}%`);
    if (confidence < this.config.minSignalStrength) {
      logger.debug(`Signal too weak for scalping: ${confidence}% < ${this.config.minSignalStrength}%`);
      return false;
    }

    // Check if execution is permitted
    const canExecute = analysis.gateStatus?.executionPermitted ?? false;
    logger.debug(`Scalping signal check - Execution permitted: ${canExecute}`);
    if (!canExecute) {
      logger.debug('Execution not permitted - scalping blocked');
      return false;
    }

    // Check daily limit
    if (this.scalpsToday >= this.config.maxScalpsPerDay) {
      logger.warn(`Scalping daily limit reached: ${this.scalpsToday}/${this.config.maxScalpsPerDay}`);
      return false;
    }

    logger.info(`✅ Signal strong enough for scalping! Confidence: ${confidence}%, Execution: ${canExecute}`);
    return true;
  }

  /**
   * Calculate scalping take profit price based on target dollar amount
   */
  static calculateScalpingTakeProfit(
    entryPrice: number,
    direction: 'BUY' | 'SELL',
    lotSize: number,
    targetProfit: number, // Target profit in dollars
    symbol: string
  ): number {
    const pipSize = this.getPipSize(symbol);
    const pipValuePerLot = this.getPipValue(symbol, entryPrice);

    // Calculate pip distance needed for target profit
    // profit = lotSize * pipDistance * pipValuePerLot
    // pipDistance = profit / (lotSize * pipValuePerLot)
    const pipDistance = targetProfit / (lotSize * pipValuePerLot);

    // Calculate take profit price
    if (direction === 'BUY') {
      return entryPrice + (pipDistance * pipSize);
    } else {
      return entryPrice - (pipDistance * pipSize);
    }
  }

  /**
   * Execute a scalping trade
   */
  static async executeScalp(
    symbol: string,
    analysis: any
  ): Promise<{ success: boolean; trade?: ScalpingTrade; error?: string }> {
    logger.info(`🔍 Scalping execution attempt for ${symbol}`, {
      enabled: this.config.enabled,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
    });

    if (!this.config.enabled) {
      logger.warn('Scalping execution blocked: Scalping is disabled');
      return { success: false, error: 'Scalping is disabled' };
    }

    if (!this.isSignalStrongEnough(analysis)) {
      const confidence = analysis.confidence || 0;
      const canExecute = analysis.gateStatus?.executionPermitted ?? false;
      logger.warn('Scalping execution blocked: Signal not strong enough', {
        confidence,
        required: this.config.minSignalStrength,
        canExecute,
      });
      return { success: false, error: `Signal not strong enough (${confidence}% < ${this.config.minSignalStrength}%) or execution not permitted` };
    }

    try {
      // Check recommendation
      if (!analysis.recommendation || analysis.recommendation === 'HOLD') {
        logger.warn(`Scalping execution blocked: Invalid recommendation (${analysis.recommendation})`);
        return { success: false, error: `Invalid recommendation: ${analysis.recommendation || 'NONE'}` };
      }

      const direction = analysis.recommendation.includes('BUY') ? 'BUY' : 
                       analysis.recommendation.includes('SELL') ? 'SELL' : null;
      
      if (!direction) {
        logger.warn(`Scalping execution blocked: Cannot determine direction from recommendation: ${analysis.recommendation}`);
        return { success: false, error: `Cannot determine direction from recommendation: ${analysis.recommendation}` };
      }
      
      // Get current price from market data or analysis
      let entryPrice: number;
      if (analysis.currentPrice) {
        entryPrice = analysis.currentPrice;
      } else if (analysis.suggestedEntryPrice) {
        entryPrice = analysis.suggestedEntryPrice;
      } else {
        // Try to get from market data
        entryPrice = await this.getCurrentPrice(symbol, direction);
      }
      
      // SCALPING FIX: Calculate position size based on TARGET PROFIT, not risk percentage
      // For scalping, we want small, frequent profits ($0.50), not large risk-based positions
      const { TradingModeManager } = await import('./trading-mode');
      const balance = TradingModeManager.getCurrentBalance();
      
      // Calculate pip size and pip value first
      const pipSize = this.getPipSize(symbol);
      const pipValuePerLot = this.getPipValue(symbol, entryPrice);
      const minStopDistance = this.getMinStopDistance(symbol);
      
      // For scalping, use a reasonable stop loss (20-30 pips for safety)
      // This is wider than the take profit to protect against quick reversals
      const scalpingStopDistance = symbol.includes('JPY') ? 0.30 : 0.0030; // 30 pips for JPY, 30 pips for others
      
      let stopLoss = analysis.suggestedStopLoss;
      if (!stopLoss) {
        // Default: use scalping stop distance
        stopLoss = direction === 'BUY' 
          ? entryPrice - scalpingStopDistance 
          : entryPrice + scalpingStopDistance;
      }
      
      // Calculate stop loss distance and ensure it meets minimum
      let stopLossDistance = Math.abs(entryPrice - stopLoss);
      if (stopLossDistance < minStopDistance) {
        // Adjust stop loss to meet minimum distance
        stopLoss = direction === 'BUY'
          ? entryPrice - Math.max(minStopDistance, scalpingStopDistance)
          : entryPrice + Math.max(minStopDistance, scalpingStopDistance);
        stopLossDistance = Math.abs(entryPrice - stopLoss);
        logger.warn(`Stop loss adjusted to meet minimum distance: ${stopLoss.toFixed(5)}`);
      }
      
      // SCALPING LOGIC: Calculate lot size based on TARGET PROFIT ($0.50)
      // For scalping, we want small positions that can achieve $0.50 profit with reasonable price movement
      // Formula: targetProfit = lotSize * pipDistanceToTP * pipValuePerLot
      // We'll use a reasonable TP distance (10-20 pips) and calculate lot size from that
      
      // Use a reasonable take profit distance for scalping (10-20 pips)
      // This is smaller than stop loss to maintain good risk/reward
      const targetPipDistance = symbol.includes('JPY') ? 0.20 : 0.0020; // 20 pips
      const targetPipDistanceInPips = targetPipDistance / pipSize;
      
      // Calculate lot size needed to achieve $0.50 profit with this TP distance
      // lotSize = targetProfit / (pipDistance * pipValuePerLot)
      let calculatedLotSize = this.config.takeProfitAmount / (targetPipDistanceInPips * pipValuePerLot);
      
      // SCALPING SAFETY: Cap lot size to reasonable maximum for scalping
      // Scalping should use small positions (max 1-2 lots), not large positions
      const maxScalpingLotSize = 2.0; // Maximum 2 lots for scalping
      calculatedLotSize = Math.min(calculatedLotSize, maxScalpingLotSize);
      
      // Also ensure we don't risk more than 0.5% of balance
      const maxRiskAmount = balance * 0.005; // 0.5% max risk for scalping
      const pipDistance = stopLossDistance / pipSize;
      const maxLotSizeByRisk = maxRiskAmount / (pipDistance * pipValuePerLot);
      
      // Use the smaller of: (1) lot size for $0.50 target, (2) lot size for 0.5% risk, (3) max scalping size
      calculatedLotSize = Math.min(calculatedLotSize, maxLotSizeByRisk, maxScalpingLotSize);
      
      // Safety check: ensure calculated lot size is a valid number
      if (!isFinite(calculatedLotSize) || isNaN(calculatedLotSize) || calculatedLotSize <= 0) {
        logger.error('Scalping execution failed: Invalid lot size calculation', {
          calculatedLotSize,
          maxRiskAmount,
          pipDistance,
          pipValuePerLot,
        });
        return { success: false, error: 'Invalid position size calculation' };
      }
      
      // CRITICAL: Cap position size to 5% of account equity FIRST (before any other calculations)
      const maxPositionValue = balance * 0.05; // 5% of account equity
      const maxLotSize = maxPositionValue / (100000 * entryPrice);
      
      // Safety check: ensure maxLotSize is valid
      if (!isFinite(maxLotSize) || isNaN(maxLotSize) || maxLotSize <= 0) {
        logger.error('Scalping execution failed: Invalid max lot size calculation', {
          maxLotSize,
          maxPositionValue,
          balance,
          entryPrice,
        });
        return { success: false, error: 'Invalid maximum position size calculation' };
      }
      
      // Use the smaller of calculated or max allowed, but ensure minimum
      let scalpingLotSize = Math.min(calculatedLotSize, maxLotSize);
      scalpingLotSize = Math.max(0.01, scalpingLotSize); // Ensure minimum 0.01 lots
      
      // Final safety check: ensure scalpingLotSize is valid and reasonable
      if (!isFinite(scalpingLotSize) || isNaN(scalpingLotSize) || scalpingLotSize > maxLotSize * 1.01) {
        // If somehow we exceeded maxLotSize by more than 1%, cap it
        scalpingLotSize = Math.min(scalpingLotSize, maxLotSize);
        logger.warn(`Scalping lot size adjusted: ${scalpingLotSize.toFixed(2)} lots (capped to max: ${maxLotSize.toFixed(2)})`);
      }
      
      // Final validation - double check position value
      const finalPositionValue = scalpingLotSize * 100000 * entryPrice;
      if (finalPositionValue > maxPositionValue) {
        // If still too large, cap it to max
        scalpingLotSize = maxLotSize;
        logger.warn(`Position size capped to maximum: ${scalpingLotSize.toFixed(2)} lots (${(finalPositionValue / balance * 100).toFixed(2)}% of equity)`);
      }
      
      // Final validation
      if (scalpingLotSize < 0.01) {
        logger.error('Scalping execution failed: Calculated lot size too small', {
          calculatedLotSize,
          maxLotSize,
          balance,
          entryPrice,
          symbol,
        });
        return { success: false, error: 'Calculated position size too small (minimum 0.01 lots)' };
      }
      
      const finalCheckPositionValue = scalpingLotSize * 100000 * entryPrice;
      if (finalCheckPositionValue > maxPositionValue) {
        logger.error('Scalping execution failed: Position size exceeds 5% equity limit after capping', {
          lotSize: scalpingLotSize,
          positionValue: finalCheckPositionValue,
          maxPositionValue,
          balance,
          maxLotSize,
        });
        return { 
          success: false, 
          error: `Position size too large: ${scalpingLotSize.toFixed(2)} lots exceeds 5% of account equity. Maximum allowed: ${maxLotSize.toFixed(2)} lots.` 
        };
      }
      
      logger.info(`Scalping position size calculated: ${scalpingLotSize.toFixed(2)} lots (target profit: $${this.config.takeProfitAmount}, max risk: $${(balance * 0.005).toFixed(2)}, stop: ${stopLossDistance.toFixed(5)})`);

      // Calculate take profit price for target dollar amount
      const takeProfitPrice = this.calculateScalpingTakeProfit(
        entryPrice,
        direction,
        scalpingLotSize,
        this.config.takeProfitAmount,
        symbol
      );

      // Ensure minimum distance from entry (reuse pipSize and pipValuePerLot from above)
      const minDistance = this.getMinStopDistance(symbol);
      const actualTPDistance = Math.abs(takeProfitPrice - entryPrice);
      
      let finalTakeProfit = takeProfitPrice;
      
      if (actualTPDistance < minDistance) {
        // Adjust take profit to meet minimum distance
        if (direction === 'BUY') {
          finalTakeProfit = entryPrice + (minDistance * 1.5); // 1.5x minimum for safety
          // Recalculate target profit based on adjusted TP
          const pipDistance = (finalTakeProfit - entryPrice) / pipSize;
          const adjustedProfit = scalpingLotSize * pipDistance * pipValuePerLot;
          logger.warn(`Take profit adjusted to meet minimum distance. New target: $${adjustedProfit.toFixed(2)}`);
        } else {
          finalTakeProfit = entryPrice - (minDistance * 1.5);
          const pipDistance = (entryPrice - finalTakeProfit) / pipSize;
          const adjustedProfit = scalpingLotSize * pipDistance * pipValuePerLot;
          logger.warn(`Take profit adjusted to meet minimum distance. New target: $${adjustedProfit.toFixed(2)}`);
        }
      }

      // Execute the trade
      const tradeResult = await httpBridge.executeTrade({
        symbol,
        type: direction,
        volume: scalpingLotSize,
        stopLoss,
        takeProfit: finalTakeProfit,
      });

      if (!tradeResult.success) {
        logger.error('Scalping trade execution failed via httpBridge', {
          error: tradeResult.error,
          symbol,
          direction,
          volume: scalpingLotSize,
          stopLoss,
          takeProfit: finalTakeProfit,
        });
        return { success: false, error: tradeResult.error || 'Trade execution failed' };
      }

      // Create scalping trade record
      const scalpTrade: ScalpingTrade = {
        id: `scalp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        direction,
        entryPrice,
        takeProfitPrice: finalTakeProfit,
        stopLoss,
        lotSize: scalpingLotSize,
        takeProfitAmount: this.config.takeProfitAmount,
        orderId: tradeResult.order_id || tradeResult.orderId,
        status: 'open',
        createdAt: new Date(),
        reEntryCount: 0,
      };

      this.activeScalps.set(scalpTrade.id, scalpTrade);
      this.scalpsToday++;
      this.saveDailyCount();

      logger.info(`✅ Scalping trade executed: ${symbol} ${direction} @ ${entryPrice}, TP: ${takeProfitPrice} (target: $${this.config.takeProfitAmount})`);

      // Start monitoring this scalp
      this.monitorScalp(scalpTrade);

      return { success: true, trade: scalpTrade };
    } catch (error: any) {
      logger.error('Scalping trade execution failed:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Monitor a scalping trade for take profit hit
   */
  private static async monitorScalp(trade: ScalpingTrade): Promise<void> {
    const checkInterval = 3000; // Check every 3s to reduce bridge load
    const maxWaitTime = 5 * 60 * 1000; // Max 5 minutes
    const startTime = Date.now();

    const checkProfit = async () => {
      // Check if we've exceeded max wait time
      if (Date.now() - startTime > maxWaitTime) {
        logger.warn(`Scalping trade ${trade.id} exceeded max wait time - stopping monitoring`);
        this.activeScalps.delete(trade.id);
        return;
      }

      try {
        // Get current positions
        let positionsResponse;
        try {
          positionsResponse = await httpBridge.getPositions();
        } catch (bridgeError: any) {
          logger.error(`Failed to get positions from bridge for scalp ${trade.id}:`, {
            error: bridgeError?.message || bridgeError,
            symbol: trade.symbol,
            orderId: trade.orderId,
          });
          // Retry after interval
          setTimeout(checkProfit, checkInterval);
          return;
        }

        // Handle different response formats
        let allPositions: any[] = [];
        if (Array.isArray(positionsResponse)) {
          allPositions = positionsResponse;
        } else if (positionsResponse && typeof positionsResponse === 'object') {
          // Try multiple possible field names
          allPositions = positionsResponse.positions || 
                        positionsResponse.data || 
                        positionsResponse.result ||
                        (positionsResponse.success !== false ? Object.values(positionsResponse).find((v: any) => Array.isArray(v)) as any[] : []) ||
                        [];
        } else {
          // Invalid response type (string, number, null, etc.)
          logger.warn(`Unexpected positions response format for scalp ${trade.id}:`, {
            responseType: typeof positionsResponse,
            response: positionsResponse,
          });
          // Retry after interval
          setTimeout(checkProfit, checkInterval);
          return;
        }

        if (!Array.isArray(allPositions)) {
          logger.warn(`Positions data is not an array for scalp ${trade.id}:`, {
            responseType: typeof positionsResponse,
            positionsType: typeof allPositions,
            response: positionsResponse,
          });
          // Retry after interval
          setTimeout(checkProfit, checkInterval);
          return;
        }

        const openPositions = allPositions.filter((p: any) => {
          const status = p.status || p.state || '';
          return status === 'open' || status === '' || !status;
        });

        const position = openPositions.find((p: any) => {
          const orderId = p.order_id || p.orderId || p.ticket || p.id;
          const symbolMatch = p.symbol === trade.symbol;
          const entryPrice = p.entry_price || p.entryPrice || p.open_price || p.price;
          const priceMatch = entryPrice && Math.abs(entryPrice - trade.entryPrice) < 0.0001;
          
          return (orderId && (orderId === trade.orderId || String(orderId) === String(trade.orderId))) ||
                 (symbolMatch && priceMatch);
        });

        if (!position) {
          // Position closed - check if it was profit or stop loss
          const closedPositions = allPositions.filter((p: any) => {
            const status = p.status || p.state || '';
            return status === 'closed' || status === 'filled' || status === 'completed';
          });

          const closed = closedPositions.find((p: any) => {
            const orderId = p.order_id || p.orderId || p.ticket || p.id;
            return orderId && (orderId === trade.orderId || String(orderId) === String(trade.orderId));
          });

          if (closed) {
            const profit = closed.profit || closed.profitLoss || closed.pl || 0;
            if (profit > 0) {
              // Profit taken!
              trade.status = 'profit_taken';
              trade.profitTakenAt = new Date();
              trade.profitAmount = profit;
              this.activeScalps.delete(trade.id);

              logger.info(`💰 Scalping profit taken: $${profit.toFixed(2)} on ${trade.symbol}`);

              // Wait for re-entry delay, then re-analyze and potentially re-enter
              setTimeout(() => {
                this.handleProfitTaken(trade);
              }, this.config.reEntryDelay * 1000);
              return;
            } else {
              // Stop loss hit
              trade.status = 'stopped';
              this.activeScalps.delete(trade.id);
              logger.warn(`🛑 Scalping stop loss hit on ${trade.symbol} (loss: $${Math.abs(profit).toFixed(2)})`);
              return;
            }
          }
        }

        // Position still open - check if profit target is reached
        if (position) {
          // Check actual profit amount (more reliable than price comparison)
          const currentProfit = position.profit || position.profitLoss || position.pl || 0;
          
          // Log progress if close to target (for debugging)
          if (currentProfit >= trade.takeProfitAmount * 0.8 && currentProfit < trade.takeProfitAmount) {
            logger.debug(`Scalping progress: $${currentProfit.toFixed(2)} / $${trade.takeProfitAmount} target (${trade.symbol})`);
          }
          
          // Also check current price as backup
          const currentPrice = position.current_price || position.currentPrice || 
                              position.price ||
                              (trade.direction === 'BUY' ? (position.ask || position.bid) : (position.bid || position.ask));
          
          // Check if profit target is reached
          const profitTargetReached = currentProfit >= trade.takeProfitAmount;
          
          // Also check if price reached take profit level (backup check)
          let priceTargetReached = false;
          if (currentPrice && typeof currentPrice === 'number') {
            priceTargetReached = trade.direction === 'BUY'
              ? currentPrice >= trade.takeProfitPrice
              : currentPrice <= trade.takeProfitPrice;
          }

          if (profitTargetReached || priceTargetReached) {
            // Profit target reached - actively close the position
            const ticket = position.ticket || position.order_id || position.orderId || trade.orderId;
            
            if (ticket) {
              // Mark that we're attempting to close (prevent multiple simultaneous close attempts)
              if (trade.status === 'closing') {
                // Already attempting to close, wait and check again
                setTimeout(checkProfit, checkInterval);
                return;
              }

              trade.status = 'closing';
              logger.info(`💰 Scalping profit target reached ($${currentProfit.toFixed(2)} >= $${trade.takeProfitAmount}) - closing position ${ticket}`);
              
              // Retry closing up to 5 times with exponential backoff
              let closeAttempts = 0;
              const maxCloseAttempts = 5;
              let closeSuccess = false;

              while (closeAttempts < maxCloseAttempts && !closeSuccess) {
                try {
                  logger.info(`Attempting to close position ${ticket} (attempt ${closeAttempts + 1}/${maxCloseAttempts})`);
                  
                  const closeResult = await httpBridge.closePosition(ticket);
                  
                  if (closeResult.success) {
                    // Position closed successfully
                    closeSuccess = true;
                    trade.status = 'profit_taken';
                    trade.profitTakenAt = new Date();
                    trade.profitAmount = currentProfit;
                    this.activeScalps.delete(trade.id);

                    logger.info(`✅ Scalping position closed: $${currentProfit.toFixed(2)} profit on ${trade.symbol}`);

                    // Wait for re-entry delay, then re-analyze and potentially re-enter
                    setTimeout(() => {
                      this.handleProfitTaken(trade);
                    }, this.config.reEntryDelay * 1000);
                    return;
                  } else {
                    closeAttempts++;
                    logger.warn(`Failed to close scalping position ${ticket} (attempt ${closeAttempts}/${maxCloseAttempts}): ${closeResult.error}`);
                    
                    if (closeAttempts < maxCloseAttempts) {
                      // Exponential backoff: wait 1s, 2s, 4s, 8s
                      const waitTime = Math.min(1000 * Math.pow(2, closeAttempts - 1), 8000);
                      logger.info(`Retrying close in ${waitTime}ms...`);
                      await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                  }
                } catch (closeError: any) {
                  closeAttempts++;
                  logger.error(`Error closing scalping position ${ticket} (attempt ${closeAttempts}/${maxCloseAttempts}):`, {
                    error: closeError?.message || closeError,
                    stack: closeError?.stack,
                  });
                  
                  if (closeAttempts < maxCloseAttempts) {
                    // Exponential backoff
                    const waitTime = Math.min(1000 * Math.pow(2, closeAttempts - 1), 8000);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                  }
                }
              }

              // If all close attempts failed, reset status and continue monitoring
              if (!closeSuccess) {
                logger.error(`❌ Failed to close scalping position ${ticket} after ${maxCloseAttempts} attempts. Will keep monitoring.`);
                trade.status = 'open'; // Reset status to continue monitoring
                
                // Show error notification to user
                if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
                  (window as any).addErrorNotification({
                    type: 'error',
                    title: '⚡ Scalping Close Failed',
                    message: `Failed to close ${trade.symbol} position ($${currentProfit.toFixed(2)} profit). Bridge connection issue. Will retry.`,
                  });
                }
                
                // Continue monitoring - will retry on next check
                setTimeout(checkProfit, checkInterval * 2); // Check less frequently if closing failed
                return;
              }
            } else {
              logger.warn(`Cannot close scalping position - no ticket found for ${trade.symbol}`);
              // Continue monitoring
              setTimeout(checkProfit, checkInterval);
              return;
            }
          }
        }

        // Continue monitoring
        setTimeout(checkProfit, checkInterval);
      } catch (error: any) {
        logger.error(`Error monitoring scalp ${trade.id}:`, {
          error: error?.message || error,
          stack: error?.stack,
          symbol: trade.symbol,
          orderId: trade.orderId,
        });
        // Continue monitoring despite error (with longer delay on error)
        setTimeout(checkProfit, checkInterval * 2);
      }
    };

    // Start monitoring
    checkProfit();
  }

  /**
   * Handle profit taken - re-analyze and potentially re-enter
   */
  private static async handleProfitTaken(trade: ScalpingTrade): Promise<void> {
    if (trade.reEntryCount >= this.config.maxReEntries) {
      logger.info(`Max re-entries reached for ${trade.symbol} (${trade.reEntryCount}/${this.config.maxReEntries})`);
      return;
    }

    try {
      logger.info(`🔄 Re-analyzing ${trade.symbol} after profit taken...`);

      // Re-analyze the market
      const adapter = new GatedEngineAdapter();
      const analysis = await adapter.analyzeMarket(trade.symbol, []);

      const confidence = analysis.confidence || 0;
      const canExecute = analysis.gateStatus?.executionPermitted ?? false;

      if (confidence >= this.config.minReEntrySignalStrength && canExecute) {
        // Signal is still strong - re-enter
        logger.info(`✅ Re-entry signal confirmed for ${trade.symbol} (confidence: ${confidence}%)`);

        const reEntryResult = await this.executeScalp(trade.symbol, analysis);
        
        if (reEntryResult.success && reEntryResult.trade) {
          reEntryResult.trade.parentTradeId = trade.id;
          reEntryResult.trade.reEntryCount = trade.reEntryCount + 1;
          logger.info(`✅ Re-entry executed: ${trade.symbol} (re-entry #${reEntryResult.trade.reEntryCount})`);
        } else {
          logger.warn(`Re-entry failed for ${trade.symbol}: ${reEntryResult.error}`);
        }
      } else {
        logger.info(`Signal weakened for ${trade.symbol} (confidence: ${confidence}%) - not re-entering`);
      }
    } catch (error: any) {
      logger.error(`Error handling profit taken for ${trade.symbol}:`, error);
    }
  }

  /**
   * Get current price for a symbol
   */
  private static async getCurrentPrice(symbol: string, direction: 'BUY' | 'SELL'): Promise<number> {
    try {
      const marketData = await httpBridge.getMarketData(symbol);
      if (marketData && marketData.success !== false) {
        // Market data should have bid/ask prices
        if (direction === 'BUY') {
          return marketData.ask || marketData.price || marketData.close || 0;
        } else {
          return marketData.bid || marketData.price || marketData.close || 0;
        }
      }
      throw new Error('Invalid market data response');
    } catch (error: any) {
      logger.error(`Failed to get current price for ${symbol}:`, error);
      throw new Error(`Failed to get current price: ${error.message}`);
    }
  }

  /**
   * Get pip size for a symbol
   */
  private static getPipSize(symbol: string): number {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
  }

  /**
   * Get pip value per lot for a symbol
   */
  private static getPipValue(symbol: string, price: number): number {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.endsWith('USD')) {
      return 10; // $10 per pip per standard lot
    }
    if (upperSymbol.startsWith('USD') && upperSymbol.includes('JPY')) {
      return 1000 / price;
    }
    if (upperSymbol.startsWith('USD')) {
      return 10 / price;
    }
    return 10; // Default
  }

  /**
   * Get minimum stop distance for a symbol
   */
  private static getMinStopDistance(symbol: string): number {
    // Most brokers require minimum 10-20 pips
    return symbol.includes('JPY') ? 0.10 : 0.0010; // 10 pips
  }

  /**
   * Save daily count to localStorage
   */
  private static saveDailyCount(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scalps_today', this.scalpsToday.toString());
      this.lastScalpDate = new Date().toDateString();
    }
  }

  /**
   * Get active scalping trades
   */
  static getActiveScalps(): ScalpingTrade[] {
    return Array.from(this.activeScalps.values());
  }

  /**
   * Get scalping statistics
   */
  static getStatistics(): {
    activeScalps: number;
    scalpsToday: number;
    maxScalpsPerDay: number;
    totalProfit: number;
  } {
    const activeScalps = this.getActiveScalps();
    const totalProfit = activeScalps
      .filter(t => t.status === 'profit_taken' && t.profitAmount)
      .reduce((sum, t) => sum + (t.profitAmount || 0), 0);

    return {
      activeScalps: activeScalps.length,
      scalpsToday: this.scalpsToday,
      maxScalpsPerDay: this.config.maxScalpsPerDay,
      totalProfit,
    };
  }
}

// Initialize scalping service on import (after class definition)
// Wrap in try-catch to prevent initialization errors from breaking the app
if (typeof window !== 'undefined') {
  try {
    ScalpingService.initialize();
  } catch (error) {
    // Silently fail initialization - components will initialize it when needed
    console.warn('Scalping service initialization failed (will retry in components):', error);
  }
}
