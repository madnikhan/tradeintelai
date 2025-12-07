/**
 * Data Providers Index
 * Centralized access to all market data APIs
 */

export { TwelveDataProvider } from './twelve-data';
export { FinnhubProvider } from './finnhub';
export { AlphaVantageProvider } from './alpha-vantage';
export { NewsDataProvider } from './newsdata';
export { COTDataProvider } from './cot-data';
export { ParserMonitor } from './parser-monitor';

// Free & Unlimited Alternatives
export { MT5PriceDataProvider } from './mt5-price-data';
export { ForexFactoryRSSProvider } from './forexfactory-rss';
export { RSSNewsProvider } from './rss-news';
export { SentimentParser } from './sentiment-parser';

// Multi-Source Economic Calendar
export { InvestingCalendarProvider } from './investing-calendar';
export { TradingEconomicsCalendarProvider } from './tradingeconomics-calendar';
export { UnifiedCalendarProvider } from './unified-calendar';

// Economic Indicators
export { TradingEconomicsIndicatorsProvider } from './tradingeconomics-indicators';
export { EnhancedSentimentParser } from './sentiment-parser-enhanced';
export type { EconomicIndicator, InterestRateData } from './tradingeconomics-indicators';

// Re-export types
export type { PriceData } from '@/types/trading';

