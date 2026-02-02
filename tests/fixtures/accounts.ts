/**
 * Test Account Management
 * 
 * Zentrale Verwaltung aller Test-Accounts mit verschiedenen Eigenschaften.
 * Ermöglicht einfache Skalierung für verschiedene Testszenarien.
 * 
 * WICHTIG: Login Challenge ≠ 2FA
 * - Login Challenge: Sicherheitsprüfung bei unbekanntem Gerät/Inkognito (kommt immer)
 * - 2FA: Zwei-Faktor-Authentifizierung (nur wenn in Account-Einstellungen aktiviert)
 * 
 * PASSWORT: Alle Test-Accounts nutzen das gleiche Passwort (TEST_PASSWORD in .env)
 */

/**
 * Zentrales Test-Passwort für alle Accounts
 */
export const TEST_PASSWORD = '1qay1qay';

export type AccountFeature = 
  | 'email'           // Hat nur E-Mail hinterlegt
  | 'phone'           // Hat nur Phone hinterlegt
  | 'email_phone'     // Hat E-Mail und Phone hinterlegt
  | 'two_factor'      // 2FA in Account-Einstellungen aktiviert (optional)
  | 'login_challenge' // Login Challenge bei unbekanntem Gerät (kommt standardmäßig immer)
  | 'verified'        // Account ist verifiziert
  | 'unverified';     // Account ist nicht verifiziert

export interface TestAccount {
  id: string;                    // Eindeutige ID für den Account
  email: string;                 // E-Mail-Adresse
  features: AccountFeature[];    // Eigenschaften des Accounts
  description: string;           // Beschreibung für was der Account genutzt wird
  phone?: string;                // Phone (optional)
  twoFactorPhone?: string;       // 2FA Phone (optional, falls abweichend von phone)
}

/**
 * Zentrale Account-Datenbank
 */
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  // Account 1: Nur E-Mail, Login Challenge (kein 2FA in Einstellungen)
  EMAIL_ONLY: {
    id: 'email_only',
    email: 'loyaltytesting+automatedtesting1@check24.de',
    features: ['email', 'login_challenge', 'verified'],
    description: 'Account mit nur E-Mail-Adresse, Login Challenge (TAN per E-Mail bei unbekanntem Gerät)',
  },

  // Account 2: E-Mail + Phone, Login Challenge (kein 2FA in Einstellungen)
  EMAIL_PHONE: {
    id: 'email_phone',
    email: 'loyaltytesting+automatedtestingcombinedaccount@check24.de',
    features: ['email', 'phone', 'email_phone', 'login_challenge', 'verified'],
    description: 'Account mit E-Mail und Phone, Login Challenge (TAN per E-Mail oder SMS bei unbekanntem Gerät)',
    phone: '01746760225 ext. 8520',
  },

  // Account 3: E-Mail + Phone + 2FA aktiviert
  EMAIL_PHONE_2FA: {
    id: 'email_phone_2fa',
    email: 'loyaltytesting+automatedtestingcombinedaccountwith2fa@check24.de',
    features: ['email', 'phone', 'email_phone', 'two_factor', 'login_challenge', 'verified'],
    description: 'Account mit E-Mail, Phone und aktiviertem 2FA (Zwei-Faktor-Authentifizierung)',
    phone: '01746760225 ext. 8521',
    twoFactorPhone: '01746760225 ext. 8521', // Gleiche Nummer für 2FA
  },
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
 * Helper: Account-Passwort abrufen (alle Accounts nutzen TEST_PASSWORD)
 */
export function getAccountPassword(account?: TestAccount): string {
  return TEST_PASSWORD;
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
 * Validierung: Prüft ob die Account-Konfiguration valide ist
 */
export function validateAccountsConfiguration(): { valid: boolean; missing: string[] } {
  // Passwort ist jetzt hardcoded in accounts.ts, keine Validierung nötig
  return {
    valid: true,
    missing: [],
  };
}
