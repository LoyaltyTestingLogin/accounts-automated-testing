# CHECK24 Login Testing System

Automatisiertes End-to-End-Frontend-Testing des CHECK24-Logins mit Playwright, Web-Dashboard und 24/7-Monitoring.

📖 **[→ CHECK24 Login-Flow Dokumentation](docs/CHECK24-LOGIN-FLOW.md)** - Vollständige Beschreibung des Login-Systems

## 🎯 Features

- ✅ **E2E-Tests mit Playwright** - Automatisierte Browser-Tests für CHECK24 Login
- 📊 **Web-Dashboard** - Übersichtliche Darstellung aller Test-Ergebnisse
- 🤖 **24/7 Monitoring** - Automatische Test-Durchläufe in konfigurierbaren Intervallen
- 🔔 **Slack-Benachrichtigungen** - Alerts bei fehlgeschlagenen Tests
- 📸 **Screenshots & Videos** - Automatische Artefakte bei Fehlern
- 🎬 **Test-Aufzeichnung** - Traces für detaillierte Fehleranalyse
- 🐳 **Docker-Support** - Einfache Portierung auf andere Systeme
- 💾 **SQLite-Datenbank** - Persistente Speicherung aller Test-Ergebnisse

## 📁 Projektstruktur

```
check24-login-testing/
├── tests/                          # Playwright E2E Tests
│   ├── login/                      # Login-Testsuites
│   │   └── password-happy-path.spec.ts
│   ├── fixtures/                   # Test-Accounts & Fixtures
│   │   ├── accounts.ts             # Multi-Account-System
│   │   └── README.md
│   └── helpers/                    # Test-Utilities
│       ├── auth.ts
│       └── email.ts
├── src/                            # Backend & Worker
│   ├── api/                        # Express API
│   │   └── server.ts
│   ├── worker/                     # 24/7 Scheduler
│   │   └── index.ts
│   ├── runner/                     # Playwright Test Runner
│   │   └── playwright-runner.ts
│   ├── database/                   # SQLite Persistenz
│   │   └── schema.ts
│   └── slack/                      # Slack-Integration
│       └── notifier.ts
├── web/                            # Next.js Dashboard
│   └── app/
│       ├── page.tsx                # Haupt-Dashboard
│       ├── layout.tsx
│       └── globals.css
├── playwright.config.ts            # Playwright-Konfiguration
├── docker-compose.yml              # Docker-Setup
├── Dockerfile
├── .env.example                    # Beispiel-Konfiguration
└── package.json
```

## 🚀 Quick Start

### Voraussetzungen

- **Node.js** >= 18.0.0
- **npm** oder **pnpm**
- Optional: **Docker** & **Docker Compose**

### Installation (Lokal)

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd check24-login-testing
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Playwright-Browser installieren**
   ```bash
   npm run install:playwright
   ```

4. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env
   ```
   
   Editiere `.env` und setze deine Werte:
   ```env
   # CHECK24 Login Zugangsdaten
   TEST_EMAIL=deine-email@example.com
   TEST_PASSWORD=dein-passwort
   
   # Slack Webhook (optional)
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   
   # Dashboard URL
   DASHBOARD_BASE_URL=http://localhost:3000
   
   # Test-Intervall in Minuten
   TEST_INTERVAL_MINUTES=15
   ```

5. **System starten**
   
   **Option A: Mit Shell-Skript (einfachste Methode):**
   ```bash
   ./start-dev.sh
   ```
   
   Das Skript:
   - ✅ Prüft ob Node.js installiert ist
   - ✅ Installiert Dependencies automatisch falls nötig
   - ✅ Startet alle Services (Frontend, API, Worker)
   
   **System stoppen:**
   ```bash
   ./stop-dev.sh
   ```
   
   **Option B: Mit npm-Befehlen:**
   
   Alle Services gleichzeitig:
   ```bash
   npm run dev
   ```
   
   Oder einzeln in separaten Terminals:
   ```bash
   # Terminal 1: API-Server
   npm run dev:api
   
   # Terminal 2: Test-Worker
   npm run dev:worker
   
   # Terminal 3: Web-Dashboard
   npm run dev:web
   ```

6. **Dashboard öffnen**
   ```
   http://localhost:3000
   ```

## 📜 Development Scripts

Das Projekt enthält praktische Shell-Skripte für einfaches Starten/Stoppen:

### `./start-dev.sh`
Startet das komplette System mit einer einzigen Befehl:
- Prüft automatisch ob Node.js installiert ist
- Installiert Dependencies falls `node_modules/` fehlt
- Lädt nvm/fnm falls vorhanden
- Startet alle Services: Frontend (Port 3000), API (Port 4000) und Worker

**Verwendung:**
```bash
./start-dev.sh
```

### `./stop-dev.sh`
Beendet alle laufenden Entwicklungs-Services:
- Findet und beendet Prozesse auf Port 3000 (Frontend)
- Findet und beendet Prozesse auf Port 4000 (API)
- Worker wird automatisch mit gestoppt

**Verwendung:**
```bash
./stop-dev.sh
```

**Tipp:** Diese Skripte sind besonders nützlich auf einem zweiten Laptop oder für schnelle Deployments!

### Installation (Docker)

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd check24-login-testing
   ```

2. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env
   # .env editieren und Werte setzen
   ```

3. **Docker Container starten**
   ```bash
   docker-compose up -d
   ```

4. **Logs ansehen**
   ```bash
   docker-compose logs -f
   ```

5. **Dashboard öffnen**
   ```
   http://localhost:3000
   ```

6. **Container stoppen**
   ```bash
   docker-compose down
   ```

## 📝 Verwendung

### Manuelles Ausführen von Tests

**CLI:**
```bash
# Alle Tests
npm run test:playwright

# Nur Login-Tests
npm run test:login

# Mit sichtbarem Browser
npm run test:headed
```

**Web-Dashboard:**
1. Öffne http://localhost:3000
2. Wähle eine Test-Suite aus
3. Klicke auf "Tests starten"

### 24/7 Automatisches Monitoring

Der Worker führt automatisch Tests in konfigurierbaren Intervallen aus:

- Konfiguriere das Intervall in `.env`: `TEST_INTERVAL_MINUTES=15`
- Der Worker startet automatisch mit `npm run dev:worker`
- Bei Fehlern werden Slack-Benachrichtigungen gesendet
- Alle Ergebnisse werden in der Datenbank gespeichert

### Slack-Integration einrichten

1. **Incoming Webhook erstellen**
   - Gehe zu https://api.slack.com/apps
   - Erstelle eine neue App oder wähle eine bestehende
   - Aktiviere "Incoming Webhooks"
   - Erstelle einen neuen Webhook für deinen Channel
   - Kopiere die Webhook-URL

2. **Webhook-URL konfigurieren**
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

3. **Verbindung testen**
   ```bash
   curl -X POST http://localhost:4000/api/test-slack
   ```

### Login Challenge - TAN-Code aus E-Mail auslesen (Microsoft Graph API)

**WICHTIG:** Login Challenge ≠ 2FA
- **Login Challenge**: Sicherheitsprüfung bei unbekanntem Gerät/Inkognito (kommt immer)
- **2FA**: Nur wenn in Account-Einstellungen aktiviert (optional)

Die automatische Behandlung von TAN-Codes per E-Mail ist **bereits eingerichtet**.

**Azure App Registration Details:**
- **App Name**: ExO RBAC Factory
- **Application (Client) ID**: `56ec444f-3c78-4925-8da4-a5514140f0a4`
- **Directory (Tenant) ID**: `04b9d98f-14cb-46a5-b5a7-a5141ddfa7ae`
- **Client Secret ID**: `fa7b4392-34e8-474c-8e93-3f1525a756d4`
- **E-Mail Account**: `loyaltytesting@check24.de`
- **Permissions**: `Mail.Read` (Application permission, Admin consent erteilt)

Die Credentials sind bereits in der `.env` Datei konfiguriert.

**Bei Problemen:**
1. Prüfe ob Admin Consent erteilt wurde (grünes Häkchen bei Mail.Read Permission)
2. Prüfe ob das Client Secret nicht abgelaufen ist
3. Teste mit: `npm run test:headed`

<details>
<summary>🔧 Neu einrichten (falls nötig)</summary>

Falls die App Registration neu erstellt werden muss:

1. **Azure App Registration erstellen**
   - Gehe zu: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
   - Klicke "New registration"
   - Name: `CHECK24 Test Automation`
   - Supported account types: "Accounts in this organizational directory only"
   - Klicke "Register"

2. **API Permissions hinzufügen**
   - Im linken Menü: "API permissions"
   - "Add a permission" → "Microsoft Graph" → "Application permissions"
   - Wähle: `Mail.Read`
   - Klicke "Add permissions"
   - **WICHTIG**: "Grant admin consent" (grünes Häkchen)

3. **Client Secret erstellen**
   - Im linken Menü: "Certificates & secrets"
   - Tab: "Client secrets" → "New client secret"
   - Description: `Test Automation Secret`
   - Expires: 24 months
   - **WICHTIG**: Kopiere den Value sofort!

4. **Credentials in .env eintragen**
   ```env
   AZURE_TENANT_ID=deine-tenant-id
   AZURE_CLIENT_ID=deine-client-id
   AZURE_CLIENT_SECRET=dein-client-secret
   EMAIL_ACCOUNT=loyaltytesting@check24.de
   ```
</details>

### Test-Artefakte

Alle Test-Artefakte werden automatisch gespeichert:

- **Screenshots**: `test-results/screenshots/`
- **Videos**: `test-results/artifacts/`
- **Traces**: `test-results/artifacts/`
- **HTML-Report**: `test-results/html-report/`

## 🔧 Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Default |
|----------|--------------|---------|
| `CHECK24_BASE_URL` | Basis-URL für CHECK24 | `https://accounts.check24.com` |
| `TEST_EMAIL` | Test-Account E-Mail | - |
| `TEST_PASSWORD` | Test-Account Passwort | - |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | - |
| `DASHBOARD_BASE_URL` | Dashboard URL für Links | `http://localhost:3000` |
| `API_PORT` | API-Server Port | `4000` |
| `TEST_INTERVAL_MINUTES` | Test-Intervall in Minuten | `15` |
| `PLAYWRIGHT_HEADLESS` | Browser im Headless-Mode | `true` |
| `PLAYWRIGHT_VIDEO` | Video-Aufzeichnung | `true` |
| `PLAYWRIGHT_SCREENSHOT` | Screenshot-Modus | `on-failure` |
| `DATABASE_PATH` | Pfad zur SQLite-Datenbank | `./data/testresults.db` |
| `RUN_TESTS_ON_STARTUP` | Tests beim Start ausführen | `false` |

