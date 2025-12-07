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

  // Forex Pairs - Major, Minor, and Cross pairs
  TRADING_PAIRS: [
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
  ] as const,

  // Success Metrics for Demo -> Live (STRICTER for aggressive strategy)
  MIN_WIN_RATE: 0.60,        // 60% (up from 55%)
  MAX_DRAWDOWN: 0.12,        // 12% (up from 8%)
  MIN_PROFIT_FACTOR: 1.8,    // 1.8 (up from 1.5)
  MIN_CONSECUTIVE_WEEKS: 4   // 4 weeks (up from 3)
} as const;

// Helper to get pair without slash (for MT5)
export function formatPairForMT5(pair: string): string {
  return pair.replace('/', '');
}

// Helper to get pair with slash (for display)
export function formatPairForDisplay(pair: string): string {
  if (pair.includes('/')) return pair;
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}
