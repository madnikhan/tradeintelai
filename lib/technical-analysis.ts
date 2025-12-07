export interface PriceData {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalIndicators {
  sma20: number
  sma50: number
  rsi: number
  macd: number
  signal: 'buy' | 'sell' | 'neutral'
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0
  
  const recentPrices = prices.slice(-period)
  const sum = recentPrices.reduce((acc, price) => acc + price, 0)
  return sum / period
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50 // Neutral RSI

  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  const gains = changes.filter(c => c > 0).reduce((sum, c) => sum + c, 0) / period
  const losses = Math.abs(changes.filter(c => c < 0).reduce((sum, c) => sum + Math.abs(c), 0) / period)

  if (losses === 0) return 100

  const rs = gains / losses
  const rsi = 100 - (100 / (1 + rs))
  
  return Math.round(rsi * 100) / 100
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  if (prices.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0 }
  }

  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)
  const macd = fastEMA - slowEMA

  // Simplified signal line (would need EMA of MACD in real implementation)
  const signal = macd * 0.9 // Approximation
  const histogram = macd - signal

  return {
    macd: Math.round(macd * 10000) / 10000,
    signal: Math.round(signal * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
  }
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1]

  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }

  return ema
}

export function getTradingSignal(indicators: TechnicalIndicators): 'buy' | 'sell' | 'neutral' {
  const { sma20, sma50, rsi, macd } = indicators

  let buySignals = 0
  let sellSignals = 0

  // SMA crossover
  if (sma20 > sma50) buySignals++
  else if (sma20 < sma50) sellSignals++

  // RSI
  if (rsi < 30) buySignals++
  else if (rsi > 70) sellSignals++

  // MACD
  if (macd > 0) buySignals++
  else if (macd < 0) sellSignals++

  if (buySignals > sellSignals) return 'buy'
  if (sellSignals > buySignals) return 'sell'
  return 'neutral'
}

