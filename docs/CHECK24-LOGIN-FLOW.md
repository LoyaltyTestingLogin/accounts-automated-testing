# CHECK24 Login-Flow Dokumentation

Diese Dokumentation beschreibt den grundsätzlichen Aufbau des CHECK24 Login-Systems und dient als Basis für alle automatisierten Tests.

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Login-Arten](#login-arten)
3. [Account-Typen](#account-typen)
4. [Login-Flow Phasen](#login-flow-phasen)
5. [Challenges](#challenges)
6. [Collectors](#collectors)
7. [Test-Strategie](#test-strategie)

---

## 🎯 Übersicht

Der CHECK24 Login ist ein mehrstufiger Prozess, der je nach:
- **Login-Methode** (Passwort, OTP, Social, Passkey)
- **Account-Typ** (Email-only, Combined Email+Phone)
- **Device-Status** (bekannt vs. unbekannt)
- **Account-Einstellungen** (2FA aktiviert, "Angemeldet bleiben")

unterschiedliche Schritte durchläuft.

---

## 🔐 Login-Arten

### 1. **Passwort Login** ✅ (Implementiert)
Der Standard-Login-Flow mit E-Mail und Passwort.

**Flow:**
```
1. E-Mail eingeben → "Weiter"
2. Passwort eingeben → "Anmelden"
3. [Optional] Login Challenge (bei unbekanntem Gerät)
4. [Optional] Collectors (Phone/Passkey)
5. → Kundenbereich
```

**Account-Requirements:**
- Registrierter Account mit Passwort

**Status:** ✅ Test vorhanden (`password-happy-path.spec.ts`)

---

### 2. **OTP Login (Einmalcode)**
Login ohne Passwort über temporären Code per E-Mail oder SMS.

**Flow:**
```
1. E-Mail eingeben → "Weiter"
2. "Code senden" wählen
3. Code aus E-Mail/SMS auslesen
4. Code eingeben → "Anmelden"
5. [Optional] Collectors
6. → Kundenbereich
```

**Account-Requirements:**
- Registrierter Account (mit oder ohne Passwort)
- E-Mail oder Telefonnummer hinterlegt

**Status:** 🔲 Noch nicht implementiert

---

### 3. **Passwort vergessen**
Prozess zum Zurücksetzen des Passworts.

**Flow:**
```
1. "Passwort vergessen?" klicken
2. E-Mail eingeben
3. Code aus E-Mail auslesen
4. Neues Passwort setzen
5. Login mit neuem Passwort
6. → Kundenbereich
```

**Status:** 🔲 Noch nicht implementiert

---

### 4. **"Angemeldet bleiben"**
Login mit persistenter Session (Cookie bleibt länger gültig).

**Flow:**
```
1. E-Mail eingeben → "Weiter"
2. Passwort eingeben
3. ✅ "Angemeldet bleiben" aktivieren
4. "Anmelden"
5. [Optional] Login Challenge
6. [Optional] Collectors
7. → Kundenbereich (mit Long-Lived-Cookie)
```

**Test-Ziele:**
- Cookie-Ablaufzeit prüfen (länger als normale Session)
- Persistent über Browser-Restart

**Status:** 🔲 Noch nicht implementiert

---

### 5. **Passkey Login** ❓
Login via biometrischer Authentifizierung (WebAuthn).

**Flow:**
```
1. E-Mail eingeben → "Weiter"
2. "Mit Passkey anmelden" wählen
3. Biometrische Authentifizierung
4. → Kundenbereich
```

**Herausforderungen:**
- Erfordert registrierten Passkey
- Biometrische Authentifizierung schwer automatisierbar
- WebAuthn API-Mocking nötig

**Status:** ❓ Automatisierbarkeit unklar

---

### 6. **Google Social Login** ❓
Login via Google OAuth.

**Flow:**
```
1. "Mit Google anmelden" klicken
2. Google-Login-Popup
3. Google-Account auswählen/einloggen
4. Zurück zu CHECK24
5. [Optional] Collectors
6. → Kundenbereich
```

**Herausforderungen:**
- Externe OAuth-Provider
- Popup-Handling
- Google-Account-Verwaltung
- 2FA bei Google

**Status:** ❓ Automatisierbarkeit unklar (evtl. mit Google Test-Accounts)

---

## 👤 Account-Typen

### Email-Only Account
**Eigenschaften:**
- Nur E-Mail-Adresse hinterlegt
- Kein Telefon
- Login Challenge per E-Mail TAN

**Test-Account:** `EMAIL_ONLY` (`loyaltytesting+automatedtesting1@check24.de`)

---

### Combined Account (Email + Phone)
**Eigenschaften:**
- E-Mail UND Telefonnummer hinterlegt
- Login Challenge kann per E-Mail ODER SMS TAN kommen
- Mehr Optionen bei OTP-Login

**Test-Account:** `EMAIL_PHONE` (`loyaltytesting+automatedtestingcombinedaccount@check24.de`)

---

## 🔄 Login-Flow Phasen

Jeder Login durchläuft potentiell diese Phasen:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Identifikation                                      │
│ → E-Mail/Telefon eingeben                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Authentifizierung                                   │
│ → Passwort / OTP / Passkey / Social                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Challenges (Optional)                               │
│ → Login Challenge (bei unbekanntem Gerät)                    │
│ → 2FA (falls in Einstellungen aktiviert)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Collectors (Optional)                               │
│ → Phone Collector (Telefonnummer hinterlegen)                │
│ → Passkey Collector (Passkey einrichten)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Callback                                            │
│ → Weiterleitung zu kundenbereich.check24.de                  │
│ → c24session Cookie gesetzt                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Challenges

### Login Challenge (Sicherheitsprüfung)
**Wann:** Bei Login von unbekanntem Gerät oder im Inkognito-Modus

**WICHTIG:** Dies ist **NICHT 2FA**! 
- **Login Challenge** = Gerätesicherheit (kommt immer bei unbekanntem Gerät)
- **2FA** = Optional in Account-Einstellungen aktivierbar

**Flow:**
```
1. Screen: "Kurze Sicherheitsüberprüfung"
2. Button: "Weiter" klicken
3. TAN-Code wird per E-Mail/SMS versendet
4. TAN-Code aus E-Mail auslesen (automatisiert via Microsoft Graph API)
5. TAN-Code eingeben
6. "Weiter" klicken
7. → Weiter zu Phase 4 (Collectors)
```

**Implementierung:** ✅ `handleLoginChallenge()` in `tests/helpers/auth.ts`

---

### 2FA (Two-Factor Authentication)
**Wann:** Falls in Account-Einstellungen aktiviert

**WICHTIG:** Aktuell haben unsere Test-Accounts **KEIN 2FA aktiviert**!

**Flow (falls aktiviert):**
```
1. Nach Passwort-Eingabe
2. 2FA-Aufforderung
3. Code aus Authenticator-App oder SMS
4. Code eingeben
5. → Weiter
```

**Status:** 🔲 Noch nicht benötigt (Test-Accounts ohne 2FA)

---

## 📱 Collectors

Collectors sind **optionale Dialoge** nach erfolgreichem Login, die zusätzliche Informationen sammeln.

### Phone Collector
**Wann:** Account hat noch keine Telefonnummer hinterlegt

**Screen:**
- Überschrift: "Telefonnummer hinterlegen"
- Input: Telefonnummer-Feld
- Buttons: "Weiter" / "später erinnern"

**Test-Strategie:**
- In Tests: "später erinnern" klicken (Skip)
- Implementiert in `handleLoginChallenge()` → Phase 7

**Status:** ✅ Implementiert

---

### Passkey Collector
**Wann:** Account hat noch keinen Passkey eingerichtet

**Screen:**
- Überschrift: "Passkey einrichten?"
- Text: Erklärung zu Passkeys
- Buttons: "Jetzt einrichten" / "später erinnern"

**Test-Strategie:**
- In Tests: "später erinnern" klicken (Skip)

**Status:** 🔲 Noch nicht implementiert

---

## 🧪 Test-Strategie

### Grundprinzipien

1. **Isolation:** Jeder Test testet genau eine Login-Art
2. **Unabhängigkeit:** Tests dürfen nicht voneinander abhängen
3. **Sauberkeit:** Collectors werden in Tests übersprungen (nicht Fokus)
4. **Verifizierung:** Erfolgreicher Login wird über `c24session` Cookie geprüft

---

### Test-Struktur

```
tests/login/
├── password-happy-path.spec.ts       ✅ Passwort Login (Standard)
├── otp-login.spec.ts                 🔲 OTP via Einmalcode
├── password-reset.spec.ts            🔲 Passwort vergessen
├── remember-me.spec.ts               🔲 "Angemeldet bleiben"
├── passkey-login.spec.ts             ❓ Passkey Login (falls möglich)
└── social-login-google.spec.ts       ❓ Google Social Login (falls möglich)
```

---

### Helper-Funktionen

**Verfügbar in `tests/helpers/auth.ts`:**

| Funktion | Beschreibung | Status |
|----------|--------------|--------|
| `loginWithPassword()` | Standard Passwort-Login | ✅ |
| `handleLoginChallenge()` | Login Challenge (TAN) | ✅ |
| `expectLoginSuccess()` | Cookie & URL Validierung | ✅ |
| `logout()` | Logout durchführen | ✅ |
| `handlePhoneCollector()` | Phone Collector skippen | ✅ (in Challenge integriert) |
| `handlePasskeyCollector()` | Passkey Collector skippen | 🔲 |
| `loginWithOTP()` | OTP-Login | 🔲 |
| `resetPassword()` | Passwort zurücksetzen | 🔲 |

---

### Test-Account-System

**Verfügbar in `tests/fixtures/accounts.ts`:**

```typescript
// Email-Only Account (Login Challenge via Email)
const creds = getAccountCredentials('EMAIL_ONLY');

// Combined Account (Login Challenge via Email oder SMS)
const creds = getAccountCredentials('EMAIL_PHONE');
```

**Neue Accounts hinzufügen:**
Siehe `tests/fixtures/README.md`

---

## 📊 Nächste Schritte

### Priorität 1: Login-Tests vervollständigen
1. ✅ Passwort Login
2. 🔲 OTP Login
3. 🔲 Passwort vergessen
4. 🔲 "Angemeldet bleiben"

### Priorität 2: Collectors vervollständigen
1. ✅ Phone Collector
2. 🔲 Passkey Collector

### Priorität 3: Erweiterte Login-Arten
1. ❓ Passkey Login (Machbarkeit prüfen)
2. ❓ Google Social Login (Machbarkeit prüfen)

### Später: Registrierungs-Tests
1. 🔲 Email-only Registrierung
2. 🔲 Combined Account Registrierung
3. 🔲 Account Replace

---

## 📝 Notizen

- **Login Challenge ≠ 2FA:** Wichtig für korrekte Terminologie in Tests und Logs
- **Collectors sind optional:** Tests skippen Collectors (nicht Test-Fokus)
- **c24session Cookie:** Zuverlässigster Indikator für erfolgreichen Login
- **Test-Accounts:** Verwenden echte CHECK24 Test-Accounts (siehe `.env`)
- **Microsoft Graph API:** Für automatisches Auslesen von TAN-Codes per E-Mail

---

## 🔗 Verwandte Dokumentation

- [Test Account System](../tests/fixtures/README.md)
- [Multi-Account Management](../tests/fixtures/accounts.ts)
- [README - Setup](../README.md)
