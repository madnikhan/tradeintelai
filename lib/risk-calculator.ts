import { TradingModeManager } from './trading-mode';
import { TRADING_RULES } from '@/config/trading-rules';
import { RiskMetrics, Trade } from '@/types/trading';
import { EconomicCalendar } from './economic-calendar';
import { logger } from './logger';

export interface TradeSizeResult {
  riskAmount: number;
  rewardAmount: number;
  lotSize: number;
  positionSize: number;
  isValid: boolean;
  message: string;
  volatilityAdjustment?: number;
  newsAdjustment?: number;
  adjustedRiskAmount?: number;
}

export class RiskCalculator {
  /**
   * Get dynamic risk percentage based on account size
   * Small accounts need higher risk to meet minimum lot size (0.01)
   * @param balance Account balance
   * @returns Risk percentage (0.02 = 2%, 0.05 = 5%, etc.)
   */
  private static getRiskPercentage(balance: number): number {
    // CRITICAL FIX: Dynamic risk for small accounts
    // Small accounts need higher risk to meet minimum lot size (0.01 lots)
    if (balance < 500) {
      // Accounts < $500: Use 5% risk to meet minimum lot size
      // Example: $100 account, 5% = $5 risk, 50 pip stop = 0.01 lots ✅
      return 0.05; // 5%
    } else if (balance < 1000) {
      // Accounts $500-$1000: Use 3% risk
      // Example: $500 account, 3% = $15 risk, 50 pip stop = 0.03 lots ✅
      return 0.03; // 3%
    } else {
      // Accounts >= $1000: Use default 2% risk
      return TRADING_RULES.RISK_PERCENTAGE; // 2%
    }
  }

