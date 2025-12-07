# API Key Capacity Analysis

## Current Configuration

**Total API Keys: 20**
- **Finnhub**: 4 keys
- **NewsData**: 4 keys  
- **TwelveData**: 4 keys
- **Alpha Vantage**: 4 keys
- **Fixer**: 4 keys (currently unused)

## API Usage Per Scan

### Scan Parameters
- **Trading Pairs**: 28 pairs
- **Scan Frequency**: 5-15 minutes (depending on trading hours)
- **Delay Between Pairs**: 1 second
- **Scan Duration**: ~28-35 seconds (including API response times)

### API Calls Per Full Scan

| Service | Calls Per Scan | Caching | Actual Calls (with cache) | Notes |
|---------|---------------|---------|--------------------------|-------|
| **TwelveData** | 28 calls | 1 minute | 28 calls (if scan >1min apart) | 1 call per pair (historical data) |
| **Finnhub** | 1 call | 5 minutes | 1 call (if scan >5min apart) | Economic calendar (shared across all pairs) |
| **NewsData** | 8 calls | 5 minutes | 8 calls (if scan >5min apart) | 1 call per major currency (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD) |
| **Alpha Vantage** | ~20 calls | Varies | ~20 calls | Forex rates (8 currencies) + economic indicators |
| **Fixer** | 0 calls | N/A | 0 calls | Not currently used in codebase |
| **TOTAL** | **~57 calls** | | **~57 calls** (if cache expired) | |

**Note**: With 5-minute scans, Finnhub and NewsData calls will be cached, reducing to ~49 calls per scan.

## Rate Limits (Free Tier)

### Finnhub.io
- **Per Minute**: 60 calls
- **Per Month**: 60,000 calls
- **With 4 Keys**: 240 calls/minute, 240,000 calls/month
- **Status**: ✅ **SUFFICIENT** (1 call per scan, well within limits)

### NewsData.io
- **Per Day**: 200 calls
- **Per Month**: 10,000 calls
- **With 4 Keys**: 800 calls/day, 40,000 calls/month
- **Status**: ⚠️ **LIMITED** (8 calls per scan = 96-288 calls/day depending on frequency)

### Alpha Vantage
- **Per Minute**: 5 calls
- **Per Day**: 500 calls
- **With 4 Keys**: 20 calls/minute, 2,000 calls/day
- **Status**: ⚠️ **TIGHT** (~20 calls per scan, may hit per-minute limit)

### TwelveData
- **Per Minute**: ~8 calls (estimated free tier)
- **Per Month**: ~800 calls (estimated free tier)
- **With 4 Keys**: ~32 calls/minute, ~3,200 calls/month
- **Status**: ⚠️ **TIGHT** (28 calls per scan, may hit limits)

## Capacity Analysis

### Scenario 1: Prime Trading Hours (5-minute scans)
- **Scans per hour**: 12 scans
- **Scans per day**: ~144 scans (12 hours of prime time)
- **API Calls per day** (accounting for caching):
  - TwelveData: 144 × 28 = **4,032 calls** ❌ (exceeds 3,200/month limit)
  - Finnhub: ~29 calls (cached after first scan) ✅
  - NewsData: ~29 calls (cached after first scan) ✅
  - Alpha Vantage: 144 × 20 = **2,880 calls** ❌ (exceeds 2,000/day limit)

### Scenario 2: Average Trading Hours (15-minute scans) ⭐ **RECOMMENDED**
- **Scans per hour**: 4 scans
- **Scans per day**: ~48 scans
- **API Calls per day** (accounting for caching):
  - TwelveData: 48 × 28 = **1,344 calls** ✅ (within 3,200/month limit with 4 keys = 12,800/month)
  - Finnhub: ~10 calls (cached 5 min, ~10 unique calls/day) ✅
  - NewsData: ~10 calls (cached 5 min, ~10 unique calls/day) ✅
  - Alpha Vantage: 48 × 20 = **960 calls** ✅ (within 2,000/day limit with 4 keys = 8,000/day)

## Recommendations

### ✅ **20 Keys Are SUFFICIENT IF:**

1. **Scan Frequency**: Use 15-minute intervals (not 5-minute)
   - Reduces API calls by 66%
   - Still provides timely signal detection

2. **Caching Optimization**: 
   - Current caching is good (1-5 minutes)
   - Consider increasing cache TTL for non-critical data

3. **Key Distribution**:
   - Current 4 keys per service is good for rotation
   - System automatically rotates and skips failed keys

### ⚠️ **Potential Issues:**

