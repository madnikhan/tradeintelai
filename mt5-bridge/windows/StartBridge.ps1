# MT5 file bridge starter for Windows.
# Run from repo root:  .\mt5-bridge\windows\StartBridge.ps1
# Do NOT use: cd StartBridge.ps1  (cd is only for folders; use .\StartBridge.ps1 to run)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-Mt5FilesDir {
  param([string]$TerminalRoot)
  if (-not (Test-Path -LiteralPath $TerminalRoot)) { return $null }
  $terminals = Get-ChildItem -LiteralPath $TerminalRoot -Directory -ErrorAction SilentlyContinue
  foreach ($t in $terminals) {
    $files = Join-Path $t.FullName "MQL5\Files"
    if (Test-Path -LiteralPath $files) { return $files }
  }
  return $null
}

function Resolve-PythonLaunch {
  # Windows: prefer `python`, then Python Launcher `py -3`
  $py = Get-Command python -ErrorAction SilentlyContinue
  if ($py) {
    return @{ Exe = $py.Source; Args = @() }
  }
  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    return @{ Exe = $pyLauncher.Source; Args = @("-3") }
  }
  return $null
}

Write-Host "=== MT5 Bridge (Windows) ===" -ForegroundColor Cyan
Write-Host ""

if (-not $env:MT5_FILES_DIR -or $env:MT5_FILES_DIR.Trim().Length -eq 0) {
  $terminalRoot = Join-Path $env:APPDATA "MetaQuotes\Terminal"
  $detected = Find-Mt5FilesDir -TerminalRoot $terminalRoot
  if ($detected) {
    $env:MT5_FILES_DIR = $detected
    Write-Host "Detected MT5_FILES_DIR: $($env:MT5_FILES_DIR)"
  } else {
    Write-Host "Could not auto-detect MT5 MQL5\Files folder under AppData." -ForegroundColor Yellow
    Write-Host "Starting bridge anyway: Python will use repo mt5-commands / mt5-responses next to mt5-bridge." -ForegroundColor Yellow
    Write-Host "For live MT5: install and open MetaTrader 5 once, then restart; or set:" -ForegroundColor Gray
    Write-Host '  $env:MT5_FILES_DIR = "$env:APPDATA\MetaQuotes\Terminal\<HASH>\MQL5\Files"' -ForegroundColor Gray
    Write-Host "List terminal folders: Get-ChildItem `"$env:APPDATA\MetaQuotes\Terminal`" -Directory" -ForegroundColor Gray
    Write-Host ""
  }
} else {
  Write-Host "Using MT5_FILES_DIR: $($env:MT5_FILES_DIR)"
}

# Repo root: either TRADEINTELAI_ROOT (if you moved scripts) or ...\tradeintelai (two levels up from this folder)
if ($env:TRADEINTELAI_ROOT -and $env:TRADEINTELAI_ROOT.Trim().Length -gt 0) {
  $repoRoot = (Resolve-Path -LiteralPath $env:TRADEINTELAI_ROOT.Trim()).Path
  Write-Host "Using TRADEINTELAI_ROOT: $repoRoot" -ForegroundColor Cyan
} else {
  # PSScriptRoot should be ...\tradeintelai\mt5-bridge\windows
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$bridgeDir = Join-Path $repoRoot "mt5-bridge"
$bridgePy  = Join-Path $bridgeDir "wine-mt5-connector.py"

if (-not (Test-Path -LiteralPath $bridgePy)) {
  Write-Host "Bridge file not found: $bridgePy" -ForegroundColor Red
  Write-Host ""
  Write-Host "This folder is NOT C:\Windows and NOT C:\Users\windows." -ForegroundColor Yellow
  Write-Host "Scripts must live at:  <your-clone>\mt5-bridge\windows\" -ForegroundColor Yellow
  Write-Host "You need the full repo (at least the mt5-bridge folder with wine-mt5-connector.py)." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "To run:  cd <your-clone>   then   .\mt5-bridge\windows\StartBridge.bat" -ForegroundColor Gray
  Write-Host "Do not use:  cd StartBridge.bat   (use .\StartBridge.bat to RUN it)" -ForegroundColor Gray
  Write-Host ""
  Write-Host "Or set repo path, then run this script from anywhere:" -ForegroundColor Yellow
  Write-Host '  $env:TRADEINTELAI_ROOT = "C:\Users\Admin\tradeintelai"' -ForegroundColor Gray
  exit 1
}

$launch = Resolve-PythonLaunch
if (-not $launch) {
  Write-Host "Python was not found in PATH." -ForegroundColor Red
  Write-Host "Install Python 3.10+ from https://www.python.org/downloads/ and enable 'Add python.exe to PATH'." -ForegroundColor Yellow
  Write-Host "Then open a NEW PowerShell window and run this script again." -ForegroundColor Yellow
  exit 1
}

$logsDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logsDir "bridge-$ts.log"
# Ensure log file exists so tail does not fail
New-Item -ItemType File -Force -Path $logFile | Out-Null

if (-not $env:MT5_BRIDGE_PORT -or $env:MT5_BRIDGE_PORT.Trim().Length -eq 0) {
  $env:MT5_BRIDGE_PORT = "8080"
}

Write-Host "Repo root:    $repoRoot"
Write-Host "Bridge dir:   $bridgeDir"
Write-Host "Python:       $($launch.Exe) $($launch.Args -join ' ')"
Write-Host "Port:         $($env:MT5_BRIDGE_PORT)"
Write-Host "Log file:     $logFile"
Write-Host ""
Write-Host "Starting bridge..." -ForegroundColor Green

$argList = @()
$argList += $launch.Args
$argList += $bridgePy

$p = Start-Process -FilePath $launch.Exe -ArgumentList $argList -WorkingDirectory $bridgeDir `
  -RedirectStandardOutput $logFile -RedirectStandardError $logFile -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 2

if ($p.HasExited) {
  Write-Host "Bridge process exited immediately (exit code: $($p.ExitCode))." -ForegroundColor Red
  Write-Host "Log output:" -ForegroundColor Yellow
  Get-Content -LiteralPath $logFile -ErrorAction SilentlyContinue
  exit 1
}

try {
  $healthUrl = "http://localhost:$($env:MT5_BRIDGE_PORT)/health"
  $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
  Write-Host "Health check OK: $($resp.StatusCode) $healthUrl" -ForegroundColor Green
} catch {
  Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "If Python failed, read: $logFile" -ForegroundColor Yellow
  Get-Content -LiteralPath $logFile -Tail 40 -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Bridge PID: $($p.Id)  |  Stop: Stop-Process -Id $($p.Id)" -ForegroundColor Cyan
Write-Host "Tailing log (Ctrl+C stops tail only; bridge keeps running):" -ForegroundColor Gray
Write-Host ""

try {
  Get-Content -LiteralPath $logFile -Wait -Tail 20
} finally {
  Write-Host ""
  Write-Host "Log tail ended. Bridge may still be running (PID $($p.Id))." -ForegroundColor Gray
}
