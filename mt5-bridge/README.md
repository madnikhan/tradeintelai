# MT5 Bridge

File-based HTTP bridge for connecting Next.js app to MT5 running on Wine (Mac/Linux).

## Quick Setup

1. **Configure paths**:
   ```bash
   ./configure-paths.sh
   ```

2. **Start bridge**:
   ```bash
   ./start-wine-bridge.sh
   ```

3. **Install EA in MT5**:
   - Copy `MT5FileBridgeEA.mq5` to MT5 Experts folder
   - Compile in MetaEditor (F7)
   - Attach to chart
   - Enable "Allow live trading" and "Allow DLL imports"

## How It Works

```
Next.js App → HTTP Bridge (Port 8080) → File System → MT5 EA → File System → HTTP Bridge → Next.js App
```

1. Next.js sends HTTP request to `http://localhost:8080/account`
2. Bridge writes command file to `mt5-commands/`
3. MT5 EA polls and reads command file
4. MT5 EA processes command and writes response to `mt5-responses/`
5. Bridge reads response and returns to Next.js

## Files

- `wine-mt5-connector.py` - HTTP bridge server (ACTIVE)
- `MT5FileBridgeEA.mq5` - MT5 Expert Advisor (ACTIVE)
- `start-wine-bridge.sh` - Startup script (ACTIVE)
- `configure-paths.sh` - Path configuration script
- `archive/` - Old/unused bridge implementations

## Troubleshooting

**Timeouts**: Check that symlinks exist and EA is running  
**Port 8080 in use**: `kill $(lsof -ti :8080)`  
**EA not processing**: Verify EA is attached to chart and directories match
