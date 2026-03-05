import { test, expect } from '../fixtures/test-hooks';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl } from '../helpers/environment';
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

  // SCHRITT 1: E-Mail eingeben
  const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
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

  // SCHRITT 2: Auf "mit Einmalcode anmelden" klicken
  console.log('🔑 SCHRITT 2: Suche "mit Einmalcode anmelden"...');
  
  // Der Text ist in einem SPAN-Element - verwende getByText
  const otpElement = page.getByText('mit Einmalcode anmelden', { exact: true });
  await otpElement.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('✅ "mit Einmalcode anmelden" Element gefunden');
  
  await otpElement.click();
  console.log('✅ "mit Einmalcode anmelden" wurde geklickt');
  await page.waitForTimeout(1500);
}

/**
 * Helper-Funktion: Klickt auf "Code senden" Button
 */
async function clickCodeSenden(page: any) {
  console.log('📧 Suche "Code senden" Button...');
  
  // Es gibt mehrere "Code senden" Buttons - verwende getByRole und filtere nach sichtbarem
  const codeSendenButton = page.getByRole('button', { name: 'Code senden' });
  await codeSendenButton.first().waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('✅ "Code senden" Button gefunden');
  
  await codeSendenButton.first().click();
  console.log('✅ "Code senden" wurde geklickt - Code wird versendet');
  await page.waitForTimeout(2000);
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

  // OTP-Code in Eingabefeld eintragen - suche sichtbares Feld
  console.log('🔍 Suche OTP-Eingabefeld...');
  
  const otpInputSelectors = [
    'input[id*="tan"]',
    'input[id*="code"]',
    'input[name*="tan"]',
    'input[placeholder*="Code"]',
    'input[type="tel"]:not([name*="phone"])',
    'input[type="text"]',
  ];

  let otpInput = null;
  for (const selector of otpInputSelectors) {
    try {
      const inputs = await page.locator(selector).all();
      for (const input of inputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          otpInput = input;
          console.log(`✅ OTP-Eingabefeld gefunden mit ${selector}`);
          break;
        }
      }
      if (otpInput) break;
    } catch (e) {
      continue;
    }
  }

  if (!otpInput) {
    throw new Error('OTP-Eingabefeld nicht gefunden');
  }
  
  await page.waitForTimeout(500);
  await otpInput.fill(otpCode);
  console.log('✅ OTP-Code eingegeben');
  await page.waitForTimeout(500);

  return otpCode;
}

/**
 * Helper-Funktion: Submit OTP Login (Enter drücken oder Button klicken)
 */
async function submitOtpLogin(page: any) {
  console.log('➡️  Schließe OTP-Login ab...');
  
  // Einfachster Weg: Enter drücken im Input-Feld
  try {
    const otpInputs = await page.locator('input[type="text"], input[type="tel"]').all();
    for (const input of otpInputs) {
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) {
        await input.press('Enter');
        console.log('✅ Enter gedrückt im OTP-Feld');
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        return;
      }
    }
  } catch (e) {
    console.log('⚠️  Enter-Taste fehlgeschlagen, suche Submit-Button...');
  }

  // Fallback: Suche Submit-Button
  console.log('🔍 Durchsuche Seite nach sichtbaren Buttons...');
  const allButtons = await page.locator('button').all();
  console.log(`   Gefunden: ${allButtons.length} Buttons insgesamt`);
  
  const submitSelectors = [
    'button:has-text("anmelden")',
    'button:has-text("Anmelden")',
    'button:has-text("weiter")',
    'button:has-text("Weiter")',
    'button[type="submit"]',
  ];

  let submitButton = null;
  for (const selector of submitSelectors) {
    const buttons = await page.locator(selector).all();
    console.log(`   ${selector}: ${buttons.length} gefunden`);
    for (const button of buttons) {
      const visible = await button.isVisible().catch(() => false);
      if (visible) {
        const text = await button.textContent().catch(() => '');
        submitButton = button;
        console.log(`✅ Submit-Button gefunden: ${selector} (Text: "${text?.trim()}")`);
        break;
      }
    }
    if (submitButton) break;
  }

  if (!submitButton) {
    // Letzter Versuch: Liste alle sichtbaren Buttons
    console.log('⚠️  Kein spezifischer Button gefunden. Alle sichtbaren Buttons:');
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const btn = allButtons[i];
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        const text = await btn.textContent().catch(() => '');
        const id = await btn.getAttribute('id').catch(() => '');
        console.log(`   ${i+1}. id="${id}", text="${text?.trim()}"`);
      }
    }
    throw new Error('Submit-Button nicht gefunden');
  }

  await submitButton.click();
  console.log('✅ Submit-Button geklickt');
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

