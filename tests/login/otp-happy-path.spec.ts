import { test, expect } from '../fixtures/test-hooks';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl } from '../helpers/environment';
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CHECK24 Login - OTP Happy Path Tests
 * 
 * Testet den Login-Flow mit OTP (One-Time-Password / Einmalcode)
 * Flow: E-Mail → Weiter → "Mit Einmalcode anmelden" → TAN aus E-Mail → Anmelden
 */

/**
 * Helper-Funktion: Startet OTP-Login (E-Mail + "Mit Einmalcode anmelden")
 * Geht nur bis zum "mit Einmalcode anmelden" Klick
 */
async function startOtpLogin(page: any, email: string) {
  // Zur Login-Seite navigieren
  const loginUrl = getLoginUrl();
  await page.goto(loginUrl);
  await page.waitForLoadState('networkidle');
  
  await takeAutoScreenshot(page, 'login-screen-empty');

  // SCHRITT 1: E-Mail eingeben
  const emailInput = page.locator('#cl_login');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
  await page.waitForTimeout(300);
  await emailInput.fill(email);
  await page.waitForTimeout(500);
  
  await takeAutoScreenshot(page, 'email-entered');

  // Klick auf "Weiter"-Button
  const weiterButton = page.locator('#c24-uli-login-btn');
  console.log('➡️  Klicke auf "Weiter"-Button...');
  await page.waitForTimeout(300);
  await weiterButton.click({ force: true });
  console.log('✅ "Weiter" wurde geklickt');
  await page.waitForTimeout(800);
  
  await takeAutoScreenshot(page, 'otp-option-visible');

  // SCHRITT 2: Auf "mit Einmalcode anmelden" klicken
  console.log('🔑 SCHRITT 2: Suche "mit Einmalcode anmelden"...');
  
  const otpElement = page.locator('.c24-uli-trigger-otp-button');
  await otpElement.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('✅ "mit Einmalcode anmelden" Element gefunden');
  
  await otpElement.click();
  console.log('✅ "mit Einmalcode anmelden" wurde geklickt');
  await page.waitForTimeout(1500);
  
  await takeAutoScreenshot(page, 'otp-screen-before-code-send');
}

/**
 * Helper-Funktion: Klickt auf "Code senden" Button
 */
async function clickCodeSenden(page: any, hasSelection: boolean = false) {
  console.log('📧 Suche "Code senden" Button...');
  
  // Es gibt zwei verschiedene "Code senden" Buttons:
  // 1. #c24-uli-lptan-send-btn - für EMAIL_ONLY Account (kein Selection Screen)
  // 2. #c24-uli-pwr-choose-btn - für Combined Account (nach Selection Screen)
  
  let codeSendenButton;
  if (hasSelection) {
    // Combined Account mit Selection Screen
    codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
    console.log('✅ "Code senden" Button (Selection Screen: #c24-uli-pwr-choose-btn)');
  } else {
    // EMAIL_ONLY Account ohne Selection
    codeSendenButton = page.locator('#c24-uli-lptan-send-btn');
    console.log('✅ "Code senden" Button (Normal: #c24-uli-lptan-send-btn)');
  }
  
  await codeSendenButton.waitFor({ state: 'attached', timeout: 10000 });
  await codeSendenButton.click({ force: true });
  console.log('✅ "Code senden" wurde geklickt - Code wird versendet');
  await page.waitForTimeout(2000);
  
  await takeAutoScreenshot(page, 'otp-input-screen');
}

/**
 * Helper-Funktion: Wartet auf OTP-Code per E-Mail und gibt ihn ein
 */
async function enterOtpCode(page: any) {
  console.log('📧 Warte auf OTP-Code per E-Mail...');
  
  const emailClient = getEmailClient();
  
  // Warte auf E-Mail mit OTP-Code
  let otpEmail;
  try {
    otpEmail = await emailClient.waitForEmail(
      {
        subject: 'CHECK24', // Anpassen falls nötig
      },
      120000, // 2 Minuten Timeout
      3000    // Alle 3 Sekunden prüfen
    );
  } catch (error) {
    await sendEmailTimeoutWarning(
      'OTP Login - OTP-Code',
      'subject: CHECK24',
      120
    );
    throw error;
  }

  if (!otpEmail) {
    throw new Error('OTP-Code E-Mail nicht erhalten (Timeout nach 2 Minuten)');
  }

  // TAN-Code aus E-Mail extrahieren
  const otpCode = emailClient.extractTanCode(otpEmail);
  if (!otpCode) {
    throw new Error('OTP-Code konnte nicht aus E-Mail extrahiert werden');
  }

  console.log(`🔑 OTP-Code erhalten: ${otpCode}`);

  // OTP-Code in Eingabefeld eintragen
  console.log('🔍 Suche OTP-Eingabefeld...');
  
  const otpInput = page.locator('.c24-uli-input-splitted').first();
  await otpInput.waitFor({ state: 'attached', timeout: 10000 });
  console.log('✅ OTP-Eingabefeld gefunden');
  
  await page.waitForTimeout(500);
  await otpInput.fill(otpCode, { force: true });
  console.log('✅ OTP-Code eingegeben');
  await page.waitForTimeout(500);
  
  await takeAutoScreenshot(page, 'otp-entered');

  return otpCode;
}

