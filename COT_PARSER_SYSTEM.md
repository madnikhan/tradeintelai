# COT Parser System Implementation

## Overview

Enhanced COT (Commitment of Traders) data provider with parser system, performance monitoring, and inverse COT logic for USD pairs.

## Features

### ✅ **Implemented:**

1. **API Route Proxy** (`/api/cot/data`)
   - Server-side proxy for CFTC API
   - Bypasses CORS restrictions
   - Better error handling
   - 6-hour cache (COT updates weekly)

2. **Performance Monitoring**
   - Integrated `ParserMonitor` tracking
   - Success/failure rates
   - Execution time tracking
   - Error logging

3. **Inverse COT Logic for USD Pairs** ✅ **NEW**
   - USDJPY: Uses JPY COT data (inverted)
   - USDCAD: Uses CAD COT data (inverted)
   - USDCHF: Uses CHF COT data (inverted)
   - Automatically inverts positions (long ↔ short)

4. **Test Endpoints** (`/api/test/cot-parsers`)
   - Tests all currencies
   - Tests non-USD pairs
   - Tests USD pairs with inverse logic
   - Comprehensive diagnostics

## How It Works

### For Non-USD Pairs (EURUSD, GBPUSD, etc.)

```typescript
// Standard COT logic
EURUSD → Uses EUR COT data directly
GBPUSD → Uses GBP COT data directly
```

### For USD Pairs (USDJPY, USDCAD, USDCHF)

```typescript
// Inverse COT logic
USDJPY → Uses JPY COT data, inverts positions
USDCAD → Uses CAD COT data, inverts positions
USDCHF → Uses CHF COT data, inverts positions

// Logic:
// If JPY specs are LONG → USDJPY should be BEARISH (inverse)
// If JPY specs are SHORT → USDJPY should be BULLISH (inverse)
```

### Position Inversion

When using inverse COT for USD pairs:
- `netNonCommercial` → Negated (long becomes short, short becomes long)
- `netCommercial` → Negated
- `netSmallSpec` → Negated
- Long/Short positions → Swapped

## API Endpoints

### 1. COT Data Proxy

**Endpoint**: `/api/cot/data`

**Parameters**:
- `currency` (required): Currency code (EUR, GBP, JPY, AUD, CAD, CHF)
- `weeks` (optional): Number of weeks (default: 52)
- `endpoint` (optional): 'legacy' or 'tff' (default: 'legacy')

**Example**:
```bash
curl "http://localhost:3000/api/cot/data?currency=EUR&weeks=52"
```

**Response**:
```json
{
  "success": true,
  "currency": "EUR",
  "contract": "EUROPEAN CURRENCY UNIT",
  "contractCode": "099741",
  "recordCount": 52,
  "data": [...]
}
```

### 2. COT Parser Test

**Endpoint**: `/api/test/cot-parsers`

**Example**:
```bash
curl "http://localhost:3000/api/test/cot-parsers"
```

**Response**:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "tests": {
    "currencies": {
      "EUR": { "success": true, "recordCount": 52, ... },
      "GBP": { "success": true, "recordCount": 52, ... },
      ...
    },
    "nonUsdPairs": {
      "EURUSD": { "sentiment": "BULLISH", "confidence": 75, ... },
      ...
    },
    "usdPairs": {
      "USDJPY": { "sentiment": "BEARISH", "hasInverseCOT": true, ... },
      ...
    }
  },
  "summary": {
    "totalExecutionTime": 1234,
    "currencyTests": { "success": 6, "successRate": 100 },
    ...
  }
}
```

## Usage

### Basic Usage

```typescript
import { COTDataProvider } from '@/lib/data-providers/cot-data';
import { COTAnalyzer } from '@/lib/cot-analyzer';

// Get COT data for a currency
const cotData = await COTDataProvider.getCOTData('EUR', 52);

// Analyze COT for a pair (handles inverse logic automatically)
const analysis = await COTAnalyzer.analyzeCOT('USDJPY');
console.log(analysis.sentiment); // BULLISH or BEARISH
console.log(analysis.confidence); // 0-100
```

### Monitoring

```typescript
import { ParserMonitor } from '@/lib/data-providers/parser-monitor';

// Get COT parser statistics
const stats = ParserMonitor.getStats('COT-CFTC');
console.log(stats.successRate); // Success rate percentage
console.log(stats.averageExecutionTime); // Average execution time
```

## Testing

### Quick Test

```bash
# Test all COT parsers
curl "http://localhost:3000/api/test/cot-parsers" | jq '.'
```

### Test Individual Currency

```bash
# Test EUR COT data
curl "http://localhost:3000/api/cot/data?currency=EUR&weeks=52" | jq '.'
```

### Verify Inverse COT

```bash
# Test USDJPY (should use inverse COT from JPY)
curl "http://localhost:3000/api/test/cot-parsers" | jq '.tests.usdPairs.USDJPY'
```

## Performance

- **Cache Duration**: 6 hours (COT updates weekly on Friday)
- **Expected Execution Time**: < 2000ms per currency
- **Success Rate**: Should be ≥ 95% (CFTC API is reliable)

## Supported Currencies

- ✅ EUR (European Currency Unit)
- ✅ GBP (Pound Sterling)
- ✅ JPY (Japanese Yen)
- ✅ AUD (Australian Dollar)
- ✅ CAD (Canadian Dollar)
- ✅ CHF (Swiss Franc)

## USD Pairs Support

- ✅ USDJPY (uses JPY COT, inverted)
- ✅ USDCAD (uses CAD COT, inverted)
- ✅ USDCHF (uses CHF COT, inverted)

## Impact

### Before:
- ❌ USD pairs returned "NEUTRAL" (no COT data)
- ❌ Missing 10% weight in scoring for USD pairs

### After:
- ✅ USD pairs use inverse COT logic
- ✅ Full 10% weight in scoring for USD pairs
- ✅ Better analysis for USDJPY, USDCAD, USDCHF

## Files Modified

- `app/api/cot/data/route.ts` - NEW: API route proxy
- `lib/data-providers/cot-data.ts` - Enhanced with monitoring
- `lib/cot-analyzer.ts` - Added inverse COT logic
- `app/api/test/cot-parsers/route.ts` - NEW: Test endpoint
- `lib/data-providers/index.ts` - Exported ParserMonitor

## Next Steps

1. ✅ Test inverse COT logic with real data
2. ✅ Verify USD pairs are getting COT analysis
3. ✅ Monitor performance and success rates
4. ⚠️ Consider adding more currencies if needed
5. ⚠️ Add TFF (Traders in Financial Futures) endpoint support

## Notes

- COT data updates weekly (Friday 3:30 PM ET)
- Cache is set to 6 hours to reduce API calls
- Inverse COT logic is automatic for USD pairs
- Performance monitoring tracks all fetches

