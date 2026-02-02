import { Page, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { getEmailClient } from './email';
import { getLoginUrl, getEnvironmentName } from './environment';

dotenv.config();

/**
 * Zentrale Login-Helper-Funktion für CHECK24
 * Kapselt die Login-Logik für Wiederverwendbarkeit
 * 
 * @param page - Playwright Page Objekt
 * @param email - E-Mail-Adresse aus tests/fixtures/accounts.ts
 * @param password - Passwort aus tests/fixtures/accounts.ts
 */
export async function loginWithPassword(page: Page, email: string, password: string) {
  if (!email || !password) {
    throw new Error('E-Mail und Passwort sind erforderlich. Verwende getAccountCredentials() aus tests/fixtures/accounts.ts');
  }

  // Zur Login-Seite navigieren (URL basierend auf Umgebung)
  const loginUrl = getLoginUrl();
  console.log(`🌍 Umgebung: ${getEnvironmentName()} - ${loginUrl}`);
  await page.goto(loginUrl);

  // Warten bis Seite geladen ist
  await page.waitForLoadState('networkidle');

  // SCHRITT 1: E-Mail/Benutzername eingeben
  const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[placeholder*="E-Mail"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
  await page.waitForTimeout(300);
  await emailInput.fill(email);
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
  await passwordInput.fill(password, { force: true });
  
  // Direkt Enter drücken nach Passwort-Eingabe (schnellster Weg)
  console.log('⏎  Drücke Enter zum Anmelden...');
  await passwordInput.press('Enter');
  console.log('✅ Enter-Taste gedrückt');
  
  await page.waitForTimeout(500);

  // Warten auf Navigation nach Login
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  return { email };
}

/**
 * Prüft, ob der Login erfolgreich war
 * ANNAHME: Nach erfolgreichem Login gibt es ein charakteristisches Element
 */
export async function expectLoginSuccess(page: Page) {
  const currentUrl = page.url();
  
  // Prüfe ob wir auf der Kundenbereich-Seite sind (PROD oder TEST)
  if (!currentUrl.includes('kundenbereich.check24.de') && !currentUrl.includes('kundenbereich.check24-test.de') && !currentUrl.includes('accounts.check24.com') && !currentUrl.includes('accounts.check24-test.com')) {
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

  // WICHTIG: Prüfe c24session Cookie (zuverlässigster Indikator für erfolgreichen Login)
  console.log('🔍 Prüfe c24session Cookie...');
  const cookies = await page.context().cookies();
  const c24sessionCookie = cookies.find(cookie => cookie.name === 'c24session');
  
  if (c24sessionCookie) {
    console.log(`✅ c24session Cookie gefunden: ${c24sessionCookie.value.substring(0, 20)}...`);
    console.log(`   Domain: ${c24sessionCookie.domain}`);
    console.log(`   Expires: ${c24sessionCookie.expires ? new Date(c24sessionCookie.expires * 1000).toISOString() : 'Session'}`);
  } else {
    console.warn('⚠️  c24session Cookie nicht gefunden - Login möglicherweise nicht vollständig');
    // Liste alle vorhandenen Cookies zur Diagnose
    console.log('📋 Vorhandene Cookies:', cookies.map(c => c.name).join(', '));
  }

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

  // Finale Validierung: Cookie MUSS vorhanden sein für erfolgreichen Login
  if (!c24sessionCookie) {
    throw new Error('Login nicht vollständig: c24session Cookie fehlt');
  }

  console.log('✅ Login erfolgreich verifiziert - Kundenbereich geladen und c24session Cookie gesetzt');
}

/**
 * Logout-Helper
 */
export async function logout(page: Page) {
  console.log('🚪 Versuche Logout...');
  
  const logoutButton = page.locator('button:has-text("Abmelden"), a:has-text("Abmelden"), [data-testid="logout"]').first();
  
  if (await logoutButton.count() > 0) {
    try {
      // Versuche mit force: true wenn nicht sichtbar
      await logoutButton.click({ force: true, timeout: 5000 });
      console.log('✅ Logout-Button geklickt');
      await page.waitForLoadState('networkidle');
    } catch (e) {
      console.log('ℹ️  Logout-Button nicht klickbar - überspringe Logout (Session läuft aus)');
      // Nicht kritisch - Session läuft eh aus
    }
  } else {
    console.log('ℹ️  Kein Logout-Button gefunden - überspringe Logout');
  }
}

/**
 * Wählt die Methode für Login Challenge aus (Email oder Phone)
 * Wird nur bei Combined Accounts angezeigt (haben Email UND Phone)
 */
export async function selectChallengeMethod(page: Page, method: 'email' | 'phone'): Promise<void> {
  console.log(`🔍 Prüfe auf Selection Screen für Login Challenge...`);
  
  await page.waitForTimeout(2000);
  
  // Prüfe ob Selection Screen vorhanden ist
  const bodyText = await page.locator('body').textContent() || '';
  const hasSelection = bodyText.toLowerCase().includes('sicherheitscode') || 
                       bodyText.toLowerCase().includes('wie möchten') ||
                       bodyText.toLowerCase().includes('code erhalten');
  
  if (!hasSelection) {
    console.log('ℹ️  Kein Selection Screen - nur eine Methode verfügbar');
    return;
  }
  
  console.log(`✅ Selection Screen erkannt - prüfe ${method === 'email' ? 'E-Mail' : 'Phone'}-Option`);
  
  // SCHRITT 1: Prüfe ob die gewünschte Option bereits ausgewählt ist (Radio Button checked)
  const radioSelectors = method === 'email'
    ? [
        'input[type="radio"][value*="email"]',
        'input[type="radio"][value*="mail"]',
      ]
    : [
        'input[type="radio"][value*="sms"]',
        'input[type="radio"][value*="phone"]',
        'input[type="radio"][value*="telefon"]',
      ];
  
  let alreadySelected = false;
  for (const radioSelector of radioSelectors) {
    try {
      const radioButton = page.locator(radioSelector).first();
      if (await radioButton.count() > 0) {
        const isChecked = await radioButton.evaluate((el: any) => el.checked);
        if (isChecked) {
          console.log(`✅ ${method === 'email' ? 'E-Mail' : 'SMS'}-Option ist bereits ausgewählt (checked=true)`);
          alreadySelected = true;
          break;
        }
      }
    } catch (e) {
      // Weiter zur nächsten Prüfung
    }
  }
  
  // WICHTIG: Auch wenn bereits ausgewählt, müssen wir trotzdem auf das Label klicken
  // um sicherzustellen dass das UI vollständig aktualisiert wird
  if (alreadySelected) {
    console.log('ℹ️  Option bereits ausgewählt, aber klicke trotzdem zur Sicherheit...');
  }
  
  // SCHRITT 2: Option ist nicht ausgewählt - jetzt auswählen
  console.log(`🖱️  ${method === 'email' ? 'E-Mail' : 'SMS'}-Option wird ausgewählt...`);
  
  // Selektoren für die Auswahl - die SPEZIFISCHEN Labels für Combined Account Selection
  const selectors = method === 'email' 
    ? [
        'label:has-text("E-Mail mit einem Code erhalten")',
        'label:has-text("E-Mail mit")',
        'input[type="radio"][value*="email"]',
        'label:has-text("per E-Mail")',
        'button:has-text("E-Mail")',
        'a:has-text("E-Mail")',
        '[data-testid*="email"]',
      ]
    : [
        'label:has-text("SMS mit einem Code erhalten")',
        'label:has-text("SMS mit")',
        'input[type="radio"][value*="sms"]',
        'input[type="radio"][value*="phone"]',
        'label:has-text("per SMS")',
        'button:has-text("SMS")',
        'button:has-text("Phone")',
        'a:has-text("SMS")',
        '[data-testid*="sms"]',
        '[data-testid*="phone"]',
      ];
  
  let clicked = false;
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      const count = await element.count();
      
      if (count > 0) {
        console.log(`🔍 ${method === 'email' ? 'E-Mail' : 'SMS'}-Option gefunden: ${selector}`);
        
        // STRATEGIE 1: Normaler Playwright-Click (bevorzugt)
        try {
          await element.click({ timeout: 3000 });
          console.log(`✅ ${method === 'email' ? 'E-Mail' : 'SMS'}-Option geklickt (normaler Click)`);
          clicked = true;
          await page.waitForTimeout(1500);
          
          // Validiere dass der Click funktioniert hat
          for (const radioSelector of radioSelectors) {
            try {
              const radioButton = page.locator(radioSelector).first();
              if (await radioButton.count() > 0) {
                const isChecked = await radioButton.evaluate((el: any) => el.checked);
                if (isChecked) {
                  console.log(`✅ Validierung: Radio-Button ist jetzt checked`);
                  return; // Erfolgreich!
                }
              }
            } catch (e) {
              // Weiter
            }
          }
          
          console.log(`⚠️  Validierung fehlgeschlagen: Radio-Button nicht checked trotz Click`);
          clicked = false; // Weiter versuchen
          
        } catch (normalClickErr) {
          console.log(`⚠️  Normaler Click fehlgeschlagen: ${normalClickErr}`);
          
          // STRATEGIE 2: Click mit force: true
          try {
            await element.click({ force: true, timeout: 3000 });
            console.log(`✅ ${method === 'email' ? 'E-Mail' : 'SMS'}-Option geklickt (force: true)`);
            clicked = true;
            await page.waitForTimeout(1500);
            break;
          } catch (forceClickErr) {
            console.log(`⚠️  Force-Click fehlgeschlagen: ${forceClickErr}`);
            
            // STRATEGIE 3: JavaScript-Click als letzter Ausweg
            try {
              await element.evaluate((el: any) => el.click());
              console.log(`✅ ${method === 'email' ? 'E-Mail' : 'SMS'}-Option geklickt (JavaScript)`);
              clicked = true;
              await page.waitForTimeout(1500);
              break;
            } catch (jsClickErr) {
              console.log(`⚠️  JavaScript-Click fehlgeschlagen: ${jsClickErr}`);
            }
          }
        }
        
        if (clicked) break;
      }
    } catch (e) {
      // Nächsten Selektor versuchen
      continue;
    }
  }
  
  if (!clicked) {
    console.log(`⚠️  ${method === 'email' ? 'E-Mail' : 'SMS'}-Option konnte nicht gefunden oder angeklickt werden - möglicherweise bereits ausgewählt`);
  }
}

/**
 * Login-Challenge Handler (Sicherheitsprüfung bei unbekanntem Gerät)
 * WICHTIG: Dies ist NICHT 2FA, sondern eine Login Challenge die bei unbekanntem Gerät/Inkognito kommt
 * Vollständiger Flow:
 * 1. Screen "Kurze Sicherheitsüberprüfung" erkennen
 * 2. [Optional] Bei Combined Account: Methode auswählen (Email/Phone)
 * 3. Auf "Weiter" klicken → E-Mail/SMS wird versendet
 * 4. 6-stelligen TAN-Code aus E-Mail/SMS auslesen
 * 5. TAN-Code eingeben
 * 6. Wieder "Weiter" klicken
 */
export async function handleLoginChallenge(page: Page, challengeMethod?: 'email' | 'phone'): Promise<boolean> {
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

  // SCHRITT 1.5: Bei Combined Account - Methode auswählen (falls challengeMethod angegeben)
  if (challengeMethod) {
    await selectChallengeMethod(page, challengeMethod);
    
    // WICHTIG: Nach der Auswahl warten, damit das DOM aktualisiert wird
    console.log('⏳ Warte nach Auswahl, damit UI aktualisiert wird...');
    await page.waitForTimeout(2000);
    
    // VALIDIERUNG: Prüfe ob die richtige Option wirklich ausgewählt ist
    console.log('🔍 Validiere ob die Auswahl erfolgreich war...');
    const radioSelectors = challengeMethod === 'email'
      ? ['input[type="radio"][value*="email"]', 'input[type="radio"][value*="mail"]']
      : ['input[type="radio"][value*="sms"]', 'input[type="radio"][value*="phone"]', 'input[type="radio"][value*="telefon"]'];
    
    let selectedCorrectly = false;
    for (const radioSelector of radioSelectors) {
      try {
        const radioButton = page.locator(radioSelector).first();
        if (await radioButton.count() > 0) {
          const isChecked = await radioButton.evaluate((el: any) => el.checked);
          if (isChecked) {
            console.log(`✅ VALIDIERUNG ERFOLGREICH: ${challengeMethod === 'email' ? 'E-Mail' : 'SMS'}-Option ist ausgewählt (checked=true)`);
            selectedCorrectly = true;
            break;
          }
        }
      } catch (e) {
        // Weiter
      }
    }
    
    if (!selectedCorrectly) {
      console.log(`⚠️  WARNUNG: ${challengeMethod === 'email' ? 'E-Mail' : 'SMS'}-Option ist NICHT ausgewählt (checked=false)!`);
    }
    
    // Screenshot vor dem Button-Click
    await page.screenshot({ 
      path: `test-results/screenshots/before-weiter-click-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Screenshot erstellt vor Button-Click');
  }

  // SCHRITT 2: Klicke auf "Weiter" oder "Code senden" um E-Mail/SMS-Versand auszulösen
  console.log('➡️  Suche "Weiter" oder "Code senden"-Button um TAN-Code anzufordern...');
  
  // Debug: Liste ALLE Buttons auf dem Screen
  const allButtonsDebug = await page.locator('button, a[role="button"]').all();
  console.log(`🔍 Alle verfügbaren Buttons auf dem Screen (${allButtonsDebug.length}):`);
  for (let i = 0; i < Math.min(allButtonsDebug.length, 15); i++) {
    const btnText = await allButtonsDebug[i].textContent();
    const btnType = await allButtonsDebug[i].getAttribute('type');
    const isVisible = await allButtonsDebug[i].isVisible();
    console.log(`   ${i + 1}. "${btnText?.trim()}" (type: ${btnType}, visible: ${isVisible})`);
  }
  
  // PRIORISIERE "Code senden"-Buttons (die sind spezifischer für TAN-Versand)
  const submitButtonSelectors = [
    'button:has-text("Code senden")',
    'button:has-text("code senden")',
    'button:has-text("Senden")',
    'button[type="submit"]:has-text("Weiter")',
    'button:has-text("Weiter")',
    '[role="button"]:has-text("Code senden")',
  ];

  let submitButton = null;
  
  for (const selector of submitButtonSelectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    
    if (count > 0) {
      console.log(`🔍 Button gefunden mit Selektor: ${selector}`);
      try {
        // Prüfe ob sichtbar
        if (await locator.isVisible({ timeout: 2000 })) {
          const buttonText = await locator.textContent();
          submitButton = locator;
          console.log(`✅ Sichtbarer Submit-Button gefunden: ${selector} (Text: "${buttonText?.trim()}")`);
          break;
        }
      } catch (e) {
        console.log(`⚠️  Button nicht sichtbar: ${selector}`);
      }
    }
  }
  
  // FALLBACK: Wenn kein spezifischer Button gefunden, suche sichtbaren Button mit "weiter" im Text
  if (!submitButton) {
    console.log('🔍 Kein spezifischer Button gefunden, suche sichtbaren "weiter"-Button...');
    const weiterButtons = await page.locator('button[type="submit"]').all();
    for (const btn of weiterButtons) {
      try {
        if (await btn.isVisible()) {
          const buttonText = (await btn.textContent() || '').toLowerCase();
          if (buttonText.includes('weiter')) {
            submitButton = btn;
            console.log(`✅ Sichtbaren "weiter"-Button gefunden (Text: "${buttonText.trim()}")`);
            break;
          }
        }
      } catch (e) {
        // Weiter
      }
    }
  }
  
  if (submitButton) {
    const urlBeforeClick = page.url();
    console.log(`📍 URL VOR Button-Click: ${urlBeforeClick}`);
    
    try {
      console.log('🖱️  Klicke auf Submit-Button...');
      await submitButton.click({ force: true, timeout: 5000 });
      console.log('✅ Submit-Button geklickt');
    } catch (e) {
      console.log(`⚠️  Click fehlgeschlagen: ${e}`);
      console.log('⌨️  Versuche Enter-Taste...');
      await page.keyboard.press('Enter');
    }
    
    // Warte auf mögliche Navigation
    await page.waitForTimeout(2000);
    
    const urlAfterClick = page.url();
    console.log(`📍 URL NACH Button-Click: ${urlAfterClick}`);
    
    if (urlBeforeClick === urlAfterClick) {
      console.log('✅ URL unverändert - vermutlich auf TAN-Eingabe-Screen geblieben');
    } else {
      console.log('⚠️  URL hat sich geändert!');
    }
    
    // Screenshot NACH dem Click
    await page.screenshot({ 
      path: `test-results/screenshots/after-weiter-click-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Screenshot erstellt nach Button-Click');
    
  } else {
    console.log('⚠️  Kein Submit-Button gefunden, versuche Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
  }

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
  
  // SCHRITT 7: Phone-Hinterlegungs-Screen überspringen (falls vorhanden)
  await page.waitForTimeout(3000);
  
  console.log('🔍 Analysiere Seite nach Login-Challenge...');
  const postChallengeUrl = page.url();
  const postChallengeTitle = await page.title();
  console.log(`📍 Aktuelle URL: ${postChallengeUrl}`);
  console.log(`📄 Seitentitel: ${postChallengeTitle}`);
  
  // Debug: Zeige Seiteninhalt
  const bodyText = await page.locator('body').textContent();
  console.log(`📄 Seiteninhalt (erste 300 Zeichen): ${bodyText?.substring(0, 300)}...`);
  
  // Debug: Liste alle Buttons auf
  const allButtons = await page.locator('button, a[role="button"]').all();
  console.log(`🔘 Gefundene Buttons (${allButtons.length}):`);
  for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
    const btnText = await allButtons[i].textContent();
    const btnType = await allButtons[i].getAttribute('type');
    console.log(`   ${i + 1}. "${btnText?.trim()}" (type: ${btnType})`);
  }
  
  // Prüfe auf Phone-Screen (case-insensitive)
  const phoneScreenPatterns = [
    /telefonnummer/i,
    /handynummer/i,
    /mobilnummer/i,
    /später.*erinnern/i,
    /jetzt.*nicht/i,
    /überspringen/i,
  ];
  
  let phoneScreenFound = false;
  for (const pattern of phoneScreenPatterns) {
    if (bodyText && pattern.test(bodyText)) {
      console.log(`✅ Phone-Screen erkannt: Pattern matched "${pattern}"`);
      phoneScreenFound = true;
      break;
    }
  }
  
  if (phoneScreenFound) {
    console.log('➡️  Suche "später erinnern" oder ähnlichen Button...');
    
    // Screenshot vor dem Klick
    await page.screenshot({ 
      path: `test-results/screenshots/phone-screen-${Date.now()}.png`,
      fullPage: true 
    });
    
    // Erweiterte Button-Selektoren (case-insensitive)
    const laterButtonSelectors = [
      'button:has-text("später")',
      'a:has-text("später")',
      'button:has-text("Später")',
      'a:has-text("Später")',
      'button:has-text("erinnern")',
      'button:has-text("Jetzt nicht")',
      'button:has-text("jetzt nicht")',
      'button:has-text("Nein")',
      'button:has-text("Skip")',
      'button:has-text("Überspringen")',
      '[data-testid*="skip"]',
      '[data-testid*="later"]',
      '[data-test*="skip"]',
      '[class*="skip"]',
      '[class*="later"]',
    ];
    
    let laterClicked = false;
    for (const selector of laterButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        const count = await button.count();
        
        if (count > 0) {
          console.log(`🔍 Button gefunden mit Selektor: ${selector}`);
          const btnText = await button.textContent();
          console.log(`   Button-Text: "${btnText?.trim()}"`);
          
          // Versuche mit force: true zu klicken
          try {
            await button.click({ force: true, timeout: 5000 });
            console.log(`✅ Button geklickt (${selector})`);
            laterClicked = true;
            await page.waitForTimeout(2000);
            break;
          } catch (clickErr) {
            // Fallback: JavaScript-Klick
            console.log('⚠️  Normaler Klick fehlgeschlagen, versuche JavaScript...');
            await button.evaluate((btn: any) => btn.click());
            console.log(`✅ Button geklickt via JavaScript (${selector})`);
            laterClicked = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (e) {
        // Nächsten Selektor versuchen
        continue;
      }
    }
    
    if (!laterClicked) {
      console.log('⚠️  WARNUNG: "später erinnern" Button konnte nicht geklickt werden');
      console.log('   Seiten-URL:', postChallengeUrl);
      console.log('   Verfügbare Buttons wurden oben gelistet');
      
      // Screenshot nach Fehler
      await page.screenshot({ 
        path: `test-results/screenshots/phone-screen-error-${Date.now()}.png`,
        fullPage: true 
      });
    } else {
      console.log('✅ Phone-Screen übersprungen');
      
      // Warte auf Navigation
      await page.waitForTimeout(2000);
      const newUrl = page.url();
      console.log(`📍 Neue URL nach Skip: ${newUrl}`);
    }
  } else {
    console.log('ℹ️  Kein Phone-Screen erkannt - überspringe');
  }
  
  return true;
}
