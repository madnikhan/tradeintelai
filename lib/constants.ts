import { CurrencyPair, TradingInstrument, AssetType } from '@/types/trading'

// Helper function to detect asset type from symbol
export function detectAssetType(symbol: string): AssetType {
  const upperSymbol = symbol.toUpperCase();
  
  // Metals (precious metals)
  if (upperSymbol.startsWith('XAU') || upperSymbol.startsWith('XAG') || 
      upperSymbol.startsWith('XPT') || upperSymbol.startsWith('XPD') ||
      upperSymbol === 'GOLD' || upperSymbol === 'SILVER') {
    return 'metal';
  }
  
  // Stocks (no slash, typically 1-5 characters, not a currency code)
  if (!symbol.includes('/') && symbol.length <= 5 && 
      !['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'NOK', 'SEK'].includes(upperSymbol)) {
    return 'stock';
  }
  
  // Default to forex
  return 'forex';
}

// Forex pairs configuration
// Note: Trading rules (DEMO_BALANCE, RISK_PERCENTAGE, etc.) are in config/trading-rules.ts
export const FOREX_PAIRS: CurrencyPair[] = [
  { symbol: 'EUR/USD', name: 'Euro/US Dollar', baseCurrency: 'EUR', quoteCurrency: 'USD', assetType: 'forex' },
  { symbol: 'GBP/USD', name: 'British Pound/US Dollar', baseCurrency: 'GBP', quoteCurrency: 'USD', assetType: 'forex' },
  { symbol: 'USD/JPY', name: 'US Dollar/Japanese Yen', baseCurrency: 'USD', quoteCurrency: 'JPY', assetType: 'forex' },
  { symbol: 'USD/CHF', name: 'US Dollar/Swiss Franc', baseCurrency: 'USD', quoteCurrency: 'CHF', assetType: 'forex' },
  { symbol: 'AUD/USD', name: 'Australian Dollar/US Dollar', baseCurrency: 'AUD', quoteCurrency: 'USD', assetType: 'forex' },
  { symbol: 'USD/CAD', name: 'US Dollar/Canadian Dollar', baseCurrency: 'USD', quoteCurrency: 'CAD', assetType: 'forex' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar/US Dollar', baseCurrency: 'NZD', quoteCurrency: 'USD', assetType: 'forex' },
  { symbol: 'EUR/GBP', name: 'Euro/British Pound', baseCurrency: 'EUR', quoteCurrency: 'GBP', assetType: 'forex' },
  { symbol: 'EUR/JPY', name: 'Euro/Japanese Yen', baseCurrency: 'EUR', quoteCurrency: 'JPY', assetType: 'forex' },
  { symbol: 'GBP/JPY', name: 'British Pound/Japanese Yen', baseCurrency: 'GBP', quoteCurrency: 'JPY', assetType: 'forex' },
]

// Metals configuration
export const METAL_PAIRS: CurrencyPair[] = [
  { symbol: 'XAU/USD', name: 'Gold/US Dollar', baseCurrency: 'XAU', quoteCurrency: 'USD', assetType: 'metal' },
  { symbol: 'XAG/USD', name: 'Silver/US Dollar', baseCurrency: 'XAG', quoteCurrency: 'USD', assetType: 'metal' },
  { symbol: 'XAU/EUR', name: 'Gold/Euro', baseCurrency: 'XAU', quoteCurrency: 'EUR', assetType: 'metal' },
  { symbol: 'XAU/GBP', name: 'Gold/British Pound', baseCurrency: 'XAU', quoteCurrency: 'GBP', assetType: 'metal' },
  { symbol: 'XPT/USD', name: 'Platinum/US Dollar', baseCurrency: 'XPT', quoteCurrency: 'USD', assetType: 'metal' },
  { symbol: 'XPD/USD', name: 'Palladium/US Dollar', baseCurrency: 'XPD', quoteCurrency: 'USD', assetType: 'metal' },
]

// Major stocks configuration
export const STOCK_INSTRUMENTS: TradingInstrument[] = [
  // US Tech
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', assetType: 'stock', exchange: 'NASDAQ', sector: 'Consumer Discretionary' },
  { symbol: 'META', name: 'Meta Platforms Inc. (Facebook)', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'stock', exchange: 'NASDAQ', sector: 'Consumer Discretionary' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'NFLX', name: 'Netflix Inc.', assetType: 'stock', exchange: 'NASDAQ', sector: 'Communication Services' },
  // US Finance
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', assetType: 'stock', exchange: 'NYSE', sector: 'Financial Services' },
  { symbol: 'BAC', name: 'Bank of America Corp.', assetType: 'stock', exchange: 'NYSE', sector: 'Financial Services' },
  { symbol: 'GS', name: 'Goldman Sachs Group Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Financial Services' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', assetType: 'stock', exchange: 'NYSE', sector: 'Financial Services' },
  // US Consumer
  { symbol: 'WMT', name: 'Walmart Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Consumer Staples' },
  { symbol: 'HD', name: 'The Home Depot Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Consumer Discretionary' },
  { symbol: 'MCD', name: 'McDonald\'s Corporation', assetType: 'stock', exchange: 'NYSE', sector: 'Consumer Discretionary' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', assetType: 'stock', exchange: 'NASDAQ', sector: 'Consumer Discretionary' },
  // US Healthcare
  { symbol: 'JNJ', name: 'Johnson & Johnson', assetType: 'stock', exchange: 'NYSE', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Healthcare' },
  // US Industrial
  { symbol: 'BA', name: 'The Boeing Company', assetType: 'stock', exchange: 'NYSE', sector: 'Industrial' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', assetType: 'stock', exchange: 'NYSE', sector: 'Industrial' },
  { symbol: 'GE', name: 'General Electric Company', assetType: 'stock', exchange: 'NYSE', sector: 'Industrial' },
  // European
  { symbol: 'ASML', name: 'ASML Holding N.V.', assetType: 'stock', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'SAP', name: 'SAP SE', assetType: 'stock', exchange: 'NYSE', sector: 'Technology' },
  { symbol: 'NOVN', name: 'Novartis AG', assetType: 'stock', exchange: 'NYSE', sector: 'Healthcare' },
  // UK
  { symbol: 'BP', name: 'BP p.l.c.', assetType: 'stock', exchange: 'NYSE', sector: 'Energy' },
  { symbol: 'GSK', name: 'GlaxoSmithKline plc', assetType: 'stock', exchange: 'NYSE', sector: 'Healthcare' },
  { symbol: 'RIO', name: 'Rio Tinto Group', assetType: 'stock', exchange: 'NYSE', sector: 'Materials' },
]

// All trading instruments (combined)
export const ALL_INSTRUMENTS: (CurrencyPair | TradingInstrument)[] = [
  ...FOREX_PAIRS,
  ...METAL_PAIRS,
  ...STOCK_INSTRUMENTS,
]

