# Annahmen und Hinweise

Dieses Dokument beschreibt die Annahmen, die während der Entwicklung getroffen wurden, und gibt Hinweise zur Anpassung an die echte CHECK24-Login-Seite.

## 🎯 Wichtige Annahmen

### 1. CHECK24 Login-Seite Struktur

**Annahme**: Die Login-Seite hat ein Standard-HTML-Formular mit:
- Email/Username-Eingabefeld
- Passwort-Eingabefeld
- Submit-Button

**Implementiert in**: `tests/helpers/auth.ts`

**Hinweise zur Anpassung**:

Die Selektoren müssen an die echte CHECK24-Login-Seite angepasst werden:

```typescript
// AKTUELL (generisch):
const emailInput = page.locator(
  'input[type="email"], input[name="email"], input[name="username"]'
).first();

// ANPASSEN auf echte Selektoren, z.B.:
const emailInput = page.locator('[data-testid="login-email"]');
// oder
const emailInput = page.locator('#email-input');
```

**So findest du die richtigen Selektoren**:

1. Führe Test mit sichtbarem Browser aus:
   ```bash
   npm run test:headed
   ```

2. Öffne DevTools (F12) während der Test läuft

3. Inspiziere die Elemente auf der Login-Seite:
   - Rechtsklick auf Element → "Inspect"
   - Suche nach stabilen Attributen:
     - `data-testid` (am besten!)
     - `id` (gut)
     - `name` (ok)
     - `aria-label` (ok)
     - CSS-Klassen (vermeiden, zu fragil)

4. Aktualisiere `tests/helpers/auth.ts` mit den gefundenen Selektoren

### 2. Erfolgreicher Login - Indikator

**Annahme**: Nach erfolgreichem Login:
- URL ändert sich (nicht mehr `/login`)
- Ein charakteristisches Element erscheint (z.B. Benutzer-Menü, Logout-Button)

**Implementiert in**: `tests/helpers/auth.ts` → Funktion `expectLoginSuccess()`

**Aktuelle Indikatoren** (müssen angepasst werden):
```typescript
const loggedInIndicators = [
  page.locator('[data-testid="user-menu"]'),
  page.locator('button:has-text("Abmelden")'),
  page.locator('[aria-label*="Benutzerprofil"]'),
  page.locator('.user-profile'),
  page.locator('#user-menu'),
];
```

**Hinweise zur Anpassung**:
- Schaue dir die Seite nach erfolgreichem Login an
- Finde ein Element, das NUR nach Login sichtbar ist
- Aktualisiere die Indikatoren entsprechend

### 3. Fehlermeldungen

**Annahme**: Bei fehlerhaftem Login erscheint eine Fehlermeldung mit:
- `role="alert"` Attribut
- oder CSS-Klasse wie `.error-message`, `.alert-danger`
- oder Text mit "fehler", "falsch", "ungültig"

**Implementiert in**: `tests/helpers/auth.ts` → Funktion `expectLoginError()`

**Hinweise zur Anpassung**:
- Probiere einen Login mit falschen Daten aus
- Inspiziere die Fehlermeldung
- Passe die Selektoren in `expectLoginError()` an

### 4. Cookie-Banner / GDPR

**Annahme**: Eventuell gibt es einen Cookie-Banner, der akzeptiert werden muss.

**Noch nicht implementiert!**

**Falls vorhanden, füge hinzu**:
```typescript
// In tests/helpers/auth.ts oder als separate Funktion
export async function acceptCookies(page: Page) {
  const cookieBanner = page.locator('[data-testid="cookie-banner"]');
  
  if (await cookieBanner.isVisible()) {
    const acceptButton = page.locator('button:has-text("Akzeptieren")');
    await acceptButton.click();
    await page.waitForTimeout(1000);
  }
}

// Dann in den Tests:
await acceptCookies(page);
await loginWithPassword(page);
```

### 5. Browser-Konfiguration

**Annahme**: Chromium im Desktop-Modus (1920x1080) ist ausreichend.

**Implementiert in**: `playwright.config.ts`

**Erweiterung auf andere Browser**:
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  // Mobile:
  { name: 'mobile', use: { ...devices['iPhone 13'] } },
],
```

Browser installieren:
```bash
npx playwright install firefox webkit
```

### 6. Test-Daten

**Annahme**: Ein einzelner Test-Account ist ausreichend.

**Implementiert**: Via `.env` → `TEST_EMAIL` und `TEST_PASSWORD`

**Erweiterung für mehrere Accounts**:
```env
# .env
TEST_EMAIL_1=account1@example.com
TEST_PASSWORD_1=password1

