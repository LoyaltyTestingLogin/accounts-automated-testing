# Test Accounts System

Zentrales Account-Management-System für verschiedene Testszenarien mit unterschiedlichen Account-Eigenschaften.

## ⚠️ Wichtiger Hinweis: Login Challenge ≠ 2FA

- **Login Challenge**: Sicherheitsprüfung bei unbekanntem Gerät/Inkognito-Modus (kommt standardmäßig immer)
- **2FA (Two-Factor Authentication)**: Nur wenn explizit in Account-Einstellungen aktiviert (optional)

## 📋 Übersicht

Das System ermöglicht die skalierbare Verwaltung von Test-Accounts mit verschiedenen Features wie:
- Nur E-Mail vs. E-Mail + Telefon
- Login Challenge (Standard) vs. zusätzlich 2FA aktiviert
- Verifizierte/unverifizierte Accounts
- etc.

## 🔧 Verwendung

### Account abrufen und verwenden

```typescript
import { getAccountCredentials } from '../fixtures/accounts';

test('Mein Test', async ({ page }) => {
  // Account mit spezifischen Features abrufen
  const credentials = getAccountCredentials('EMAIL_ONLY_2FA');
  
  // Credentials verwenden
  await loginWithPassword(page, credentials.email, credentials.password);
  
  // Account-Informationen sind verfügbar
  console.log(credentials.account.description);
  console.log(credentials.account.features);
});
```

### Accounts nach Features filtern

```typescript
import { getAccountsByFeature, getAccountWithFeatures } from '../fixtures/accounts';

// Alle Accounts mit 2FA finden
const accounts2FA = getAccountsByFeature('two_factor');

// Account mit spezifischen Features finden
const account = getAccountWithFeatures(['email', 'phone', 'two_factor']);
```

## 📝 Verfügbare Accounts

### 1. EMAIL_ONLY
- **E-Mail:** `loyaltytesting+automatedtesting1@check24.de`
- **Features:** Nur E-Mail, Login Challenge (kein 2FA)
- **Verwendung:** Standard-Login-Tests mit E-Mail-TAN bei unbekanntem Gerät

### 2. EMAIL_PHONE
- **E-Mail:** `loyaltytesting+automatedtestingcombinedaccount@check24.de`
- **Features:** E-Mail + Telefon, Login Challenge (kein 2FA)
- **Verwendung:** Tests mit mehreren Challenge-Optionen (E-Mail oder SMS TAN)

## ➕ Neue Accounts hinzufügen

1. **Account in `accounts.ts` definieren:**

```typescript
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  // Bestehende Accounts...
  
  MY_NEW_ACCOUNT: {
    id: 'my_new_account',
    email: 'test+neueraccount@check24.de',
    passwordEnvKey: 'TEST_PASSWORD_ACCOUNT_3',
    features: ['email', 'login_challenge', 'verified'],  // oder zusätzlich 'two_factor'
    description: 'Account für spezielle Tests',
  },
};
```

2. **Passwort in `.env` hinzufügen:**

```bash
# Account 3: Mein neuer Account
TEST_PASSWORD_ACCOUNT_3=mein-passwort
```

3. **Auch `.env.example` aktualisieren:**

```bash
# Account 3: Mein neuer Account
TEST_PASSWORD_ACCOUNT_3=your-password-account-3
```

4. **Test erstellen:**

```typescript
test('Mein neuer Test', async ({ page }) => {
  const credentials = getAccountCredentials('MY_NEW_ACCOUNT');
  await loginWithPassword(page, credentials.email, credentials.password);
  // ...
});
```

## 🎯 Account Features

Verfügbare Feature-Typen:

- `email` - Hat E-Mail-Adresse hinterlegt
- `phone` - Hat Telefonnummer hinterlegt
- `email_phone` - Hat beides hinterlegt
- `login_challenge` - Login Challenge bei unbekanntem Gerät (Standard, kommt immer)
- `two_factor` - 2FA in Account-Einstellungen aktiviert (optional, zusätzlich zu Login Challenge)
- `verified` - Account ist verifiziert
- `unverified` - Account ist nicht verifiziert

## ✅ Validierung

Das System validiert automatisch, ob alle Passwörter in `.env` definiert sind:

```typescript
import { validateAccountsConfiguration } from '../fixtures/accounts';

const validation = validateAccountsConfiguration();
if (!validation.valid) {
  console.error('Fehlende Passwörter:', validation.missing);
}
```

## 🔐 Sicherheit

- **Passwörter** werden niemals im Code gespeichert
- Nur die **Environment-Variable-Keys** sind im Code
- Tatsächliche Passwörter stehen nur in `.env` (nicht in Git)
- `.env` ist in `.gitignore` und wird nie committed

## 📖 Best Practices

1. **Sprechende IDs verwenden:** `EMAIL_ONLY_2FA` statt `ACCOUNT_1`
2. **Features klar dokumentieren:** Was macht diesen Account besonders?
3. **Description aussagekräftig:** Wofür wird der Account verwendet?
4. **Tests aussagekräftig benennen:** z.B. `email-phone-2fa-login.spec.ts`
5. **Cleanup nach Tests:** Immer `logout()` aufrufen

## 🚀 Vorteile

✅ **Skalierbar** - Beliebig viele Accounts hinzufügen  
✅ **Typsicher** - TypeScript-Interfaces für alle Account-Daten  
✅ **Zentral** - Alle Accounts an einem Ort  
✅ **Sicher** - Passwörter in Environment Variables  
✅ **Dokumentiert** - Jeder Account hat eine Beschreibung  
✅ **Filterbar** - Accounts nach Features suchen  