test.describe('CHECK24 Login - OTP Happy Path', () => {
  
  test('Erfolgreicher OTP-Login - Account mit nur E-Mail', async ({ page }) => {
    // Account mit nur E-Mail-Adresse verwenden
    const credentials = getAccountCredentials('EMAIL_ONLY');
    console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

    // OTP-Login starten (E-Mail + "Mit Einmalcode anmelden")
    await startOtpLogin(page, credentials.email);

    // "Code senden" klicken
    await clickCodeSenden(page);

    // OTP-Code aus E-Mail holen und eingeben
    await enterOtpCode(page);

    // Anmelden
    await submitOtpLogin(page);

    // Warte auf mögliche Weiterleitung oder Phone Collector Screen
    await page.waitForTimeout(2000);

    // Phone-Screen überspringen falls vorhanden (analog zu password-happy-path)
    console.log('🔍 Prüfe auf Phone-Screen (Phone Collector)...');
    const bodyText = await page.locator('body').textContent() || '';
    
    if (bodyText.toLowerCase().includes('telefonnummer')) {
      console.log('📱 Phone-Screen erkannt - klicke "später erinnern"...');
      
      const laterButtonSelectors = [
        'button:has-text("später")',
        'a:has-text("später")',
        'button:has-text("Später")',
        'a:has-text("Später")',
        '[class*="skip"]',
      ];
      
      let laterClicked = false;
      for (const selector of laterButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            await button.click({ force: true, timeout: 3000 });
            console.log(`✅ "später erinnern" geklickt (${selector})`);
            laterClicked = true;
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // Versuche JavaScript
          try {
            const button = page.locator(selector).first();
            if (await button.count() > 0) {
              await button.evaluate((btn: any) => btn.click());
              console.log(`✅ "später erinnern" geklickt via JavaScript (${selector})`);
              laterClicked = true;
              await page.waitForTimeout(2000);
              break;
            }
          } catch (jsErr) {
            continue;
          }
        }
      }
      
      if (!laterClicked) {
        console.log('⚠️  "später erinnern" Button nicht gefunden - fahre trotzdem fort');
      }
    } else {
      console.log('ℹ️  Kein Phone-Screen erkannt');
    }

    // Warte auf Weiterleitung zum Kundenbereich
    console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
    
    try {
      await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 3000 });
      console.log('✅ Zum Kundenbereich weitergeleitet');
    } catch (e) {
      console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
      await page.waitForTimeout(1000);
    }

    // Login-Erfolg verifizieren (c24session Cookie prüfen)
    await expectLoginSuccess(page);

    console.log(`✅ OTP-Login vollständig erfolgreich für: ${credentials.email}`);

    // Logout
    await logout(page);
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

      // "Code senden" klicken
      await clickCodeSenden(page);

      // OTP-Code aus E-Mail holen und eingeben
      const otpCode = await enterOtpCode(page);

      // Auto-Submit: Nach Code-Eingabe erfolgt automatische Weiterleitung (wie bei SMS)
      console.log('⏳ Warte auf Auto-Submit und Navigation...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      // Warte auf Weiterleitung zum Kundenbereich
      console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(1000);
      }

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

      // "Code senden" klicken - SMS wird versendet
      await clickCodeSenden(page);

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

      // SMS-Code eingeben - verwende die gleiche Logik wie enterOtpCode
      console.log('🔍 Suche SMS-Eingabefeld...');
      
      let smsInput = null;
      const smsInputs = await page.locator('input[type="tel"], input[type="text"], input[id*="tan"]').all();
      for (const input of smsInputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          smsInput = input;
          console.log('✅ SMS-Eingabefeld gefunden');
          break;
        }
      }

      if (!smsInput) {
        throw new Error('SMS-Eingabefeld nicht gefunden');
      }

      await page.waitForTimeout(500);
      await smsInput.fill(smsCode);
      console.log('✅ SMS-Code eingegeben');
      
      // Auto-Submit: Nach SMS-Code-Eingabe erfolgt automatische Weiterleitung
      console.log('⏳ Warte auf Auto-Submit und Navigation...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      // Warte auf Weiterleitung zum Kundenbereich
      console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
      
      // Warte explizit auf kundenbereich URL
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(1000);
      }
      
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
