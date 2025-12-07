# COT Data Verification Guide

## Official CFTC COT Report Websites

### 1. **CFTC Official COT Reports**
**Main Website**: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm

**Direct Links**:
- **Legacy Futures-Only Report**: https://www.cftc.gov/MarketReports/CommitmentsofTraders/LegacyFuturesOnly/index.htm
- **Traders in Financial Futures (TFF)**: https://www.cftc.gov/MarketReports/CommitmentsofTraders/TradersinFinancialFutures/index.htm

### 2. **CFTC Socrata API (What We Use)**
**API Base**: https://publicreporting.cftc.gov/resource

**Direct Data Links**:
- **Legacy Futures Report (JSON)**: https://publicreporting.cftc.gov/resource/6dca-aqww.json
- **TFF Report (JSON)**: https://publicreporting.cftc.gov/resource/gpe5-46if.json

**Filtered by Contract Code**:
- **EUR**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=099741&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC
- **GBP**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=096742&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC
- **JPY**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=097741&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC
- **AUD**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=232741&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC
- **CAD**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=090741&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC
- **CHF**: https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=092741&$limit=52&$order=report_date_as_yyyy_mm_dd%20DESC

### 3. **Alternative COT Analysis Websites**

**TradingView COT Data**:
- https://www.tradingview.com/symbols/CFTC-EURUSD/
- https://www.tradingview.com/symbols/CFTC-GBPUSD/
- https://www.tradingview.com/symbols/CFTC-USDJPY/
- https://www.tradingview.com/symbols/CFTC-AUDUSD/
- https://www.tradingview.com/symbols/CFTC-USDCAD/
- https://www.tradingview.com/symbols/CFTC-USDCHF/

**MyFxBook COT Data**:
- https://www.myfxbook.com/forex-market/cot-report

**Investing.com COT Data**:
- https://www.investing.com/economic-calendar/cot-report-1088

**ForexFactory COT Data**:
- https://www.forexfactory.com/cot

## Contract Codes We Use

