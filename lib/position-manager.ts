/**
 * Position Manager
 * Handles partial profit-taking and trailing stops
 */

import { Trade, TradeDirection } from '@/types/trading';

export interface PositionLevel {
  level: number;  // Price level
  percentage: number;  // % of position to close at this level
  executed: boolean;
  executedAt?: Date;
}

export interface PositionManagement {
  tradeId: string;
  entryPrice: number;
  direction: TradeDirection;
  initialLotSize: number;
  remainingLotSize: number;
  stopLoss: number;
  takeProfit: number;
  profitLevels: PositionLevel[];
  trailingStop?: {
    enabled: boolean;
    distance: number;  // Distance from highest/lowest price
    currentStop: number;
  };
  currentPrice: number;
  unrealizedPL: number;
  realizedPL: number;
}

export class PositionManager {
  private static positions: Map<string, PositionManagement> = new Map();

  /**
   * Initialize position management for a trade
   */
  static initializePosition(trade: Trade, currentPrice: number): PositionManagement {
    const initialLotSize = trade.lotSize;
    
    // PHASE 2: Partial profit-taking levels
    // 50% at 1:1 risk-reward, 25% at 1:2, 25% trailing
    const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss);
    const profitLevel1 = trade.entryPrice + (riskDistance * 1 * (trade.direction === 'BUY' ? 1 : -1));
    const profitLevel2 = trade.entryPrice + (riskDistance * 2 * (trade.direction === 'BUY' ? 1 : -1));

    const profitLevels: PositionLevel[] = [
      { level: profitLevel1, percentage: 50, executed: false },
      { level: profitLevel2, percentage: 25, executed: false },
      // Remaining 25% will use trailing stop
    ];

    const management: PositionManagement = {
      tradeId: trade.id,
      entryPrice: trade.entryPrice,
      direction: trade.direction,
      initialLotSize,
      remainingLotSize: initialLotSize,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      profitLevels,
      trailingStop: {
        enabled: true,
        distance: riskDistance * 0.5, // Trail by 50% of risk distance
        currentStop: trade.stopLoss
      },
      currentPrice,
      unrealizedPL: 0,
      realizedPL: 0
    };

    this.positions.set(trade.id, management);
    return management;
  }

  /**
   * Update position with current price and check for profit-taking
   */
  static updatePosition(tradeId: string, currentPrice: number): {
    shouldClose: boolean;
    closePercentage: number;
    newStopLoss?: number;
    realizedPL: number;
  } {
    const position = this.positions.get(tradeId);
    if (!position) {
      return { shouldClose: false, closePercentage: 0, realizedPL: 0 };
    }

    position.currentPrice = currentPrice;
    
    // Calculate unrealized P/L
    const priceDiff = currentPrice - position.entryPrice;
    const multiplier = position.direction === 'BUY' ? 1 : -1;
    position.unrealizedPL = priceDiff * multiplier * position.remainingLotSize * 100000; // Simplified

    // Check profit levels
    let totalClosePercentage = 0;
    let realizedPL = 0;

    for (const level of position.profitLevels) {
      if (!level.executed) {
        const hitLevel = position.direction === 'BUY' 
          ? currentPrice >= level.level
          : currentPrice <= level.level;

        if (hitLevel) {
          level.executed = true;
          level.executedAt = new Date();
          totalClosePercentage += level.percentage;
          
          // Calculate realized P/L for this level
          const levelPL = (level.level - position.entryPrice) * multiplier * 
                         (position.initialLotSize * level.percentage / 100) * 100000;
          realizedPL += levelPL;
          position.realizedPL += levelPL;
          
          // Update remaining lot size
          position.remainingLotSize -= position.initialLotSize * level.percentage / 100;
        }
      }
    }

    // Update trailing stop for remaining 25%
    let newStopLoss: number | undefined;
    if (position.trailingStop && position.trailingStop.enabled && position.remainingLotSize > 0) {
      const trailingStop = this.updateTrailingStop(position, currentPrice);
      if (trailingStop) {
        newStopLoss = trailingStop;
        position.trailingStop.currentStop = trailingStop;
        position.stopLoss = trailingStop;
      }
    }

    // Check if stop loss hit
    const stopHit = position.direction === 'BUY'
      ? currentPrice <= position.stopLoss
      : currentPrice >= position.stopLoss;

    return {
      shouldClose: stopHit || totalClosePercentage > 0,
      closePercentage: stopHit ? 100 : totalClosePercentage,
      newStopLoss,
      realizedPL
    };
  }

  /**
   * Update trailing stop
   */
  private static updateTrailingStop(
    position: PositionManagement,
    currentPrice: number
  ): number | undefined {
    if (!position.trailingStop) return undefined;

    const { distance, currentStop } = position.trailingStop;

    if (position.direction === 'BUY') {
      // For long positions, trail stop upward
      const newStop = currentPrice - distance;
      if (newStop > currentStop) {
        return newStop;
      }
    } else {
      // For short positions, trail stop downward
      const newStop = currentPrice + distance;
      if (newStop < currentStop || currentStop === position.stopLoss) {
        return newStop;
      }
    }

    return undefined;
  }

  /**
   * Get position management for a trade
   */
  static getPosition(tradeId: string): PositionManagement | undefined {
    return this.positions.get(tradeId);
  }

  /**
   * Close position completely
   */
  static closePosition(tradeId: string, closePrice: number): number {
    const position = this.positions.get(tradeId);
    if (!position) return 0;

    const priceDiff = closePrice - position.entryPrice;
    const multiplier = position.direction === 'BUY' ? 1 : -1;
    const finalPL = priceDiff * multiplier * position.remainingLotSize * 100000;

    position.realizedPL += finalPL;
    position.remainingLotSize = 0;
    this.positions.delete(tradeId);

    return finalPL;
  }

  /**
   * Get all active positions
   */
  static getActivePositions(): PositionManagement[] {
    return Array.from(this.positions.values()).filter(p => p.remainingLotSize > 0);
  }
}

