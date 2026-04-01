## Windows MT5 Bridge (one-command)

This folder contains Windows launch scripts for the MT5 file-based HTTP bridge.

### Important: where to run from

- You need the **full project** (the `tradeintelai` repo), not only this `windows` folder.
- **Double-click** `StartBridge.bat` from Explorer **after** you put the repo on your PC (e.g. `C:\Users\You\tradeintelai\mt5-bridge\windows\StartBridge.bat`).

### Do not use `cd` on the script file

`cd` only changes folders. To **run** a script:

```powershell
cd C:\path\to\tradeintelai
.\mt5-bridge\windows\StartBridge.ps1
```

Wrong (what causes “Cannot find path”):

```powershell
cd StartBridge.ps1
```

### PowerShell path tips

- Go to C: drive: `cd C:\` (not `cd \C:`)
- Go to your user folder: `cd $env:USERPROFILE` or `cd C:\Users\YourName`

### What it starts

- Python bridge server: `mt5-bridge/wine-mt5-connector.py`
- Default URL: `http://localhost:8080`
- MT5 file I/O directories (inside MT5): `MQL5\Files\mt5-commands` and `MQL5\Files\mt5-responses`

### Using the hosted app (Vercel) + this bridge on your PC

Vercel only serves the website. Your browser must reach the bridge running on your machine (or your network).

1. **Start the bridge** on Windows (`StartBridge.bat`). It listens on **localhost:8080** by default.
2. **Expose port 8080 with HTTPS** (recommended), using **Cloudflare Tunnel**, **ngrok**, or similar. You should get a URL like `https://xxxx.trycloudflare.com` with **no** trailing slash.
3. **Open the dashboard** with the bridge URL in the query string (encode if needed):

   `https://tradeintelai.vercel.app/dashboard?bridge_url=https://YOUR-TUNNEL-HOST`

   The app saves that URL to **localStorage** (`bridge_url`) so the next visit can omit the query string. To change tunnels later, open the same link again with a new `bridge_url`, or clear site data for the site.

4. **Optional — Vercel env:** set `NEXT_PUBLIC_BRIDGE_URL` to your tunnel URL and **redeploy**. Query string and localStorage still override when present (see `config/bridge-config.ts`).

**Same PC only (no tunnel):** the app may use `http://localhost:8080`. Browsers may block **mixed content** (HTTPS page → HTTP localhost); if balance/MT5 calls fail, use a tunnel with **HTTPS** instead.

**Not supported:** expecting Vercel’s servers to call `localhost` on your PC — that will never work.

### Prereqs

- Install **Python 3.10+** for Windows. In the installer, enable **Add python.exe to PATH**. If `python` is missing, try `py -3` in a terminal; the script tries both.
- Install / open **MetaTrader 5** at least once (so the Terminal data folder exists).
- In MT5, compile + attach the EA `mt5-bridge/MT5FileBridgeEA.mq5` to a chart.
- In the EA inputs (or inside the EA if hardcoded), ensure it uses these folder names:
  - `mt5-commands`
  - `mt5-responses`

### Start the bridge

**Option A — double-click**

`mt5-bridge\windows\StartBridge.bat`  
If something fails, the window will **stay open** with `Press any key` so you can read the error.

**Option B — PowerShell from repo root**

```powershell
cd C:\path\to\tradeintelai
.\mt5-bridge\windows\StartBridge.ps1
```

If scripts are blocked:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\tradeintelai\mt5-bridge\windows\StartBridge.ps1"
```

It will:

- auto-detect your MT5 `...\MQL5\Files` folder (or you can set it manually)
- start the bridge
- write logs to `mt5-bridge\windows\logs\bridge-*.log`
- call `GET /health`

### If the black window flashes and closes (old behaviour)

That usually meant the script exited with an error immediately. Use the updated `StartBridge.bat` (it pauses on error), or run from PowerShell so you see the message.

### Manual override (recommended if you have multiple terminals)

```powershell
$env:MT5_FILES_DIR = "$env:APPDATA\MetaQuotes\Terminal\<TERMINAL_HASH>\MQL5\Files"
.\mt5-bridge\windows\StartBridge.ps1
```

### Stop the bridge

- `Stop-Process -Id <PID>` (PID is printed when the bridge starts), or close the Python process in Task Manager.
