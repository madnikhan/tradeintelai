# Scalping Feature Documentation

## Overview

The Scalping feature automatically executes trades with small take profit targets (e.g., $0.50) when strong signals are detected. After taking profit, it re-analyzes the market and re-enters if conditions are still favorable.

## How It Works

### 1. Signal Detection
- Monitors AI analysis results for strong signals
- Requires minimum confidence threshold (default: 75%)
- Only executes when execution is permitted by gated engine

### 2. Trade Execution
- Uses **50% of normal position size** for lower risk
- Sets take profit to target dollar amount (default: $0.50)
- Calculates precise take profit price based on:
  - Entry price
  - Direction (BUY/SELL)
  - Lot size
  - Target profit amount
  - Symbol-specific pip values

### 3. Profit Monitoring
- Monitors position every second for take profit hit
- Detects when position closes with profit
- Maximum wait time: 5 minutes per trade

### 4. Re-Entry Logic
- After profit taken, waits for re-entry delay (default: 5 seconds)
- Re-analyzes market using gated trading engine
- Re-enters if:
  - Signal strength ≥ re-entry threshold (default: 70%)
  - Execution is permitted
  - Max re-entries not reached (default: 5)

### 5. Automatic Loop
- Repeats process until:
  - Max re-entries reached
  - Signal weakens below threshold
  - Daily limit reached

## Configuration

### Settings Panel
Access via **Dashboard → Settings Tab → Scalping Panel**

### Configurable Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **Enabled** | false | on/off | Enable/disable scalping |
| **Take Profit Target** | $0.50 | $0.10 - $10.00 | Target profit per trade |
| **Min Signal Strength** | 75% | 60% - 100% | Minimum confidence to scalp |
| **Max Scalps Per Day** | 20 | 1 - 100 | Daily limit |
| **Re-Entry Delay** | 5 seconds | 1 - 60 seconds | Wait time before re-entry |
| **Max Re-Entries** | 5 | 0 - 20 | Maximum re-entries per signal |
| **Min Re-Entry Signal** | 70% | 50% - 100% | Minimum confidence for re-entry |

## Example Workflow

1. **Strong Signal Detected** (confidence: 80%)
   - ✅ Scalping enabled
   - ✅ Confidence ≥ 75%
   - ✅ Execution permitted

2. **Trade Executed**
   - Symbol: EURUSD
   - Direction: BUY
   - Entry: 1.1000
   - Take Profit: 1.1005 (target: $0.50)
   - Lot Size: 0.05 (50% of normal)

3. **Profit Taken** ($0.50)
   - Position closes at take profit
   - System detects profit

4. **Re-Analysis** (after 5 seconds)
   - Market re-analyzed
   - New confidence: 72%
   - ✅ Still above 70% threshold

5. **Re-Entry Executed**
   - New trade opened
   - Same direction (BUY)
   - New entry: 1.1005
   - New take profit: 1.1010

6. **Repeat** until:
   - Signal weakens (< 70%)
   - Max re-entries reached (5)
   - Daily limit reached (20)

## Benefits

### ✅ Advantages
- **Compound Profits**: Many small profits can add up quickly
- **Lower Risk**: Uses 50% of normal position size
- **Automated**: No manual intervention needed
- **Smart Re-Entry**: Only re-enters when signal is still strong
- **Daily Limits**: Prevents over-trading

### ⚠️ Considerations
- **Commission Costs**: Higher frequency = more commissions
- **Slippage**: Small targets may be affected by spread/slippage
- **Market Conditions**: Works best in trending markets
- **Account Size**: Very small accounts may struggle with minimum lot sizes

## Risk Management

1. **Position Size**: 50% of normal risk per trade
2. **Daily Limits**: Maximum scalps per day prevents over-trading
3. **Signal Strength**: Only trades on strong signals (≥75%)
4. **Re-Entry Threshold**: Re-enters only if signal ≥70%
5. **Stop Loss**: Always uses proper stop loss from risk calculator

## Integration Points

### Automatic Trigger
- Integrated into `AITradingDashboard`
- Automatically triggers when analysis completes
- Checks signal strength and executes if conditions met

### Manual Control
- Can be enabled/disabled via Settings panel
- All parameters configurable
- Real-time statistics displayed

## Statistics

The Scalping Panel displays:
- **Active Scalps**: Currently open scalping trades
- **Scalps Today**: Number of scalps executed today
- **Total Profit**: Cumulative profit from closed scalps

## Technical Details

### Take Profit Calculation
```
pipDistance = targetProfit / (lotSize * pipValuePerLot)
takeProfitPrice = entryPrice ± (pipDistance * pipSize)
```

### Minimum Distance Check
- Ensures take profit meets broker minimum distance requirements
- Adjusts if needed (1.5x minimum distance)
- Recalculates actual profit target

### Position Monitoring
- Checks every 1 second
- Maximum 5 minutes per trade
- Detects profit/stop loss via position status

## Best Practices

1. **Start Small**: Begin with $0.50 target to test
2. **Monitor Performance**: Watch statistics in Scalping Panel
3. **Adjust Thresholds**: Increase min signal strength for fewer, higher-quality trades
4. **Consider Market Hours**: Scalping works best during active trading sessions
5. **Account Size**: Ensure account can handle minimum lot sizes (0.01)

## Troubleshooting

### Scalping Not Executing
- Check if enabled in Settings
- Verify signal strength ≥ min threshold
- Check daily limit not reached
- Ensure execution is permitted by gated engine

### Take Profit Not Hitting
- Check broker minimum distance requirements
- Verify spread isn't too wide
- Ensure market is moving in expected direction

### Re-Entry Not Happening
- Check re-entry signal threshold
- Verify max re-entries not reached
- Check if signal weakened below threshold

## Files Modified/Created

1. **`lib/scalping-service.ts`** - Core scalping logic
2. **`components/ScalpingPanel.tsx`** - UI component for settings
3. **`components/AITradingDashboard.tsx`** - Auto-trigger integration
4. **`app/dashboard/page.tsx`** - Added ScalpingPanel to dashboard

## Future Enhancements

- [ ] Trailing stop loss for scalping trades
- [ ] Different take profit targets for different market conditions
- [ ] Scalping performance analytics
- [ ] Backtesting for scalping strategy
- [ ] Multi-symbol scalping

---

**Note**: Scalping is a high-frequency trading strategy. Ensure you understand the risks and have appropriate account size and broker conditions for this type of trading.
