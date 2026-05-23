# Gated Trading Engine - Decision Flow Diagram

## Complete Decision Flow (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKET ANALYSIS START                         │
│  • Load Historical Data                                         │
│  • Get Technical, Fundamental, Sentiment Scores                 │
│  • Get COT Analysis                                             │
│  • Get Regime Analysis                                          │
│  • Get GPT Structure Analysis (if available)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 1: MARKET READABILITY GATE                    │
│                    (MANDATORY - NO EXCEPTIONS)                  │
├─────────────────────────────────────────────────────────────────┤
│  Evaluate:                                                       │
│  ❌ Regime = HIGH_VOLATILITY_RANGE → BLOCK                      │
│  ❌ Regime confidence < 30% → BLOCK                            │
│  ❌ ≥2 major components strongly disagree → BLOCK               │
│  ❌ GPT confidence > 70% AND contradicts technical → BLOCK      │
│  ❌ Sentiment + Fundamentals diverge > 40 points → BLOCK       │
│  ❌ GPT structure = INVALID → BLOCK                            │
│                                                                  │
│  Result: isMarketReadable() → boolean                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
              FALSE │                   │ TRUE
                    ↓                   ↓
        ┌───────────────────┐   ┌──────────────────────────────┐
        │   RETURN HOLD      │   │  LAYER 2: DIRECTIONAL BIAS   │
        │                     │   │      ENGINE                  │
        │ Reason:             │   │  (NOT a trade signal)        │
        │ "Market unreadable  │   ├──────────────────────────────┤
        │  - standing aside"  │   │ Calculate:                   │
        │                     │   │ • Technical trend (PRIMARY) │
        │ Blocked By:         │   │ • Fundamental alignment      │
        │ [list of blockers]  │   │ • COT influence (strengthen/ │
        │                     │   │   weaken, NEVER flip)        │
        └───────────────────┘   │                                │
                                │ Result:                        │
                                │ • direction: BULLISH/BEARISH/  │
                                │   NEUTRAL                      │
                                │ • strength: 0-100               │
                                └────────────────────────────────┘
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                   │
                              NEUTRAL│                   │BULLISH/BEARISH
                                    ↓                   ↓
                        ┌───────────────────┐   ┌──────────────────────────────┐
                        │   RETURN HOLD      │   │  LAYER 3: GPT STRUCTURE      │
                        │                     │   │      VALIDATOR               │
                        │ Reason:             │   ├──────────────────────────────┤
                        │ "No clear           │   │ GPT analyzes chart:          │
                        │  directional bias" │   │ • marketStructure:           │
                        │                     │   │   TREND_CONTINUATION/        │
                        │                     │   │   REVERSAL/RANGE/INVALID     │
                        │                     │   │ • alignment:                 │
                        │                     │   │   CONFIRMS/CONTRADICTS/      │
                        │                     │   │   NEUTRAL                    │
                        │                     │   │ • confidence: 0-100          │
                        │                     │   │                              │
                        │                     │   │ GPT CAN:                     │
                        │                     │   │ ✅ Increase confidence        │
                        │                     │   │ ✅ BLOCK execution           │
                        │                     │   │ ❌ NEVER flip direction       │
                        └───────────────────┘   └──────────────────────────────┘
                                                          ↓
                                ┌─────────────────────────────────────────────┐
                                │  LAYER 4: EXECUTION PERMISSION GATE        │
                                │           (MANDATORY - ALL MUST PASS)      │
                                ├─────────────────────────────────────────────┤
                                │ Check ALL conditions:                       │
                                │ ✅ Market readable                          │
                                │ ✅ Bias ≠ NEUTRAL                           │
                                │ ✅ Technical execution score ≥ 55           │
                                │ ✅ GPT does NOT strongly contradict         │
                                │ ✅ Volatility is tradable                   │
                                │ ✅ Confidence ≥ 50                          │
                                │                                             │
                                │ Result: canExecuteTrade() → boolean         │
                                └─────────────────────────────────────────────┘
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                   │
                                  NO│                   │YES
                                    ↓                   ↓
                        ┌───────────────────┐   ┌──────────────────────────────┐
                        │   RETURN HOLD      │   │  LAYER 5: RISK ALLOCATION    │
                        │                     │   │      & TRADE EXECUTION      │
                        │ Reason:             │   ├──────────────────────────────┤
                        │ "Execution          │   │ Calculate:                   │
                        │  conditions not     │   │ • Stop Loss (ATR-based)      │
                        │  met"               │   │ • Take Profit (1:2 R:R)      │
                        │                     │   │ • Position Size              │
                        │ Blocked By:         │   │ • Risk Level                 │
                        │ [list of blockers]  │   │                              │
                        │                     │   │ Estimate Expectancy:         │
                        │                     │   │ • Win Rate                   │
                        │                     │   │ • Avg Win (pips)              │
                        │                     │   │ • Avg Loss (pips)             │
                        │                     │   │ • Expectancy (pips/trade)      │
                        │                     │   │                              │
                        │                     │   │ Return: BUY or SELL          │
                        └───────────────────┘   └──────────────────────────────┘
