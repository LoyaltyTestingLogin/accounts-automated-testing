import { Page, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Zentrale Login-Helper-Funktion für CHECK24
 * Kapselt die Login-Logik für Wiederverwendbarkeit
 */
export async function loginWithPassword(page: Page, email?: string, password?: string) {
  const testEmail = email || process.env.TEST_EMAIL;
  const testPassword = password || process.env.TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error('TEST_EMAIL und TEST_PASSWORD müssen in .env definiert sein');
  }

  // Zur Login-Seite navigieren (vollständige URL aus .env)
  const loginUrl = process.env.CHECK24_BASE_URL;
  if (!loginUrl) {
    throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
  }
  await page.goto(loginUrl);

  // Warten bis Seite geladen ist
  await page.waitForLoadState('networkidle');

  // SCHRITT 1: E-Mail/Benutzername eingeben
  const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[placeholder*="E-Mail"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
  await page.waitForTimeout(1000); // Pause vor Eingabe - gut sichtbar
  await emailInput.fill(testEmail);
  await page.waitForTimeout(1500); // Längere Pause nach E-Mail

  // Klick auf "Weiter"-Button
  const weiterButton = page.locator('button[type="submit"]').first();
  
  console.log('➡️  Klicke auf "Weiter"-Button...');
  await page.waitForTimeout(1000); // Pause vor Klick
  await weiterButton.click({ force: true });
  console.log('✅ "Weiter" wurde geklickt');
  await page.waitForTimeout(1500); // Warten bis Passwort-Seite erscheint

  // SCHRITT 2: Passwort eingeben (erscheint erst nach "Weiter"-Klick)
  console.log('🔍 Warte auf Passwort-Feld...');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[id*="password"]').first();
  
  // Warten bis Passwort-Feld verfügbar ist
  await passwordInput.waitFor({ state: 'attached', timeout: 10000 });
  
  console.log('🔐 SCHRITT 2: Gebe Passwort ein...');
  await page.waitForTimeout(500); // Kürzere Pause vor Eingabe
  await passwordInput.fill(testPassword + 'XX', { force: true }); // ABSICHTLICH FALSCH für Test
  await page.waitForTimeout(2000); // Längere Pause nach Passwort - damit Button bereit ist

  // Klick auf "Anmelden"-Button (finaler Submit)
  console.log('🖱️  Klicke auf "Anmelden"-Button...');
  await page.waitForTimeout(1500); // Längere Pause vor Klick - Button muss erst erscheinen
  
  // Button-Selektor - es ist der Submit-Button
  const anmeldenButton = page.locator('button[type="submit"]').first();
  
  try {
    // Explizit warten bis Button visible ist
    await anmeldenButton.waitFor({ state: 'visible', timeout: 8000 });
    await anmeldenButton.click({ force: true });
    console.log('✅ "Anmelden"-Button wurde geklickt');
  } catch (e) {
    console.log('⚠️  "Anmelden"-Button nicht visible, versuche force-click...');
    try {
      await anmeldenButton.click({ force: true, timeout: 3000 });
      console.log('✅ "Anmelden"-Button wurde geklickt (force)');
    } catch (e2) {
      console.log('⚠️  Button-Klick fehlgeschlagen, versuche Enter-Taste...');
      await passwordInput.press('Enter');
      console.log('✅ Enter-Taste gedrückt');
    }
  }
  
  await page.waitForTimeout(2000); // Pause nach Klick - Navigation beobachten

  // Warten auf Navigation nach Login
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  return { email: testEmail };
}

/**
 * Prüft, ob der Login erfolgreich war
 * ANNAHME: Nach erfolgreichem Login gibt es ein charakteristisches Element
 */
export async function expectLoginSuccess(page: Page) {
  const currentUrl = page.url();
  
  // Prüfe ob wir auf der Kundenbereich-Seite sind
  if (!currentUrl.includes('kundenbereich.check24.de')) {
    // Prüfe auf Fehlermeldungen auf der Login-Seite
    const errorSelectors = [
      page.locator('[role="alert"]'),
      page.locator('.error-message'),
      page.locator('.alert-danger'),
      page.locator('text=/fehler|falsch|ungültig|incorrect|wrong/i'),
    ];

    let errorText = null;
    for (const errorSelector of errorSelectors) {
      const count = await errorSelector.count();
      if (count > 0) {
        const visible = await errorSelector.first().isVisible().catch(() => false);
        if (visible) {
          errorText = await errorSelector.first().textContent();
          break;
        }
      }
    }

    if (errorText) {
      throw new Error(`Login fehlgeschlagen: ${errorText.trim()}`);
    } else if (currentUrl.includes('login') || currentUrl.includes('auth')) {
      throw new Error('Login fehlgeschlagen: Noch auf der Login-Seite. Möglicherweise falsches Passwort oder falsche E-Mail-Adresse.');
    } else {
      throw new Error(`Login fehlgeschlagen: Unerwartete URL: ${currentUrl}`);
    }
  }

  // Prüfen auf URL-Änderung (zum Kundenbereich)
  await expect(page).toHaveURL(/kundenbereich\.check24\.de/);

  // Prüfen auf typische Post-Login-Elemente
  const loggedInIndicators = [
    page.locator('[data-testid="user-menu"]'),
    page.locator('button:has-text("Abmelden")'),
    page.locator('[aria-label*="Benutzerprofil"]'),
    page.locator('.user-profile'),
    page.locator('#user-menu'),
  ];

  // Versuche mindestens einen Indikator zu finden
  let found = false;
  for (const indicator of loggedInIndicators) {
    const count = await indicator.count();
    if (count > 0) {
      await expect(indicator.first()).toBeVisible({ timeout: 10000 });
      found = true;
      break;
    }
  }

  console.log('✅ Login erfolgreich verifiziert - Kundenbereich geladen');
}

/**
 * Logout-Helper
 */
export async function logout(page: Page) {
  const logoutButton = page.locator('button:has-text("Abmelden"), a:has-text("Abmelden"), [data-testid="logout"]').first();
  
  if (await logoutButton.count() > 0) {
    await logoutButton.click();
    await page.waitForLoadState('networkidle');
  }
}