  /**
   * Calculate trade size with volatility and news adjustments
   * @param entryPrice Entry price
   * @param stopLossPrice Stop loss price
   * @param pair Currency pair
   * @param currentATR Current ATR value (for volatility adjustment)
   * @param baseATR Base ATR value (for comparison)
   */
  static async calculateTradeSize(
    entryPrice: number,
    stopLossPrice: number,
    pair: string,
    currentATR?: number,
    baseATR?: number
  ): Promise<TradeSizeResult> {
    const balance = TradingModeManager.getCurrentBalance();
    
    // CRITICAL FIX: Dynamic risk percentage for small accounts
    const riskPercentage = this.getRiskPercentage(balance);
    let riskAmount = balance * riskPercentage;
    
    // Show warning for small accounts using higher risk
    if (balance < 500) {
      logger.warn(`⚠️ Small account detected ($${balance.toFixed(2)}). Using ${(riskPercentage * 100).toFixed(0)}% risk per trade to meet minimum lot size (0.01 lots). Consider depositing more funds (minimum $500 recommended) for better risk management with 2% risk.`);
    }
    
    // PHASE 1: Volatility adjustment
    let volatilityAdjustment = 1.0;
    if (currentATR && baseATR && baseATR > 0 && currentATR > 0) {
      // CRITICAL FIX: Validate ATR values are reasonable
      // Real EURUSD ATR should be 0.0060-0.0100 (60-100 pips)
      // If ATR is suspiciously small (< 0.001), ignore the adjustment
      const minValidATR = 0.001; // 10 pips minimum
      const maxValidATR = 0.02;  // 200 pips maximum
      
      if (currentATR < minValidATR || currentATR > maxValidATR) {
        // ATR data is corrupted or wrong - don't use it for adjustment
        logger.warn(`Invalid ATR value detected: ${currentATR.toFixed(5)} for ${pair}. Expected range: 0.001-0.02. Ignoring volatility adjustment.`);
      } else {
        // Adjust position size based on volatility
        // Higher volatility = smaller position size (to keep monetary risk constant)
        volatilityAdjustment = baseATR / currentATR;
        // CRITICAL: Clamp adjustment between 0.5 and 1.5 (more conservative)
        // Never increase position size by more than 50% due to low volatility
        volatilityAdjustment = Math.max(0.5, Math.min(1.5, volatilityAdjustment));
        riskAmount = riskAmount * volatilityAdjustment;
      }
    }
    
    // PHASE 1: News impact adjustment
    let newsAdjustment = 1.0;
    try {
      const newsFactor = await EconomicCalendar.getPositionSizeFactor(pair);
      newsAdjustment = newsFactor;
      riskAmount = riskAmount * newsAdjustment;
    } catch (error) {
      console.warn('Failed to get news impact:', error);
    }
    
    // Get all trades for correlation and drawdown calculations
    let allTrades: any[] = [];
    try {
      const { getStoredTrades } = await import('./trade-history');
      allTrades = getStoredTrades();
    } catch (error) {
      // Non-critical - continue without trade history
    }
    
    // NEW: Correlation-based position sizing adjustment
    let correlationAdjustment = 1.0;
    try {
      const { CorrelationMonitor } = await import('./correlation-monitor');
      
      // Get open positions (use allTrades already fetched above)
      const openTrades = allTrades.filter(t => t.status === 'open');
      
      if (openTrades.length > 0) {
        // Calculate total exposure to correlated pairs
        let totalCorrelatedExposure = 0;
        for (const trade of openTrades) {
          const correlation = Math.abs(CorrelationMonitor.getCorrelation(pair, trade.pair));
          if (correlation >= 0.7) {
            // High correlation - reduce position size
            totalCorrelatedExposure += correlation;
          }
        }
        
        // Reduce position size based on correlation exposure
        // If total correlation > 1.5, reduce by 50%
        if (totalCorrelatedExposure > 1.5) {
          correlationAdjustment = 0.5; // Reduce to 50%
        } else if (totalCorrelatedExposure > 1.0) {
          correlationAdjustment = 0.7; // Reduce to 70%
        } else if (totalCorrelatedExposure > 0.7) {
          correlationAdjustment = 0.85; // Reduce to 85%
        }
        
        riskAmount = riskAmount * correlationAdjustment;
      }
    } catch (error) {
      console.warn('Failed to calculate correlation adjustment:', error);
    }
    
    // NEW: Drawdown-based position reduction
    let drawdownAdjustment = 1.0;
    try {
      const { calculateAccountMetrics } = await import('./account-calculator');
      const metrics = calculateAccountMetrics(allTrades, []);
      
      // If account is in drawdown, reduce position sizes
      if (metrics.allTimeProfitLoss < 0) {
        const drawdownPercent = Math.abs(metrics.allTimeProfitLoss / balance);
        if (drawdownPercent > 0.15) {
          // >15% drawdown - reduce to 50%
          drawdownAdjustment = 0.5;
        } else if (drawdownPercent > 0.10) {
          // >10% drawdown - reduce to 70%
          drawdownAdjustment = 0.7;
        } else if (drawdownPercent > 0.05) {
          // >5% drawdown - reduce to 85%
          drawdownAdjustment = 0.85;
        }
        
        riskAmount = riskAmount * drawdownAdjustment;
      }
    } catch (error) {
      console.warn('Failed to calculate drawdown adjustment:', error);
    }
    
    const adjustedRiskAmount = riskAmount;
    
    // Calculate price difference
    const priceDifference = Math.abs(entryPrice - stopLossPrice);
    
    if (priceDifference === 0 || priceDifference > entryPrice * 0.1) {
      return {
        riskAmount: 0,
        rewardAmount: 0,
        lotSize: 0,
        positionSize: 0,
        isValid: false,
        message: 'Invalid stop loss distance'
      };
    }

    // FIXED: Proper lot size calculation for Forex
    // Standard lot = 100,000 units
    // Mini lot = 10,000 units  
    // Micro lot = 1,000 units
    
    // Get pip size for the pair (0.0001 for most pairs, 0.01 for JPY pairs)
    const pipSize = this.getPipSize(pair);
    const pipDistance = priceDifference / pipSize; // Convert to pips
    
    // Get pip value per standard lot
    const pipValuePerLot = this.getPipValue(pair, entryPrice);
    
    // Calculate lot size: risk = lot size * pip distance * pip value per lot
    // Therefore: lot size = risk / (pip distance * pip value per lot)
    const lotSize = riskAmount / (pipDistance * pipValuePerLot);
    
    // CRITICAL FIX: Add proper maximum position size caps
    // Maximum position size should be limited to 2% of account equity in margin
    const marginPerLot = (100000 * entryPrice) / 500; // Assuming 500:1 leverage (conservative)
    const maxLotsByMargin = (balance * 0.02) / marginPerLot; // Max 2% of equity in margin
    
    // Also cap at absolute maximum: 100 lots for accounts < $1M, 200 lots for larger accounts
    const absoluteMaxLots = balance >= 1000000 ? 200 : 100;
    
    // Use the most restrictive limit
    const maxLots = Math.min(maxLotsByMargin, absoluteMaxLots);
    
    // Ensure minimum lot size and apply maximum cap
    const reasonableLotSize = Math.min(Math.max(lotSize, 0.01), maxLots);
    
    // CRITICAL FIX: For small accounts, check if calculated lot size is below minimum
    // If so, increase risk to meet minimum (but warn user)
    let finalLotSize = reasonableLotSize;
    let finalRiskAmount = adjustedRiskAmount;
    
    if (lotSize < 0.01 && balance < 500) {
      // For very small accounts, we need to use minimum lot size
      // This means actual risk will be higher than intended
      finalLotSize = 0.01;
      // Recalculate actual risk based on minimum lot size
      finalRiskAmount = finalLotSize * pipDistance * pipValuePerLot;
      
      if (finalRiskAmount > balance * 0.1) {
        // If actual risk exceeds 10% of account, reject the trade
        return {
          riskAmount: 0,
          rewardAmount: 0,
          lotSize: 0,
          positionSize: 0,
          isValid: false,
          message: `Account too small ($${balance.toFixed(2)}). Minimum lot size (0.01 lots) would risk ${((finalRiskAmount / balance) * 100).toFixed(1)}% of account. Minimum recommended account size: $500 for proper risk management.`
        };
      }
      
      logger.warn(`⚠️ Small account: Using minimum lot size (0.01 lots). Actual risk: ${((finalRiskAmount / balance) * 100).toFixed(1)}% instead of intended ${(riskPercentage * 100).toFixed(0)}%.`);
    }
    
    // CRITICAL SAFETY CHECK: Reject if position size exceeds 5% of account equity
    const positionValue = finalLotSize * 100000 * entryPrice;
    const maxPositionValue = balance * 0.05; // 5% of account equity
    if (positionValue > maxPositionValue) {
      return {
        riskAmount: 0,
        rewardAmount: 0,
        lotSize: 0,
        positionSize: 0,
        isValid: false,
        message: `Position size too large: ${finalLotSize.toFixed(2)} lots exceeds 5% of account equity. Maximum allowed: ${(maxPositionValue / (100000 * entryPrice)).toFixed(2)} lots.`
      };
    }
    
    const rewardAmount = finalRiskAmount * TRADING_RULES.MIN_REWARD_RISK_RATIO;

    return {
      riskAmount: Math.round(finalRiskAmount * 100) / 100,
      rewardAmount: Math.round(rewardAmount * 100) / 100,
      lotSize: Math.round(finalLotSize * 100) / 100, // Reasonable lot size
      positionSize: Math.round((finalLotSize * 100000 * entryPrice) / 100000),
      isValid: finalLotSize >= 0.01 && finalLotSize <= maxLots,
      message: finalLotSize >= 0.01 ? 'Trade meets risk requirements' : 'Lot size too small',
      volatilityAdjustment: volatilityAdjustment !== 1.0 ? Math.round(volatilityAdjustment * 100) / 100 : undefined,
      newsAdjustment: newsAdjustment !== 1.0 ? Math.round(newsAdjustment * 100) / 100 : undefined,
      correlationAdjustment: correlationAdjustment !== 1.0 ? Math.round(correlationAdjustment * 100) / 100 : undefined,
      drawdownAdjustment: drawdownAdjustment !== 1.0 ? Math.round(drawdownAdjustment * 100) / 100 : undefined,
      adjustedRiskAmount: Math.round(adjustedRiskAmount * 100) / 100
    };
  }

