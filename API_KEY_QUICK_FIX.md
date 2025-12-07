# API Key Issues - Quick Fix Guide

## Current Status

You're seeing:
- **Finnhub.io**: 8 failures (Economic calendar data unavailable)
- **NewsData.io**: 7 failures (News sentiment data unavailable)

## Quick Diagnosis

1. **Open the Opportunity Scanner** tab
2. **Click "🔍 Test API Keys"** in the warning banner
3. **Test each key individually** to see which ones are failing
4. **Check the status**:
   - ✅ **Valid**: Key is working
   - ❌ **Invalid/Expired (403)**: Key needs to be replaced
   - ⚠️ **Rate Limited (429)**: Too many requests, wait or upgrade

## Common Issues & Solutions

### Issue 1: 403 Forbidden (Invalid/Expired Keys)

**Problem**: API keys are invalid, expired, or revoked.

**Solution**:
1. **Get New Keys**:
   - **Finnhub.io**: Go to https://finnhub.io/ → Sign up/Login → Dashboard → API Key
   - **NewsData.io**: Go to https://newsdata.io/ → Sign up/Login → Dashboard → API Key

2. **Update Keys**:
   - Open `config/api-keys.ts`
   - Replace the failing keys with new ones
   - Keep the array format: `["key1", "key2", "key3", "key4"]`

3. **Restart Server**:
   ```bash
   # Stop the dev server (Ctrl+C)
   npm run dev
   ```

4. **Clear Failure Counts**:
   - Click "🔄 Clear Failure Counts" in the warning banner
   - Or wait 1 hour for automatic reset

### Issue 2: 429 Rate Limited

**Problem**: Too many API requests, hitting rate limits.

**Solutions**:
1. **Wait**: Rate limits reset after the time period (usually 1 hour or 1 day)
2. **Reduce Scan Frequency**: 
   - Use "Major Pairs" (7 pairs) instead of all pairs
   - Increase scan interval to 15 minutes
3. **Upgrade API Plan**: Get higher rate limits from the provider
4. **Add More Keys**: More keys = more capacity (already have 4 per service)

### Issue 3: Network/Timeout Errors

**Problem**: Network issues or API service down.

**Solutions**:
1. **Check Internet Connection**
2. **Wait and Retry**: Temporary API outages usually resolve quickly
3. **Check API Status**: Visit provider status pages

## Step-by-Step Fix

### Step 1: Test Your Keys

1. In Opportunity Scanner, click **"🔍 Test API Keys"**
2. Click **"Test"** next to each key
3. Note which keys show ❌ Invalid/Expired

### Step 2: Get New Keys

**Finnhub.io**:
1. Visit https://finnhub.io/
2. Sign up (free) or log in
3. Go to Dashboard → API Key
4. Copy your API key

**NewsData.io**:
1. Visit https://newsdata.io/
2. Sign up (free) or log in
3. Go to Dashboard → API Key
4. Copy your API key (starts with `pub_`)

### Step 3: Update config/api-keys.ts

```typescript
export const API_KEYS = {
  FINNHUB: [
    "your-new-key-1",  // Replace failing keys
    "your-new-key-2",
    "your-new-key-3",
    "your-new-key-4",
  ],
  NEWSDATA: [
    "pub_your-new-key-1",  // Replace failing keys
    "pub_your-new-key-2",
    "pub_your-new-key-3",
    "pub_your-new-key-4",
  ],
  // ... other services
}
```

### Step 4: Restart & Verify

1. **Restart dev server**: `npm run dev`
2. **Clear failure counts**: Click "🔄 Clear Failure Counts"
3. **Test again**: Click "🔍 Test API Keys" and verify all keys are ✅ Valid
4. **Wait for next scan**: The warning should disappear after successful API calls

## Prevention Tips

1. **Use Major Pairs**: 7 pairs instead of 28 reduces API calls by 75%
2. **Monitor Usage**: Check the warning banner regularly
3. **Rotate Keys**: Having 4 keys per service provides redundancy
4. **Respect Rate Limits**: Don't scan too frequently (5-15 min intervals are good)

## Impact on Trading

**Without Fundamental/Sentiment Data**:
- ✅ System still works using **Technical Analysis (60% weight)**
- ⚠️ Signals may be less frequent
- ⚠️ Confidence scores may be lower
- ⚠️ Missing economic calendar events and news sentiment

**With Fixed API Keys**:
- ✅ Full analysis: Technical (60%) + Fundamental (15%) + Sentiment (10%) + COT (10%) + Regime (5%)
- ✅ More accurate signals
- ✅ Better confidence scores
- ✅ Economic calendar integration

## Need Help?

If keys continue to fail:
1. Verify keys are copied correctly (no extra spaces)
2. Check if keys are from the correct service (Finnhub vs NewsData)
3. Ensure keys haven't expired (some free keys expire)
4. Check provider's status page for outages
5. Consider upgrading to paid plans for higher limits

## Quick Reference

| Service | Free Tier Limits | Get New Key |
|---------|-----------------|-------------|
| **Finnhub.io** | 60 calls/min, 60k/month | https://finnhub.io/ |
| **NewsData.io** | 200 calls/day, 10k/month | https://newsdata.io/ |

