# Currency Pair Selection Feature

## Overview

The Opportunity Scanner now includes a **Currency Pair Selection** feature that allows you to choose which pairs to scan, enabling faster 5-minute scan intervals while staying within API rate limits.

## Features

### ✅ **Pair Selection Options**

1. **⭐ Major Pairs** (7 pairs) - Default
   - EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
   - Best for: Fast 5-minute scans, most liquid pairs

2. **🌐 All Pairs** (28 pairs)
   - All trading pairs including cross pairs and exotics
   - Best for: Comprehensive coverage, 15-minute intervals

3. **🎯 Custom Selection**
   - Select any combination of pairs
   - Best for: Focused trading on specific pairs

### ✅ **Automatic Scan Interval Adjustment**

- **Selected Pairs (< 28)**: Automatically uses **5-minute intervals**
- **All Pairs (28)**: Uses trading-hours-based intervals (5-15 minutes)

### ✅ **Persistent Storage**

- Selected pairs are saved to `localStorage`
- Preferences persist across browser sessions
- Defaults to Major Pairs on first use

## How to Use

1. **Open Pair Selector**:
   - Click the **"📊 X Pairs"** button in the Opportunity Scanner header

2. **Choose a Preset**:
   - Click **"⭐ Major Pairs"** for 7 most important pairs
   - Click **"🌐 All Pairs"** for all 28 pairs
   - Click **"🎯 Custom"** to manually select pairs

3. **Manual Selection**:
   - Check/uncheck individual pairs in the grid
   - Major pairs are marked with ⭐
   - Selection updates in real-time

4. **Close Selector**:
   - Click the **✕** button or click outside the selector

## Benefits

### 🚀 **Performance**

- **Faster Scans**: 7 pairs scan in ~7 seconds vs ~28 seconds for all pairs
- **More Frequent Updates**: 5-minute intervals vs 15-minute intervals
- **Better Signal Detection**: More scans = more opportunities caught

### 💰 **API Efficiency**

- **Reduced API Calls**: 7 pairs = ~1,000 calls/day vs ~4,000 for all pairs
- **Stays Within Limits**: Well within free tier limits with 4 keys per service
- **Better Caching**: Fewer pairs = better cache hit rates

### 🎯 **Trading Focus**

- **Focus on Liquidity**: Major pairs are most liquid and reliable
- **Reduce Noise**: Fewer pairs = cleaner signal analysis
- **Custom Strategy**: Select pairs that match your trading style

## API Capacity with Selected Pairs

### Scenario: 7 Major Pairs, 5-Minute Intervals

- **Scans per hour**: 12 scans
- **Scans per day**: ~144 scans (12 hours of trading)
- **API Calls per day**:
  - TwelveData: 144 × 7 = **1,008 calls** ✅
  - Finnhub: ~29 calls (cached) ✅
  - NewsData: ~29 calls (cached) ✅
  - Alpha Vantage: 144 × 20 = **2,880 calls** ✅

**Total**: ~4,000 calls/day (well within limits with 4 keys per service)

## Comparison

| Configuration | Pairs | Scan Interval | Daily Scans | Daily API Calls | Status |
|--------------|-------|---------------|-------------|-----------------|--------|
| **Major Pairs** | 7 | 5 min | ~144 | ~4,000 | ✅ Optimal |
| **All Pairs** | 28 | 15 min | ~48 | ~2,300 | ✅ Balanced |
| **All Pairs** | 28 | 5 min | ~144 | ~11,000 | ❌ Exceeds limits |

## Recommendations

### 🎯 **For Active Trading**:
- Use **Major Pairs (7)** with **5-minute intervals**
- Best balance of speed and API efficiency
- Catches opportunities quickly

### 🎯 **For Comprehensive Analysis**:
- Use **All Pairs (28)** with **15-minute intervals**
- Full market coverage
- More thorough but slower

### 🎯 **For Custom Strategy**:
- Select **10-15 pairs** that match your trading style
- Use **5-minute intervals** automatically
- Balance between coverage and speed

## Technical Details

### Storage
- Selected pairs stored in `localStorage` as `opportunityScanner_selectedPairs`
- JSON format: `["EUR/USD", "GBP/USD", ...]`
- Automatically loads on component mount

### Scan Logic
- `scanAllPairs()` uses `selectedPairs` if available, otherwise falls back to all pairs
- Scan interval calculated based on number of selected pairs
- Progress bar shows scan progress for selected pairs only

### UI Features
- Visual indicators for major pairs (⭐)
- Real-time selection updates
- Preset buttons for quick selection
- Info banner showing scan interval impact

## Future Enhancements

Potential improvements:
- Save multiple presets (e.g., "My Strategy", "Major + JPY Crosses")
- Pair grouping by category (Major, Cross, Exotic)
- Performance metrics per pair
- Auto-disable pairs with low signal frequency

