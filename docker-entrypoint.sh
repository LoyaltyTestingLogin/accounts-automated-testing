#!/bin/bash

set -e

echo "🚀 CHECK24 Login Testing System wird gestartet..."

# Environment-Check
if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "⚠️  WARNUNG: TEST_EMAIL und/oder TEST_PASSWORD nicht gesetzt!"
  echo "   Bitte in .env-Datei oder als Environment-Variable konfigurieren."
fi

if [ -z "$SLACK_WEBHOOK_URL" ]; then
  echo "⚠️  WARNUNG: SLACK_WEBHOOK_URL nicht gesetzt - Benachrichtigungen deaktiviert"
fi

# Datenbank-Verzeichnis sicherstellen
mkdir -p /app/data
mkdir -p /app/test-results

echo "✅ Verzeichnisse vorbereitet"

# API-Server im Hintergrund starten
echo "🌐 Starte API-Server..."
node --loader tsx src/api/server.ts &
API_PID=$!

# Worker im Hintergrund starten
echo "🤖 Starte Test-Worker..."
node --loader tsx src/worker/index.ts &
WORKER_PID=$!

# Web-Dashboard starten
echo "📊 Starte Web-Dashboard..."
npm run start:web &
WEB_PID=$!

echo "✅ Alle Services gestartet:"
echo "   - API-Server (PID: $API_PID)"
echo "   - Worker (PID: $WORKER_PID)"
echo "   - Web-Dashboard (PID: $WEB_PID)"
echo ""
echo "📡 Dashboard verfügbar unter: http://localhost:3000"
echo "📡 API verfügbar unter: http://localhost:4000"
echo ""

# Graceful Shutdown Handler
cleanup() {
  echo ""
  echo "👋 Beende Services..."
  kill $API_PID $WORKER_PID $WEB_PID 2>/dev/null || true
  wait $API_PID $WORKER_PID $WEB_PID 2>/dev/null || true
  echo "✅ Services beendet"
  exit 0
}

trap cleanup SIGTERM SIGINT

# Warten auf Prozesse
wait