  /**
   * Synchronous version for backward compatibility
   * Calculates trade size without volatility and news adjustments
   */
  static calculateTradeSizeSync(
    entryPrice: number,
    stopLossPrice: number,
    pair: string
  ): TradeSizeResult {
    const balance = TradingModeManager.getCurrentBalance();
    
    // CRITICAL FIX: Dynamic risk percentage for small accounts (same as async version)
    const riskPercentage = this.getRiskPercentage(balance);
    const riskAmount = balance * riskPercentage;
    
    // Show warning for small accounts using higher risk
    if (balance < 500) {
      logger.warn(`⚠️ Small account detected ($${balance.toFixed(2)}). Using ${(riskPercentage * 100).toFixed(0)}% risk per trade to meet minimum lot size (0.01 lots). Consider depositing more funds (minimum $500 recommended) for better risk management with 2% risk.`);
    }
    const priceDifference = Math.abs(entryPrice - stopLossPrice);

    if (priceDifference === 0 || priceDifference > entryPrice * 0.1) {
      return {
        riskAmount: 0,
        rewardAmount: 0,
        lotSize: 0,
        positionSize: 0,
        isValid: false,
        message: 'Invalid stop loss distance'
      };
    }

    // Proper lot size calculation for Forex
    const pipSize = this.getPipSize(pair);
    const pipDistance = priceDifference / pipSize;
    const pipValuePerLot = this.getPipValue(pair, entryPrice);
    const lotSize = riskAmount / (pipDistance * pipValuePerLot);
    
    // CRITICAL FIX: Add proper maximum position size caps (same as async version)
    const marginPerLot = (100000 * entryPrice) / 500; // Assuming 500:1 leverage
    const maxLotsByMargin = (balance * 0.02) / marginPerLot; // Max 2% of equity in margin
    const absoluteMaxLots = balance >= 1000000 ? 200 : 100;
    const maxLots = Math.min(maxLotsByMargin, absoluteMaxLots);
    
    const reasonableLotSize = Math.min(Math.max(lotSize, 0.01), maxLots);
    
    // CRITICAL FIX: For small accounts, check if calculated lot size is below minimum
    // If so, increase risk to meet minimum (but warn user)
    let finalLotSize = reasonableLotSize;
    let finalRiskAmount = riskAmount;
    
    if (lotSize < 0.01 && balance < 500) {
      // For very small accounts, we need to use minimum lot size
      // This means actual risk will be higher than intended
      finalLotSize = 0.01;
      // Recalculate actual risk based on minimum lot size
      finalRiskAmount = finalLotSize * pipDistance * pipValuePerLot;
      
      if (finalRiskAmount > balance * 0.1) {
        // If actual risk exceeds 10% of account, reject the trade
        return {
          riskAmount: 0,
          rewardAmount: 0,
          lotSize: 0,
          positionSize: 0,
          isValid: false,
          message: `Account too small ($${balance.toFixed(2)}). Minimum lot size (0.01 lots) would risk ${((finalRiskAmount / balance) * 100).toFixed(1)}% of account. Minimum recommended account size: $500 for proper risk management.`
        };
      }
      
      logger.warn(`⚠️ Small account: Using minimum lot size (0.01 lots). Actual risk: ${((finalRiskAmount / balance) * 100).toFixed(1)}% instead of intended ${(riskPercentage * 100).toFixed(0)}%.`);
    }
    
    // CRITICAL SAFETY CHECK: Reject if position size exceeds 5% of account equity
    const positionValue = finalLotSize * 100000 * entryPrice;
    const maxPositionValue = balance * 0.05;
    if (positionValue > maxPositionValue) {
      return {
        riskAmount: 0,
        rewardAmount: 0,
        lotSize: 0,
        positionSize: 0,
        isValid: false,
        message: `Position size too large: ${finalLotSize.toFixed(2)} lots exceeds 5% of account equity. Maximum allowed: ${(maxPositionValue / (100000 * entryPrice)).toFixed(2)} lots.`
      };
    }
    
    const rewardAmount = finalRiskAmount * TRADING_RULES.MIN_REWARD_RISK_RATIO;

    return {
      riskAmount: Math.round(finalRiskAmount * 100) / 100,
      rewardAmount: Math.round(rewardAmount * 100) / 100,
      lotSize: Math.round(finalLotSize * 100) / 100,
      positionSize: Math.round((finalLotSize * 100000 * entryPrice) / 100000),
      isValid: finalLotSize >= 0.01 && finalLotSize <= maxLots,
      message: finalLotSize >= 0.01 ? 'Trade meets risk requirements' : 'Lot size too small'
    };
  }

