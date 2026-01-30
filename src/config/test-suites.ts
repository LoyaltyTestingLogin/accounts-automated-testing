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
    description: 'Vollständiger Passwort Login-Flow inklusive Testing vollständiger Login Challenge\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
    testCount: 3,
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
    description: 'Vollständiger Passwort-Reset Flow mit TAN-Verifizierung\n\n• Test 1: E-Mail only Account (TAN per E-Mail + Phone Collector)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
    testCount: 3,
  },
  {
    id: 'registration-email',
    name: 'Registrierung - E-Mail Registrierung',
    path: 'tests/registration/email-registrierung-happy-path.spec.ts',
    description: 'Vollständiger E-Mail-Registrierungs-Flow\n\n• E-Mail eingeben\n\n• Passwort wählen\n\n• TAN-Verifizierung per E-Mail\n\n• Registrierung abschließen',
    testCount: 1,
  },
  {
    id: 'registration-phone',
    name: 'Registrierung - Telefon Registrierung',
    path: 'tests/registration/phone-registrierung-happy-path.spec.ts',
    description: 'Vollständiger Telefon-Registrierungs-Flow\n\n• Telefonnummer eingeben\n\n• Passwort wählen (optional)\n\n• TAN-Verifizierung per SMS\n\n• Registrierung abschließen',
    testCount: 1,
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
 * Gibt die Gesamtanzahl aller Tests zurück
 */
export function getTotalTestCount(): number {
  return TEST_SUITES.reduce((sum, suite) => sum + suite.testCount, 0);
}
