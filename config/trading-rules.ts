export const TRADING_RULES = {
  // Trading Modes - DEFAULT VALUES (will be overridden by real MT5 data)
  DEMO_BALANCE: 0,    // Will be fetched from MT5
  LIVE_BALANCE: 0,    // Will be fetched from MT5

  // Risk Management - AGGRESSIVE for 15-20% monthly target
  RISK_PERCENTAGE: 0.02,     // 2% per trade (increased from 1.5%)
  DAILY_LOSS_PERCENT: 0.05,  // 5% daily limit (increased from 3%)
  MONTHLY_LOSS_PERCENT: 0.15, // 15% monthly limit (increased from 10%)

  // Position Limits - More active trading
  MAX_OPEN_TRADES: 5,        // Up from 3
  MAX_TRADES_PER_DAY: 3,     // Up from 1

  // Strategy Rules
  MIN_REWARD_RISK_RATIO: 2,  // 1:2 minimum (keep this strict)
  REQUIRED_CONFLUENCE: 2,    // 2+ indicators agreeing

  // Trading Instruments - Forex, Metals, and Stocks
  TRADING_PAIRS: [
    // === FOREX PAIRS ===
    // Major Pairs (USD pairs)
    'EUR/USD',
    'GBP/USD', 
    'USD/JPY',
    'USD/CHF',
    'AUD/USD',
    'USD/CAD',
    'NZD/USD',
    // Cross Pairs
    'EUR/GBP',
    'EUR/JPY',
    'GBP/JPY',
    'EUR/AUD',
    'GBP/AUD',
    'AUD/JPY',
    'EUR/CAD',
    'GBP/CAD',
    'AUD/CAD',
    'NZD/JPY',
    'CHF/JPY',
    'EUR/CHF',
    'GBP/CHF',
    // Exotic Pairs (optional)
    'USD/SGD',
    'USD/HKD',
    'EUR/NOK',
    'EUR/SEK',
    // === METALS ===
    'XAU/USD', // Gold
    'XAG/USD', // Silver
    'XAU/EUR', // Gold/Euro
    'XAU/GBP', // Gold/Pound
    'XPT/USD', // Platinum
    'XPD/USD', // Palladium
    // === MAJOR STOCKS ===
    // US Tech Stocks
    'AAPL', // Apple
    'MSFT', // Microsoft
    'GOOGL', // Alphabet (Google)
    'AMZN', // Amazon
    'META', // Meta (Facebook)
    'TSLA', // Tesla
    'NVDA', // NVIDIA
    'NFLX', // Netflix
    // US Finance
    'JPM', // JPMorgan Chase
    'BAC', // Bank of America
    'GS', // Goldman Sachs
    'WFC', // Wells Fargo
    // US Consumer
    'WMT', // Walmart
    'HD', // Home Depot
    'MCD', // McDonald's
    'SBUX', // Starbucks
    // US Healthcare
    'JNJ', // Johnson & Johnson
    'PFE', // Pfizer
    'UNH', // UnitedHealth
    // US Industrial
    'BA', // Boeing
    'CAT', // Caterpillar
    'GE', // General Electric
    // European Stocks
    'ASML', // ASML Holding
    'SAP', // SAP SE
    'NOVN', // Novartis
    // UK Stocks
    'BP', // BP
    'GSK', // GlaxoSmithKline
    'RIO', // Rio Tinto
  ] as const,

  // Success Metrics for Demo -> Live (STRICTER for aggressive strategy)
  MIN_WIN_RATE: 0.60,        // 60% (up from 55%)
  MAX_DRAWDOWN: 0.12,        // 12% (up from 8%)
  MIN_PROFIT_FACTOR: 1.8,    // 1.8 (up from 1.5)
  MIN_CONSECUTIVE_WEEKS: 4,   // 4 weeks (up from 3)
  MIN_CLOSED_TRADES_FOR_LIVE: 20,
  MIN_RESOLVED_ANALYSES: 10,

  // Position watch (browser-based, while dashboard open)
  POSITION_WATCH_POLL_MS: 8000,
  POSITION_WATCH_MAX_HOLD_MS: 8 * 60 * 60 * 1000, // 8h forex default
  POSITION_WATCH_STALL_NEAR_TP_MS: 2 * 60 * 60 * 1000, // 2h
  POSITION_WATCH_STALL_TP_FRACTION: 0.15, // within 15% of TP distance
  POSITION_WATCH_GIVEBACK_FRACTION: 0.5, // exit if give back 50% of peak profit
  POSITION_WATCH_LOSS_EXTENSION: 1.5, // vs planned risk distance
  POSITION_WATCH_SIGNAL_RECHECK_MS: 30 * 60 * 1000, // re-analyze every 30m max
  POSITION_WATCH_ASSIST_TP_CLOSE: false, // prefer broker TP; set true to close near TP
  POSITION_WATCH_ASSIST_TP_PIPS: 3,
} as const;

export type PositionWatchConfig = {
  enabled: boolean;
  smartExitEnabled: boolean;
  maxHoldMs: number;
  stallNearTpMs: number;
  stallTpFraction: number;
  givebackFraction: number;
  lossExtension: number;
  signalRecheckEnabled: boolean;
  assistTpClose: boolean;
};

export const DEFAULT_POSITION_WATCH_CONFIG: PositionWatchConfig = {
  enabled: true,
  smartExitEnabled: true,
  maxHoldMs: TRADING_RULES.POSITION_WATCH_MAX_HOLD_MS,
  stallNearTpMs: TRADING_RULES.POSITION_WATCH_STALL_NEAR_TP_MS,
  stallTpFraction: TRADING_RULES.POSITION_WATCH_STALL_TP_FRACTION,
  givebackFraction: TRADING_RULES.POSITION_WATCH_GIVEBACK_FRACTION,
  lossExtension: TRADING_RULES.POSITION_WATCH_LOSS_EXTENSION,
  signalRecheckEnabled: true,
  assistTpClose: TRADING_RULES.POSITION_WATCH_ASSIST_TP_CLOSE,
};

// Helper to get pair without slash (for MT5)
// Handles forex (EUR/USD -> EURUSD), metals (XAU/USD -> XAUUSD), and stocks (AAPL -> AAPL)
export function formatPairForMT5(pair: string): string {
  // Stocks don't have slashes, return as-is
  if (!pair.includes('/')) return pair;
  // Forex and metals: remove slash
  return pair.replace('/', '');
}

// Helper to get pair with slash (for display)
// Handles forex (EURUSD -> EUR/USD), metals (XAUUSD -> XAU/USD), and stocks (AAPL -> AAPL)
export function formatPairForDisplay(pair: string): string {
  // If already has slash, return as-is
  if (pair.includes('/')) return pair;
  
  // Stocks: typically 1-5 characters, no slash, and not a currency code
  // Common currency codes are 3 chars, so if it's 3 chars and not a known currency, it might be a stock
  // But for simplicity, if it's <= 5 chars and doesn't match forex pattern, treat as stock
  const knownCurrencies = ['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'NOK', 'SEK', 'XAU', 'XAG', 'XPT', 'XPD'];
  if (pair.length <= 5 && !knownCurrencies.includes(pair.toUpperCase())) {
    return pair; // Likely a stock
  }
  
  // Forex and metals: add slash (assume 6 characters: XXXYYY)
  if (pair.length >= 6) {
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  
  return pair;
}
