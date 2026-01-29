#!/usr/bin/env bash
# Frontend + Backend starten (installiert Abhängigkeiten bei Bedarf)
set -e
cd "$(dirname "$0")"

# nvm laden (falls installiert)
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
fi
# fnm laden (falls installiert)
if command -v fnm &>/dev/null; then
  eval "$(fnm env)"
fi

if ! command -v node &>/dev/null; then
  echo "Fehler: Node.js nicht gefunden."
  echo ""
  echo "Node installieren (eine Option):"
  echo "  • nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  • fnm:  brew install fnm && fnm install --lts"
  echo "  • direkt: https://nodejs.org"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Abhängigkeiten installieren..."
  npm install
fi

echo "Starte API (Port 4000), Worker und Frontend (Port 3000)..."
npm run dev
