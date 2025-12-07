# Calendar Parser Testing Guide

## Overview

This guide explains how to test, verify, and monitor the calendar parsers for ForexFactory, Investing.com, and Trading Economics.

## Test Endpoints

### 1. Raw Source Test (`/api/test/calendar-raw`)

Tests if we can fetch raw HTML/XML from the sources.

**Usage:**
```bash
# Test all sources
curl "http://localhost:3000/api/test/calendar-raw?source=all"

# Test specific source
curl "http://localhost:3000/api/test/calendar-raw?source=forexfactory"
curl "http://localhost:3000/api/test/calendar-raw?source=investing"
curl "http://localhost:3000/api/test/calendar-raw?source=tradingeconomics"
```

**Response includes:**
- Success status
- HTTP status code
- Content type
- File size
- HTML/XML preview (first 2000 chars)
- Structure indicators (table presence, class names, etc.)

### 2. Parser Test (`/api/test/calendar-parsers`)

Tests all parsers and returns detailed results.

**Usage:**
```bash
curl "http://localhost:3000/api/test/calendar-parsers"
```

**Response includes:**
- Event counts per source
- Execution times
- Sample events (first 3-5)
- Events by currency
- Events by impact level
- Events with actual/forecast/previous data
- Source statistics
- Summary with overall metrics

### 3. Parser Statistics (`/api/monitor/parser-stats`)

Gets performance statistics and health status.

**Usage:**
```bash
curl "http://localhost:3000/api/monitor/parser-stats"
```

**Response includes:**
- Success rates per source
- Average execution times
- Total events processed
- Health status (healthy/degraded/failing)
- Overall statistics

## Quick Test Script

Use the provided script to run all tests:

```bash
./scripts/test-calendar-parsers.sh
```

Or manually:

```bash
# 1. Test raw fetches
curl "http://localhost:3000/api/test/calendar-raw?source=all" | jq '.'

# 2. Test parsers
curl "http://localhost:3000/api/test/calendar-parsers" | jq '.'

# 3. Get statistics
curl "http://localhost:3000/api/monitor/parser-stats" | jq '.'
```

## Expected Results

### ForexFactory RSS
- **Expected Events**: 20-50 events per day
- **Format**: RSS XML
- **Success Indicators**:
  - `itemCount > 0` in raw test
  - `eventCount > 0` in parser test
  - Events have title, country, impact, date

### Investing.com
- **Expected Events**: 30-60 events per day
- **Format**: HTML table
- **Success Indicators**:
  - `hasTable: true` in raw test
  - `hasEventClass: true` in raw test
  - `eventCount > 0` in parser test
  - Events have title, country, impact, date

### Trading Economics
- **Expected Events**: 30-60 events per day
- **Format**: HTML calendar
- **Success Indicators**:
  - `hasTable: true` in raw test
  - `hasEventId: true` in raw test
  - `eventCount > 0` in parser test
  - Events have title, country, impact, date

### Unified Provider
- **Expected Events**: 50-100+ events (after deduplication)
- **Success Indicators**:
  - `eventCount > sum of individual sources` (due to deduplication)
  - `sourceStats` shows counts from all sources
  - Events have diverse currencies and impact levels

## Troubleshooting

### No Events Returned

1. **Check Raw Fetch**:
   ```bash
   curl "http://localhost:3000/api/test/calendar-raw?source=forexfactory" | jq '.sources.forexfactory'
   ```
   - If `success: false`, check network/API route
   - If `success: true` but `itemCount: 0`, RSS format may have changed

2. **Check Parser**:
   ```bash
   curl "http://localhost:3000/api/test/calendar-parsers" | jq '.tests.forexFactory'
   ```
   - Check `error` field for details
   - Check `executionTime` (should be < 5000ms)

3. **Check HTML Structure**:
   - View raw HTML preview in raw test response
   - Verify HTML structure matches parser expectations
   - Update regex patterns if structure changed

### Low Event Counts

1. **Check Date Filtering**:
   - Events may be filtered by date range
   - Check if events are in the future
   - Verify currency filtering (only major currencies)

2. **Check Parsing Logic**:
   - Review sample events in parser test
   - Verify title, country, currency are extracted correctly
   - Check if impact levels are being parsed

### High Execution Times

1. **Check Network**:
   - Slow network can cause timeouts
   - Check if sources are accessible
   - Verify API routes are working

2. **Check Caching**:
   - First request may be slower (no cache)
   - Subsequent requests should be faster
   - Check cache TTL (30 minutes)

### Parser Errors

1. **HTML Structure Changed**:
   - View raw HTML in raw test
   - Update regex patterns in parser
   - Test with new patterns

2. **API Route Issues**:
   - Check server logs
   - Verify CORS headers
   - Check User-Agent headers

## Monitoring

### Health Status

- **Healthy**: Success rate ≥ 80%
- **Degraded**: Success rate 50-79%
- **Failing**: Success rate < 50%

### Performance Metrics

- **Execution Time**: Should be < 5000ms per source
- **Success Rate**: Should be ≥ 80% for all sources
- **Event Count**: Should be > 0 for at least one source

### Continuous Monitoring

Monitor parser stats regularly:

```bash
# Get current stats
curl "http://localhost:3000/api/monitor/parser-stats" | jq '.summary'

# Check health
curl "http://localhost:3000/api/monitor/parser-stats" | jq '.health'
```

## Integration Testing

Test the full integration:

1. **Run Opportunity Scanner**:
   - Check console logs for event counts
   - Verify events appear in fundamental analysis
   - Check for "0 positive, 0 negative events" warnings

2. **Check Economic Calendar**:
   ```typescript
   import { UnifiedCalendarProvider } from '@/lib/data-providers/unified-calendar';
   const events = await UnifiedCalendarProvider.getEconomicCalendar();
   console.log(`Loaded ${events.length} events`);
   ```

3. **Verify in UI**:
   - Check if fundamental scores improve
   - Verify events are being used in analysis
   - Check for any error messages

## Next Steps

1. ✅ Run raw source tests to verify connectivity
2. ✅ Run parser tests to verify extraction
3. ✅ Check statistics to monitor performance
4. ⚠️ Fix any parsing issues found
5. ⚠️ Update HTML patterns if structure changed
6. ⚠️ Monitor success rates over time

