# 🚀 Quick Setup Guide

## Schritt 1: Dependencies installieren

```bash
npm install
```

## Schritt 2: Playwright-Browser installieren

```bash
npm run install:playwright
```

## Schritt 3: Umgebungsvariablen konfigurieren

Die `.env`-Datei wurde bereits erstellt. Bitte öffne sie und trage deine echten Zugangsdaten ein:

```bash
# Mit deinem bevorzugten Editor öffnen
nano .env
# oder
code .env
# oder
vim .env
```

**Wichtig:** Setze mindestens diese Variablen:
- `TEST_EMAIL` - Deine CHECK24 Test-Account E-Mail
- `TEST_PASSWORD` - Dein CHECK24 Test-Account Passwort
- `SLACK_WEBHOOK_URL` - Optional: Slack Webhook für Benachrichtigungen

## Schritt 4: System starten

### Option A: Alle Services gleichzeitig (empfohlen)

```bash
npm run dev
```

Dies startet:
- ✅ API-Server auf Port 4000
- ✅ Test-Worker (24/7 Scheduler)
- ✅ Web-Dashboard auf Port 3000

### Option B: Services einzeln starten

In separaten Terminal-Fenstern:

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:worker

# Terminal 3
npm run dev:web
```

## Schritt 5: Dashboard öffnen

Öffne deinen Browser und gehe zu:

```
http://localhost:3000
```

## 🧪 Ersten Test ausführen

### Via Web-Dashboard:
1. Öffne http://localhost:3000
2. Wähle "Login Tests" aus
3. Klicke auf "▶ Tests starten"

### Via CLI:
```bash
npm run test:login
```

## ✅ Checkliste

- [ ] Dependencies installiert
- [ ] Playwright-Browser installiert
- [ ] `.env` mit echten Zugangsdaten konfiguriert
- [ ] System gestartet (API + Worker + Web)
- [ ] Dashboard erreichbar (http://localhost:3000)
- [ ] Erster Test erfolgreich ausgeführt
- [ ] (Optional) Slack-Integration getestet

## 🔍 Selektoren anpassen

**WICHTIG:** Die Test-Selektoren in `tests/helpers/auth.ts` sind generisch!

Nach dem ersten Test-Durchlauf:

1. Öffne `tests/helpers/auth.ts`
2. Passe die Selektoren an die echte CHECK24-Login-Seite an
3. Führe Tests erneut aus: `npm run test:headed` (mit sichtbarem Browser)

## 🐛 Probleme?

Siehe [README.md](./README.md) → Abschnitt "Troubleshooting"

Häufigste Probleme:
- **Port bereits belegt**: Ändere `API_PORT` in `.env`
- **Browser startet nicht**: `npx playwright install --force chromium`
- **Tests schlagen fehl**: Prüfe Selektoren in `tests/helpers/auth.ts`

## 📚 Nächste Schritte

1. ✅ System läuft → Selektoren an echte CHECK24-Seite anpassen
2. ✅ Slack-Integration einrichten (siehe README.md)
3. ✅ Test-Intervall anpassen in `.env`
4. ✅ Weitere Tests hinzufügen in `tests/login/`

## 🐳 Docker Alternative

Falls du lieber Docker verwenden möchtest:

```bash
docker-compose up -d
docker-compose logs -f
```

Dashboard: http://localhost:3000

---

**Viel Erfolg! 🎉**