  private static getPipSize(pair: string): number {
    // Pip size: 0.0001 for most pairs, 0.01 for JPY pairs
    const pipSizes: { [key: string]: number } = {
      // Major pairs
      'EURUSD': 0.0001,
      'GBPUSD': 0.0001,
      'USDJPY': 0.01,
      'USDCHF': 0.0001,
      'AUDUSD': 0.0001,
      'USDCAD': 0.0001,
      'NZDUSD': 0.0001,
      // Cross pairs
      'EURGBP': 0.0001,
      'EURJPY': 0.01,
      'GBPJPY': 0.01,
      'EURAUD': 0.0001,
      'GBPAUD': 0.0001,
      'AUDJPY': 0.01,
      'EURCAD': 0.0001,
      'GBPCAD': 0.0001,
      'AUDCAD': 0.0001,
      'NZDJPY': 0.01,
      'CHFJPY': 0.01,
      'EURCHF': 0.0001,
      'GBPCHF': 0.0001,
      // Exotic pairs
      'USDSGD': 0.0001,
      'USDHKD': 0.0001,
      'EURNOK': 0.0001,
      'EURSEK': 0.0001,
    };
    
    // For JPY pairs, pip size is 0.01, otherwise 0.0001
    const upperPair = pair.toUpperCase();
    if (pipSizes[upperPair]) return pipSizes[upperPair];
    return upperPair.includes('JPY') ? 0.01 : 0.0001;
  }