### Playwright-Konfiguration

Bearbeite `playwright.config.ts` für erweiterte Einstellungen:

- Browser (Chromium, Firefox, WebKit)
- Timeouts
- Retries
- Video/Screenshot-Einstellungen
- Viewports
- etc.

## 📋 Verfügbare Scripts

```bash
# Installation
npm install                  # Dependencies installieren
npm run install:playwright   # Playwright-Browser installieren

# Tests
npm run test:playwright      # Alle E2E-Tests ausführen
npm run test:login          # Nur Login-Tests ausführen
npm run test:headed         # Tests mit sichtbarem Browser

# Development
npm run dev                 # Alle Services starten
npm run dev:web            # Nur Web-Dashboard
npm run dev:api            # Nur API-Server
npm run dev:worker         # Nur Test-Worker

# Production
npm run build:web          # Next.js Build
npm run start:web          # Next.js Production
npm run start:api          # API-Server Production
npm run start:worker       # Test-Worker Production

# Code Quality
npm run lint               # ESLint
npm run format             # Prettier

# Docker
npm run docker:build       # Docker Image bauen
npm run docker:up          # Container starten
npm run docker:down        # Container stoppen
```

## 🧪 Tests schreiben

### Neuen Test hinzufügen

1. Erstelle eine neue Datei in `tests/login/`:
   ```typescript
   // tests/login/mein-neuer-test.spec.ts
   import { test, expect } from '@playwright/test';
   import { loginWithPassword, expectLoginSuccess } from '../helpers/auth';

   test.describe('Mein neuer Test', () => {
     test('Beschreibung', async ({ page }) => {
       // Test-Code hier
     });
   });
   ```

2. Nutze die Helper-Funktionen aus `tests/helpers/auth.ts`:
   - `loginWithPassword(page, email?, password?)` - Login durchführen
   - `expectLoginSuccess(page)` - Erfolgreichen Login prüfen
   - `expectLoginError(page, expectedError?)` - Fehlermeldung prüfen
   - `logout(page)` - Logout durchführen

### Best Practices

- ✅ Verwende stabile Selektoren (data-testid, IDs, etc.)
- ✅ Kapsle wiederkehrende Schritte in Helper-Funktionen
- ✅ Nutze aussagekräftige Test-Namen
- ✅ Füge Screenshots bei Fehlern hinzu
- ✅ Verwende Timeouts angemessen
- ❌ Vermeide hardcodierte Waits (`page.waitForTimeout`)
- ❌ Vermeide fragile Selektoren (z.B. CSS-Klassen)

## 🔍 Selektoren anpassen

**WICHTIG:** Die Selektoren in `tests/helpers/auth.ts` sind generisch und müssen an die tatsächliche CHECK24-Login-Seite angepasst werden!

So gehst du vor:

1. **Inspiziere die Login-Seite**
   ```bash
   npm run test:headed
   ```
   
2. **Öffne DevTools** und finde die richtigen Selektoren

3. **Aktualisiere `tests/helpers/auth.ts`**
   ```typescript
   // Beispiel: Ersetze generische Selektoren
   const emailInput = page.locator('[data-testid="login-email"]');
   const passwordInput = page.locator('[data-testid="login-password"]');
   const loginButton = page.locator('[data-testid="login-submit"]');
   ```

4. **Teste die Änderungen**
   ```bash
   npm run test:login
   ```

## 📊 API-Endpoints

