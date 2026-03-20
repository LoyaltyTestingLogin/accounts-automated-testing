/**
 * Zentrale Konfiguration aller verfügbaren Test-Suites
 */

export interface TestSuiteConfig {
  id: string;
  name: string;
  path: string;
  description: string;
  testCount: number; // Anzahl der Tests in dieser Suite
}

export const TEST_SUITES: TestSuiteConfig[] = [
  {
    id: 'login-happy',
    name: 'Login - Passwort Login inklusive Login Challenge',
    path: 'tests/login/password-happy-path.spec.ts',
    description: 'Vollständiger Passwort Login-Flow inklusive Testing vollständiger Login Challenge\n\n• Test 1: Erster Login + Zweiter Login ohne Challenge (E-Mail only Account, TAN per E-Mail, dann Abmelden & erneut Anmelden ohne Challenge)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)\n\n• Test 4: 2FA Account (SMS-TAN)\n\n• Test 5: Login-Seite lädt korrekt\n\n• Test 6: Login-Formular ist interaktiv',
    testCount: 6,
  },
  {
    id: 'login-otp',
    name: 'Login - OTP (Einmalcode) Login',
    path: 'tests/login/otp-happy-path.spec.ts',
    description: 'Vollständiger OTP Login-Flow mit Einmalcode statt Passwort\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
    testCount: 3,
  },
  {
    id: 'login-password-reset',
    name: 'Login - Passwort Reset',
    path: 'tests/login/password-reset.spec.ts',
    description: 'Vollständiger Passwort-Reset Flow mit TAN-Verifizierung\n\n• Test 1: E-Mail only Account (TAN per E-Mail + Phone Collector)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)\n\n• Test 4: Combined Account mit 2FA (Doppel-TAN: Email + SMS, kein Passwort-Änderung)',
    testCount: 4,
  },
  {
    id: 'login-passkey',
    name: 'Login - Passkey Login',
    path: 'tests/login/passkey-happy-path.spec.ts',
    description: 'Vollständiger Passkey Login-Flow mit Apple Keychain\n\n• Test Case 1: Passkey über Button (E-Mail eingeben → Weiter → "mit Passkey anmelden")\n\n• Test Case 2: Passkey über Conditional UI (Email-Feld klicken → Passkey-Vorschlag auswählen)\n\n⚠️ Benötigt macOS Accessibility-Berechtigung für AppleScript',
    testCount: 2,
  },
  {
    id: 'login-plz-birthday-challenge',
    name: 'Login - PLZ/Birthday Challenge',
    path: 'tests/login/plz-birthday-challenge.spec.ts',
    description: 'Vollständige Tests für Geburtsdatum- und PLZ-Challenge bei Passwort-Reset und OTP-Login\n\n• Test 1: Geburtsdatum-Challenge (Account erstellen, Geburtsdatum hinterlegen, 2x Passwort-Reset mit Birthday-Challenge, 2x OTP-Login mit Birthday-Challenge, Account löschen)\n\n• Test 2: PLZ-Challenge (Account erstellen, PLZ hinterlegen, 2x Passwort-Reset mit PLZ-Challenge, 2x OTP-Login mit PLZ-Challenge, Account löschen)',
    testCount: 2,
  },
  {
    id: 'registration-email',
    name: 'Registrierung - E-Mail Registrierung',
    path: 'tests/registration/email-registrierung-happy-path.spec.ts',
    description: 'Vollständiger E-Mail-Registrierungs-Flow\n\n• E-Mail eingeben\n\n• Passwort wählen\n\n• TAN-Verifizierung per E-Mail\n\n• Registrierung abschließen\n\n• Account wird über "Anmelden & Sicherheit" gelöscht',
    testCount: 1,
  },
  {
    id: 'registration-phone',
    name: 'Registrierung - Phone Registrierung',
    path: 'tests/registration/phone-registrierung-happy-path.spec.ts',
    description: 'Vollständiger Phone-Registrierungs-Flow\n\n• Phone eingeben\n\n• Passwort wählen (optional)\n\n• TAN-Verifizierung per SMS\n\n• Registrierung abschließen\n\n• Account wird über "Anmelden & Sicherheit" gelöscht',
    testCount: 1,
  },
  {
    id: 'registration-account-replace',
    name: 'Registrierung - Account Replace',
    path: 'tests/registration/account-replace.spec.ts',
    description: 'Account Replace Flow - Ersetzen eines bestehenden Accounts\n\n• Test 1: Account Replace mit E-Mail-Adresse (Erstelle Account → Öffne neuen Browser → Klicke "dieser E-Mail-Adresse" → "trotzdem neues Konto erstellen" → Account ersetzen)\n\n• Test 2: Account Replace mit Mobiltelefonnummer (Erstelle Account mit Phone → Öffne neuen Browser → Klicke "dieser Mobiltelefonnummer" → "trotzdem neues Konto erstellen" → Account ersetzen)',
    testCount: 2,
  },
];