/**
 * Helper-Funktion: Submit OTP Login (Enter drücken oder Button klicken)
 */
async function submitOtpLogin(page: any) {
  console.log('➡️  Schließe OTP-Login ab...');

  const otpInputSelectors = [
    '.c24-uli-input-splitted',
    'input[inputmode="numeric"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="text"]',
  ];

  // Bevorzugt: Enter direkt auf einem sichtbaren OTP-Feld.
  for (const selector of otpInputSelectors) {
    const inputs = await page.locator(selector).all();
    for (const input of inputs) {
      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      try {
        await input.press('Enter');
        console.log(`✅ Enter gedrückt im OTP-Feld (${selector})`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
        if (await hasReachedPostOtpState(page)) {
          return;
        }
      } catch (error) {
        console.log(`⚠️  Enter auf ${selector} fehlgeschlagen`);
      }
    }
  }

  // Fallback: Suche einen passenden Submit-Button auf dem OTP-Screen.
  console.log('🔍 Suche Submit-Button...');
  const submitButtonSelectors = [
    '#c24-uli-lptan-btn',
    'button[type="submit"]',
    'button:has-text("Anmelden")',
    'button:has-text("Bestätigen")',
    'button:has-text("Weiter")',
    '[role="button"]:has-text("Anmelden")',
    '[role="button"]:has-text("Bestätigen")',
    '[role="button"]:has-text("Weiter")',
  ];

  for (const selector of submitButtonSelectors) {
    const button = page.locator(selector).first();
    const exists = (await button.count()) > 0;

    if (!exists) {
      continue;
    }

    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    try {
      const buttonText = (await button.textContent().catch(() => ''))?.trim() || selector;
      await button.click({ force: true, timeout: 5000 });
      console.log(`✅ Submit-Button geklickt: ${buttonText}`);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      if (await hasReachedPostOtpState(page)) {
        return;
      }
    } catch (error) {
      console.log(`⚠️  Submit-Button fehlgeschlagen: ${selector}`);
    }
  }

  throw new Error('Kein passender OTP-Submit-Button gefunden');
}

async function isPhoneCollectorVisible(page: any) {
  const laterButton = page.locator('a[data-tid="later-button"], [data-tid="later-button"]').first();
  if (await laterButton.isVisible().catch(() => false)) {
    return true;
  }

  const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
  const bodyLower = bodyText.toLowerCase();
  return bodyLower.includes('telefonnummer') ||
    bodyLower.includes('handynummer') ||
    bodyLower.includes('mobilnummer') ||
    bodyLower.includes('später erinnern');
}

async function hasReachedPostOtpState(page: any) {
  if (isKundenbereichUrl(page.url())) {
    return true;
  }

  if (await isPhoneCollectorVisible(page)) {
    console.log('✅ Phone-Collector nach OTP erkannt');
    return true;
  }

  return false;
}

/**
 * Helper-Funktion: Wartet robust auf die Weiterleitung in den Kundenbereich
 * und bricht explizit ab, falls der Redirect ausbleibt.
 */
function isKundenbereichUrl(urlValue: string) {
  try {
    const { hostname } = new URL(urlValue);
    return hostname === 'kundenbereich.check24.de' || hostname === 'kundenbereich.check24-test.de';
  } catch {
    return false;
  }
}

async function waitForKundenbereichRedirect(page: any, timeout: number = 15000) {
  console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');

  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    console.log('ℹ️  networkidle nicht erreicht - prüfe Redirect trotzdem weiter');
  });

  try {
    await page.waitForURL((url: URL) => isKundenbereichUrl(url.toString()), { timeout });
    console.log(`✅ Zum Kundenbereich weitergeleitet: ${page.url()}`);
  } catch (error) {
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unbekannt');
    throw new Error(
      `Keine Weiterleitung zum Kundenbereich innerhalb von ${timeout}ms. Aktuelle URL: ${currentUrl}. Seitentitel: ${pageTitle}`
    );
  }
}