Der API-Server läuft auf Port 4000:

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/health` | GET | Health Check |
| `/api/test-runs` | GET | Letzte Test-Runs abrufen |
| `/api/test-runs/:id` | GET | Einzelnen Test-Run abrufen |
| `/api/statistics` | GET | Statistiken (letzte 7 Tage) |
| `/api/test-suites` | GET | Verfügbare Test-Suites |
| `/api/run-tests` | POST | Tests manuell starten |
| `/api/test-slack` | POST | Slack-Verbindung testen |

## 🐛 Troubleshooting

### Tests schlagen fehl mit "Target closed"
- Playwright-Browser neu installieren: `npx playwright install --force chromium`
- Shared Memory erhöhen (Docker): `shm_size: '2gb'` in docker-compose.yml

### "TEST_EMAIL und TEST_PASSWORD müssen in .env definiert sein"
- Stelle sicher, dass `.env` existiert und die Variablen gesetzt sind
- Prüfe ob die `.env`-Datei geladen wird: `console.log(process.env.TEST_EMAIL)`

### Slack-Benachrichtigungen funktionieren nicht
- Prüfe die Webhook-URL: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test"}'`
- Teste über API: `curl -X POST http://localhost:4000/api/test-slack`

### Port bereits belegt
- Ändere Ports in `.env`: `API_PORT=5000`
- Oder stoppe andere Services: `lsof -ti:4000 | xargs kill`

### Datenbank-Fehler
- Lösche alte Datenbank: `rm data/testresults.db`
- Das Schema wird automatisch neu erstellt

## 🚀 Deployment auf anderen Rechner

### Variante 1: Git-Repo

```bash
# Auf neuem Rechner
git clone <repository-url>
cd check24-login-testing
npm install
npm run install:playwright
cp .env.example .env
# .env editieren
npm run dev
```

### Variante 2: Docker

```bash
# Auf neuem Rechner
git clone <repository-url>
cd check24-login-testing
cp .env.example .env
# .env editieren
docker-compose up -d
```

### Variante 3: ZIP-Transfer

1. Packe das Projekt (ohne node_modules):
   ```bash
   tar -czf check24-testing.tar.gz . --exclude=node_modules --exclude=.next --exclude=dist
   ```

2. Auf neuem Rechner:
   ```bash
   tar -xzf check24-testing.tar.gz
   cd check24-login-testing
   npm install
   npm run install:playwright
   cp .env.example .env
   # .env editieren
   npm run dev
   ```

## 📈 Monitoring & Wartung

### Datenbank-Cleanup

Alte Test-Runs werden automatisch gelöscht (täglich um 3 Uhr, letzte 30 Tage werden behalten).

Manuelles Cleanup:
```typescript
import { getDatabase } from './src/database/schema';
const db = getDatabase();
db.cleanupOldRuns(30); // Behalte 30 Tage
```

### Logs

- **Lokale Entwicklung**: Logs erscheinen im Terminal
- **Docker**: `docker-compose logs -f`
- **Production**: Verwende einen Log-Aggregator (z.B. ELK, Datadog)

### Performance

- **Worker-Intervall**: Nicht unter 5 Minuten für Production
- **Parallele Tests**: Für Login-Tests empfohlen: `workers: 1` (seriell)
- **Video-Aufzeichnung**: Bei Production optional deaktivieren: `PLAYWRIGHT_VIDEO=false`

## 🤝 Erweiterungen

### Weitere Browser hinzufügen

Bearbeite `playwright.config.ts`:
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
],
```

Installiere Browser:
```bash
npx playwright install firefox webkit
```

### Weitere Test-Suites hinzufügen

1. Erstelle Ordner: `tests/neue-suite/`
2. Schreibe Tests: `tests/neue-suite/mein-test.spec.ts`
3. Füge zur API hinzu: `src/api/server.ts` → `/api/test-suites`

### Custom-Benachrichtigungen

Erweitere `src/slack/notifier.ts` oder erstelle neue Notifier:
- E-Mail-Benachrichtigungen
- Discord-Webhooks
- PagerDuty
- etc.

## 📄 Lizenz

Dieses Projekt ist für interne Zwecke erstellt.

## 🙏 Support

Bei Fragen oder Problemen:
1. Prüfe zuerst die Troubleshooting-Sektion
2. Schaue in die Logs
3. Erstelle ein Issue im Repository

## 🔐 GitHub-Zugang

Dieses Projekt ist mit einem GitHub-Account verknüpft:

- **E-Mail**: `loyaltytesting@check24.de`
- **Passwort**: `1qay2wsx!autotesting`

**Wichtig:** Diese Credentials sind nur für Projektadministratoren gedacht. Bewahre diese Informationen sicher auf.

---

**Viel Erfolg mit dem CHECK24 Login Testing System! 🚀**
