import { test, expect } from '@playwright/test';
import { loginWithPassword, expectLoginSuccess, logout, handleLoginChallenge } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Login Happy Path Test
 * Testet den erfolgreichen Login mit korrekten Zugangsdaten (inkl. Login Challenge)
 */
test.describe('CHECK24 Login - Happy Path', () => {
  test('Erfolgreicher Login - Account mit nur E-Mail (Login Challenge)', async ({ page }) => {
    // Account mit nur E-Mail-Adresse verwenden
    const credentials = getAccountCredentials('EMAIL_ONLY');
    console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

    // Login durchführen (E-Mail + Passwort)
    const { email } = await loginWithPassword(page, credentials.email, credentials.password);
    console.log(`✅ Login-Daten eingegeben für: ${email}`);

    // Login-Challenge behandeln (Sicherheitsprüfung bei unbekanntem Gerät)
    const hadChallenge = await handleLoginChallenge(page);
    
    if (hadChallenge) {
      console.log('✅ Login-Challenge erfolgreich bestanden (TAN-Code aus E-Mail)');
    }

    // Erfolgreichen Login verifizieren
    await expectLoginSuccess(page);

    // Screenshot nach erfolgreichem Login
    await page.screenshot({ 
      path: `test-results/screenshots/login-success-${credentials.account.id}-${Date.now()}.png`,
      fullPage: true 
    });

    console.log(`✅ Login vollständig erfolgreich für: ${email}`);

    // Optional: Logout durchführen für saubere Cleanup
    await logout(page);
  });

  test('Login-Seite lädt korrekt', async ({ page }) => {
    // Zur Login-Seite navigieren
    const loginUrl = process.env.CHECK24_BASE_URL;
    if (!loginUrl) throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
    
    await page.goto(loginUrl);
    await page.waitForLoadState('networkidle');

    // Prüfen ob wichtige Elemente vorhanden sind
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Prüfen ob Seite den korrekten Titel hat
    await expect(page).toHaveTitle(/check24|login|anmeld/i);

    console.log('✅ Login-Seite lädt korrekt mit allen erforderlichen Elementen');
  });

  test('Login-Formular ist interaktiv', async ({ page }) => {
    const loginUrl = process.env.CHECK24_BASE_URL;
    if (!loginUrl) throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
    
    await page.goto(loginUrl);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    // Interaktivität testen
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.fill('testpassword');
    await expect(passwordInput).toHaveValue('testpassword');

    console.log('✅ Login-Formular ist interaktiv');
  });
});