```

---

## Key Decision Points

### **Gate 1: Market Readability**
- **Purpose:** Block trading when market structure is unclear
- **Hard Rules:** No exceptions
- **Output:** `isReadable: boolean`

### **Gate 2: Directional Bias**
- **Purpose:** Identify market direction (NOT a trade signal)
- **Rules:** COT can strengthen/weaken but NEVER flip
- **Output:** `direction: BULLISH | BEARISH | NEUTRAL`, `strength: 0-100`

### **Gate 3: GPT Structure Validation**
- **Purpose:** Validate market structure, not generate signals
- **Rules:** Can confirm, contradict, or block - but NEVER flip direction
- **Output:** `marketStructure`, `alignment`, `confidence`

### **Gate 4: Execution Permission**
- **Purpose:** Final check before trade execution
- **Rules:** ALL conditions must pass
- **Output:** `canExecute: boolean`

### **Gate 5: Risk Allocation**
- **Purpose:** Calculate position size, SL/TP only if execution permitted
- **Rules:** ATR-based, COT-adjusted
- **Output:** `stopLoss`, `takeProfit`, `positionSize`, `expectancy`

---

## User-Facing Messages

### **When Market Unreadable:**
```
⚠️ Market Unreadable - Standing Aside

Reason: [specific reason]
Blocked By:
• [condition 1]
• [condition 2]

System prefers NO TRADE over BAD TRADE
```

### **When Bias Neutral:**
```
⚠️ No Clear Directional Bias - Standing Aside

Technical: [score]
Fundamental: [score]
COT: [analysis]

No clear edge detected - waiting for better setup
```

### **When Execution Blocked:**
```
❌ Execution Blocked

Bias: [BULLISH/BEARISH] ([strength]% strength)
Blocked By:
• [condition 1]
• [condition 2]

Confidence: [X]% (minimum 50% required)
```

### **When Execution Permitted:**
```
✅ Trade Execution Permitted

Bias: [BULLISH/BEARISH] ([strength]% strength)
GPT Structure: [CONFIRMS/CONTRADICTS/NEUTRAL]
Confidence: [X]%

Expected Win Rate: [X]%
Expected Expectancy: [X] pips/trade
```

---

## Expectancy Calculation

```
Expectancy = (WinRate × AvgWin) - (LossRate × AvgLoss)

Where:
- WinRate = estimated from confidence + bias strength
- AvgWin = Take Profit distance (pips)
- AvgLoss = Stop Loss distance (pips)
- LossRate = 1 - WinRate

