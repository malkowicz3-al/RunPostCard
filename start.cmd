@echo off
rem Double-click to start RunPostcard on Windows (runs start.ps1 without changing system settings).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
pause