  private static getPipValue(pair: string, price: number): number {
    // Pip value calculation for all pairs
    // For pairs where USD is the quote currency: pip value = 10 (per standard lot)
    // For pairs where USD is the base currency: pip value = 10 / price
    // For cross pairs: need to convert through USD
    
    const upperPair = pair.toUpperCase();
    
    // USD as quote currency (EUR/USD, GBP/USD, AUD/USD, NZD/USD)
    if (upperPair.endsWith('USD')) {
      return 10; // $10 per pip per standard lot
    }
    
    // USD as base currency (USD/JPY, USD/CHF, USD/CAD, USD/SGD, USD/HKD)
    if (upperPair.startsWith('USD')) {
      if (upperPair.includes('JPY')) {
        return 1000 / price; // JPY pairs have different calculation
      }
      return 10 / price;
    }
    
    // Cross pairs - approximate pip values
    const crossPipValues: { [key: string]: number } = {
      'EURGBP': 12.5,   // ~$12.50 per pip
      'EURJPY': 9.09,   // ~$9.09 per pip
      'GBPJPY': 9.09,   // ~$9.09 per pip
      'EURAUD': 6.5,    // ~$6.50 per pip
      'GBPAUD': 6.5,    // ~$6.50 per pip
      'AUDJPY': 9.09,   // ~$9.09 per pip
      'EURCAD': 7.5,    // ~$7.50 per pip
      'GBPCAD': 7.5,    // ~$7.50 per pip
      'AUDCAD': 7.5,    // ~$7.50 per pip
      'NZDJPY': 9.09,   // ~$9.09 per pip
      'CHFJPY': 9.09,   // ~$9.09 per pip
      'EURCHF': 11,     // ~$11 per pip
      'GBPCHF': 11,     // ~$11 per pip
      'EURNOK': 1,      // ~$1 per pip
      'EURSEK': 1,      // ~$1 per pip
    };
    
    return crossPipValues[upperPair] || 10; // Default to $10
  }

