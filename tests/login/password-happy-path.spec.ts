import { test, expect } from '@playwright/test';
import { loginWithPassword, expectLoginSuccess, logout } from '../helpers/auth';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Login Happy Path Test
 * Testet den erfolgreichen Login mit korrekten Zugangsdaten
 */
test.describe('CHECK24 Login - Happy Path', () => {
  test('Erfolgreicher Login mit korrekten Zugangsdaten', async ({ page }) => {
    // Login durchführen
    const { email } = await loginWithPassword(page);

    // Erfolgreichen Login verifizieren
    await expectLoginSuccess(page);

    // Screenshot nach erfolgreichem Login
    await page.screenshot({ 
      path: `test-results/screenshots/login-success-${Date.now()}.png`,
      fullPage: true 
    });

    console.log(`✅ Login erfolgreich für: ${email}`);

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
