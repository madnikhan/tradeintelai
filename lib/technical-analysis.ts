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

/**
 * Calculate RSI using Wilder's Smoothing Method (Standard RSI)
 * 🔒 FIXED: Now uses proper Wilder's smoothing instead of simple average
 * 
 * Formula:
 * First Period: avgGain = sum(gains) / period, avgLoss = sum(losses) / period
 * Subsequent: avgGain = (prevAvgGain * (period-1) + currentGain) / period
 * RS = avgGain / avgLoss
 * RSI = 100 - (100 / (1 + RS))
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50 // Neutral RSI

  // Calculate price changes
  const changes: number[] = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  // First period: Simple average
  let gains = 0
  let losses = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i]
    } else {
      losses += Math.abs(changes[i])
    }
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period

  // Subsequent periods: Wilder's smoothing
  // avgGain = (prevAvgGain * (period - 1) + currentGain) / period
  for (let i = period; i < changes.length; i++) {
    const currentGain = changes[i] > 0 ? changes[i] : 0
    const currentLoss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    
    avgGain = (avgGain * (period - 1) + currentGain) / period
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period
  }

  if (avgLoss === 0) return 100

  const rs = avgGain / avgLoss
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

  // Calculate MACD line: Fast EMA - Slow EMA
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)
  const macd = fastEMA - slowEMA

  // FIXED: Calculate proper signal line using EMA of MACD values
  // We need to calculate MACD values for each period to get EMA of MACD
  const macdValues: number[] = []
  
  // Calculate MACD for each period (need at least signalPeriod values)
  const startIndex = Math.max(slowPeriod, prices.length - signalPeriod - 1)
  for (let i = startIndex; i < prices.length; i++) {
    const periodPrices = prices.slice(0, i + 1)
    const periodFastEMA = calculateEMA(periodPrices, fastPeriod)
    const periodSlowEMA = calculateEMA(periodPrices, slowPeriod)
    macdValues.push(periodFastEMA - periodSlowEMA)
  }

  // Calculate signal line as EMA of MACD values
  const signal = macdValues.length >= signalPeriod
    ? calculateEMA(macdValues, signalPeriod)
    : macdValues.length > 0
    ? macdValues[macdValues.length - 1] // Use last MACD value if insufficient data
    : macd * 0.9 // Fallback approximation if no MACD values

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

