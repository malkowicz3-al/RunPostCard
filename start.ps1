# RunPostcard: start the app with one command (Windows).
# Checks Node.js, installs packages, helps fill in .env, then opens the app in the browser.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$NeedNode = 20

function Say($text, $color = 'White') { Write-Host $text -ForegroundColor $color }

function Get-NodeMajor {
  try {
    $v = & node --version 2>$null
    if ($v -match '^v(\d+)') { return [int]$Matches[1] }
  } catch {}
  return 0
}

function Stop-WithMessage($text) {
  Say $text Red
  Read-Host 'Press Enter to close'
  exit 1
}

Say ''
Say '== RunPostcard ==' Cyan

# 1. Node.js
$major = Get-NodeMajor
if ($major -lt $NeedNode) {
  if ($major -gt 0) { Say "Node.js $major is installed, but version $NeedNode or newer is needed." Yellow }
  else { Say 'Node.js is not installed. The app needs it to run.' Yellow }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $answer = Read-Host 'Install Node.js LTS now (with winget, from the official package)? [Y/n]'
    if ($answer -notmatch '^[nN]') {
      winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
      # The new PATH is not in this window yet.
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
      $major = Get-NodeMajor
    }
  }
  if ($major -lt $NeedNode) {
    Stop-WithMessage 'Install Node.js LTS from https://nodejs.org, close this window and run start again.'
  }
}
Say "Node.js $(node --version): OK" Green

# 2. Packages (again only when package-lock.json is newer than node_modules)
$needInstall = -not (Test-Path 'node_modules') -or
  ((Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item 'node_modules').LastWriteTime)
if ($needInstall) {
  Say 'Installing packages (first time takes a minute or two)...' Cyan
  npm.cmd install
  if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'npm install failed. Check your internet connection and try again.' }
  (Get-Item 'node_modules').LastWriteTime = Get-Date
}
Say 'Packages: OK' Green

# 3. Strava keys in .env
function Get-EnvValue($lines, $key) {
  $line = $lines | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if ($line) { return ($line -replace "^$key=", '').Trim() }
  return ''
}

$envLines = @()
if (Test-Path '.env') { $envLines = Get-Content '.env' }
$id = Get-EnvValue $envLines 'VITE_STRAVA_CLIENT_ID'
$secret = Get-EnvValue $envLines 'STRAVA_CLIENT_SECRET'
$demo = $false

if (-not $id -or -not $secret) {
  Say ''
  Say 'The app needs your own Strava API application (free, about 5 minutes, only once).' Yellow
  Say '  1. Log in to Strava, the page https://www.strava.com/settings/api opens now.'
  Say '  2. Fill in any name, category and website (e.g. https://github.com).'
  Say '  3. Authorization Callback Domain: type exactly  localhost'
  Say '  4. Click Create, then copy the Client ID and the Client Secret (click Show).'
  Say ''
  Say 'No Strava account at hand? Type D to open a demo with sample runs instead.' Cyan
  Start-Process 'https://www.strava.com/settings/api'
  while ($true) {
    $id = (Read-Host 'Client ID (a number), or D for demo').Trim()
    if ($id -match '^[dD]$') { $demo = $true; break }
    if ($id -match '^\d+$') { break }
    Say 'The Client ID is a number, e.g. 123456. Try again.' Yellow
  }
  if (-not $demo) {
    while ($true) {
      $secure = Read-Host 'Client Secret (hidden while you type)' -AsSecureString
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      try { $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
      if ($secret -match '^[0-9a-fA-F]{20,}$') { break }
      Say 'The Client Secret is a long code of letters a-f and digits. Try again.' Yellow
    }
    # Other lines in .env stay; the two keys are replaced. File stays only on this computer.
    $kept = $envLines | Where-Object { $_ -notmatch '^(VITE_STRAVA_CLIENT_ID|STRAVA_CLIENT_SECRET)=' }
    $content = (@("VITE_STRAVA_CLIENT_ID=$id", "STRAVA_CLIENT_SECRET=$secret") + $kept) -join "`n"
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), "$content`n")
    Say 'Saved to .env (never share this file).' Green
  }
}

# 4. Start
Say ''
Say 'Starting RunPostcard. The browser opens by itself; keep this window open while you use the app.' Cyan
Say 'To stop the app, close this window or press Ctrl+C.'
# npm.cmd omija shim npm.ps1, który mógłby zgubić `--`.
if ($demo) { npm.cmd run dev -- --open '/?mock=1' } else { npm.cmd run dev -- --open }
