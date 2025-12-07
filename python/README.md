# MetaTrader 5 Python Integration

## Installation

**Note:** MetaTrader5 library is primarily available on Windows. For macOS/Linux, you'll need to use Wine or run on a Windows server.

### Windows Installation

```bash
pip install MetaTrader5 pandas
```

### macOS/Linux Installation

The MetaTrader5 library requires Windows. Options:

1. **Use Wine** (Linux/Mac):
   ```bash
   # Install Wine first, then:
   pip install MetaTrader5 pandas
   ```

2. **Run on Windows Server**: Deploy the Python backend on a Windows server

3. **Use API Routes**: The Next.js API routes can call Python scripts via subprocess

## Usage

The `mt5_integration.py` script provides a complete MT5 connector that can be called from Next.js API routes.

## Environment Variables

Set these in your `.env.local`:
- `IC_MARKETS_ACCOUNT_ID`
- `IC_MARKETS_PASSWORD`
- `IC_MARKETS_SERVER`

