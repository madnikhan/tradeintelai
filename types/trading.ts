export type TradingMode = 'demo' | 'live';

export type TradeDirection = 'BUY' | 'SELL';

export type TradeStatus = 'open' | 'closed' | 'pending';

export interface TradingConfig {
  mode: TradingMode;
  initialBalance: number;
  currency: string;
  riskPerTrade: number;
  monthlyTarget: number;
}

export type AssetType = 'forex' | 'metal' | 'stock' | 'commodity';

export interface CurrencyPair {
  symbol: string;
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  assetType?: AssetType; // Optional for backward compatibility
}

export interface TradingInstrument {
  symbol: string;
  name: string;
  assetType: AssetType;
  baseCurrency?: string; // For forex/metals
  quoteCurrency?: string; // For forex/metals
  exchange?: string; // For stocks
  sector?: string; // For stocks
}

export interface RiskMetrics {
  currentRisk: number;
  maxRisk: number;
  riskPercentage: number;
  availableBalance: number;
}

export interface Trade {
  id: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  riskAmount: number;
  rewardAmount: number;
  status: TradeStatus;
  profitLoss?: number;
  timestamp: Date;
  reason: string;
  closePrice?: number;
  closeTime?: Date;
  closeReason?: string;
}

export interface Account {
  balance: number;
  equity: number;
  dailyProfitLoss: number; // Realized P/L from trades closed today only
  unrealizedPL?: number; // Current profit/loss from all open positions
  monthlyProfitLoss: number;
  allTimeProfitLoss?: number; // Total profit/loss from all closed trades
  openTrades: number;
  tradesToday: number;
  totalTrades: number;
}

export interface TradeSignal {
  pair: string;
  action: TradeDirection;
  confidence: number;
  reason: string;
  timestamp: Date;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  consecutiveProfitableWeeks: number;
  sharpeRatio?: number;
  calmarRatio?: number;
  sortinoRatio?: number;
  recoveryFactor?: number;
  expectancy?: number;
}

export interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