test.describe('CHECK24 Login - OTP Happy Path', () => {
  
  test('Erfolgreicher OTP-Login - Account mit nur E-Mail', async ({ page }) => {
    enableAutoScreenshots('login-otp');
    
    try {
      // Account mit nur E-Mail-Adresse verwenden
      const credentials = getAccountCredentials('EMAIL_ONLY');
      console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

      // OTP-Login starten (E-Mail + "Mit Einmalcode anmelden")
      await startOtpLogin(page, credentials.email);

    // "Code senden" klicken (EMAIL_ONLY hat keinen Selection Screen)
    await clickCodeSenden(page, false);

    // OTP-Code aus E-Mail holen und eingeben
    await enterOtpCode(page);

    // Anmelden
    await submitOtpLogin(page);

    // Warte auf mögliche Weiterleitung oder Phone Collector Screen
    await page.waitForTimeout(2000);

    // Phone-Screen überspringen falls vorhanden (analog zu password-happy-path / auth.ts)
    console.log('🔍 Prüfe auf Phone-Screen (Phone Collector)...');
    const hasPhoneCollector = await isPhoneCollectorVisible(page);

    if (hasPhoneCollector) {
      console.log('📱 Phone-Screen erkannt - klicke "später erinnern"...');
      await page.waitForTimeout(500);

      // Zuerst spezifische ID (Stelle 7), dann Fallbacks wie in password-happy-path/auth.ts
      const laterButtonSelectors = [
        'a[data-tid="later-button"]',
        '[data-tid="later-button"]',
        'a:has-text("später")',
        'button:has-text("später")',
        'a:has-text("Später")',
        'button:has-text("Später")',
        '[class*="later"]',
        '[class*="skip"]',
      ];

      let laterClicked = false;
      for (const selector of laterButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if ((await button.count()) === 0) continue;
          // Bei data-tid nicht nach Text filtern; bei Klassen/Text-Selektoren nur Elemente mit passendem Text
          if (!selector.includes('data-tid')) {
            const text = await button.textContent().catch(() => '') || '';
            if (text && !/später|skip|erinnern/i.test(text)) continue;
          }
          console.log(`🔍 "später erinnern" gefunden mit: ${selector}`);
          try {
            await button.waitFor({ state: 'attached', timeout: 3000 });
            await button.click({ force: true, timeout: 3000 });
            console.log('✅ "später erinnern" geklickt');
            laterClicked = true;
            await page.waitForTimeout(2000);
            break;
          } catch (e) {
            try {
              await button.evaluate((btn: any) => btn.click());
              console.log('✅ "später erinnern" geklickt via JavaScript');
              laterClicked = true;
              await page.waitForTimeout(2000);
              break;
            } catch (jsErr) {
              continue;
            }
          }
        } catch (e) {
          continue;
        }
      }
      if (!laterClicked) {
        console.log('⚠️  "später erinnern" Button nicht gefunden - fahre trotzdem fort');
      }
    } else {
      console.log('ℹ️  Kein Phone-Screen erkannt');
    }

      await waitForKundenbereichRedirect(page);

      // Login-Erfolg verifizieren (c24session Cookie prüfen)
      await expectLoginSuccess(page);

      console.log(`✅ OTP-Login vollständig erfolgreich für: ${credentials.email}`);
      
      // Test erfolgreich - Screenshots übernehmen
      commitScreenshots();

      // Logout
      await logout(page);
    } finally {
      disableAutoScreenshots();
    }
  });

  test('Erfolgreicher OTP-Login - Combined Account (TAN per E-Mail)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // OTP-Login starten
      await startOtpLogin(page, credentials.email);

      // Prüfe auf OTP Selection Screen (E-Mail vs. SMS Auswahl)
      console.log('🔍 Prüfe auf OTP Selection Screen...');
      await page.waitForTimeout(500);
      
      // Prüfe auf E-Mail Radio Button (OTP-spezifisch)
      const emailRadio = page.locator('#c24-uli-choose-email');
      const hasEmailOption = await emailRadio.count() > 0;

      if (hasEmailOption) {
        console.log('✅ OTP Selection Screen erkannt - wähle E-Mail...');
        
        // E-Mail Radio Button auswählen
        try {
          await emailRadio.click({ timeout: 1500 });
          console.log('✅ E-Mail Radio Button geklickt (normal)');
        } catch (e) {
          try {
            await emailRadio.click({ force: true });
            console.log('✅ E-Mail Radio Button geklickt (force)');
          } catch (e2) {
            // Fallback: Klicke auf das Label
            const emailLabel = page.locator('label[for="c24-uli-choose-email"]');
            await emailLabel.click({ force: true });
            console.log('✅ E-Mail Label geklickt (force)');
          }
        }
        
        await page.waitForTimeout(300);
        
        // Verifiziere dass E-Mail ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
      }

      // "Code senden" klicken (Combined Account hat Selection Screen)
      await clickCodeSenden(page, true);

      // OTP-Code aus E-Mail holen und eingeben
      const otpCode = await enterOtpCode(page);

      // Auto-Submit: Nach Code-Eingabe erfolgt automatische Weiterleitung (wie bei SMS)
      console.log('⏳ Warte auf Auto-Submit und Navigation...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      await waitForKundenbereichRedirect(page);

      // Login-Erfolg verifizieren (Combined Account hat keinen Phone Collector)
      await expectLoginSuccess(page);

      console.log(`✅ OTP-Login vollständig erfolgreich für Combined Account (E-Mail): ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher OTP-Login - Combined Account (TAN per SMS)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // OTP-Login starten
      await startOtpLogin(page, credentials.email);

      // Prüfe auf Selection Screen (E-Mail vs. SMS Auswahl)
      console.log('🔍 Prüfe auf OTP Selection Screen...');
      await page.waitForTimeout(500);
      
      // Prüfe auf SMS Radio Button (OTP-spezifisch)
      const smsRadio = page.locator('#c24-uli-choose-sms');
      const hasSmsOption = await smsRadio.count() > 0;

      if (hasSmsOption) {
        console.log('✅ OTP Selection Screen erkannt - wähle SMS...');
        
        // SMS Radio Button auswählen
        try {
          await smsRadio.click({ timeout: 1500 });
          console.log('✅ SMS Radio Button geklickt (normal)');
        } catch (e) {
          try {
            await smsRadio.click({ force: true });
            console.log('✅ SMS Radio Button geklickt (force)');
          } catch (e2) {
            // Fallback: Klicke auf das Label
            const smsLabel = page.locator('label[for="c24-uli-choose-sms"]');
            await smsLabel.click({ force: true });
            console.log('✅ SMS Label geklickt (force)');
          }
        }
        
        await page.waitForTimeout(300);
        
        // Verifiziere dass SMS ausgewählt ist
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
      } else {
        console.log('⚠️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
      }

      // "Code senden" klicken - SMS wird versendet (Combined Account hat Selection Screen)
      await clickCodeSenden(page, true);

      // SMS-Code aus weitergeleiteter E-Mail holen (iPhone-Weiterleitung)
      console.log('📱 Warte auf weitergeleitete SMS per E-Mail vom iPhone...');
      const emailClient = getEmailClient();
      
      let smsEmail;
      try {
        smsEmail = await emailClient.waitForEmail(
          {
            from: 'ulitesting@icloud.com', // iPhone-Weiterleitung
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'OTP Login SMS - TAN-Code',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }

      if (!smsEmail) {
        throw new Error('SMS-Weiterleitungs-E-Mail vom iPhone nicht erhalten');
      }

      const smsCode = emailClient.extractTanCode(smsEmail);
      if (!smsCode) {
        throw new Error('SMS-Code konnte nicht extrahiert werden');
      }

      console.log(`🔑 SMS-Code erhalten: ${smsCode}`);

      // SMS-Code eingeben
      console.log('🔍 Suche SMS-Eingabefeld...');
      
      const smsInput = page.locator('.c24-uli-input-splitted').first();
      await smsInput.waitFor({ state: 'attached', timeout: 10000 });
      console.log('✅ SMS-Eingabefeld gefunden');

      await page.waitForTimeout(500);
      await smsInput.fill(smsCode, { force: true });
      console.log('✅ SMS-Code eingegeben');
      
      // Submit OTP Login (Enter drücken oder Button klicken)
      await submitOtpLogin(page);
      
      await waitForKundenbereichRedirect(page);
      console.log(`📍 Finale URL nach SMS-Login: ${page.url()}`);
      console.log(`📄 Seitentitel: ${await page.title()}`);

      // Login-Erfolg verifizieren (Combined Account hat keinen Phone Collector)
      await expectLoginSuccess(page);

      console.log(`✅ OTP-Login vollständig erfolgreich für Combined Account (SMS): ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });
  
});
