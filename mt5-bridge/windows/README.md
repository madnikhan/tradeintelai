## Windows MT5 Bridge (one-command)

This folder contains Windows launch scripts for the MT5 file-based HTTP bridge.

### Quick start (do these in order)

1. **Get the project on your PC**  
   - **ZIP:** [github.com/madnikhan/tradeintelai](https://github.com/madnikhan/tradeintelai) → **Code → Download ZIP** → extract so you have `...\tradeintelai\` with `mt5-bridge` inside.  
   - Or **git clone** if Git works.

2. **Install real Python (not only the Store stub)**  
   - From [python.org/downloads/windows](https://www.python.org/downloads/windows/): enable **Add python.exe to PATH** and **py launcher**.  
   - Optional: **Settings → Apps → App execution aliases** → turn **off** `python.exe` / `python3.exe` if the bridge still hits the Store message.

3. **Pin stable Python if you have 3.13 and 3.15 alpha** (PowerShell, before starting the bridge):  
   `$env:MT5_PYTHON_VERSION = "3.13"`

4. **MetaTrader 5**  
   - Install/open **MT5** once.  
   - In MT5: **File → Open Data Folder** → confirm **`MQL5\Files`** exists (create **Files** if missing).  
   - Copy **`mt5-bridge\MT5FileBridgeEA.mq5`** into MT5’s **Experts** folder, compile in MetaEditor (**F7**), attach the EA to a chart.

5. **Set MT5 file folder for the bridge** (PowerShell — use **your** path from “Open Data Folder”):  
   `$env:MT5_FILES_DIR = "$env:APPDATA\MetaQuotes\Terminal\<YOUR_HASH>\MQL5\Files"`  
   Or skip this if the script auto-detects it.

6. **Never use placeholder text** in `MT5_FILES_DIR`. If you set a bad value:  
   `Remove-Item Env:MT5_FILES_DIR -ErrorAction SilentlyContinue`

7. **Start the bridge** (replace path if yours differs):  
   `cd $env:USERPROFILE\tradeintelai`  
   `.\mt5-bridge\windows\StartBridge.bat`  
   Do **not** use `cd StartBridge.bat` — that is wrong.

8. **Check it**  
   - Browser: [http://localhost:8080/health](http://localhost:8080/health) should return JSON with `"status":"running"`.

9. **Use the Vercel site with your PC**  
   - Expose port **8080** with **Cloudflare Tunnel** or **ngrok** (HTTPS URL).  
   - Open: `https://tradeintelai.vercel.app/dashboard?bridge_url=https://YOUR-TUNNEL`  
   - No tunnel + same PC only: you may use `http://localhost:8080` if the browser allows it.

### Important: where to run from

- You need the **full project** (the `tradeintelai` repo), not only this `windows` folder.
- **Double-click** `StartBridge.bat` from Explorer **after** you put the repo on your PC (e.g. `C:\Users\You\tradeintelai\mt5-bridge\windows\StartBridge.bat`).

### Updating only `mt5-bridge\windows` (`.bat` and `.ps1`)

Replace **`StartBridge.bat`** and **`StartBridge.ps1`** in your PC folder with the latest versions. Your **`logs\`** subfolder is optional to keep (old logs); the scripts recreate it.

**Option A — Git (repo already cloned)**

```powershell
cd C:\Users\Admin\tradeintelai
git pull origin main
```

That updates the whole repo, including `mt5-bridge\windows`.

**Option B — No Git (ZIP from GitHub)**

1. Open [tradeintelai on GitHub](https://github.com/madnikhan/tradeintelai) → **Code → Download ZIP**.  
2. Extract the ZIP.  
3. Copy these **into your existing** `...\tradeintelai\mt5-bridge\windows\` (overwrite):
   - `StartBridge.bat`
   - `StartBridge.ps1`
4. Optionally copy **`README.md`** from the same folder so your instructions stay in sync.

**After updating**

- Run **`StartBridge.bat`** again from `mt5-bridge\windows` (or `& "...\StartBridge.bat"` from PowerShell).  
- If you had set **`MT5_FILES_DIR`** in that PowerShell window, set it again (session variables do not persist after you close the terminal).

### This `windows` folder is not `C:\Windows`

- **`C:\Windows`** = Windows operating system files (wrong place).
- **`C:\Users\windows`** = does not exist unless you created it (not the project).
- The correct path looks like: **`C:\Users\Admin\tradeintelai\mt5-bridge\windows`**  
  (your clone name may differ; `tradeintelai` is the GitHub repo folder).

### Do not use `cd` on the script file

`cd` only changes folders. To **run** a script, use `.\` in front of the name:

```powershell
cd C:\Users\Admin\tradeintelai
.\mt5-bridge\windows\StartBridge.bat
```

```powershell
cd C:\Users\Admin\tradeintelai
.\mt5-bridge\windows\StartBridge.ps1
```

Wrong (common mistakes from PowerShell):

```powershell
cd StartBridge.bat
cd StartBridge.ps1
.\StartBridge.bat\   # invalid: no trailing \ on a file name
.\StartBridge        # ambiguous: may run .ps1 only; prefer .bat below
```

Use **`.\StartBridge.bat`** (recommended) or **`.\StartBridge.ps1`**. Do not add **`\`** after **`.bat`**. Avoid **`.\StartBridge`** alone so Windows does not pick the wrong file or an old/corrupt script.

### Scripts only in a random folder?

The `.bat` / `.ps1` files alone are not enough: they start **`wine-mt5-connector.py`** from **`mt5-bridge`** in the same repo.

If you copied the scripts elsewhere but the repo is at `C:\Users\Admin\tradeintelai`:

```powershell
$env:TRADEINTELAI_ROOT = "C:\Users\Admin\tradeintelai"
& "D:\wherever\StartBridge.ps1"
```

### PowerShell path tips

- Go to C: drive: `cd C:\` (not `cd \C:`)
- Go to your user folder: `cd $env:USERPROFILE` or `cd C:\Users\YourName`
- **`cd /tradeintelai`** becomes **`C:\tradeintelai`** (drive root), which usually does not exist. Use e.g. **`cd $env:USERPROFILE\tradeintelai`** or **`cd C:\Users\Admin\tradeintelai`**.

### If MT5 folder was not detected

The bridge can still start; Python falls back to **`mt5-commands`** and **`mt5-responses`** in the **repo root** (same level as the `mt5-bridge` folder). For real MT5 data, open MetaTrader 5 once so `AppData\MetaQuotes\Terminal\...\MQL5\Files` exists, then restart the bridge—or set **`MT5_FILES_DIR`** manually (see below).

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

### ngrok on Windows (Vercel + bridge)

1. Download **`ngrok.exe`** from [ngrok.com/download](https://ngrok.com/download), then either add its folder to **PATH** or run it by full path, e.g. `C:\Users\Admin\Downloads\ngrok.exe`.
2. One-time: `ngrok config add-authtoken YOUR_TOKEN` (from [dashboard.ngrok.com](https://dashboard.ngrok.com/)).
3. Start the **MT5 bridge** first so something is listening on **8080**.
4. **Random URL each time (simplest):**  
   `ngrok http 8080`  
   Use the **https://….ngrok-free.app** URL printed in the terminal with  
   `?bridge_url=https://….ngrok-free.app` (no trailing slash).
5. **Reserved free/paid hostname** (ngrok v3): **`--domain` is deprecated** — use **`--url`** instead, for example:  
   `ngrok http --url=https://YOUR-SUBDOMAIN.ngrok-free.dev 8080`  
   or (if your ngrok build accepts hostname only):  
   `ngrok http --url=YOUR-SUBDOMAIN.ngrok-free.dev 8080`  
   Run `ngrok http --help` on your PC to match your installed version.

### Prereqs

- Install **Python 3.10+** for Windows from **[python.org](https://www.python.org/downloads/windows/)** (not only the Microsoft Store prompt). In the installer, enable **Add python.exe to PATH** and the **py launcher**.
- If you see **“Python was not found; run without arguments to install from the Microsoft Store”** or `...\WindowsApps\python.exe` in errors, Windows is using a **Store stub**, not real Python. Either install from **python.org**, or go to **Settings → Apps → Advanced app settings → App execution aliases** and turn **off** `python.exe` / `python3.exe` so a real install on PATH is used. The updated `StartBridge.ps1` skips that stub and prefers **`py -3`** or the next real `python` on PATH.
- If you have **several** Pythons (e.g. **3.13** stable and **3.15 alpha**), `py -3` uses the **newest** 3.x. To force the stable bridge runtime: before starting, run `$env:MT5_PYTHON_VERSION = "3.13"` (matches **Python Launcher**’s `py -3.13`).
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
- write logs to `mt5-bridge\windows\logs\bridge-*.out.log` and `bridge-*.err.log` (PowerShell requires separate stdout/stderr files)
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
