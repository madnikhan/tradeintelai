# API Key Issues - Fix Guide

## Problem Summary

The Opportunity Scanner is not finding strong signals because external data providers (Finnhub.io and NewsData.io) are returning errors:

- **Finnhub.io**: `403 Forbidden` errors - API keys may be invalid, expired, or lack proper permissions
- **NewsData.io**: `429 Too Many Requests` errors - Rate limits are being exceeded

## Impact on Signal Quality

Without fundamental and sentiment data:
- **Fundamental Analysis**: Reduced from 15% weight to effectively 0% (no economic calendar data)
- **Sentiment Analysis**: Reduced from 10% weight to effectively 0% (no news sentiment data)
- **Overall Score**: The AI relies more heavily on technical analysis (60% weight), which may result in fewer strong signals

## Solutions Implemented

### 1. Improved Error Handling
- Added detailed error logging with specific messages for 403 and 429 errors
- Errors are now logged using the `logger` utility (suppressed in production)

### 2. Rate Limiting & Key Rotation
- Added failure tracking to the `APIKeyManager`
- Keys that fail 3+ times are temporarily skipped
- Failed keys are reset after 1 hour
- System automatically rotates to working keys

### 3. Increased Delays
- Increased delay between pair scans from 300ms to 1000ms (1 second)
- This reduces the number of API calls per scan, helping avoid rate limits

### 4. Warning Banner
- Added a warning banner in the Opportunity Scanner that displays when API keys are failing
- Shows the number of failures for each service
- Provides guidance on how to fix the issue

## How to Fix API Key Issues

### Option 1: Update API Keys (Recommended)

1. **Finnhub.io**:
   - Go to https://finnhub.io/
   - Sign up or log in
   - Get a free API key (or upgrade for higher rate limits)
   - Update `config/api-keys.ts`:
     ```typescript
     FINNHUB: [
       "your-new-api-key-1",
       "your-new-api-key-2",
       // ... add multiple keys for rotation
     ],
     ```

2. **NewsData.io**:
   - Go to https://newsdata.io/
   - Sign up or log in
   - Get a free API key (or upgrade for higher rate limits)
   - Update `config/api-keys.ts`:
     ```typescript
     NEWSDATA: [
       "pub_your-new-api-key-1",
       "pub_your-new-api-key-2",
       // ... add multiple keys for rotation
     ],
     ```

### Option 2: Reduce Scan Frequency

If you can't update API keys immediately, reduce the scan frequency:

1. Go to **Settings** tab
2. Disable **Auto-Scan Opportunities** or increase the **Scan Interval** to 15-30 minutes
3. This reduces the number of API calls and helps avoid rate limits

### Option 3: Use Technical Analysis Only

The system will continue to function using only technical analysis (60% weight). However:
- Signals may be less frequent
- Confidence scores may be lower
- You may need to lower thresholds (e.g., 60+ score, 50%+ confidence) to find signals

## Current API Key Status

Check the **Opportunity Scanner** tab for a warning banner that shows:
- Number of Finnhub failures
- Number of NewsData failures
- Impact on signal quality
- Instructions on how to fix

## Verification

After updating API keys:
1. Restart the Next.js dev server (`npm run dev`)
2. Check the browser console - you should see fewer 403/429 errors
3. The warning banner in Opportunity Scanner should disappear after successful API calls
4. Strong signals should start appearing more frequently

## Rate Limits

### Finnhub.io Free Tier:
- 60 API calls/minute
- 60,000 API calls/month

### NewsData.io Free Tier:
- 200 API calls/day
- 10,000 API calls/month

**Recommendation**: With 28 trading pairs and scans every 5-15 minutes, you may need:
- Multiple API keys for rotation (already implemented)
- Reduced scan frequency (15+ minutes)
- Or upgrade to paid plans for higher limits

## Technical Details

### Files Modified:
- `config/api-keys.ts` - Added failure tracking and key rotation
- `lib/data-providers/finnhub.ts` - Improved error handling and logging
- `lib/data-providers/newsdata.ts` - Improved error handling and logging
- `components/OpportunityScanner.tsx` - Added warning banner and increased delays

### How It Works:
1. When an API call fails (403 or 429), the system records the failure
2. After 3 failures, that key is temporarily skipped
3. The system rotates to the next available key
4. Failed keys are reset after 1 hour
5. The warning banner displays the total failure count

## Next Steps

1. **Immediate**: Check the warning banner in Opportunity Scanner to see current API key status
2. **Short-term**: Update API keys in `config/api-keys.ts` with valid keys
3. **Long-term**: Consider upgrading API plans or implementing additional data providers for redundancy

