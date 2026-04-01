@echo off
setlocal
title MT5 Bridge
REM Always run the .ps1 next to this .bat (full path avoids "wrong folder" issues)
cd /d "%~dp0"

echo.
echo Running: %~f0
echo Script folder: %CD%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0StartBridge.ps1"
set "EC=%ERRORLEVEL%"

if not "%EC%"=="0" (
  echo.
  echo -------------------------------------------
  echo Script exited with error code %EC%.
  echo Read the messages above (Python path, MT5 folder, or missing repo).
  echo If you stopped log tail with Ctrl+C, you can ignore this.
  echo -------------------------------------------
  pause
)

endlocal
