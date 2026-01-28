# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [1.0.0] - 2026-01-28

### ✨ Initial Release

#### Features
- ✅ **Playwright E2E Tests**
  - Login Happy Path Tests
  - Login Fehler-Tests (falsches Passwort, ungültige E-Mail, leere Felder)
  - Wiederverwendbare Test-Helper-Funktionen
  - Konfigurierbare Selektoren

- ✅ **Web-Dashboard (Next.js)**
  - Übersicht aller Test-Durchläufe
  - Live-Statistiken (Erfolgsquote, Anzahl Tests, Durchschnittsdauer)
  - Manuelles Triggern von Tests
  - Auto-Refresh alle 10 Sekunden
  - Responsive Design mit Tailwind CSS

- ✅ **API-Server (Express)**
  - REST-API für Test-Verwaltung
  - Endpoints für Test-Runs, Statistiken, Test-Suites
  - Health-Check Endpoint
  - CORS-Support

- ✅ **24/7 Test-Worker**
  - Automatische Test-Durchläufe in konfigurierbaren Intervallen
  - Cron-basierter Scheduler
  - Automatisches Cleanup alter Test-Runs

- ✅ **Slack-Integration**
  - Benachrichtigungen bei fehlgeschlagenen Tests
  - Rich-Message-Format mit allen wichtigen Infos
  - Link zum Dashboard
  - Verbindungstest

- ✅ **SQLite-Datenbank**
  - Persistente Speicherung aller Test-Ergebnisse
  - Statistiken über letzte 7 Tage
  - Automatisches Cleanup

- ✅ **Docker-Support**
  - Dockerfile mit allen Dependencies
  - docker-compose.yml für einfaches Deployment
  - Health-Checks
  - Volume-Mounting für Persistenz

- ✅ **Developer Experience**
  - TypeScript durchgehend
  - ESLint + Prettier
  - Umfangreiche README mit Beispielen
  - Setup-Script für automatische Installation
  - .env-Konfiguration für alle Einstellungen

#### Dokumentation
- Vollständige README.md mit:
  - Features-Übersicht
  - Installationsanleitung (lokal + Docker)
  - Verwendungshinweise
  - API-Dokumentation
  - Troubleshooting
  - Best Practices

- SETUP.md mit Schnellstart-Anleitung
- Setup-Script (setup.sh) für automatisierte Installation

#### Projektstruktur
```
check24-login-testing/
├── tests/           # Playwright Tests
├── src/             # Backend (API, Worker, Database, Slack)
├── app/             # Next.js Dashboard
├── playwright.config.ts
├── docker-compose.yml
└── README.md
```

#### Technologie-Stack
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Testing**: Playwright Test
- **Database**: SQLite (better-sqlite3)
- **Scheduler**: node-cron
- **Notifications**: Slack Incoming Webhooks

### 📝 Bekannte Einschränkungen

- Selektoren für CHECK24-Login sind generisch und müssen angepasst werden
- Nur Chromium-Browser initial konfiguriert (Firefox/WebKit können hinzugefügt werden)
- Slack ist die einzige Benachrichtigungs-Option (weitere können hinzugefügt werden)

### 🔜 Geplante Features

- [ ] Detailansicht für einzelne Test-Runs im Dashboard
- [ ] Video-Viewer im Dashboard
- [ ] Screenshot-Galerie
- [ ] Mehrere Test-Accounts
- [ ] E-Mail-Benachrichtigungen
- [ ] Metriken-Export (Prometheus)
- [ ] CI/CD-Integration (GitHub Actions)

---

## Versionsformat

Dieses Projekt folgt [Semantic Versioning](https://semver.org/):
- **MAJOR**: Inkompatible API-Änderungen
- **MINOR**: Neue Features (abwärtskompatibel)
- **PATCH**: Bug-Fixes (abwärtskompatibel)