TEST_EMAIL_2=account2@example.com
TEST_PASSWORD_2=password2
```

Dann in Tests rotieren oder parallel testen.

### 7. Rate Limiting

**Annahme**: CHECK24 hat kein aggressives Rate Limiting für Login-Versuche.

**Falls doch**:
- Reduziere Test-Intervall: `TEST_INTERVAL_MINUTES=30` oder höher
- Füge Delays zwischen Tests hinzu
- Verwende mehrere Test-Accounts

### 8. Session-Management

**Annahme**: Tests laufen unabhängig, keine Session-Wiederverwendung.

**Jeder Test**:
- Startet mit frischem Browser-Context
- Führt eigenen Login durch
- Räumt auf (optional Logout)

**Optimierung** (optional):
- Verwende `storageState` um Sessions zu speichern und wiederzuverwenden
- Siehe: https://playwright.dev/docs/auth

### 9. Monitoring-Intervall

**Annahme**: 15-Minuten-Intervall ist sinnvoll.

**Konfigurierbar via**: `.env` → `TEST_INTERVAL_MINUTES`

**Empfehlungen**:
- **Development**: 5-10 Minuten (schnelles Feedback)
- **Production**: 15-30 Minuten (weniger Last, immer noch zeitnah)
- **Nach Releases**: 5 Minuten temporär

### 10. Slack-Benachrichtigungen

**Annahme**: Nur Fehler sollen gemeldet werden.

**Implementiert**: Slack-Benachrichtigung nur bei `status: 'failed'`

**Erweiterung**:
- Recovery-Benachrichtigungen (Test war failed, ist jetzt wieder passed)
- Tägliche Summary
- Wöchentliche Reports

Siehe: `src/slack/notifier.ts` → `notifyTestRecovery()`

## 🔍 Empfohlene nächste Schritte

### 1. Selektoren anpassen (WICHTIG!)

```bash
# Test im headed mode ausführen
npm run test:headed

# Seite inspizieren, Selektoren finden
# Dann tests/helpers/auth.ts anpassen
```

### 2. Cookie-Banner handling

Falls CHECK24 einen Cookie-Banner hat, diesen akzeptieren.

### 3. Login-Flow verifizieren

Prüfe ob der Login-Flow ggf. Zwischenschritte hat:
- Captcha (würde automatisierte Tests blockieren!)
- 2FA (müsste speziell gehandhabt werden)
- Email-Bestätigung
- etc.

### 4. Error-Messages testen

Probiere bewusst falsche Logins aus und schaue:
- Welche Fehlermeldungen erscheinen?
- Wie sind sie strukturiert?
- Passe `expectLoginError()` entsprechend an

### 5. Performance-Metriken

Optional: Erweitere Tests um Performance-Checks:
```typescript
const startTime = Date.now();
await loginWithPassword(page);
const loginDuration = Date.now() - startTime;

expect(loginDuration).toBeLessThan(5000); // Max 5 Sekunden
```

## 📝 Test-Checkliste

Nach Anpassung der Selektoren:

- [ ] Happy Path Test läuft durch
- [ ] Fehler-Tests (falsches Passwort) funktionieren
- [ ] URL-Prüfung nach Login korrekt
- [ ] Logged-in-Indikator wird erkannt
- [ ] Screenshots werden erstellt
- [ ] Videos werden aufgezeichnet (bei Fehler)
- [ ] Datenbank speichert Ergebnisse
- [ ] Slack-Benachrichtigungen funktionieren
- [ ] Dashboard zeigt Tests an
- [ ] 24/7-Worker läuft stabil

## 🐛 Bekannte Einschränkungen

### Captcha

Falls CHECK24 Captcha verwendet, können automatisierte Tests blockiert sein.

**Lösungen**:
- Test-Umgebung ohne Captcha nutzen
- Captcha-Service-Integration (z.B. 2Captcha) - nicht empfohlen
- Captcha für Test-Accounts deaktivieren (falls möglich)

### 2FA / MFA

Falls 2-Faktor-Authentifizierung erforderlich ist:

**Lösungen**:
- Test-Account ohne 2FA erstellen
- TOTP-Codes programmatisch generieren
- Backup-Codes verwenden

### Rate Limiting

Falls zu viele Login-Versuche geblockt werden:

**Lösungen**:
- Test-Intervall erhöhen
- Mehrere Test-Accounts rotieren
- Mit CHECK24-Team Test-Account mit höheren Limits absprechen

## 📞 Support

Bei Problemen mit der Anpassung:

1. Prüfe die Browser-Console auf Fehler
2. Schaue in die Test-Screenshots
3. Aktiviere Playwright-Traces: `trace: 'on'` in `playwright.config.ts`
4. Prüfe die Test-Logs

---

**Dokumentation zuletzt aktualisiert**: 28.01.2026
