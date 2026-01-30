/**
 * Test Account Management
 * 
 * Zentrale Verwaltung aller Test-Accounts mit verschiedenen Eigenschaften.
 * Ermöglicht einfache Skalierung für verschiedene Testszenarien.
 * 
 * WICHTIG: Login Challenge ≠ 2FA
 * - Login Challenge: Sicherheitsprüfung bei unbekanntem Gerät/Inkognito (kommt immer)
 * - 2FA: Zwei-Faktor-Authentifizierung (nur wenn in Account-Einstellungen aktiviert)
 */

export type AccountFeature = 
  | 'email'           // Hat nur E-Mail hinterlegt
  | 'phone'           // Hat nur Telefon hinterlegt
  | 'email_phone'     // Hat E-Mail und Telefon hinterlegt
  | 'two_factor'      // 2FA in Account-Einstellungen aktiviert (optional)
  | 'login_challenge' // Login Challenge bei unbekanntem Gerät (kommt standardmäßig immer)
  | 'verified'        // Account ist verifiziert
  | 'unverified';     // Account ist nicht verifiziert

export interface TestAccount {
  id: string;                    // Eindeutige ID für den Account
  email: string;                 // E-Mail-Adresse
  passwordEnvKey: string;        // Key für Passwort in .env
  features: AccountFeature[];    // Eigenschaften des Accounts
  description: string;           // Beschreibung für was der Account genutzt wird
  phone?: string;                // Telefonnummer (optional)
}

/**
 * Zentrale Account-Datenbank
 */
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  // Account 1: Nur E-Mail, Login Challenge (kein 2FA in Einstellungen)
  EMAIL_ONLY: {
    id: 'email_only',
    email: 'loyaltytesting+automatedtesting1@check24.de',
    passwordEnvKey: 'TEST_PASSWORD_ACCOUNT_1',
    features: ['email', 'login_challenge', 'verified'],
    description: 'Account mit nur E-Mail-Adresse, Login Challenge (TAN per E-Mail bei unbekanntem Gerät)',
  },

  // Account 2: E-Mail + Telefon, Login Challenge (kein 2FA in Einstellungen)
  EMAIL_PHONE: {
    id: 'email_phone',
    email: 'loyaltytesting+automatedtestingcombinedaccount@check24.de',
    passwordEnvKey: 'TEST_PASSWORD_ACCOUNT_2',
    features: ['email', 'phone', 'email_phone', 'login_challenge', 'verified'],
    description: 'Account mit E-Mail und Telefon, Login Challenge (TAN per E-Mail oder SMS bei unbekanntem Gerät)',
    phone: '01746760225 ext. 8520',
  },

  // Weitere Accounts können hier einfach hinzugefügt werden:
  // EMAIL_ONLY_WITH_2FA: { features: ['email', 'two_factor', 'login_challenge'] },
  // etc.
};

/**
 * Helper: Account nach ID abrufen
 */
export function getAccount(accountId: keyof typeof TEST_ACCOUNTS): TestAccount {
  const account = TEST_ACCOUNTS[accountId];
  if (!account) {
    throw new Error(`Test-Account mit ID "${accountId}" nicht gefunden`);
  }
  return account;
}

/**
 * Helper: Account-Passwort aus Environment abrufen
 */
export function getAccountPassword(account: TestAccount): string {
  const password = process.env[account.passwordEnvKey];
  if (!password) {
    throw new Error(
      `Passwort für Account "${account.id}" nicht gefunden. ` +
      `Bitte ${account.passwordEnvKey} in .env setzen.`
    );
  }
  return password;
}

/**
 * Helper: Accounts mit bestimmten Features finden
 */
export function getAccountsByFeature(feature: AccountFeature): TestAccount[] {
  return Object.values(TEST_ACCOUNTS).filter(account =>
    account.features.includes(feature)
  );
}

/**
 * Helper: Account mit allen angegebenen Features finden
 */
export function getAccountWithFeatures(features: AccountFeature[]): TestAccount | undefined {
  return Object.values(TEST_ACCOUNTS).find(account =>
    features.every(feature => account.features.includes(feature))
  );
}

/**
 * Helper: Vollständige Login-Credentials für einen Account
 */
export interface AccountCredentials {
  email: string;
  password: string;
  account: TestAccount;
}

export function getAccountCredentials(accountId: keyof typeof TEST_ACCOUNTS): AccountCredentials {
  const account = getAccount(accountId);
  const password = getAccountPassword(account);
  
  return {
    email: account.email,
    password,
    account,
  };
}

/**
 * Validierung: Prüft ob alle Account-Passwörter in .env definiert sind
 */
export function validateAccountsConfiguration(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const account of Object.values(TEST_ACCOUNTS)) {
    if (!process.env[account.passwordEnvKey]) {
      missing.push(account.passwordEnvKey);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