Example:
- WinRate: 60%
- AvgWin: 60 pips
- AvgLoss: 30 pips
- Expectancy = (0.60 × 60) - (0.40 × 30) = 36 - 12 = +24 pips/trade
```

---

## COT Role (Corrected)

**OLD (WRONG):**
- COT EXTREME_SHORT → Adds +15 points → Can flip BUY to SELL

**NEW (CORRECT):**
- COT EXTREME_SHORT → Strengthens BULLISH bias (+15 strength)
- COT EXTREME_LONG → Strengthens BEARISH bias (+15 strength)
- COT can NEVER flip direction
- COT can reduce position size (risk adjustment)

---

## GPT Role (Reformed)

**OLD (WRONG):**
- GPT Chart Analysis → 20% weight in score → Can be averaged out

**NEW (CORRECT):**
- GPT Structure Analysis → Validates market structure
- GPT can CONFIRM bias → Increases confidence
- GPT can CONTRADICT bias → Blocks execution (if confidence > 70%)
- GPT can NEVER flip direction alone

---

## Success Criteria

✅ **Trade frequency decreases** (more HOLDs)
✅ **HOLD frequency increases** (gates block bad trades)
✅ **Conflicting signals no longer average into trades**
✅ **GPT improves quality without dominating**
✅ **System prefers NO TRADE over BAD TRADE**

---

## Example Flow: EUR/USD Analysis

**Input:**
- Technical: 56 (neutral)
- Fundamental: 56 (neutral)
- Sentiment: 51 (neutral)
- COT: EXTREME_SHORT → BUY
- Regime: LOW_VOLATILITY_RANGE (20% confidence)
- GPT: SELL (descending triangle, 80% confidence)

**Flow:**

1. **Market Readability Gate:**
   - Regime confidence < 30% → ❌ BLOCKED
   - GPT contradicts technical → ❌ BLOCKED
   - **Result:** `isReadable = false`

2. **Return HOLD:**
   - Recommendation: HOLD
   - Reason: "Market unreadable - standing aside"
   - Blocked By:
     - "Regime detection uncertain (20% confidence)"
     - "GPT structure (80% confidence) contradicts technical analysis"

**OLD SYSTEM WOULD HAVE:**
- Calculated score: 67/100
- Recommended: BUY
- Executed trade (despite conflicts)

**NEW SYSTEM:**
- ✅ Blocks trade (conflicts detected)
- ✅ Returns HOLD
- ✅ Explains why

---

## Example Flow: USD/JPY Analysis (Successful)

**Input:**
- Technical: 75 (bullish)
- Fundamental: 60 (slightly bullish)
- Sentiment: 55 (neutral-bullish)
- COT: EXTREME_SHORT → BUY
- Regime: LOW_VOLATILITY_RANGE (55% confidence)
- GPT: BUY (ascending triangle, 80% confidence)

**Flow:**

1. **Market Readability Gate:**
   - ✅ Regime confidence ≥ 30%
   - ✅ No strong disagreements
   - ✅ GPT confirms technical
   - **Result:** `isReadable = true`

2. **Directional Bias:**
   - Technical: BULLISH (strength: 25)
   - COT: Strengthens BULLISH (+15)
   - Fundamental: Aligns (+3)
   - **Result:** `direction = BULLISH`, `strength = 43`

3. **GPT Structure:**
   - Structure: TREND_CONTINUATION
   - Alignment: CONFIRMS
   - Confidence: 80%

4. **Execution Permission:**
   - ✅ Market readable
   - ✅ Bias = BULLISH
   - ✅ Technical execution score: 80
   - ✅ GPT confirms
   - ✅ Confidence: 72%
   - **Result:** `canExecute = true`

5. **Risk Allocation:**
   - Stop Loss: 156.56 (29.6 pips)
   - Take Profit: 157.46 (60.4 pips)
   - Position Size: 0.01 lots
   - Expectancy: +18.5 pips/trade

6. **Return BUY:**
   - Recommendation: BUY
   - Reason: "BULLISH bias detected (strength: 43%) • GPT structure confirms BULLISH bias • Execution conditions met (confidence: 72%)"

---

## Key Differences from Old System

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Decision Method** | Weighted averaging | Sequential gating |
| **Conflicts** | Averaged into score | Block execution |
| **COT Role** | Can flip direction | Strengthens/weakens only |
| **GPT Role** | 20% weight | Structure validator |
| **Confidence** | Distance from 50 | Signal alignment |
| **HOLD Frequency** | Low (40-60 score) | High (gates block) |
| **Trade Frequency** | High | Lower (quality over quantity) |
| **Expectancy** | Not tracked | Tracked and displayed |

---

## Implementation Status

✅ **Core Engine:** Implemented (`lib/gated-trading-engine.ts`)
⏳ **Integration:** Pending (needs adapter for existing UI)
⏳ **UI Updates:** Pending (remove "accuracy %", show gates)
⏳ **GPT Service:** Pending (update to return structure analysis)
⏳ **Testing:** Pending

---

**Last Updated:** December 2025
**Status:** Core implementation complete, integration pending

