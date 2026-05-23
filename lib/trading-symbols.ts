import { TRADING_RULES } from '@/config/trading-rules';

/** Normalize EUR/USD → EURUSD */
export function toCompactSymbol(pair: string): string {
  return pair.replace(/\//g, '').toUpperCase();
}

/** Normalize EURUSD → EUR/USD for display */
export function toDisplaySymbol(symbol: string): string {
  const s = symbol.replace(/\//g, '').toUpperCase();
  if (s.length === 6 && !symbol.includes('/')) {
    return `${s.slice(0, 3)}/${s.slice(3)}`;
  }
  return symbol;
}

export const TRADING_SYMBOL_GROUPS = {
  forexMajor: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
  forexCross: ['EURGBP', 'EURJPY', 'GBPJPY', 'EURAUD', 'GBPAUD', 'AUDJPY', 'EURCAD', 'GBPCAD', 'AUDCAD', 'NZDJPY', 'CHFJPY', 'EURCHF', 'GBPCHF'],
  metals: ['XAUUSD', 'XAGUSD'],
  stocks: TRADING_RULES.TRADING_PAIRS.filter((p) => !p.includes('/') || p.startsWith('XAU') || p.startsWith('XAG'))
    .filter((p) => !['EUR/USD', 'GBP/USD', 'USD/JPY'].includes(p))
    .map(toCompactSymbol)
    .filter((s) => s.length <= 6 || s.startsWith('XAU') || s.startsWith('XAG')),
};

export const ALL_COMPACT_SYMBOLS: string[] = [
  ...new Set(TRADING_RULES.TRADING_PAIRS.map(toCompactSymbol)),
];
