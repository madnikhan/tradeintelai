# 🧪 Complete System Test Suite

**Date:** Current  
**Status:** Comprehensive Testing

---

## 🎯 **Test Plan**

### **1. Sentiment Analysis Tests**

#### **Test 1.1: Enhanced NLP Sentiment Parser**
```bash
# Test endpoint
curl http://localhost:3000/api/test/sentiment-parsers
```

**Expected:**
- ✅ Keyword extraction works for all pairs
- ✅ NLP sentiment analysis returns scores
- ✅ Entity recognition extracts currencies
- ✅ Relevance scoring filters articles
- ✅ Time-weighted sentiment calculates trends

---

#### **Test 1.2: RSS News Provider**
```bash
# Test RSS aggregation
curl http://localhost:3000/api/rss/news?keywords=EUR,USD
```

**Expected:**
- ✅ Fetches from 7 RSS sources
- ✅ Parses XML correctly
- ✅ Filters by keywords
- ✅ Returns sentiment scores

---

### **2. COT Analysis Tests**

#### **Test 2.1: TFF Report Support**
```bash
# Test TFF endpoint
curl "http://localhost:3000/api/cot/data?currency=EUR&weeks=10&endpoint=tff"
```

**Expected:**
- ✅ Returns TFF data
- ✅ Includes Managed Money data
- ✅ Includes Swap Dealers data

---

#### **Test 2.2: NZD Support**
```bash
# Test NZD COT
curl "http://localhost:3000/api/cot/data?currency=NZD&weeks=10"
```

**Expected:**
- ✅ Returns NZD COT data
- ✅ Contract code 112741 works

---

#### **Test 2.3: Advanced COT Indicators**
```bash
# Test COT parser
curl http://localhost:3000/api/test/cot-parsers
```

**Expected:**
- ✅ COT Index calculated (0-100)
- ✅ COT Momentum calculated
- ✅ Reasoning includes index and momentum

---

### **3. Technical Analysis Tests**

#### **Test 3.1: Advanced Indicators**
```typescript
// Test in browser console or API
import { AdvancedIndicators } from '@/lib/technical-analysis/advanced-indicators';

// Test OBV
const obv = AdvancedIndicators.calculateOBV(priceData);
// Expected: { obv: number, obvEMA: number, trend: string, signal: string }

// Test VWAP
const vwap = AdvancedIndicators.calculateVWAP(priceData);
// Expected: { vwap: number, priceVsVWAP: number, signal: string }

// Test Stochastic
const stoch = AdvancedIndicators.calculateStochastic(priceData);
// Expected: { k: number, d: number, signal: string }

// Test Ichimoku
const ichimoku = AdvancedIndicators.calculateIchimoku(priceData);
// Expected: { tenkan, kijun, senkouA, senkouB, chikou, signal, cloud }
```

**Expected:**
- ✅ All indicators calculate correctly
- ✅ Signals are generated
- ✅ No errors or NaN values

---

#### **Test 3.2: Technical Analysis Integration**
```bash
# Test full technical analysis
# Use Opportunity Scanner or AI Dashboard
```

**Expected:**
- ✅ OBV adds to score
- ✅ VWAP adds to score
- ✅ Stochastic adds to score
- ✅ Ichimoku adds to score
- ✅ Total technical score includes all indicators

---

### **4. Regime Detection Tests**

#### **Test 4.1: ML Regime Detection**
```typescript
// Test ML regime detector
import { MLRegimeDetector } from '@/lib/regime-detector-ml';

const analysis = await MLRegimeDetector.detectRegimeML(priceData, 'EURUSD');
// Expected: { regime, confidence, volatility, trendStrength, rangeStrength, reasoning }
```

**Expected:**
- ✅ Multi-timeframe analysis works
- ✅ Regime transition detected
- ✅ Historical pattern matching works
- ✅ Enhanced features calculated (ADX, RSI, EMA alignment)
- ✅ Confidence score includes all factors

---

#### **Test 4.2: Multi-Timeframe Alignment**
```bash
# Test multi-timeframe
# Should analyze H1, H4, D1
```

**Expected:**
- ✅ H1 regime detected
- ✅ H4 regime detected
- ✅ D1 regime detected
- ✅ Alignment calculated (aligned/mixed/conflicting)
- ✅ Confidence boosted when aligned

---

### **5. Integration Tests**

#### **Test 5.1: Full AI Analysis**
```bash
# Test complete analysis
# Use Opportunity Scanner
```

**Expected:**
- ✅ Technical analysis includes all indicators
- ✅ Fundamental analysis includes all currencies
- ✅ Sentiment analysis uses enhanced NLP
- ✅ COT analysis uses TFF and advanced indicators
- ✅ Regime detection uses ML
- ✅ Overall score calculated correctly

---

#### **Test 5.2: Data Provider Integration**
```bash
# Test all data providers
curl http://localhost:3000/api/monitor/parser-stats
```

**Expected:**
- ✅ All parsers tracked
- ✅ Success rates > 80%
- ✅ Execution times reasonable
- ✅ No critical errors

---

## 📊 **Test Results**

### **✅ Component Tests**

| Component | Status | Notes |
|-----------|--------|-------|
| **Sentiment NLP** | ⏳ Testing | Enhanced parser integrated |
| **COT TFF Report** | ⏳ Testing | TFF endpoint available |
| **COT NZD** | ⏳ Testing | NZD contract code added |
| **COT Advanced** | ⏳ Testing | Index & Momentum added |
| **Technical Indicators** | ⏳ Testing | OBV, VWAP, Stochastic, Ichimoku |
| **ML Regime** | ⏳ Testing | Multi-timeframe & transitions |

---

## 🔍 **Manual Testing Checklist**

### **Frontend Tests:**
- [ ] Dashboard loads without errors
- [ ] Opportunity Scanner works
- [ ] AI Trading Dashboard displays analysis
- [ ] Trade Panel shows recommendations
- [ ] All charts render correctly
- [ ] Notifications work
- [ ] Auto-scan works

### **Backend Tests:**
- [ ] All API routes respond
- [ ] Data providers fetch data
- [ ] Parsers work correctly
- [ ] Caching works
- [ ] Error handling works

### **Integration Tests:**
- [ ] Full analysis pipeline works
- [ ] All components integrated
- [ ] No circular dependencies
- [ ] Performance acceptable

---

## 🚀 **Quick Test Commands**

```bash
# 1. Start dev server
npm run dev

# 2. Test sentiment parsers
curl http://localhost:3000/api/test/sentiment-parsers | jq

# 3. Test COT parsers
curl http://localhost:3000/api/test/cot-parsers | jq

# 4. Test calendar parsers
curl http://localhost:3000/api/test/calendar-parsers | jq

# 5. Check parser stats
curl http://localhost:3000/api/monitor/parser-stats | jq

# 6. Test COT TFF
curl "http://localhost:3000/api/cot/data?currency=EUR&weeks=5&endpoint=tff" | jq

# 7. Test COT NZD
curl "http://localhost:3000/api/cot/data?currency=NZD&weeks=5" | jq
```

---

## ✅ **Expected System Status**

After all tests:
- ✅ All components working
- ✅ No critical errors
- ✅ All integrations functional
- ✅ Performance acceptable
- ✅ Data quality good

---

## 📝 **Test Report**

**Status:** Ready for Testing  
**Next Steps:** Run test commands and verify results

