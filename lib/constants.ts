import { CurrencyPair } from '@/types/trading'

// Forex pairs configuration
// Note: Trading rules (DEMO_BALANCE, RISK_PERCENTAGE, etc.) are in config/trading-rules.ts
export const FOREX_PAIRS: CurrencyPair[] = [
  { symbol: 'EUR/USD', name: 'Euro/US Dollar', baseCurrency: 'EUR', quoteCurrency: 'USD' },
  { symbol: 'GBP/USD', name: 'British Pound/US Dollar', baseCurrency: 'GBP', quoteCurrency: 'USD' },
  { symbol: 'USD/JPY', name: 'US Dollar/Japanese Yen', baseCurrency: 'USD', quoteCurrency: 'JPY' },
  { symbol: 'USD/CHF', name: 'US Dollar/Swiss Franc', baseCurrency: 'USD', quoteCurrency: 'CHF' },
  { symbol: 'AUD/USD', name: 'Australian Dollar/US Dollar', baseCurrency: 'AUD', quoteCurrency: 'USD' },
  { symbol: 'USD/CAD', name: 'US Dollar/Canadian Dollar', baseCurrency: 'USD', quoteCurrency: 'CAD' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar/US Dollar', baseCurrency: 'NZD', quoteCurrency: 'USD' },
  { symbol: 'EUR/GBP', name: 'Euro/British Pound', baseCurrency: 'EUR', quoteCurrency: 'GBP' },
  { symbol: 'EUR/JPY', name: 'Euro/Japanese Yen', baseCurrency: 'EUR', quoteCurrency: 'JPY' },
  { symbol: 'GBP/JPY', name: 'British Pound/Japanese Yen', baseCurrency: 'GBP', quoteCurrency: 'JPY' },
]

