# TradeIntel AI - Forex Trading System

Professional AI-powered Forex trading system with advanced risk management and multi-dimensional market analysis.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Connect to MT5 (Required for Live Trading)

#### Step 1: Find MT5 Files Folder
- Open MT5 Terminal
- Go to: `File → Open Data Folder`
- Navigate to: `MQL5 → Files`
- Copy the full path

#### Step 2: Configure Paths
```bash
./mt5-bridge/configure-paths.sh
```
Paste the MT5 Files folder path when prompted.

#### Step 3: Install MT5 Expert Advisor
1. Copy `mt5-bridge/MT5FileBridgeEA.mq5` to MT5 Experts folder
2. Open MetaEditor (F4 in MT5)
3. Compile the EA (F7) - should show "0 errors, 0 warnings"
4. **IMPORTANT**: Attach EA to a **chart** (not Strategy Tester!)
   - Drag `MT5FileBridgeEA` from Navigator onto any chart
   - Configure parameters (defaults are fine)
   - Enable "Allow live trading" and "Allow DLL imports"
   - Click OK
5. Verify EA is running:
   - Chart should show EA name with 😊 icon
   - Check Toolbox → Experts tab for initialization messages

#### Step 4: Start HTTP Bridge
```bash
./mt5-bridge/start-wine-bridge.sh
```

#### Step 5: Start Application
```bash
npm run dev
```

Open `http://localhost:3000/dashboard`

---

## ✅ Verify Connection

1. **Check Bridge Logs** - Should show:
   ```
   📁 Found symlink to MT5 Files: ...
   📤 Sent account info request: ...
   📥 Received account info response: ...
   ```

2. **Check MT5 EA Logs** - Should show:
   ```
   ✅ File Bridge EA initialized
   📨 Processing command: ...
   📤 Response written: ...
   ```

3. **Check Dashboard** - ConnectionTester should show: `✅ Connected to MT5 HTTP Bridge`

---

## 🔧 Troubleshooting

### Timeout Errors
- **Check EA is running**: Must be attached to chart, not just compiled
- **Check symlinks**: Run `ls -la mt5-commands mt5-responses` - should show `->` arrows
- **Check paths match**: Bridge and EA must use same directories

### Build Errors
```bash
# Clean and rebuild
rm -rf .next
npm run build
```

### Port 8080 Already in Use
```bash
kill $(lsof -ti :8080)
```

---

## 📁 Project Structure

```
tradeintelai/
├── app/                    # Next.js app
│   ├── dashboard/         # Main trading dashboard
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Core trading logic
├── config/                # Configuration
├── mt5-bridge/           # MT5 connection bridge
│   ├── MT5FileBridgeEA.mq5  # MT5 Expert Advisor
│   └── wine-mt5-connector.py # HTTP bridge server
└── types/                # TypeScript types
```

---

## 🎯 Features

- **AI Market Analysis**: Multi-factor scoring (technical, fundamental, sentiment, COT, regime)
- **Risk Management**: Dynamic position sizing, volatility adjustment, correlation monitoring
- **Economic Calendar**: News impact detection and position size adjustment
- **COT Analysis**: Commitment of Traders report analysis
- **Regime Detection**: Market state classification (trending, ranging, volatile)
- **Performance Analytics**: Sharpe Ratio, Calmar Ratio, Sortino Ratio, and more
- **Real-time Trading**: Live MT5 integration via HTTP bridge

---

## 📖 Documentation

- **MT5 Bridge Details**: See `mt5-bridge/README.md`
- **Archived Files**: See `mt5-bridge/archive/README.md`

---

## 🛠️ Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## 📝 Notes

- The system uses file-based communication between the HTTP bridge and MT5 EA
- Symlinks are required to connect project directories with MT5 Files folder
- All trading rules are in `config/trading-rules.ts`
- Demo mode is enabled by default (switch in dashboard)