  static canPlaceTrade(
    currentBalance: number,
    dailyPL: number,
    openTrades: number,
    tradesToday: number
  ): { allowed: boolean; reason: string } {
    // Check if balance is loaded from MT5
    // Only allow trading if we have a real balance from MT5
    if (currentBalance <= 0 || isNaN(currentBalance)) {
      return { 
        allowed: false, 
        reason: 'MT5 balance not loaded. Please ensure MT5 bridge is running, EA is attached to a chart, and account is logged in. Check Connection Status in dashboard.' 
      };
    }
    
    // Use the real MT5 balance
    const balanceToUse = currentBalance;
    
    const dailyLossLimit = balanceToUse * TRADING_RULES.DAILY_LOSS_PERCENT;
    
    if (dailyPL <= -dailyLossLimit) {
      return { allowed: false, reason: 'Daily loss limit reached' };
    }
    
    if (openTrades >= TRADING_RULES.MAX_OPEN_TRADES) {
      return { allowed: false, reason: 'Maximum open trades reached' };
    }
    
    if (tradesToday >= TRADING_RULES.MAX_TRADES_PER_DAY) {
      return { allowed: false, reason: 'Maximum trades per day reached' };
    }

    return { allowed: true, reason: 'Trading allowed' };
  }

  static getRiskAmount(): number {
    const balance = TradingModeManager.getCurrentBalance();
    return balance * TRADING_RULES.RISK_PERCENTAGE;
  }

  static getRiskLabel(): string {
    const risk = this.getRiskAmount();
    const currency = TradingModeManager.getCurrencySymbol();
    return `${currency}${risk.toFixed(2)}`;
  }
}

// Backward compatibility helper functions
export function calculateRisk(
  balance: number,
  entryPrice: number,
  stopLoss: number,
  quantity: number
): number {
  const priceDifference = Math.abs(entryPrice - stopLoss);
  const riskAmount = priceDifference * quantity;
  return riskAmount;
}

export function calculatePositionSize(
  balance: number,
  entryPrice: number,
  stopLoss: number
): number {
  const result = RiskCalculator.calculateTradeSizeSync(entryPrice, stopLoss, 'EURUSD');
  return result.lotSize;
}

export function getRiskMetrics(
  balance: number,
  openTrades: Trade[]
): RiskMetrics {
  // Handle zero balance
  if (balance <= 0) {
    return {
      currentRisk: 0,
      maxRisk: 0,
      riskPercentage: 0,
      availableBalance: 0,
    };
  }

  const totalRisk = openTrades.reduce((sum, trade) => {
    const result = RiskCalculator.calculateTradeSizeSync(
      trade.entryPrice,
      trade.stopLoss,
      trade.pair
    );
    return sum + result.riskAmount;
  }, 0);

  const maxRisk = balance * TRADING_RULES.RISK_PERCENTAGE;
  const riskPercentage = (totalRisk / balance) * 100;

  return {
    currentRisk: totalRisk,
    maxRisk,
    riskPercentage,
    availableBalance: balance - totalRisk,
  };
}

export function validateRisk(
  balance: number,
  entryPrice: number,
  stopLoss: number,
  quantity: number
): { valid: boolean; message?: string } {
  const risk = calculateRisk(balance, entryPrice, stopLoss, quantity);
  const maxRisk = balance * TRADING_RULES.RISK_PERCENTAGE;

  if (risk > maxRisk) {
    return {
      valid: false,
      message: `Risk exceeds maximum allowed (${(maxRisk / balance) * 100}%)`,
    };
  }

  if (risk <= 0) {
    return {
      valid: false,
      message: 'Invalid risk calculation',
    };
  }

  return { valid: true };
}
