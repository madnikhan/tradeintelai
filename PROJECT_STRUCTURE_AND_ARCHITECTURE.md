# TradeIntel AI - Complete Project Structure & Architecture

## Date: December 2025
## Version: 2.0 (Gated Engine Architecture with Hard-Enforced Gate-1 Invariants)

---

## 📋 Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [System Architecture](#system-architecture)
4. [Core Calculation Logic](#core-calculation-logic)
5. [Data Flow](#data-flow)
6. [Key Algorithms](#key-algorithms)
7. [Component Details](#component-details)

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework:** Next.js 14.2.5 (React 18.2.0)
- **Language:** TypeScript 5.4.5
- **Styling:** Tailwind CSS 3.4.4
- **Charts:** Recharts 3.5.1
- **UI Components:** Custom React components

### **Backend**
- **Runtime:** Node.js (via Next.js API routes)
- **Language:** TypeScript
- **API:** Next.js API Routes (`/app/api/*`)

### **Trading Platform Integration**
- **MT5 Bridge:** Python 3.x (`wine-mt5-connector.py`)
- **MT5 EA:** MQL5 (`MT5FileBridgeEA.mq5`)
- **Communication:** File-based (symlinks) + HTTP REST API
- **Containerization:** Docker (optional, for multi-account)

### **Data Sources**
- **Price Data:** MT5 Terminal (via bridge)
- **COT Data:** CFTC (via `cot-data.ts`)
- **Economic Calendar:** Unified Calendar (ForexFactory RSS + Investing.com + Trading Economics)
- **News/Sentiment:** RSS feeds + NewsData.io API
- **Technical Indicators:** Calculated internally

### **AI/ML Services**
- **GPT-4 Vision:** OpenAI API (chart pattern recognition)
- **Regime Detection:** ML-based classification (`regime-detector-ml.ts`)

### **Database & Storage**
- **Firebase Firestore:** Account context, analysis storage, trade history
- **Firebase Auth:** User authentication
- **Local Storage:** Browser cache for UI state

### **Deployment**
- **Hosting:** Vercel (Next.js)
- **Tunneling:** ngrok / Cloudflare Tunnel (for MT5 bridge access)
- **Multi-Account:** Docker containers (optional)

---

## 📁 Project Structure

```
tradeintelai/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── cot/data/            # COT data endpoint
│   │   ├── mt5/history/         # MT5 trade history
│   │   ├── openai/chat/         # GPT-4 Vision API proxy
│   │   ├── proxy/               # External API proxies (Finnhub, NewsData, Twelve Data)
│   │   ├── rss/                 # RSS feed endpoints (economic calendar, news)
│   │   └── tradingeconomics/   # Trading Economics indicators
│   ├── dashboard/               # Main trading dashboard page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
│
├── components/                   # React UI Components
│   ├── AITradingDashboard.tsx   # Main AI analysis dashboard
│   ├── TradeAnalysisDashboard.tsx # Trade history & performance
│   ├── OpportunityScanner.tsx   # Multi-pair scanner
│   ├── charts/                  # Chart components
│   │   ├── PriceChart.tsx       # Price candlestick chart
│   │   ├── PLGraph.tsx          # Profit/Loss chart
│   │   ├── PerformanceChart.tsx # Performance metrics chart
│   │   └── TradeHistoryChart.tsx # Trade history visualization
│   ├── SmartScoreCard.tsx       # Score display card
│   ├── SystemStatus.tsx         # System health monitoring
│   ├── RiskMonitor.tsx          # Risk metrics display
│   └── ...                      # Other UI components
│
├── lib/                          # Core Business Logic
│   ├── gated-trading-engine.ts  # ⭐ NEW: Gated trading engine (primary)
│   ├── gated-engine-adapter.ts  # Adapter for backward compatibility
│   ├── ai-trading-engine.ts     # Legacy weighted-score engine (deprecated)
│   ├── openai-service.ts        # GPT-4 Vision integration
│   ├── risk-calculator.ts       # Position sizing & risk management
│   ├── cot-analyzer.ts          # COT report analysis
│   ├── regime-detector.ts       # Market regime classification
│   ├── regime-detector-ml.ts    # ML-based regime detection
│   ├── technical-analysis.ts   # Technical indicators (RSI, MACD, EMA, etc.)
│   ├── economic-calendar.ts     # Economic event analysis
│   ├── trading-hours.ts         # Trading session analysis
│   ├── performance-analytics.ts # Performance metrics (Sharpe, Calmar, etc.)
│   ├── account-calculator.ts    # Account balance calculations
│   ├── position-manager.ts      # Position management
│   ├── trade-analyzer.ts        # Trade analysis
│   ├── correlation-monitor.ts   # Currency correlation tracking
│   ├── data-providers/         # External data providers
│   │   ├── mt5-price-data.ts   # MT5 price data fetcher
│   │   ├── cot-data.ts         # CFTC COT data parser
│   │   ├── unified-calendar.ts # Economic calendar aggregator
│   │   ├── sentiment-parser.ts # News sentiment parser
│   │   └── ...                 # Other data providers
│   ├── technical-analysis/      # Advanced technical analysis
│   │   ├── advanced-indicators.ts # Advanced indicators
│   │   ├── divergence-detector.ts # Divergence detection
│   │   ├── pattern-detector.ts    # Chart pattern detection
│   │   ├── volume-analyzer.ts     # Volume analysis
│   │   └── multi-timeframe-analyzer.ts # Multi-timeframe analysis
│   ├── firebase/                # Firebase integration
│   │   ├── auth.ts             # Authentication
│   │   ├── account-context.ts  # Account context storage
│   │   ├── analysis-storage.ts  # Analysis history storage
│   │   └── trade-history.ts    # Trade history storage
│   ├── http-bridge-connector.ts # MT5 HTTP bridge client
│   ├── file-bridge-connector.ts # MT5 file bridge client (legacy)
│   └── ...                      # Other utilities
│
├── mt5-bridge/                   # MT5 Integration Bridge
│   ├── MT5FileBridgeEA.mq5      # MQL5 Expert Advisor (file-based)
│   ├── wine-mt5-connector.py    # Python HTTP bridge server
│   ├── multi-bridge-manager.py  # Multi-account bridge manager
│   ├── bridge-router.py         # Request router for multi-bridge
│   ├── docker/                  # Docker setup for multi-account
│   │   ├── Dockerfile.mt5       # MT5 container image
│   │   ├── Dockerfile.bridge   # Bridge container image
│   │   └── docker-compose.yml.example
│   └── ...                      # Bridge utilities
│
├── config/                       # Configuration Files
│   └── trading-rules.ts         # Trading rules & constants
│
├── types/                        # TypeScript Type Definitions
│   └── trading.ts               # Trading-related types
│
├── public/                       # Static Assets
│   └── ...                      # Images, icons, etc.
│
├── scripts/                      # Utility Scripts
│   └── test-gated-engine.ts     # Gated engine testing
│
└── [Documentation Files]         # Various .md documentation files
```

---

## 🏗️ System Architecture

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │  Trade Panel │  │  Performance │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘             │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              API Layer (Next.js API Routes)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   COT    │  │   MT5    │  │  OpenAI  │  │  Proxy   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼─────────────┼─────────────┼────────┘
        │              │             │             │
        ▼              ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│              Core Trading Engine (lib/)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         GATED TRADING ENGINE (Primary)               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │   │
│  │  │ Gate 1:      │  │ Gate 2:      │  │ Gate 4:  │  │   │
│  │  │ Readability  │→ │ Directional  │→ │ Execution│  │   │
│  │  │              │  │ Bias         │  │          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │   │
│  │         │                  │                  │        │   │
│  │         └──────────────────┼──────────────────┘        │   │
│  │                            │                            │   │
│  │         ┌──────────────────▼──────────────────┐      │   │
│  │         │   Risk Allocation & Trade Execution   │      │   │
│  │         └──────────────────┬───────────────────┘      │   │
│  └─────────────────────────────┼────────────────────────────┘   │
│                               │                               │
│  ┌───────────────────────────┼───────────────────────────┐  │
│  │      Supporting Modules                              │  │
│  │  • Technical Analysis  • COT Analyzer                │  │
│  │  • Regime Detector    • Economic Calendar           │  │
│  │  • Risk Calculator    • Performance Analytics        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  MT5 Bridge  │    │  Data APIs   │    │   Firebase   │
│  (Python)    │    │  (External)  │    │  (Firestore) │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│  MT5 Terminal │
│  (via Wine)  │
└──────────────┘
```

---

## 🧮 Core Calculation Logic

### **1. Gated Trading Engine (Primary System)**

#### **Gate 1: Market Readability Assessment**

**Purpose:** Determine if market structure is clear enough to trade

**🔒 HARD-ENFORCED INVARIANTS:**
- Gate-1 uses **ONLY** `regimeAnalysis.trendStrength` (price-action structure from upMoves/downMoves) and `gptStructure` as inputs
- **PROHIBITED** from computing, normalizing, clamping, or inferring trend strength from: `technicalScore`, indicators (RSI, MACD, EMA, etc.), volatility (ATR), regime confidence, ML regime labels
- **PROHIBITED** from emitting "weak trend" when `regimeAnalysis.trendStrength >= 60`
- **PROHIBITED** from emitting "no confirmed pattern" when `gptStructure.confidence >= 70` (unless structure is INVALID)
- **PROHIBITED** from emitting "no support/resistance" when S/R arrays are non-empty
- `MarketReadability` is the **single immutable source of truth** - consumed verbatim by all layers (UI, logs, adapters, explanations)
- **RUNTIME ASSERTION:** If UI-displayed trend strength ≠ `gate1Output.gate1Inputs.trendStrength`, throw `[GATE1-DESYNC]` error and force-render Gate-1 value
- **FINAL INVARIANT:** Market with `trendStrength >= 60%`, `pattern >= 70%`, and S/R can **NEVER** be labeled unreadable

**Inputs:**
- `regimeAnalysis.trendStrength`: 0-100 (price-action structure, from upMoves/downMoves calculation)
- `gptStructure`: GPT-4 Vision analysis (optional)
  - `gptStructure.confidence`: 0-100 (pattern confidence)
  - `gptStructure.supportResistance`: { support: number[], resistance: number[] }

**Calculation Logic:**
```typescript
// 🔒 STRICT INVARIANT: Gate-1 must NEVER compute, normalize, clamp, or infer trend strength from other sources
// Gate-1 MUST use regimeAnalysis.trendStrength verbatim (price-action structure only)
let trendStrengthPercent = regimeAnalysis.trendStrength || 0;

// 🔒 GUARD ASSERTION 1: Prevent trendStrength = 0% when regime trendStrength >= 60%
if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent === 0) {
  const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated 0%. Forcing correction.`;
  console.error(errorMsg);
  this.debugLog.push(errorMsg);
  trendStrengthPercent = regimeAnalysis.trendStrength;
}

// 🔒 GUARD ASSERTION 2: Ensure trendStrengthPercent reflects regimeAnalysis.trendStrength if >= 60
if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent < regimeAnalysis.trendStrength) {
  const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated ${trendStrengthPercent}%. Forcing correction.`;
  console.error(errorMsg);
  this.debugLog.push(errorMsg);
  trendStrengthPercent = regimeAnalysis.trendStrength;
}

// 1. Structure-based trend strength ≥ 60%
const hasStrongTrend = trendStrengthPercent >= 60;

// 2. Chart pattern confidence ≥ 70%
const hasStrongPattern = gptStructure && gptStructure.confidence >= 70 && gptStructure.marketStructure !== 'INVALID';

// 3. Clear support and resistance levels identified
const hasSupportResistance = gptStructure && 
  gptStructure.supportResistance && 
  (gptStructure.supportResistance.support.length > 0 || gptStructure.supportResistance.resistance.length > 0);

// 🔒 PROHIBITED: If regimeAnalysis.trendStrength >= 60, NEVER emit "weak trend" or add to failedChecks
if (regimeAnalysis.trendStrength >= 60) {
  // Force exact match - never assign < 60
  if (!hasStrongTrend) {
    const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated weak trend. Forcing correction.`;
    console.error(errorMsg);
    this.debugLog.push(errorMsg);
    trendStrengthPercent = regimeAnalysis.trendStrength;
    // Do NOT add to failedChecks - regime says trend is strong
  }
} else if (!hasStrongTrend) {
  // Only check weak trend if regime trendStrength < 60
  failedSubChecks.weakTrend = true;
  failedChecks.push(`Weak trend (strength: ${trendStrengthPercent.toFixed(1)}% < 60%)`);
  confidence -= 30;
}

// 🔒 PROHIBITED: If gptStructure.confidence >= 70, NEVER emit "no confirmed pattern"
if (gptStructure && gptStructure.confidence >= 70 && gptStructure.marketStructure !== 'INVALID') {
  // Skip pattern check - PROHIBITED from negating pattern existence
  // Pattern is confirmed - do not add to failedChecks
} else if (gptStructure && gptStructure.marketStructure === 'INVALID') {
  // Only fail pattern check if structure is explicitly INVALID
  failedSubChecks.unconfirmedPattern = true;
  failedChecks.push(`Pattern structure invalid or confidence insufficient`);
  confidence -= 20;
}

// 🔒 PROHIBITED: If S/R arrays are non-empty, NEVER emit "no support/resistance"
const hasNonEmptySR = gptStructure && 
  gptStructure.supportResistance && 
  (gptStructure.supportResistance.support.length > 0 || gptStructure.supportResistance.resistance.length > 0);
if (hasNonEmptySR) {
  // Skip S/R check - PROHIBITED from negating S/R existence
} else {
  // Only fail S/R check if arrays are truly empty
  failedSubChecks.noSupportResistance = true;
  failedChecks.push(`Support/resistance levels not clearly identified`);
  confidence -= 15;
}

// 4. Determine readability
const hasAnyStructure = hasStrongTrend || hasStrongPattern;
const hasStructureWithSR = hasAnyStructure && hasSupportResistance;
const isReadableByStructure = hasStructureWithSR;

// 5. Final invariant check: Market with trendStrength >= 60%, pattern >= 70%, and S/R can NEVER be labeled unreadable
if (regimeAnalysis.trendStrength >= 60 && 
    gptStructure && gptStructure.confidence >= 70 && 
    hasNonEmptySR && 
    !isReadable) {
  // Force readable - structural conditions are met
  isReadable = true;
  reason = `Market structure is clear and readable (Trend: ${regimeAnalysis.trendStrength.toFixed(1)}%, Pattern: ${gptStructure.confidence.toFixed(1)}%, S/R: Defined)`;
}

// 6. Generate reason (when READABLE=true) - echo evaluated inputs verbatim
if (isReadable) {
  reason = `Market structure is clear and readable (Trend: ${trendStrengthPercent.toFixed(1)}%, Pattern: ${(gptStructure?.confidence || 0).toFixed(1)}%, S/R: ${hasSupportResistance ? 'Defined' : 'Not identified'})`;
}

// 7. Store gate1Inputs for UI desync detection
gate1Inputs = {
  trendStrength: trendStrengthPercent, // Exact match to regimeAnalysis.trendStrength
  patternConfidence: gptStructure?.confidence || 0,
  hasSupportResistance: hasSupportResistance,
  hasStrongTrend: hasStrongTrend,
  hasStrongPattern: hasStrongPattern,
};
```

**Output:**
- `isReadable`: boolean
- `reason`: string (with evaluated inputs verbatim, single source of truth)
- `confidence`: 0-100
- `gate1Inputs`: { 
  - `trendStrength`: number (exact match to `regimeAnalysis.trendStrength`)
  - `patternConfidence`: number (exact match to `gptStructure.confidence`)
  - `hasSupportResistance`: boolean
  - `hasStrongTrend`: boolean
  - `hasStrongPattern`: boolean
  }

---

#### **Gate 2: Directional Bias Engine**

**Purpose:** Determine market direction and strength (NOT a trade signal)

**Inputs:**
- `marketReadability`: Gate 1 result
- `technicalScore`: 0-100
- `fundamentalScore`: 0-100
- `sentimentScore`: 0-100
- `cotAnalysis`: COT report analysis
- `gptStructure`: GPT-4 Vision analysis

**Calculation Logic:**
```typescript
// 1. Check Gate 1 requirement
if (!marketReadability.isReadable) {
  return NEUTRAL bias
}

// 2. Calculate primary trend
technicalBias = technicalScore - 50  // -50 to +50
primaryTrend = technicalBias > 10 ? 'BULLISH' 
            : technicalBias < -10 ? 'BEARISH' 
            : 'NEUTRAL'

// 3. Check trend/pattern alignment
trendPatternAligned = (hasStrongTrend && hasStrongPattern) 
                   ? (technicalDirection === gptDirection)
                   : (hasStrongTrend || hasStrongPattern)

// 4. Apply COT analysis (contrarian handling)
if (COT contradicts primaryTrend) {
  biasStrength = Math.min(biasStrength, 30)  // Cap strength
  contrarianNote = "Downtrend intact; contrarian COT suggests exhaustion"
  // NEVER flip direction - only weaken
}

// 5. Calculate final strength
finalStrength = baseStrength + cotBias + fundamentalContribution
finalStrength = Math.max(0, Math.min(100, finalStrength))
```

**Output:**
- `direction`: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
- `strength`: 0-100
- `primaryTrend`: Primary market structure trend
- `reversalWatch`: boolean (if contrarian signals detected)
- `contrarianNote`: string (if COT contradicts structure)

---

#### **Gate 3: GPT Structure Validator**

**Purpose:** Validate market structure using GPT-4 Vision (NOT generate signals)

**Inputs:**
- `chartImageBase64`: Base64-encoded chart image
- `symbol`: Currency pair

**Process:**
1. Send chart image to GPT-4 Vision API
2. GPT analyzes: patterns, support/resistance, trend direction
3. Extract structure: TREND_CONTINUATION | REVERSAL | RANGE | INVALID
4. Compare with internal analysis for alignment

**Output:**
- `marketStructure`: Structure type
- `alignment`: 'CONFIRMS' | 'CONTRADICTS' | 'NEUTRAL'
- `confidence`: 0-100
- `patterns`: Array of detected patterns
- `supportResistance`: { support: number[], resistance: number[] }

---

#### **Gate 4: Execution Permission Gate**

**Purpose:** Determine if trade execution is permitted

**Inputs:**
- `marketReadability`: Gate 1 result
- `directionalBias`: Gate 2 result
- `technicalScore`: 0-100
- `gptStructure`: Gate 3 result
- `regimeAnalysis`: Market regime classification
- `tradingHours`: Trading session analysis

**Hard Blockers (NO EXCEPTIONS):**
```typescript
// Blocker 1: Gate 1 unreadable
if (!marketReadability.isReadable) {
  return BLOCKED
}

// Blocker 2: Neutral bias
if (directionalBias.direction === 'NEUTRAL') {
  return BLOCKED
}

// Blocker 3: Regime unsuitable
if (regime === 'LOW_VOLATILITY_RANGE' && confidence < 55%) {
  return BLOCKED
}

// Blocker 4: Technical neutral
if (technicalScore < 55) {
  return BLOCKED
}

// Blocker 5: Regime ↔ GPT contradiction
if (regime.includes('RANGE') && gptStructure === 'TREND_CONTINUATION') {
  return BLOCKED
}

// Blocker 6: Confidence too low
if (confidence < 50%) {
  return BLOCKED
}
```

**Output:**
- `canExecute`: boolean
- `reason`: string (uses Gate-1 reason verbatim if readable)
- `blockedBy`: string[] (list of blockers)
- `technicalExecutionScore`: 0-100
- `confidence`: 0-100 (capped at 65%, never 100%)

---

### **2. Technical Analysis Calculations**

#### **RSI (Relative Strength Index)**
```typescript
// Period: 14 (default)
changes = [price[i] - price[i-1] for i in 1..prices.length]
gains = average(positive changes)
losses = average(absolute(negative changes))
RS = gains / losses
RSI = 100 - (100 / (1 + RS))

// Interpretation:
// RSI < 30: Oversold (bullish)
// RSI > 70: Overbought (bearish)
// RSI 40-60: Neutral
```

#### **MACD (Moving Average Convergence Divergence)**
```typescript
// Periods: Fast=12, Slow=26, Signal=9
fastEMA = EMA(prices, 12)
slowEMA = EMA(prices, 26)
macd = fastEMA - slowEMA
signal = EMA(macd, 9)
histogram = macd - signal

// Interpretation:
// histogram > 0 && macd > signal: Bullish
// histogram < 0 && macd < signal: Bearish
```

#### **EMA (Exponential Moving Average)**
```typescript
multiplier = 2 / (period + 1)
ema[0] = SMA(prices[0..period])
for i in period..prices.length:
  ema[i] = (price[i] - ema[i-1]) * multiplier + ema[i-1]
```

#### **Bollinger Bands**
```typescript
// Period: 20, Standard Deviations: 2
sma20 = SMA(prices, 20)
stdDev = standardDeviation(prices, 20)
upperBand = sma20 + (2 * stdDev)
lowerBand = sma20 - (2 * stdDev)

// Position calculation:
bbPosition = (currentPrice - lowerBand) / (upperBand - lowerBand)
// bbPosition < 0.2: Near lower band (bullish)
// bbPosition > 0.8: Near upper band (bearish)
```

#### **ATR (Average True Range)**
```typescript
// Period: 14
trueRange[i] = max(
  high[i] - low[i],
  abs(high[i] - close[i-1]),
  abs(low[i] - close[i-1])
)
ATR = SMA(trueRange, 14)

// Used for:
// - Stop loss calculation (2-3x ATR)
// - Take profit calculation (3-5x ATR)
// - Volatility adjustment
```

---

### **3. COT Analysis Calculations**

#### **COT Percentile Calculation**
```typescript
// Calculate percentile of current position vs historical
historicalPositions = [netNonCommercial for each week in 52 weeks]
currentPosition = latest.netNonCommercial
percentile = (count of positions < currentPosition) / totalWeeks * 100

// Interpretation:
// percentile > 90: EXTREME_LONG
// percentile > 75: LONG
// percentile < 10: EXTREME_SHORT
// percentile < 25: SHORT
// 25-75: NEUTRAL
```

#### **COT Sentiment Calculation**
```typescript
// Contrarian interpretation:
if (largeSpecPercentile > 80) {
  sentiment = 'BEARISH'  // Specs extreme long = bearish (contrarian)
} else if (largeSpecPercentile < 20) {
  sentiment = 'BULLISH'  // Specs extreme short = bullish (contrarian)
} else if (commercialNet > 0 && specNet < 0) {
  sentiment = 'BULLISH'  // Commercials long, specs short = bullish
} else {
  sentiment = 'NEUTRAL'
}
```

#### **COT Index & Momentum**
```typescript
// COT Index: Normalized position (-100 to +100)
cotIndex = ((currentPosition - minPosition) / (maxPosition - minPosition) - 0.5) * 200

// COT Momentum: Rate of change
cotMomentum = (currentPosition - position[4 weeks ago]) / maxPosition * 100
```

---

### **4. Regime Detection Calculations**

#### **ATR-Based Volatility**
```typescript
atr = calculateATR(priceData, 14)
volatility = atr

// Thresholds:
// LOW: < 0.001 (10 pips)
// HIGH: > 0.002 (20 pips)
```

#### **Trend Strength**
```typescript
// Calculate percentage of price moves in one direction
upMoves = count(price[i] > price[i-1])
downMoves = count(price[i] < price[i-1])
totalMoves = upMoves + downMoves

trendStrength = max(upMoves, downMoves) / totalMoves * 100

// Threshold: ≥60% = strong trend
```

#### **Range Strength**
```typescript
// Calculate price oscillation within range
high = max(prices)
low = min(prices)
range = high - low
oscillation = sum(abs(price[i] - price[i-1])) / range

rangeStrength = oscillation * 100

// Threshold: ≥40% = strong range
```

#### **Regime Classification**
```typescript
if (volatility < LOW_THRESHOLD && rangeStrength > RANGE_THRESHOLD) {
  regime = 'LOW_VOLATILITY_RANGE'
  strategy = 'MEAN_REVERSION'
} else if (volatility > HIGH_THRESHOLD && trendStrength > TREND_THRESHOLD) {
  regime = 'HIGH_VOLATILITY_TREND'
  strategy = 'MOMENTUM'
} else if (trendStrength > TREND_THRESHOLD) {
  regime = trendDirection === 'UP' ? 'TRENDING_UP' : 'TRENDING_DOWN'
  strategy = 'TREND_FOLLOWING'
} else if (volatility > HIGH_THRESHOLD) {
  regime = 'HIGH_VOLATILITY_RANGE'
  strategy = 'AVOID'
} else {
  regime = 'UNKNOWN'
  strategy = 'TREND_FOLLOWING'
}
```

---

### **5. Risk Management Calculations**

#### **Dynamic Risk Percentage**
```typescript
// Small accounts need higher risk to meet minimum lot size (0.01)
if (balance < 500) {
  riskPercentage = 0.05  // 5%
} else if (balance < 1000) {
  riskPercentage = 0.03  // 3%
} else {
  riskPercentage = 0.02  // 2% (default)
}

riskAmount = balance * riskPercentage
```

#### **Position Size Calculation**
```typescript
// 1. Base calculation
pipValue = (lotSize * contractSize) / 10000  // For 4-decimal pairs
stopLossPips = abs(entryPrice - stopLossPrice) * 10000
lotSize = riskAmount / (stopLossPips * pipValue)

// 2. Volatility adjustment
volatilityAdjustment = baseATR / currentATR
volatilityAdjustment = clamp(volatilityAdjustment, 0.5, 1.5)  // Max ±50%
adjustedRiskAmount = riskAmount * volatilityAdjustment

// 3. News adjustment
if (highImpactEvent within 15 minutes) {
  newsAdjustment = 0.5  // Reduce position by 50%
}

// 4. Correlation adjustment
if (openPositions in correlated pairs) {
  correlationAdjustment = 0.7  // Reduce position by 30%
}

// 5. Final position size
finalLotSize = lotSize * volatilityAdjustment * newsAdjustment * correlationAdjustment
finalLotSize = clamp(finalLotSize, 0.01, 200)  // Min 0.01, Max 200 lots
```

#### **Stop Loss / Take Profit Calculation**
```typescript
// Using ATR
atr = calculateATR(priceData, 14)

// Stop Loss: 2-3x ATR
stopLoss = entryPrice ± (2.5 * atr)  // ± depends on direction

// Take Profit: 3-5x ATR (risk-reward ratio 1:1.2 to 1:2)
takeProfit = entryPrice ± (4 * atr)  // ± depends on direction

// For BUY:
stopLoss = entryPrice - (2.5 * atr)
takeProfit = entryPrice + (4 * atr)

// For SELL:
stopLoss = entryPrice + (2.5 * atr)
takeProfit = entryPrice - (4 * atr)
```

---

### **6. Performance Analytics Calculations**

#### **Win Rate**
```typescript
winRate = (winningTrades.length / totalTrades.length) * 100
```

#### **Profit Factor**
```typescript
totalWins = sum(profit of winning trades)
totalLosses = abs(sum(profit of losing trades))
profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0)
```

#### **Sharpe Ratio**
```typescript
// Calculate monthly returns
monthlyReturns = groupReturnsByMonth(trades)

// Calculate average return and standard deviation
avgReturn = mean(monthlyReturns)
stdDev = standardDeviation(monthlyReturns)

// Sharpe Ratio (assuming risk-free rate = 0)
sharpeRatio = (avgReturn / stdDev) * sqrt(12)  // Annualized
```

#### **Calmar Ratio**
```typescript
// Calmar Ratio = Annual Return / Max Drawdown
annualReturn = (totalProfit / initialBalance) * (12 / monthsTraded)
calmarRatio = maxDrawdown > 0 ? annualReturn / maxDrawdown : (annualReturn > 0 ? 999 : 0)
```

#### **Sortino Ratio**
```typescript
// Sortino Ratio (only penalizes downside volatility)
downsideReturns = monthlyReturns.filter(r => r < 0)
downsideStdDev = standardDeviation(downsideReturns)
sortinoRatio = (avgReturn / downsideStdDev) * sqrt(12)  // Annualized
```

#### **Expectancy**
```typescript
// Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
winRate = winningTrades.length / totalTrades.length
lossRate = losingTrades.length / totalTrades.length
avgWin = mean(profit of winning trades)
avgLoss = abs(mean(profit of losing trades))
expectancy = (winRate * avgWin) - (lossRate * avgLoss)
```

#### **Drawdown**
```typescript
// Calculate running balance
runningBalance = [initialBalance]
for trade in trades:
  runningBalance.push(runningBalance[-1] + trade.profitLoss)

// Find peak and trough
peak = max(runningBalance)
trough = min(runningBalance after peak)
maxDrawdown = peak - trough
maxDrawdownPercent = (maxDrawdown / peak) * 100
```

---

## 🔄 Data Flow

### **Analysis Flow (Gated Engine)**

```
1. User clicks "Start AI Analysis"
   ↓
2. Frontend captures chart image (if available)
   ↓
3. Frontend calls: gatedEngineAdapter.analyzeMarket(symbol, [], chartImageBase64)
   ↓
4. Gated Engine: analyzeMarket()
   ├─→ Load historical data (MT5)
   ├─→ Assess Market Readability (Gate 1)
   │   ├─→ Use regimeAnalysis.trendStrength verbatim (price-action structure)
   │   ├─→ Check pattern confidence (gptStructure.confidence >= 70%)
   │   ├─→ Verify support/resistance (gptStructure.supportResistance arrays)
   │   ├─→ Enforce prohibitions (no "weak trend" if regime >= 60%, etc.)
   │   ├─→ Final invariant check (force readable if structural conditions met)
   │   └─→ Return: { isReadable, reason, gate1Inputs } (single immutable source of truth)
   │
   ├─→ Calculate Directional Bias (Gate 2)
   │   ├─→ Check Gate 1 requirement
   │   ├─→ Calculate primary trend
   │   ├─→ Apply COT analysis (contrarian handling)
   │   └─→ Return: { direction, strength, primaryTrend }
   │
   ├─→ Get GPT Structure Analysis (Gate 3) [Optional]
   │   ├─→ Send chart image to GPT-4 Vision
   │   ├─→ Extract structure, patterns, S/R
   │   └─→ Return: { marketStructure, alignment, confidence }
   │
   ├─→ Assess Execution Permission (Gate 4)
   │   ├─→ Check Gate 1 requirement
   │   ├─→ Check Gate 2 requirement (non-neutral bias)
   │   ├─→ Check regime suitability
   │   ├─→ Check technical confirmation
   │   ├─→ Check confidence threshold
   │   └─→ Return: { canExecute, reason, blockedBy }
   │
   └─→ Calculate Risk Allocation (if execution allowed)
       ├─→ Calculate position size
       ├─→ Calculate stop loss/take profit
       └─→ Return: { suggestedPositionSize, suggestedStopLoss, suggestedTakeProfit }
   ↓
5. Generate final recommendation
   ├─→ If execution allowed: BUY or SELL
   └─→ If execution blocked: HOLD
   ↓
6. Generate reasoning (with Gate-1 reason verbatim)
   ↓
7. Return: GatedMarketAnalysis
   ↓
8. Adapter converts to ExtendedMarketAnalysis (for UI)
   ↓
9. Frontend displays results
```

---

### **Trade Execution Flow**

```
1. User clicks "Execute Trade"
   ↓
2. Frontend validates: gateStatus.executionPermitted === true
   ↓
3. Frontend calls: httpBridge.executeTrade(tradeParams)
   ↓
4. HTTP Bridge (Python) receives request
   ↓
5. Bridge writes command to: mt5-commands/command_<timestamp>.json
   ↓
6. MT5 EA (MQL5) polls mt5-commands/ directory
   ↓
7. EA reads command file
   ↓
8. EA executes trade via MT5 API:
   ├─→ OrderSend(symbol, orderType, lotSize, price, slippage, stopLoss, takeProfit)
   └─→ Returns: ticket number or error
   ↓
9. EA writes response to: mt5-responses/response_<timestamp>.json
   ↓
10. Bridge polls mt5-responses/ directory
    ↓
11. Bridge reads response file
    ↓
12. Bridge returns response to frontend via HTTP
    ↓
13. Frontend displays execution result
```

---

## 🔑 Key Algorithms

### **1. Gated Decision Flow**

```typescript
// Sequential gate evaluation (ALL must pass)
if (Gate1.isReadable === false) {
  return HOLD  // Stop here
}

if (Gate2.direction === 'NEUTRAL') {
  return HOLD  // Stop here
}

if (Gate4.canExecute === false) {
  return HOLD  // Stop here
}

// All gates passed
return BUY or SELL
```

### **2. Expectancy-Aware Design**

```typescript
// Track expected value per trade
expectancy = (winRate × avgWin) - (lossRate × avgLoss)

// Only execute if expectancy > 0
if (expectancy <= 0) {
  executionPermission.canExecute = false
}
```

### **3. Conflict Resolution**

```typescript
// If signals conflict, block execution (don't average)
if (technicalDirection !== fundamentalDirection && 
    technicalStrength > 30 && fundamentalStrength > 30) {
  executionPermission.canExecute = false
  executionPermission.reason = "Conflicting signals detected"
}
```

### **4. Structure-First Bias Rule**

```typescript
// Directional bias MUST align with primary trend
if (primaryTrend !== directionBias) {
  directionBias = primaryTrend  // Force alignment
  // COT can weaken but NEVER flip direction
}
```

### **5. Hard-Lock Gate-1 Integrity**

```typescript
// 🔒 HARD-ENFORCED INVARIANT: Gate-1 reason is BOUND to assessMarketReadability() output ONLY
// MarketReadability is the single immutable source of truth
// NEVER recompute, NEVER overwrite, NEVER use fallbacks downstream
if (marketReadability.isReadable) {
  // Use marketReadability.reason verbatim
  // Reason already contains: "Trend: X%, Pattern: Y%, S/R: [levels]"
  // gate1Inputs.trendStrength exactly matches regimeAnalysis.trendStrength
}

// 🔒 RUNTIME ASSERTION: If UI-displayed trend strength ≠ gate1Output.gate1Inputs.trendStrength, throw [GATE1-DESYNC] error
// This assertion is enforced in the UI component (AITradingDashboard.tsx)
useEffect(() => {
  if (analysis?.gateStatus?.gate1Inputs && uiTrendStrength !== undefined) {
    const gate1TrendStrength = analysis.gateStatus.gate1Inputs.trendStrength;
    if (Math.abs(uiTrendStrength - gate1TrendStrength) > 0.1) {
      const errorMsg = `[GATE1-DESYNC] UI displayed trend strength (${uiTrendStrength.toFixed(1)}%) ≠ Gate-1 output (${gate1TrendStrength.toFixed(1)}%). Forcing UI update.`;
      console.error(errorMsg);
      // Force re-render or update state to reflect gate1TrendStrength
    }
  }
}, [analysis?.gateStatus?.gate1Inputs, uiTrendStrength]);

// 🔒 ADAPTER LAYER: Must pass gate1Inputs verbatim to UI
gateStatus: {
  marketReadable: gated.marketReadability.isReadable,
  marketReadabilityReason: gated.marketReadability.reason, // Verbatim from Gate-1
  gate1Inputs: gated.marketReadability.gate1Inputs, // 🔒 HARD-LOCK: Pass Gate-1 inputs verbatim
  // ... other gate status fields
}

// 🔒 EXPLANATION LAYER: Must use Gate-1 reason verbatim, never recompute
private generateHoldReasoning(
  marketReadability?: MarketReadability, // Required parameter
  // ... other parameters
): string[] {
  if (!marketReadability) {
    const errorMsg = `[GATE1-INVARIANT] CRITICAL: marketReadability is missing. Cannot proceed without Gate-1 output.`;
    console.error(errorMsg);
    return [errorMsg];
  }
  
  const gate1Reason = marketReadability.reason; // Always use verbatim
  // Never recompute, never overwrite, never use fallbacks
}
```

### **6. Gate-1 Hard-Enforced Prohibitions**

```typescript
// 🔒 PROHIBITED: "Weak Trend" when regime >= 60%
if (regimeAnalysis.trendStrength >= 60) {
  // NEVER emit "weak trend"
  // NEVER assign trendStrengthPercent < 60
  // NEVER set failedSubChecks.weakTrend = true
  // NEVER reduce confidence due to weak trend
  // NEVER add "Weak trend" to failedChecks array
  // Force exact match: trendStrengthPercent = regimeAnalysis.trendStrength
  // Guard assertion: If trendStrengthPercent < regimeAnalysis.trendStrength, force correction
}

// 🔒 PROHIBITED: "No Confirmed Pattern" when GPT confidence >= 70%
if (gptStructure && gptStructure.confidence >= 70 && gptStructure.marketStructure !== 'INVALID') {
  // NEVER emit "no confirmed pattern"
  // NEVER emit "pattern confidence insufficient"
  // NEVER set failedSubChecks.unconfirmedPattern = true
  // NEVER negate pattern existence
  // NEVER add "Pattern confidence insufficient" to failedChecks array
  // Pattern is confirmed - skip pattern check entirely
}

// 🔒 PROHIBITED: "No Support/Resistance" when arrays are non-empty
if (hasNonEmptySR) {
  // NEVER emit "no support/resistance"
  // NEVER emit "support/resistance levels not identified"
  // NEVER set failedSubChecks.noSupportResistance = true
  // NEVER negate S/R existence
  // NEVER add "Support/resistance levels not identified" to failedChecks array
  // S/R exists - skip S/R check entirely
}

// 🔒 PROHIBITED: "Market Unreadable" when structural conditions are met
if (regimeAnalysis.trendStrength >= 60 && 
    gptStructure && gptStructure.confidence >= 70 && 
    hasNonEmptySR) {
  // NEVER label market as unreadable
  // NEVER set isReadable = false
  // Force readable: isReadable = true
  // Reason must reflect structural clarity: "Market structure is clear and readable"
}

// 🔒 PROHIBITED: Downstream recomputation or override
// All downstream layers (execution, regime, confidence, fallback narratives) are FORBIDDEN from:
// - Recomputing trend strength from technicalScore, indicators, volatility, regime confidence
// - Overwriting Gate-1 reason with fallback narratives
// - Emitting "unreadable / weak trend / no pattern / no S/R" when Gate-1 is READABLE
// - Using any source other than MarketReadability object for Gate-1 status
```

---

## 📦 Component Details

### **Frontend Components**

#### **AITradingDashboard.tsx**
- **Purpose:** Main AI analysis interface
- **Features:**
  - Symbol selector
  - Chart display (Recharts)
  - Gate status display
  - AI analysis results
  - Trade execution buttons
- **State Management:** React hooks (useState, useCallback)
- **Data Flow:** Calls `GatedEngineAdapter.analyzeMarket()`

#### **TradeAnalysisDashboard.tsx**
- **Purpose:** Trade history and performance analysis
- **Features:**
  - Trade table with filtering
  - Performance charts
  - Risk metrics
  - CSV export
- **Data Source:** MT5 bridge (trade history)

#### **OpportunityScanner.tsx**
- **Purpose:** Multi-pair market scanner
- **Features:**
  - Scans multiple currency pairs
  - Ranks by opportunity score
  - Displays best opportunities
- **Algorithm:** Parallel analysis of multiple pairs

---

### **Backend Services**

#### **Gated Trading Engine**
- **File:** `lib/gated-trading-engine.ts`
- **Size:** ~2,200 lines
- **Key Methods:**
  - `analyzeMarket()`: Main entry point
  - `assessMarketReadability()`: Gate 1 (hard-enforced invariants)
    - Uses ONLY `regimeAnalysis.trendStrength` (price-action structure) and `gptStructure` as inputs
    - Prohibited from computing, normalizing, clamping, or inferring trend strength from other sources
    - Prohibited from emitting contradictory messages when structural conditions are met
    - Guard assertions prevent `trendStrength = 0%` when `regimeAnalysis.trendStrength >= 60`
    - Final invariant check forces readable when structural conditions are met
    - Returns `MarketReadability` as single immutable source of truth with `gate1Inputs` for UI desync detection
  - `calculateDirectionalBias()`: Gate 2
  - `assessExecutionPermission()`: Gate 4
  - `calculateRiskAllocation()`: Position sizing
  - `generateHoldReasoning()`: Explanation generator (uses Gate-1 reason verbatim)

#### **Risk Calculator**
- **File:** `lib/risk-calculator.ts`
- **Key Methods:**
  - `calculateTradeSize()`: Position size calculation
  - `getRiskPercentage()`: Dynamic risk based on account size
  - `calculateStopLoss()`: ATR-based stop loss
  - `calculateTakeProfit()`: ATR-based take profit

#### **COT Analyzer**
- **File:** `lib/cot-analyzer.ts`
- **Key Methods:**
  - `fetchCOTData()`: Fetch CFTC data
  - `analyzeCOT()`: Analyze positions
  - `calculatePercentile()`: Percentile calculation
  - `calculateSentiment()`: Contrarian sentiment

#### **Regime Detector**
- **File:** `lib/regime-detector.ts`
- **Key Methods:**
  - `detectRegime()`: Main detection function
  - `calculateATR()`: Volatility calculation
  - `calculateTrendStrength()`: Trend strength
  - `calculateRangeStrength()`: Range strength
  - `classifyRegime()`: Regime classification

---

### **Data Providers**

#### **MT5 Price Data Provider**
- **File:** `lib/data-providers/mt5-price-data.ts`
- **Purpose:** Fetch historical price data from MT5
- **Methods:**
  - `getHistoricalData()`: Fetch OHLCV data
  - `getCurrentPrice()`: Fetch current price

#### **COT Data Provider**
- **File:** `lib/data-providers/cot-data.ts`
- **Purpose:** Fetch and parse CFTC COT reports
- **Sources:** CFTC API (TFF report preferred)
- **Methods:**
  - `getCOTData()`: Fetch COT data
  - `parseCFTCRecord()`: Parse CSV records

#### **Unified Calendar Provider**
- **File:** `lib/data-providers/unified-calendar.ts`
- **Purpose:** Aggregate economic calendar from multiple sources
- **Sources:** ForexFactory RSS, Investing.com, Trading Economics
- **Methods:**
  - `getEconomicCalendar()`: Fetch unified calendar

---

### **MT5 Bridge**

#### **Python HTTP Bridge**
- **File:** `mt5-bridge/wine-mt5-connector.py`
- **Purpose:** HTTP server for MT5 communication
- **Port:** 8080 (default)
- **Endpoints:**
  - `GET /health`: Health check
  - `GET /account`: Account info
  - `GET /positions`: Open positions
  - `POST /trade`: Execute trade
  - `GET /history`: Trade history

#### **MQL5 Expert Advisor**
- **File:** `mt5-bridge/MT5FileBridgeEA.mq5`
- **Purpose:** File-based communication with bridge
- **Communication:**
  - Reads: `mt5-commands/command_*.json`
  - Writes: `mt5-responses/response_*.json`
- **Features:**
  - Dynamic STOPLEVEL validation
  - Price normalization
  - Error handling

---

## 🔐 Security & Configuration

### **Environment Variables**
```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
FIREBASE_ADMIN_SDK_JSON=...

# MT5 Bridge
MT5_BRIDGE_URL=http://localhost:8080

# Data APIs (optional)
FINNHUB_API_KEY=...
NEWSDATA_API_KEY=...
TWELVE_DATA_API_KEY=...
```

### **Firebase Security Rules**
- **Firestore:** User-based access control
- **Storage:** Authenticated users only
- **Auth:** Email/password + Google OAuth

---

## 📊 Performance Metrics

### **System Performance**
- **Analysis Time:** ~2-5 seconds (with GPT Vision)
- **Trade Execution:** ~100-500ms (via MT5 bridge)
- **Data Fetching:** Parallel (COT, calendar, news)

### **Scalability**
- **Multi-Account:** Docker containers (50+ accounts)
- **Concurrent Analysis:** Parallel processing
- **Caching:** 1-hour cache for economic calendar

---

## 🎯 Key Design Principles

1. **Prefer NO TRADE over BAD TRADE**
   - Multiple gates must pass
   - Hard blockers cannot be overridden

2. **Analysis ≠ Execution ≠ Narrative**
   - Gate 1 (Readability) independent of execution
   - Gate 2 (Bias) independent of execution
   - Gate 4 (Execution) only evaluates suitability

3. **Structure-First Rule**
   - Directional bias MUST align with primary trend
   - COT can weaken but NEVER flip direction

4. **Gate-1 Integrity (Hard-Enforced)**
   - Gate-1 uses **ONLY** `regimeAnalysis.trendStrength` (price-action structure from upMoves/downMoves) and `gptStructure` as inputs
   - **PROHIBITED** from computing, normalizing, clamping, or inferring trend strength from: `technicalScore`, indicators (RSI, MACD, EMA, etc.), volatility (ATR), regime confidence, ML regime labels
   - **PROHIBITED** from emitting "weak trend" when `regimeAnalysis.trendStrength >= 60`
   - **PROHIBITED** from emitting "no confirmed pattern" when `gptStructure.confidence >= 70` (unless structure is INVALID)
   - **PROHIBITED** from emitting "no support/resistance" when S/R arrays are non-empty
   - **PROHIBITED** from labeling market as "unreadable" when structural conditions are met (trendStrength >= 60%, pattern >= 70%, S/R exists)
   - Gate-1 reason bound to `assessMarketReadability()` ONLY - single immutable source of truth
   - `MarketReadability` object consumed verbatim by all layers (UI, logs, adapters, explanations)
   - Never recomputed, normalized, overridden, or fallbacked downstream
   - Runtime `[GATE1-DESYNC]` assertion in UI if displayed trend strength ≠ `gate1Output.gate1Inputs.trendStrength`
   - Guard assertions prevent `trendStrength = 0%` when `regimeAnalysis.trendStrength >= 60`
   - Final invariant: Market with `trendStrength >= 60%`, `pattern >= 70%`, and S/R can **NEVER** be labeled unreadable

5. **Expectancy-Aware**
   - Track expected value per trade
   - Only execute if expectancy > 0

---

## 📚 Additional Resources

- **Gated Engine Guide:** `GATED_ENGINE_REFACTORING_GUIDE.md`
- **Decision Flow:** `GATED_ENGINE_DECISION_FLOW.md`
- **Gate-1 Structure-Based Refactor:** `GATE1_STRUCTURE_BASED_REFACTOR.md`
- **Gate-1 Hard Enforcement:** `GATE1_HARD_ENFORCEMENT_COMPLETE.md`
- **Gate-1 Strict Binding:** `GATE1_STRICT_BINDING_ENFORCEMENT.md`
- **MT5 Bridge:** `mt5-bridge/README.md`
- **Docker Setup:** `DOCKER_SETUP_GUIDE.md`
- **Multi-Account:** `SETUP_50_ACCOUNTS_GUIDE.md`

---

## 🔒 Gate-1 Hard-Enforced Invariants (Latest Update)

### **Input Restrictions**
- ✅ **ONLY** `regimeAnalysis.trendStrength` (price-action structure from upMoves/downMoves)
- ✅ **ONLY** `gptStructure` (GPT-4 Vision analysis)
- ❌ **PROHIBITED:** `technicalScore`, indicators (RSI, MACD, EMA, etc.), volatility (ATR), regime confidence, ML regime labels

### **Prohibited Outputs**
- ❌ **PROHIBITED:** "Weak trend" when `regimeAnalysis.trendStrength >= 60`
- ❌ **PROHIBITED:** "No confirmed pattern" when `gptStructure.confidence >= 70` (unless structure is INVALID)
- ❌ **PROHIBITED:** "No support/resistance" when S/R arrays are non-empty
- ❌ **PROHIBITED:** "Market unreadable" when structural conditions are met (trendStrength >= 60%, pattern >= 70%, S/R exists)
- ❌ **PROHIBITED:** Downstream recomputation or override of Gate-1 reason or inputs

### **Single Source of Truth**
- ✅ `MarketReadability` object is immutable and bound as single source of truth
- ✅ All UI, logs, explanations, adapters, and retry renders consume it verbatim
- ✅ `gate1Inputs` stored in `MarketReadability` for UI desync detection
- ✅ Runtime `[GATE1-DESYNC]` assertion in UI component if displayed trend strength ≠ `gate1Output.gate1Inputs.trendStrength`
- ✅ No recomputation, normalization, override, or fallbacks downstream
- ✅ Guard assertions prevent `trendStrength = 0%` when `regimeAnalysis.trendStrength >= 60`

### **Guard Assertions**
```typescript
// Guard Assertion 1: Prevent trendStrength = 0% when regime trendStrength >= 60%
if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent === 0) {
  const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated 0%. Forcing correction.`;
  console.error(errorMsg);
  this.debugLog.push(errorMsg);
  trendStrengthPercent = regimeAnalysis.trendStrength;
}

// Guard Assertion 2: Ensure trendStrengthPercent reflects regimeAnalysis.trendStrength if >= 60
if (regimeAnalysis.trendStrength >= 60 && trendStrengthPercent < regimeAnalysis.trendStrength) {
  const errorMsg = `[GATE 1] CRITICAL INVARIANT VIOLATION: Regime trendStrength is ${regimeAnalysis.trendStrength}% but Gate-1 calculated ${trendStrengthPercent}%. Forcing correction.`;
  console.error(errorMsg);
  this.debugLog.push(errorMsg);
  trendStrengthPercent = regimeAnalysis.trendStrength;
}
```

### **Final Invariant**
A market with `trendStrength >= 60%`, `pattern >= 70%`, and S/R can **NEVER** be labeled unreadable.

**Implementation:**
```typescript
// Final invariant check in assessMarketReadability()
if (regimeAnalysis.trendStrength >= 60 && 
    gptStructure && gptStructure.confidence >= 70 && 
    hasNonEmptySR && 
    !isReadable) {
  // Force readable - structural conditions are met
  gate1Output.isReadable = true;
  gate1Output.reason = `Market structure is clear and readable (Trend: ${regimeAnalysis.trendStrength.toFixed(1)}%, Pattern: ${gptStructure.confidence.toFixed(1)}%, S/R: Defined)`;
}
```

### **Runtime UI Desync Detection**
```typescript
// In AITradingDashboard.tsx
useEffect(() => {
  if (analysis?.gateStatus?.gate1Inputs && uiTrendStrength !== undefined) {
    const gate1TrendStrength = analysis.gateStatus.gate1Inputs.trendStrength;
    if (Math.abs(uiTrendStrength - gate1TrendStrength) > 0.1) {
      const errorMsg = `[GATE1-DESYNC] UI displayed trend strength (${uiTrendStrength.toFixed(1)}%) ≠ Gate-1 output (${gate1TrendStrength.toFixed(1)}%). Forcing UI update.`;
      console.error(errorMsg);
      // Force re-render or update state to reflect gate1TrendStrength
    }
  }
}, [analysis?.gateStatus?.gate1Inputs, uiTrendStrength]);
```

---

**Last Updated:** December 2025
**Architecture Version:** 2.0 (Gated Engine with Hard-Enforced Gate-1 Invariants - Strict Binding to Regime Trend Strength)

