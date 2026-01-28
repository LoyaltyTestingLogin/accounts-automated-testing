import { Page, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { getEmailClient } from './email';

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
  await page.waitForTimeout(300);
  await emailInput.fill(testEmail);
  await page.waitForTimeout(500);

  // Klick auf "Weiter"-Button
  const weiterButton = page.locator('button[type="submit"]').first();
  
  console.log('➡️  Klicke auf "Weiter"-Button...');
  await page.waitForTimeout(300);
  await weiterButton.click({ force: true });
  console.log('✅ "Weiter" wurde geklickt');
  await page.waitForTimeout(800);

  // SCHRITT 2: Passwort eingeben (erscheint erst nach "Weiter"-Klick)
  console.log('🔍 Warte auf Passwort-Feld...');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[id*="password"]').first();
  
  // Warten bis Passwort-Feld verfügbar ist
  await passwordInput.waitFor({ state: 'attached', timeout: 10000 });
  
  console.log('🔐 SCHRITT 2: Gebe Passwort ein...');
  await page.waitForTimeout(200);
  await passwordInput.fill(testPassword, { force: true });
  await page.waitForTimeout(800);

  // Klick auf "Anmelden"-Button (finaler Submit)
  console.log('🖱️  Klicke auf "Anmelden"-Button...');
  await page.waitForTimeout(500);
  
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
  
  await page.waitForTimeout(800);

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

/**
 * Login-Challenge Handler (2FA TAN-Code)
 * Vollständiger Flow:
 * 1. Screen "Kurze Sicherheitsüberprüfung" erkennen
 * 2. Auf "Weiter" klicken → E-Mail wird versendet
 * 3. 6-stelligen TAN-Code aus E-Mail auslesen
 * 4. TAN-Code eingeben
 * 5. Wieder "Weiter" klicken
 */
export async function handleLoginChallenge(page: Page): Promise<boolean> {
  console.log('🔐 Prüfe auf Login-Challenge...');

  // Warte auf Challenge-Seite
  await page.waitForTimeout(2000);

  // Debug: Zeige aktuelle URL und Seitentitel
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log(`📍 Aktuelle URL: ${currentUrl}`);
  console.log(`📄 Seitentitel: ${pageTitle}`);

  // SCHRITT 1: Prüfe auf "Sicherheitsüberprüfung" Screen
  // Prüfe mit verschiedenen Methoden
  const securityCheckPatterns = [
    { type: 'text', value: 'Kurze Sicherheitsüberprüfung' },
    { type: 'text', value: 'Sicherheitsüberprüfung' },
    { type: 'text', value: 'Bestätigen Sie Ihre Identität' },
    { type: 'text', value: 'Verifizierung' },
    { type: 'text', value: 'sicherheit' }, // Case-insensitive partial match
  ];

  let securityCheckFound = false;
  
  for (const pattern of securityCheckPatterns) {
    const locator = page.locator(`text=${pattern.value}`);
    const count = await locator.count();
    
    if (count > 0) {
      console.log(`✅ Sicherheitsüberprüfung-Screen erkannt: "${pattern.value}" (${count} Treffer)`);
      securityCheckFound = true;
      break;
    }
  }

  // Alternative: Prüfe auf häufige Challenge-Elemente
  if (!securityCheckFound) {
    const bodyText = await page.locator('body').textContent();
    console.log(`🔍 Seiteninhalt (erste 200 Zeichen): ${bodyText?.substring(0, 200)}...`);
    
    if (bodyText && (
      bodyText.toLowerCase().includes('sicherheit') || 
      bodyText.toLowerCase().includes('verifizierung') ||
      bodyText.toLowerCase().includes('identität')
    )) {
      console.log('✅ Sicherheitsüberprüfung-Screen erkannt (via Volltext-Suche)');
      securityCheckFound = true;
    }
  }

  if (!securityCheckFound) {
    console.log('ℹ️  Keine Login-Challenge erkannt - möglicherweise nicht erforderlich');
    return false;
  }

  // SCHRITT 2: Klicke auf "Weiter" um E-Mail-Versand auszulösen
  console.log('➡️  Suche "Weiter"-Button um TAN-Code per E-Mail anzufordern...');
  
  // Sehr breite Button-Selektor-Liste
  const weiterButtonSelectors = [
    'button:has-text("Weiter")',
    'button:has-text("weiter")',
    'button[type="submit"]:has-text("Weiter")',
    'button[type="button"]:has-text("Weiter")',
    'a:has-text("Weiter")',
    'button[type="submit"]',
    'button:visible:not([disabled])',
    '[role="button"]:has-text("Weiter")',
  ];

  let weiterButton = null;
  
  for (const selector of weiterButtonSelectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    
    if (count > 0) {
      console.log(`🔍 Button gefunden mit Selektor: ${selector}`);
      try {
        // Prüfe ob sichtbar
        if (await locator.isVisible({ timeout: 2000 })) {
          weiterButton = locator;
          console.log(`✅ Sichtbarer "Weiter"-Button gefunden: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️  Button nicht sichtbar: ${selector}`);
      }
    }
  }
  
  if (weiterButton) {
    try {
      console.log('🖱️  Klicke auf "Weiter"-Button...');
      await weiterButton.click({ force: true, timeout: 5000 });
      console.log('✅ "Weiter" geklickt - E-Mail wird versendet');
    } catch (e) {
      console.log(`⚠️  Click fehlgeschlagen: ${e}`);
      console.log('⌨️  Versuche Enter-Taste...');
      await page.keyboard.press('Enter');
    }
  } else {
    console.log('⚠️  Kein "Weiter"-Button gefunden, versuche Enter...');
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(1500);

  // Debug: Was ist nach dem Klick auf "Weiter" passiert?
  const urlAfterWeiter = page.url();
  const titleAfterWeiter = await page.title();
  console.log(`📍 Nach "Weiter"-Klick - URL: ${urlAfterWeiter}`);
  console.log(`📄 Nach "Weiter"-Klick - Titel: ${titleAfterWeiter}`);
  
  const bodyTextAfterWeiter = await page.locator('body').textContent();
  console.log(`🔍 Seiteninhalt (erste 300 Zeichen): ${bodyTextAfterWeiter?.substring(0, 300)}...`);

  // Cookie-Banner schließen falls vorhanden
  console.log('🍪 Prüfe auf Cookie-Banner...');
  const cookieButtonSelectors = [
    'button:has-text("Nur notwendige")',
    'button:has-text("nur notwendige")',
    'button:has-text("Notwendige")',
    'button:has-text("Ablehnen")',
    'button:has-text("ablehnen")',
    '[data-testid="uc-deny-all-button"]',
    '#usercentrics-root button',
    'button[class*="cookie"]',
    'button[id*="cookie"]',
    'a:has-text("Nur notwendige")',
  ];

  let cookieBannerClosed = false;
  for (const selector of cookieButtonSelectors) {
    try {
      const cookieButton = page.locator(selector);
      const count = await cookieButton.count();
      
      if (count > 0) {
        console.log(`🔍 Cookie-Button gefunden: ${selector} (${count} Element(e))`);
        try {
          await cookieButton.first().click({ force: true, timeout: 3000 });
          await page.waitForTimeout(800);
          console.log(`✅ Cookie-Banner geschlossen via: ${selector}`);
          cookieBannerClosed = true;
          break;
        } catch (clickError) {
          console.log(`⚠️  Klick fehlgeschlagen auf: ${selector}`);
        }
      }
    } catch (e) {
      // Weiter zum nächsten Selektor
    }
  }
  
  if (!cookieBannerClosed) {
    console.log('ℹ️  Kein Cookie-Banner gefunden oder bereits geschlossen');
  }

  // SCHRITT 3: Warte auf TAN-Eingabefeld
  console.log('🔍 Warte auf TAN-Eingabefeld...');
  
  const tanInputSelectors = [
    'input[name*="tan"]:not([name*="zip"])',
    'input[name*="otp"]',
    'input[name="challenge_code"]',
    'input[name="verification_code"]',
    'input[id*="tan"]',
    'input[id*="otp"]',
    'input[placeholder*="Code"]:not([placeholder*="Postleitzahl"])',
    'input[placeholder*="code"]:not([placeholder*="Postleitzahl"])',
    'input[placeholder*="TAN"]',
    'input[placeholder*="Verifizierung"]',
    'input[type="text"][inputmode="numeric"]:not([name*="zip"]):not([name*="phone"])',
    'input[type="tel"]:not([name*="zip"]):not([name*="phone"])',
    'input[type="text"]:not([name*="zip"]):not([name*="phone"]):not([name*="email"])',
    'input[type="number"]',
  ];

  let tanInput = null;
  
  console.log('🔎 Durchsuche Seite mit allen TAN-Eingabefeld-Selektoren...');
  
  for (const selector of tanInputSelectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    
    if (count > 0) {
      console.log(`   Gefunden mit "${selector}": ${count} Element(e)`);
      try {
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        tanInput = locator;
        console.log(`✅ TAN-Eingabefeld gefunden und sichtbar: ${selector}`);
        break;
      } catch (e) {
        console.log(`   ⚠️  Element nicht sichtbar: ${selector}`);
        // Versuche trotzdem das Feld zu verwenden (könnte durch Overlay verdeckt sein)
        try {
          const isAttached = await locator.count() > 0;
          if (isAttached) {
            tanInput = locator;
            console.log(`⚠️  Verwende nicht-sichtbares Feld trotzdem: ${selector}`);
            break;
          }
        } catch (attachError) {
          // Weiter
        }
      }
    }
  }

  if (!tanInput) {
    // Letzter Versuch: Zeige alle Input-Felder auf der Seite
    const allInputs = await page.locator('input').count();
    console.log(`⚠️  Alle Input-Felder auf der Seite: ${allInputs}`);
    
    for (let i = 0; i < Math.min(allInputs, 10); i++) {
      const input = page.locator('input').nth(i);
      const inputType = await input.getAttribute('type');
      const inputName = await input.getAttribute('name');
      const inputPlaceholder = await input.getAttribute('placeholder');
      console.log(`   Input #${i}: type="${inputType}", name="${inputName}", placeholder="${inputPlaceholder}"`);
    }
    
    throw new Error('TAN-Eingabefeld nicht gefunden nach Klick auf "Weiter"');
  }

  // SCHRITT 4: Hole TAN-Code aus E-Mail
  console.log('📧 Warte auf TAN-Code per E-Mail...');

  // E-Mail Client initialisieren
  const emailClient = getEmailClient();

  // Auf E-Mail mit TAN-Code warten (6-stelliger Code)
  const tanCode = await emailClient.waitForTanCode(
    {
      subject: 'CHECK24', // Anpassen an tatsächlichen Betreff falls nötig
      // from: 'noreply@check24.de' // Optional: Absender filtern
    },
    120000 // 120 Sekunden Timeout (2 Minuten)
  );

  if (!tanCode) {
    throw new Error('TAN-Code konnte nicht aus E-Mail extrahiert werden (Timeout nach 2 Minuten)');
  }

  console.log(`🔑 TAN-Code erhalten: ${tanCode}`);

  // SCHRITT 5: TAN-Code eingeben
  await page.waitForTimeout(300);
  
  try {
    // Versuche normal zu füllen
    await tanInput.fill(tanCode, { timeout: 5000 });
    console.log('✅ TAN-Code eingegeben');
  } catch (fillError) {
    // Falls nicht sichtbar: Versuche mit force
    console.log('⚠️  Normales fill() fehlgeschlagen, versuche mit force...');
    try {
      await tanInput.evaluate((el: any, code: string) => {
        el.value = code;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, tanCode);
      console.log('✅ TAN-Code eingegeben (via JavaScript)');
    } catch (jsError) {
      throw new Error(`TAN-Code konnte nicht eingegeben werden: ${jsError}`);
    }
  }
  
  await page.waitForTimeout(500);

  // SCHRITT 6: Wieder auf "Weiter" klicken (oder Enter drücken)
  console.log('➡️  Schließe Login ab (Enter-Taste oder Weiter-Button)...');
  
  // Strategie 1: Enter-Taste im TAN-Feld drücken (funktioniert auch bei verdecktem Button)
  try {
    console.log('⌨️  Drücke Enter im TAN-Feld...');
    await tanInput.press('Enter');
    await page.waitForTimeout(1500);
    console.log('✅ Enter gedrückt - warte auf Navigation...');
  } catch (enterError) {
    // Strategie 2: Versuche Button mit JavaScript zu klicken
    console.log('⚠️  Enter fehlgeschlagen, versuche Button-Klick mit JavaScript...');
    try {
      const submitButton = page.locator('button[type="submit"], button:has-text("Weiter"), button:has-text("Bestätigen")').first();
      
      if (await submitButton.count() > 0) {
        await submitButton.evaluate((btn: any) => {
          btn.click();
        });
        await page.waitForTimeout(1500);
        console.log('✅ Button geklickt via JavaScript');
      } else {
        throw new Error('Kein Submit-Button gefunden');
      }
    } catch (buttonError) {
      console.log(`⚠️  Beide Methoden fehlgeschlagen: Enter=${enterError}, Button=${buttonError}`);
      throw new Error('Login konnte nicht abgeschlossen werden - weder Enter noch Button-Klick funktioniert');
    }
  }

  console.log('✅ Login-Challenge abgeschlossen');
  return true;
}
