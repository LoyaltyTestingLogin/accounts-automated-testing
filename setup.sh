#!/bin/bash

# CHECK24 Login Testing - Setup Script
# Dieses Script automatisiert die Installation des Projekts

set -e

echo "🚀 CHECK24 Login Testing - Setup"
echo "=================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Node.js Version prüfen
echo "📦 Prüfe Node.js Version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js ist nicht installiert!${NC}"
    echo "Bitte installiere Node.js >= 18.0.0 von https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js Version zu alt (${NODE_VERSION})!${NC}"
    echo "Bitte installiere Node.js >= 18.0.0"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) gefunden${NC}"
echo ""

# Dependencies installieren
echo "📥 Installiere Dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installiert${NC}"
echo ""

# Playwright Browser installieren
echo "🌐 Installiere Playwright Browser..."
npx playwright install chromium
echo -e "${GREEN}✅ Playwright Browser installiert${NC}"
echo ""

# .env prüfen
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Keine .env-Datei gefunden, erstelle aus .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env-Datei erstellt${NC}"
else
    echo -e "${GREEN}✅ .env-Datei existiert bereits${NC}"
fi
echo ""

# Verzeichnisse erstellen
echo "📁 Erstelle benötigte Verzeichnisse..."
mkdir -p data
mkdir -p test-results/screenshots
mkdir -p test-results/artifacts
echo -e "${GREEN}✅ Verzeichnisse erstellt${NC}"
echo ""

# Konfiguration prüfen
echo "🔍 Prüfe Konfiguration..."
echo ""

if grep -q "your-test-email@example.com" .env; then
    echo -e "${YELLOW}⚠️  WARNUNG: TEST_EMAIL noch nicht konfiguriert!${NC}"
    echo "   Bitte editiere .env und setze deine echten Zugangsdaten:"
    echo "   TEST_EMAIL=deine-email@example.com"
    echo "   TEST_PASSWORD=dein-passwort"
    echo ""
    NEEDS_CONFIG=true
fi

if grep -q "SLACK_WEBHOOK_URL=$" .env || ! grep -q "SLACK_WEBHOOK_URL=" .env; then
    echo -e "${YELLOW}⚠️  INFO: SLACK_WEBHOOK_URL nicht gesetzt (optional)${NC}"
    echo "   Für Slack-Benachrichtigungen setze in .env:"
    echo "   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    echo ""
fi

# Zusammenfassung
echo "=================================="
echo "✅ Setup abgeschlossen!"
echo "=================================="
echo ""

if [ "$NEEDS_CONFIG" = true ]; then
    echo -e "${YELLOW}⚠️  Nächster Schritt: Konfiguriere .env mit echten Zugangsdaten!${NC}"
    echo ""
    echo "Öffne .env mit:"
    echo "  nano .env"
    echo "  # oder"
    echo "  code .env"
    echo ""
    echo "Dann starte das System mit:"
    echo "  npm run dev"
else
    echo "System starten:"
    echo "  npm run dev"
    echo ""
    echo "Einzelne Services:"
    echo "  npm run dev:api      # API-Server"
    echo "  npm run dev:worker   # Test-Worker"
    echo "  npm run dev:web      # Web-Dashboard"
    echo ""
fi

echo "Dashboard öffnen:"
echo "  http://localhost:3000"
echo ""

echo "Tests ausführen:"
echo "  npm run test:login      # Login-Tests"
echo "  npm run test:headed     # Mit sichtbarem Browser"
echo ""

echo "📚 Weitere Infos:"
echo "  README.md  - Vollständige Dokumentation"
echo "  SETUP.md   - Detaillierte Setup-Anleitung"
echo ""

echo -e "${GREEN}Viel Erfolg! 🎉${NC}"