| Currency | Contract Name | Contract Code | CME Symbol | Direct API Link |
|----------|---------------|---------------|------------|-----------------|
| EUR | EUROPEAN CURRENCY UNIT | 099741 | 6E | [View EUR COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=099741&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |
| GBP | POUND STERLING | 096742 | 6B | [View GBP COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=096742&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |
| JPY | JAPANESE YEN | 097741 | 6J | [View JPY COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=097741&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |
| AUD | AUSTRALIAN DOLLAR | 232741 | 6A | [View AUD COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=232741&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |
| CAD | CANADIAN DOLLAR | 090741 | 6C | [View CAD COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=090741&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |
| CHF | SWISS FRANC | 092741 | 6S | [View CHF COT](https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=092741&$limit=10&$order=report_date_as_yyyy_mm_dd%20DESC) |

## How to Verify Parsed Data

### Step 1: Get Latest COT Data from Our System

```bash
# Test our parser
curl "http://localhost:3000/api/test/cot-parsers" | jq '.tests.currencies.EUR'

# Get specific currency data
curl "http://localhost:3000/api/cot/data?currency=EUR&weeks=1" | jq '.data[0]'
```

### Step 2: Compare with Official CFTC Data

1. **Visit CFTC Website**:
   - Go to: https://www.cftc.gov/MarketReports/CommitmentsofTraders/LegacyFuturesOnly/index.htm
   - Click on "Current Report" (latest Friday's report)
   - Find "EURO FX - CHICAGO MERCANTILE EXCHANGE" (for EUR)

2. **Check Key Fields**:
   - **Report Date**: Should match `report_date_as_yyyy_mm_dd`
   - **Open Interest**: Should match `open_interest_all`
   - **Non-Commercial Long**: Should match `noncomm_positions_long_all`
   - **Non-Commercial Short**: Should match `noncomm_positions_short_all`
   - **Commercial Long**: Should match `comm_positions_long_all`
   - **Commercial Short**: Should match `comm_positions_short_all`

### Step 3: Verify Calculations

Our system calculates:
- `netNonCommercial` = `noncomm_positions_long_all` - `noncomm_positions_short_all`
- `netCommercial` = `comm_positions_long_all` - `comm_positions_short_all`
- `netSmallSpec` = `nonrept_positions_long_all` - `nonrept_positions_short_all`

**Verify these match**:
- Net Non-Commercial = Long - Short (from CFTC report)
- Net Commercial = Long - Short (from CFTC report)

### Step 4: Test Inverse COT for USD Pairs

For USDJPY:
1. Get JPY COT data from CFTC
2. Our system inverts it for USDJPY
3. If JPY specs are LONG → USDJPY should show BEARISH (inverse)

**Test**:
```bash
# Get USDJPY analysis (uses inverse COT)
curl "http://localhost:3000/api/test/cot-parsers" | jq '.tests.usdPairs.USDJPY'
```

## Expected Data Format

### CFTC API Response (JSON)
```json
{
  "report_date_as_yyyy_mm_dd": "2024-01-02",
  "commodity_name": "EUROPEAN CURRENCY UNIT",
  "cftc_contract_market_code": "099741",
  "open_interest_all": "500000",
  "noncomm_positions_long_all": "150000",
  "noncomm_positions_short_all": "100000",
  "comm_positions_long_all": "200000",
  "comm_positions_short_all": "180000",
  "nonrept_positions_long_all": "50000",
  "nonrept_positions_short_all": "20000"
}
```

### Our Parsed Format
```json
{
  "symbol": "EUR",
  "date": "2024-01-02T00:00:00.000Z",
  "openInterest": 500000,
  "nonCommercialLong": 150000,
  "nonCommercialShort": 100000,
  "commercialLong": 200000,
  "commercialShort": 180000,
  "netNonCommercial": 50000,  // 150000 - 100000
  "netCommercial": 20000,      // 200000 - 180000
  "netSmallSpec": 30000        // 50000 - 20000
}
```

## Quick Verification Checklist

- [ ] Latest report date matches CFTC website
- [ ] Open Interest matches
- [ ] Non-Commercial Long/Short match
- [ ] Commercial Long/Short match
- [ ] Net calculations are correct (Long - Short)
- [ ] Date format is correct (YYYY-MM-DD)
- [ ] Contract codes match (099741 for EUR, etc.)
- [ ] Inverse COT works for USD pairs (USDJPY, USDCAD, USDCHF)

## Common Issues to Check

1. **Date Mismatch**: 
   - CFTC reports are released Friday 3:30 PM ET
   - Data reflects positions as of prior Tuesday
   - Check if you're comparing the right week

2. **Contract Code Mismatch**:
   - Verify contract code matches currency
   - Check if using correct endpoint (Legacy vs TFF)

3. **Data Type Mismatch**:
   - CFTC API returns strings, we convert to numbers
   - Verify conversion is correct

4. **Inverse COT Logic**:
   - For USDJPY, check if positions are inverted
   - Long should become short, short should become long

## Testing Script

```bash
#!/bin/bash

echo "Testing COT Data Parsing..."
echo "=========================="

# Test EUR
echo "1. Testing EUR COT data..."
curl -s "http://localhost:3000/api/cot/data?currency=EUR&weeks=1" | jq '.data[0] | {
  date: .report_date_as_yyyy_mm_dd,
  openInterest: .open_interest_all,
  nonCommLong: .noncomm_positions_long_all,
  nonCommShort: .noncomm_positions_short_all
}'

echo ""
echo "2. Compare with CFTC website:"
echo "   https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=099741&\$limit=1&\$order=report_date_as_yyyy_mm_dd%20DESC"
echo ""
echo "3. Test USDJPY inverse COT..."
curl -s "http://localhost:3000/api/test/cot-parsers" | jq '.tests.usdPairs.USDJPY'
```

## Additional Resources

- **CFTC COT Report Explanation**: https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm
- **CME Forex Futures**: https://www.cmegroup.com/trading/fx/
- **COT Report Schedule**: Reports released every Friday at 3:30 PM ET

## Notes

- COT data updates **weekly** (every Friday)
- Data reflects positions as of **prior Tuesday**
- Reports are typically available by **Friday 4:00 PM ET**
- Our cache is set to **6 hours** to reduce API calls
- Contract codes are from **CME (Chicago Mercantile Exchange)**

