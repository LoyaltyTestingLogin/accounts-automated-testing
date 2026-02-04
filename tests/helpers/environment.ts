/**
 * Environment Helper
 * Liefert umgebungsspezifische Konfiguration
 */

export type Environment = 'prod' | 'test';

/**
 * Ermittelt die aktuelle Test-Umgebung
 */
export function getEnvironment(): Environment {
  const env = process.env.TEST_ENVIRONMENT?.toLowerCase();
  return env === 'test' ? 'test' : 'prod';
}

/**
 * Gibt die Check24 Login-URL für die aktuelle Umgebung zurück
 */
export function getLoginUrl(): string {
  const environment = getEnvironment();
  
  if (environment === 'test') {
    return 'https://accounts.check24-test.com/login?callback=https%3A%2F%2Fkundenbereich.check24-test.de%2Findex.html%3Fls%3D1%26loc%3Dde_DE%26api_product%3Dcheck24_sso&api_product=check24_sso&loc=de_DE&deviceoutput=desktop&ls=1&sso_env=test&context_ref=https%3A%2F%2Fkundenbereich.check24-test.de%2Findex.html%3Fls%3D1%26loc%3Dde_DE%26api_product%3Dcheck24_sso';
  }
  
  // PROD
  return 'https://accounts.check24.com/login?callback=https%3A%2F%2Fkundenbereich.check24.de%2Findex.html%3Fls%3D1%26loc%3Dde_DE%26api_product%3Dcheck24_sso&api_product=check24_sso&loc=de_DE&deviceoutput=desktop&ls=2&context_ref=https%3A%2F%2Fkundenbereich.check24.de%2Findex.html%3Fls%3D1%26loc%3Dde_DE%26api_product%3Dcheck24_sso';
}

/**
 * Gibt einen lesbaren Namen für die Umgebung zurück
 */
export function getEnvironmentName(): string {
  const environment = getEnvironment();
  return environment === 'test' ? 'TEST' : 'PROD';
}

/**
 * Gibt die Kundenbereich-URL für die aktuelle Umgebung zurück
 */
export function getKundenbereichUrl(): string {
  const environment = getEnvironment();
  return environment === 'test' 
    ? 'https://kundenbereich.check24-test.de'
    : 'https://kundenbereich.check24.de';
}