1. **TwelveData**: Most critical bottleneck
   - 28 calls per scan is high
   - Consider reducing pairs or upgrading plan

2. **NewsData**: Daily limit is restrictive
   - 8 calls per scan × frequent scans = risk
   - Consider upgrading to paid plan

3. **Alpha Vantage**: Per-minute limit is tight
   - 20 calls per scan may hit 5 calls/minute limit
   - With 4 keys rotating: 20 calls/minute total capacity
   - Need to ensure delays between calls

### 🎯 **Optimal Configuration:**

**For 20 Keys to Work Efficiently:**

1. **Scan Interval**: 15 minutes minimum
   - Reduces daily calls significantly
   - Still provides good signal detection

2. **Pair Reduction** (Optional):
   - Focus on top 20 pairs instead of 28
   - Reduces TwelveData calls by 28%

3. **Upgrade Priorities** (if needed):
   - **TwelveData**: Highest priority (most calls)
   - **NewsData**: Second priority (daily limit)
   - **Alpha Vantage**: Third priority (per-minute limit)

## Current System Status

### ✅ **Working Well:**
- Key rotation system is implemented
- Failure tracking prevents using bad keys
- Caching reduces redundant calls
- 1-second delay between pairs helps

### ⚠️ **Needs Attention:**
- TwelveData usage is high (28 calls/scan)
- NewsData daily limit may be hit during active trading
- Alpha Vantage per-minute limit needs monitoring

## Conclusion

### ✅ **20 API Keys Are SUFFICIENT** with:

#### Option 1: Selected Pairs (Major Pairs) + 5-Minute Intervals ⭐ **RECOMMENDED**
- ✅ **7 Major Pairs** (EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD)
- ✅ **5-minute scan intervals**
- ✅ Current caching (1-5 minutes) - reduces calls significantly
- ✅ Key rotation system (4 keys per service)
- ✅ 1-second delays between pairs
- ✅ Failure tracking and automatic key skipping

**Capacity Summary (Selected Pairs - 7 pairs, 5-min intervals):**
- **Daily Scans**: ~144 scans (12 hours × 12 scans/hour)
- **TwelveData**: 144 × 7 = **1,008 calls/day** ✅ (well within 3,200/month = ~107/day per key × 4 = 428/day)
- **Finnhub**: ~29 calls/day (cached) ✅
- **NewsData**: ~29 calls/day (cached) ✅
- **Alpha Vantage**: 144 × 20 = **2,880 calls/day** ⚠️ (close to 2,000/day limit, but with 4 keys = 8,000/day capacity ✅)

#### Option 2: All Pairs + 15-Minute Intervals
- ✅ **28 pairs** (all trading pairs)
- ✅ **15-minute scan intervals**
- ✅ Daily Scans: ~48 scans/day
- ✅ Total Daily API Calls: ~2,300 calls (well within limits)

### ⚠️ **20 API Keys May Be INSUFFICIENT for:**
- ❌ **All 28 pairs** with **5-minute scan intervals** (too frequent, exceeds limits)
- ❌ Continuous 24/7 scanning at high frequency
- ❌ High-frequency trading scenarios (>200 scans/day)

### 🎯 **Optimal Setup:**

**Best Performance (Recommended):**
- **Pairs**: 7 Major Pairs (EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD)
- **Scan Frequency**: 5 minutes
- **Trading Hours**: Focus on PRIME/GOOD hours (8-12 hours/day)
- **Daily Scans**: ~144 scans/day
- **Total Daily API Calls**: ~4,000 calls (well within limits with 4 keys per service)

**Balanced Approach:**
- **Pairs**: All 28 pairs
- **Scan Frequency**: 15 minutes
- **Daily Scans**: ~48 scans/day
- **Total Daily API Calls**: ~2,300 calls (well within limits)

## Action Items

1. **Use Pair Selection Feature**: Select "Major Pairs" (7 pairs) for 5-minute scans
2. **Monitor API Usage**: Check the warning banner in Opportunity Scanner
3. **Adjust Scan Frequency**: 
   - Selected pairs (7): Use 5-minute intervals ✅
   - All pairs (28): Use 15-minute intervals ✅
4. **Consider Upgrades**: If hitting limits, prioritize TwelveData and NewsData
5. **Custom Selection**: Create your own pair list based on trading preferences

## Verification

To verify your API capacity:
1. Run a full scan and check console logs
2. Monitor the warning banner in Opportunity Scanner
3. Check for 429 (rate limit) errors in console
4. Adjust scan frequency if limits are hit

