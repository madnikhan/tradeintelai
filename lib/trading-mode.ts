import { TradingMode, TradingConfig } from '@/types/trading';
import { TRADING_RULES } from '@/config/trading-rules';

const MODE_OVERRIDE_KEY = 'trading_mode_override';

export type Mt5AccountKind = 'demo' | 'live' | 'unknown';

export class TradingModeManager {
  private static currentMode: TradingMode = 'demo';
  private static mt5AccountKind: Mt5AccountKind = 'unknown';
  private static demoBalance: number = TRADING_RULES.DEMO_BALANCE;
  private static liveBalance: number = TRADING_RULES.LIVE_BALANCE;
  private static realBalance: number | null = null; // Real balance from MT5

  static getCurrentMode(): TradingMode {
    return this.currentMode;
  }

  static setMode(mode: TradingMode): void {
    this.currentMode = mode;
    console.log(`Trading mode changed to: ${mode}`);
  }

  /** User manual choice; when set, MT5 auto-detect will not overwrite app mode. */
  static getModeOverride(): TradingMode | null {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(MODE_OVERRIDE_KEY);
    if (v === 'demo' || v === 'live') return v;
    return null;
  }

  static setModeOverride(mode: TradingMode | null): void {
    if (typeof window === 'undefined') return;
    if (mode === null) {
      localStorage.removeItem(MODE_OVERRIDE_KEY);
    } else {
      localStorage.setItem(MODE_OVERRIDE_KEY, mode);
    }
  }

  static setModeWithOverride(mode: TradingMode): void {
    this.setMode(mode);
    this.setModeOverride(mode);
  }

  static clearModeOverride(): void {
    this.setModeOverride(null);
  }

  /** Apply MT5-detected mode only if user has not set a manual override. */
  static applyDetectedModeFromMt5(detected: TradingMode): void {
    if (this.getModeOverride() !== null) return;
    if (this.currentMode !== detected) {
      this.setMode(detected);
    }
  }

  static setMt5AccountKind(kind: Mt5AccountKind): void {
    this.mt5AccountKind = kind;
  }

  static getMt5AccountKind(): Mt5AccountKind {
    return this.mt5AccountKind;
  }

  static getCurrentBalance(): number {
    // If we have a real balance from MT5, use it; otherwise use default
    if (this.realBalance !== null) {
      return this.realBalance;
    }
    return this.currentMode === 'demo' ? this.demoBalance : this.liveBalance;
  }

  static setRealBalance(balance: number): void {
    this.realBalance = balance;
    // Also update the mode-specific balance
    if (this.currentMode === 'demo') {
      this.demoBalance = balance;
    } else {
      this.liveBalance = balance;
    }
    console.log(`✅ Real MT5 balance synced: ${balance}`);
  }

  static updateBalance(amount: number): void {
    if (this.currentMode === 'demo') {
      this.demoBalance += amount;
    } else {
      this.liveBalance += amount;
    }
    // Update real balance if set
    if (this.realBalance !== null) {
      this.realBalance += amount;
    }
  }

  static getBalanceLabel(): string {
    const balance = this.getCurrentBalance();
    const currency = this.currentMode === 'demo' ? '$' : '£';
    return `${currency}${balance.toLocaleString()}`;
  }

  static isDemoMode(): boolean {
    return this.currentMode === 'demo';
  }

  static getCurrencySymbol(): string {
    return this.currentMode === 'demo' ? '$' : '£';
  }
}

// Backward compatibility helper function
export function getTradingConfig(mode: TradingMode): TradingConfig {
  return {
    mode,
    initialBalance: mode === 'demo' ? TRADING_RULES.DEMO_BALANCE : TRADING_RULES.LIVE_BALANCE,
    currency: mode === 'demo' ? 'USD' : 'GBP',
    riskPerTrade: TRADING_RULES.RISK_PERCENTAGE,
    monthlyTarget: 0.20, // 20% - can be moved to TRADING_RULES if needed
  };
}

export function isDemoMode(mode: TradingMode): boolean {
  return mode === 'demo';
}

export function isLiveMode(mode: TradingMode): boolean {
  return mode === 'live';
}