/**
 * Gibt die Anzahl der Tests für einen bestimmten Test-Path zurück
 */
export function getTestCountForPath(testPath?: string): number {
  if (!testPath) {
    // Keine Angabe = alle Tests
    return TEST_SUITES.reduce((sum, suite) => sum + suite.testCount, 0);
  }

  // Exakte Übereinstimmung mit Test-Suite-Path
  const exactMatch = TEST_SUITES.find(suite => suite.path === testPath);
  if (exactMatch) {
    return exactMatch.testCount;
  }

  // Prüfe ob es ein Verzeichnis ist (z.B. "tests/login")
  if (testPath === 'tests/login') {
    return TEST_SUITES
      .filter(suite => suite.path.startsWith('tests/login/'))
      .reduce((sum, suite) => sum + suite.testCount, 0);
  }

  if (testPath === 'tests/registration') {
    return TEST_SUITES
      .filter(suite => suite.path.startsWith('tests/registration/'))
      .reduce((sum, suite) => sum + suite.testCount, 0);
  }

  if (testPath === 'tests') {
    return TEST_SUITES.reduce((sum, suite) => sum + suite.testCount, 0);
  }

  // Teilübereinstimmung
  for (const suite of TEST_SUITES) {
    if (testPath.includes(suite.path) || suite.path.includes(testPath)) {
      return suite.testCount;
    }
  }

  // Fallback: 1 Test
  return 1;
}

/**
 * Gibt die Anzahl der Test-Suites für einen Pfad zurück
 * (für Progress Bar bei "Alle Tests")
 */
export function getTestSuiteCountForPath(testPath?: string): number {
  if (!testPath || testPath === 'tests') {
    // Alle Test-Suites
    return TEST_SUITES.length;
  }

  if (testPath === 'tests/login') {
    return TEST_SUITES.filter(suite => suite.path.startsWith('tests/login/')).length;
  }

  if (testPath === 'tests/registration') {
    return TEST_SUITES.filter(suite => suite.path.startsWith('tests/registration/')).length;
  }

  // Einzelne Suite = 1
  return 1;
}

/**
 * Gibt die Gesamtanzahl aller Tests zurück
 */
export function getTotalTestCount(): number {
  return TEST_SUITES.reduce((sum, suite) => sum + suite.testCount, 0);
}

export interface OrderedSuiteEntry {
  path: string;
  name: string;
}

/**
 * Sortiert Spec-Pfade wie Playwright bei Verzeichnis-Läufen: lexikographisch nach relativem Pfad.
 * So stimmen Live-UI und tatsächliche Ausführungsreihenfolge überein.
 */
export function sortSpecPathsLikePlaywright(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b, 'en'));
}

function orderedSuitesFromSortedPaths(paths: string[]): OrderedSuiteEntry[] {
  const sorted = sortSpecPathsLikePlaywright(paths);
  return sorted.map(path => {
    const suite = TEST_SUITES.find(s => s.path === path);
    return suite ? { path: suite.path, name: suite.name } : { path, name: path };
  });
}

/**
 * Explizite Playwright-CLI-Argumente: gleiche Pfade wie in der UI, in Playwright-Reihenfolge.
 * @returns null = einzelner Pfad / unbekannt → Aufrufer nutzt testPath unverändert
 */
export function getPlaywrightCliTestArgsForPath(testPath?: string): string | null {
  if (testPath === 'tests') {
    return sortSpecPathsLikePlaywright(TEST_SUITES.map(s => s.path)).join(' ');
  }
  if (testPath === 'tests/login') {
    const paths = TEST_SUITES.filter(s => s.path.startsWith('tests/login/')).map(s => s.path);
    return sortSpecPathsLikePlaywright(paths).join(' ');
  }
  if (testPath === 'tests/registration') {
    const paths = TEST_SUITES.filter(s => s.path.startsWith('tests/registration/')).map(s => s.path);
    return sortSpecPathsLikePlaywright(paths).join(' ');
  }
  return null;
}

export function getOrderedSuitesForTestPath(testPath?: string): OrderedSuiteEntry[] {
  if (!testPath || testPath === 'tests') {
    return orderedSuitesFromSortedPaths(TEST_SUITES.map(s => s.path));
  }

  if (testPath === 'tests/login') {
    const paths = TEST_SUITES.filter(s => s.path.startsWith('tests/login/')).map(s => s.path);
    return orderedSuitesFromSortedPaths(paths);
  }

  if (testPath === 'tests/registration') {
    const paths = TEST_SUITES.filter(s => s.path.startsWith('tests/registration/')).map(s => s.path);
    return orderedSuitesFromSortedPaths(paths);
  }

  const exact = TEST_SUITES.find(s => s.path === testPath);
  if (exact) {
    return [{ path: exact.path, name: exact.name }];
  }

  return [];
}
