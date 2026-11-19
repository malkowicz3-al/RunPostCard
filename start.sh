#!/usr/bin/env bash
# RunPostcard: start the app with one command (macOS, Linux).
# Checks Node.js, installs packages, helps fill in .env, then opens the app in the browser.
set -euo pipefail
cd "$(dirname "$0")"
NEED_NODE=20

say() { printf '%s\n' "$1"; }
fail() { say "$1"; exit 1; }
node_major() { node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0; }

say ''
say '== RunPostcard =='

# 1. Node.js
major=$(node_major); major=${major:-0}
if [ "$major" -lt "$NEED_NODE" ]; then
  say "Node.js $NEED_NODE or newer is needed (found: ${major/#0/none})."
  if command -v brew >/dev/null 2>&1; then
    read -r -p 'Install Node.js now with Homebrew? [Y/n] ' answer
    if [[ ! "$answer" =~ ^[nN] ]]; then brew install node; fi
    major=$(node_major); major=${major:-0}
  fi
  [ "$major" -ge "$NEED_NODE" ] || fail 'Install Node.js LTS from https://nodejs.org and run ./start.sh again.'
fi
say "Node.js $(node --version): OK"

# 2. Packages (again only when package-lock.json is newer than node_modules)
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  say 'Installing packages (first time takes a minute or two)...'
  npm install || fail 'npm install failed. Check your internet connection and try again.'
  touch node_modules
fi
say 'Packages: OK'

# 3. Strava keys in .env
env_value() { [ -f .env ] && grep -E "^$1=" .env | head -n1 | cut -d= -f2- | tr -d '[:space:]' || true; }
id=$(env_value VITE_STRAVA_CLIENT_ID)
secret=$(env_value STRAVA_CLIENT_SECRET)
demo=0

if [ -z "$id" ] || [ -z "$secret" ]; then
  say ''
  say 'The app needs your own Strava API application (free, about 5 minutes, only once).'
  say '  1. Log in to Strava and open https://www.strava.com/settings/api'
  say '  2. Fill in any name, category and website (e.g. https://github.com).'
  say '  3. Authorization Callback Domain: type exactly  localhost'
  say '  4. Click Create, then copy the Client ID and the Client Secret (click Show).'
  say ''
  say 'No Strava account at hand? Type D to open a demo with sample runs instead.'
  (command -v open >/dev/null && open 'https://www.strava.com/settings/api') ||
    (command -v xdg-open >/dev/null && xdg-open 'https://www.strava.com/settings/api') || true
  while true; do
    read -r -p 'Client ID (a number), or D for demo: ' id
    if [[ "$id" =~ ^[dD]$ ]]; then demo=1; break; fi
    if [[ "$id" =~ ^[0-9]+$ ]]; then break; fi
    say 'The Client ID is a number, e.g. 123456. Try again.'
  done
  if [ "$demo" = 0 ]; then
    while true; do
      read -r -s -p 'Client Secret (hidden while you type): ' secret; say ''
      if [[ "$secret" =~ ^[0-9a-fA-F]{20,}$ ]]; then break; fi
      say 'The Client Secret is a long code of letters a-f and digits. Try again.'
    done
    # Other lines in .env stay; the two keys are replaced. File stays only on this computer.
    kept=$( [ -f .env ] && grep -vE '^(VITE_STRAVA_CLIENT_ID|STRAVA_CLIENT_SECRET)=' .env || true )
    umask 077
    printf 'VITE_STRAVA_CLIENT_ID=%s\nSTRAVA_CLIENT_SECRET=%s\n%s\n' "$id" "$secret" "$kept" > .env
    chmod 600 .env # istniejący plik zachowuje swój tryb mimo umask
    say 'Saved to .env (never share this file).'
  fi
fi

# 4. Start
say ''
say 'Starting RunPostcard. The browser opens by itself; keep this window open while you use the app.'
say 'To stop the app, close this window or press Ctrl+C.'
if [ "$demo" = 1 ]; then exec npm run dev -- --open '/?mock=1'; else exec npm run dev -- --open; fi
