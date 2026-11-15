#!/usr/bin/env bash
# Starts Market Screener: double-click this file, or run ./start.sh
cd "$(dirname "$(readlink -f "$0")")" || exit 1

# Programs started from a file manager don't load nvm, so do it here.
if ! command -v node >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is needed to run Market Screener, and it isn't installed."
  echo
  echo "Install it without admin rights (works on SteamOS):"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
  echo "  then open a new terminal and run:  nvm install --lts"
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

node scripts/launch.mjs "$@"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -r -p "Press Enter to close."
fi
exit $status
