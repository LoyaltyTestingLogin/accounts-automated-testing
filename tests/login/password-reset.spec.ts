import { test, expect } from '../fixtures/test-hooks';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl } from '../helpers/environment';
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';
import { COOKIE_GEHT_KLAR_SELECTOR, COOKIE_AFTER_CLICK_MS } from '../helpers/cookie-consent';
import dotenv from 'dotenv';

dotenv.config();

test.describe('CHECK24 Login - Passwort Reset', () => {

  test('Erfolgreicher Passwort-Reset - Account mit nur E-Mail', async ({ browser }) => {
    enableAutoScreenshots('login-password-reset');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit nur E-Mail verwenden
      const credentials = getAccountCredentials('EMAIL_ONLY');
      console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');
      
      await takeAutoScreenshot(page, 'login-screen-empty');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      await takeAutoScreenshot(page, 'email-entered');

      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      await page.waitForTimeout(400);
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(600);

      // SCHRITT 3: "Code senden" klicken (Email-Only Account – kein Selection Screen, andere Button-ID)
      console.log('📧 SCHRITT 3: Klicke "Code senden"...');
      const codeSendenButton = page.locator('#c24-uli-pwr-email-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');
      await page.waitForTimeout(150);

      // E-Mail Client initialisieren (wird für mehrere Schritte benötigt)
      const emailClient = getEmailClient();

      // SCHRITT 4: TAN-Code aus E-Mail holen
      console.log('📧 SCHRITT 4: Warte auf TAN-Code per E-Mail...');
      
      let email;
      try {
        email = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset Email-Only - TAN-Code',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      // TAN-Code extrahieren
      console.log('🔍 Extrahiere TAN-Code aus E-Mail...');
      console.log(`   Betreff: ${email!.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email!.body.substring(0, 200)}`);

      // TAN aus Betreff extrahieren (z.B. "123456 ist Ihr CHECK24 Sicherheitscode")
      let tanCode: string | null = null;
      const subjectMatch = email!.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = email!.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
          console.log(`✅ TAN-Code extrahiert aus Body: ${tanCode}`);
        }
      }

      if (!tanCode) {
        throw new Error('Konnte TAN-Code nicht aus E-Mail extrahieren');
      }

      console.log(`🔑 TAN-Code erhalten: ${tanCode}`);

      // SCHRITT 5: TAN-Code eingeben
      console.log('🔍 SCHRITT 5: Suche TAN-Eingabefeld...');
      
      const tanInputSelectors = [
        'input[id*="tan"]',
        'input[id*="code"]',
        'input[name*="tan"]',
        'input[placeholder*="Code"]',
        'input[type="tel"]:not([name*="phone"])',
        'input[type="text"]',
      ];

      let tanInput = null;
      for (const selector of tanInputSelectors) {
        try {
          const inputs = await page.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              tanInput = input;
              console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
              break;
            }
          }
          if (tanInput) break;
        } catch (e) {
          continue;
        }
      }

      if (!tanInput) {
        throw new Error('Konnte TAN-Eingabefeld nicht finden');
      }

      // TAN-Code komplett eingeben (6-stellig)
      await page.waitForTimeout(200);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');
      await page.waitForTimeout(600);

      // SCHRITT 6: Warte auf Navigation / Screen-Update
      console.log('⏳ SCHRITT 6: Warte auf Screen-Update...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(400);

      // SCHRITT 7: "Passwort ändern" Link klicken
      console.log('🔐 SCHRITT 7: Klicke "Passwort ändern"...');
      const passwortAendernLink = page.locator('a.c24-uli-pwr-pw-link').first();
      await passwortAendernLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwortAendernLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 8: Neues Passwort eingeben
      console.log('🔐 SCHRITT 8: Gebe neues Passwort ein...');
      
      // Finde nur sichtbare Passwort-Felder
      const allPasswordFields = await page.locator('input[type="password"]').all();
      const visiblePasswordFields = [];
      
      for (const field of allPasswordFields) {
        const isVisible = await field.isVisible().catch(() => false);
        if (isVisible) {
          visiblePasswordFields.push(field);
        }
      }
      
      console.log(`   Sichtbare Passwort-Felder: ${visiblePasswordFields.length}`);

      if (visiblePasswordFields.length < 2) {
        throw new Error(`Erwarte mindestens 2 sichtbare Passwort-Felder, gefunden: ${visiblePasswordFields.length}`);
      }

      // Neues Passwort: 1qay1qay (gleich wie vorher)
      const newPassword = '1qay1qay';
      
      // Erstes Passwort-Feld
      await visiblePasswordFields[0].fill(newPassword);
      console.log('✅ Passwort in erstes Feld eingegeben');
      await page.waitForTimeout(150);

      // Zweites Passwort-Feld (Bestätigung)
      await visiblePasswordFields[1].fill(newPassword);
      console.log('✅ Passwort in zweites Feld eingegeben (Bestätigung)');
      await page.waitForTimeout(200);

      // SCHRITT 9: "Speichern und weiter" klicken
      console.log('💾 SCHRITT 9: Klicke "Speichern und weiter"...');
      const speichernButton = page.locator('#c24-uli-pwr-pw-btn');
      await speichernButton.waitFor({ state: 'visible', timeout: 10000 });
      await speichernButton.click();
      console.log('✅ "Speichern und weiter" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 10: Prüfe auf Bestätigungsmail für Passwort-Änderung
      console.log('📧 SCHRITT 10: Prüfe auf Bestätigungsmail für Passwort-Änderung...');
      
      try {
        const confirmationEmail = await emailClient.waitForEmail(
          {
            subject: 'Ihr CHECK24 Passwort wurde geändert',
          },
          30000,
          2000
        );
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail!.subject}"`);
      } catch (e) {
        console.warn('⚠️  Bestätigungsmail nicht innerhalb von 30 Sekunden erhalten - fahre trotzdem fort');
        await sendEmailTimeoutWarning(
          'Passwort-Reset Email-Only - Bestätigungsmail',
          'subject: Ihr CHECK24 Passwort wurde geändert',
          30
        );
      }

      // SCHRITT 11: Phone Collector überspringen (nur bei Email-Only Account)
      console.log('🔍 SCHRITT 11: Prüfe auf Phone-Screen (Phone Collector)...');
      await page.waitForTimeout(400);
      
      const bodyText = await page.locator('body').textContent() || '';
      const hasPhoneCollector = bodyText.toLowerCase().includes('telefonnummer');

      if (hasPhoneCollector) {
        console.log('📱 Phone-Screen erkannt - klicke "später erinnern"...');
        await page.waitForTimeout(200);

        // Wie in otp-happy-path: data-tid zuerst, dann Fallbacks (bis zu 2 Klicks für Overlay + Screen)
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

        let clickCount = 0;
        for (let attempt = 0; attempt < 2; attempt++) {
          let laterClicked = false;
          for (const selector of laterButtonSelectors) {
            try {
              const button = page.locator(selector).first();
              if ((await button.count()) === 0) continue;
              if (!selector.includes('data-tid')) {
                const text = await button.textContent().catch(() => '') || '';
                if (text && !/später|skip|erinnern/i.test(text)) continue;
              }
              console.log(`   Klicke "später erinnern" (Versuch ${attempt + 1}) mit: ${selector}`);
              await button.waitFor({ state: 'attached', timeout: 3000 });
              await button.click({ force: true, timeout: 3000 });
              console.log('✅ "später erinnern" geklickt');
              laterClicked = true;
              clickCount++;
              await page.waitForTimeout(150);
              break;
            } catch (e) {
              try {
                const button = page.locator(selector).first();
                if ((await button.count()) === 0) continue;
                await button.evaluate((btn: unknown) => (btn as { click(): void }).click());
                console.log('✅ "später erinnern" geklickt via JavaScript');
                laterClicked = true;
                clickCount++;
                await page.waitForTimeout(150);
                break;
              } catch (jsErr) {
                continue;
              }
            }
          }
          if (!laterClicked) break;
        }

        if (clickCount === 0) {
          console.warn('⚠️  Konnte Phone Collector nicht überspringen, fahre trotzdem fort...');
        } else {
          console.log(`✅ Phone Collector übersprungen (${clickCount} Klick(s))`);
        }

        // Warte auf Navigation zum Kundenbereich (erfolgt automatisch nach "später erinnern")
        console.log('⏳ Warte auf automatische Weiterleitung zum Kundenbereich...');
        
        // Warte auf networkidle (alle Netzwerkaktivitäten abgeschlossen)
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        await page.waitForTimeout(150);
        
        // Prüfe finale URL
        const finalUrl = page.url();
        console.log(`📍 Finale URL: ${finalUrl}`);
        
        if (finalUrl.includes('kundenbereich.check24.de') || finalUrl.includes('kundenbereich.check24-test.de')) {
          console.log('✅ Zum Kundenbereich weitergeleitet');
        } else {
          console.log('⚠️  Noch nicht auf Kundenbereich - URL wird möglicherweise noch aktualisiert');
          await page.waitForTimeout(1200);
          console.log(`📍 URL nach zusätzlichem Warten: ${page.url()}`);
        }
      } else {
        console.log('ℹ️  Kein Phone Collector erkannt');
        const currentUrl = page.url();
        console.log(`📍 Aktuelle URL (kein Phone Collector): ${currentUrl}`);
      }

      // SCHRITT 12: Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset vollständig erfolgreich für: ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Passwort-Reset - Combined Account (TAN per E-Mail)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 3: Selection Screen - E-Mail auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(200);
      
      const emailRadio = page.locator('#c24-uli-choose-email');
      const hasEmailOption = await emailRadio.count() > 0;

      if (hasEmailOption) {
        console.log('✅ Selection Screen erkannt - wähle E-Mail...');
        
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
        
        await page.waitForTimeout(150);
        
        // Verifiziere dass E-Mail ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken
      console.log('📧 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(150);

      // E-Mail Client initialisieren (wird für mehrere Schritte benötigt)
      const emailClient = getEmailClient();

      // SCHRITT 5: TAN-Code aus E-Mail holen
      console.log('📧 SCHRITT 5: Warte auf TAN-Code per E-Mail...');
      
      let email;
      try {
        email = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset Combined Email - TAN-Code',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      // TAN-Code extrahieren
      console.log('🔍 Extrahiere TAN-Code aus E-Mail...');
      console.log(`   Betreff: ${email!.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email!.body.substring(0, 200)}`);

      // TAN aus Betreff extrahieren (z.B. "123456 ist Ihr CHECK24 Sicherheitscode")
      let tanCode: string | null = null;
      const subjectMatch = email!.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = email!.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
          console.log(`✅ TAN-Code extrahiert aus Body: ${tanCode}`);
        } else {
          throw new Error('Konnte TAN-Code nicht aus E-Mail extrahieren');
        }
      }

      console.log(`🔑 TAN-Code erhalten: ${tanCode}`);

      // SCHRITT 6: TAN-Code eingeben (6-stellig komplett)
      console.log('🔍 SCHRITT 6: Suche TAN-Eingabefeld...');
      
      let tanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            tanInput = input;
            console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (tanInput) break;
      }

      if (!tanInput) {
        throw new Error('Konnte TAN-Eingabefeld nicht finden');
      }

      await page.waitForTimeout(200);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');

      // SCHRITT 7: Warte auf Auto-Submit
      console.log('⏳ SCHRITT 7: Warte auf Screen-Update...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(150);

      // SCHRITT 8: "Passwort ändern" klicken
      console.log('🔐 SCHRITT 8: Klicke "Passwort ändern"...');
      const passwordChangeLink = page.locator('a.c24-uli-pwr-pw-link').first();
      await passwordChangeLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwordChangeLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 9: Neues Passwort eingeben
      console.log('🔐 SCHRITT 9: Gebe neues Passwort ein...');
      
      const visiblePasswordFields = [];
      const allPasswordFields = await page.locator('input[type="password"]').all();
      
      for (const field of allPasswordFields) {
        const isVisible = await field.isVisible().catch(() => false);
        if (isVisible) {
          visiblePasswordFields.push(field);
        }
      }

      console.log(`   Sichtbare Passwort-Felder: ${visiblePasswordFields.length}`);
      
      if (visiblePasswordFields.length < 2) {
        throw new Error(`Erwarte 2 Passwort-Felder, gefunden: ${visiblePasswordFields.length}`);
      }

      // Neues Passwort in beide Felder eingeben
      await visiblePasswordFields[0].fill('1qay1qay');
      console.log('✅ Passwort in erstes Feld eingegeben');
      
      await visiblePasswordFields[1].fill('1qay1qay');
      console.log('✅ Passwort in zweites Feld eingegeben (Bestätigung)');

      // SCHRITT 10: "Speichern und weiter" klicken
      console.log('💾 SCHRITT 10: Klicke "Speichern und weiter"...');
      const saveButton = page.locator('#c24-uli-pwr-pw-btn');
      await saveButton.waitFor({ state: 'visible', timeout: 10000 });
      await saveButton.click();
      console.log('✅ "Speichern und weiter" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 11: Prüfe auf Bestätigungsmail für Passwort-Änderung
      console.log('📧 SCHRITT 11: Prüfe auf Bestätigungsmail für Passwort-Änderung...');
      
      try {
        const confirmationEmail = await emailClient.waitForEmail(
          {
            subject: 'Ihr CHECK24 Passwort wurde geändert',
          },
          30000,
          2000
        );
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail!.subject}"`);
      } catch (e) {
        console.warn('⚠️  Bestätigungsmail nicht innerhalb von 30 Sekunden erhalten - fahre trotzdem fort');
        await sendEmailTimeoutWarning(
          'Passwort-Reset - Bestätigungsmail',
          'subject: Ihr CHECK24 Passwort wurde geändert',
          30
        );
      }

      // SCHRITT 12: Warte auf Weiterleitung zum Kundenbereich (kein Phone Collector bei Combined Account)
      console.log('⏳ SCHRITT 12: Warte auf Weiterleitung zum Kundenbereich...');
      await page.waitForLoadState('networkidle');
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(150);
      }

      // SCHRITT 13: Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset vollständig erfolgreich für Combined Account (E-Mail): ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Passwort-Reset - Combined Account (TAN per SMS)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 3: Selection Screen - SMS auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(200);
      
      const smsRadio = page.locator('#c24-uli-choose-sms');
      const hasSmsOption = await smsRadio.count() > 0;

      if (hasSmsOption) {
        console.log('✅ Selection Screen erkannt - wähle SMS...');
        
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
        
        await page.waitForTimeout(150);
        
        // Verifiziere dass SMS ausgewählt ist
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
      } else {
        console.log('⚠️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken - SMS wird versendet
      console.log('📱 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 5: SMS-Code aus weitergeleiteter E-Mail holen (iPhone-Weiterleitung)
      console.log('📱 SCHRITT 5: Warte auf weitergeleitete SMS per E-Mail vom iPhone...');
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
          'Passwort-Reset Combined SMS - TAN-Code',
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

      // SCHRITT 6: SMS-Code eingeben
      console.log('🔍 SCHRITT 6: Suche SMS-Eingabefeld...');
      
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

      await page.waitForTimeout(200);
      await smsInput.fill(smsCode);
      console.log('✅ SMS-Code eingegeben');

      // SCHRITT 7: Warte auf Auto-Submit
      console.log('⏳ SCHRITT 7: Warte auf Auto-Submit und Navigation...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(150);

      // SCHRITT 8: "Passwort ändern" klicken
      console.log('🔐 SCHRITT 8: Klicke "Passwort ändern"...');
      const passwordChangeLink = page.locator('a.c24-uli-pwr-pw-link').first();
      await passwordChangeLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwordChangeLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 9: Neues Passwort eingeben
      console.log('🔐 SCHRITT 9: Gebe neues Passwort ein...');
      
      const visiblePasswordFields = [];
      const allPasswordFields = await page.locator('input[type="password"]').all();
      
      for (const field of allPasswordFields) {
        const isVisible = await field.isVisible().catch(() => false);
        if (isVisible) {
          visiblePasswordFields.push(field);
        }
      }

      console.log(`   Sichtbare Passwort-Felder: ${visiblePasswordFields.length}`);
      
      if (visiblePasswordFields.length < 2) {
        throw new Error(`Erwarte 2 Passwort-Felder, gefunden: ${visiblePasswordFields.length}`);
      }

      // Neues Passwort in beide Felder eingeben
      await visiblePasswordFields[0].fill('1qay1qay');
      console.log('✅ Passwort in erstes Feld eingegeben');
      
      await visiblePasswordFields[1].fill('1qay1qay');
      console.log('✅ Passwort in zweites Feld eingegeben (Bestätigung)');

      // SCHRITT 10: "Speichern und weiter" klicken
      console.log('💾 SCHRITT 10: Klicke "Speichern und weiter"...');
      const saveButton = page.locator('#c24-uli-pwr-pw-btn');
      await saveButton.waitFor({ state: 'visible', timeout: 10000 });
      await saveButton.click();
      console.log('✅ "Speichern und weiter" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 11: Prüfe auf Bestätigungsmail für Passwort-Änderung
      console.log('📧 SCHRITT 11: Prüfe auf Bestätigungsmail für Passwort-Änderung...');
      
      try {
        const confirmationEmail = await emailClient.waitForEmail(
          {
            subject: 'Ihr CHECK24 Passwort wurde geändert',
          },
          30000,
          2000
        );
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail!.subject}"`);
      } catch (e) {
        console.warn('⚠️  Bestätigungsmail nicht innerhalb von 30 Sekunden erhalten - fahre trotzdem fort');
        await sendEmailTimeoutWarning(
          'Passwort-Reset - Bestätigungsmail',
          'subject: Ihr CHECK24 Passwort wurde geändert',
          30
        );
      }

      // SCHRITT 12: Warte auf Weiterleitung zum Kundenbereich (kein Phone Collector bei Combined Account)
      console.log('⏳ SCHRITT 12: Warte auf Weiterleitung zum Kundenbereich...');
      await page.waitForLoadState('networkidle');
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(150);
      }

      // SCHRITT 13: Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset vollständig erfolgreich für Combined Account (SMS): ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Passwort-Reset - Combined Account mit 2FA (Doppel-TAN: Email + SMS)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone + 2FA verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE_2FA');
      console.log(`🔐 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);
      console.log(`🔒 2FA aktiviert: Ja`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 3: Selection Screen - E-Mail auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(200);
      
      const emailRadio = page.locator('#c24-uli-choose-email');
      const hasEmailOption = await emailRadio.count() > 0;

      if (hasEmailOption) {
        console.log('✅ Selection Screen erkannt - wähle E-Mail...');
        
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
        
        await page.waitForTimeout(150);
        
        // Verifiziere dass E-Mail ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken
      console.log('📧 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(150);

      // E-Mail Client initialisieren (wird für mehrere Schritte benötigt)
      const emailClient = getEmailClient();

      // SCHRITT 5: Erster TAN-Code aus E-Mail holen
      console.log('📧 SCHRITT 5: Warte auf ersten TAN-Code per E-Mail...');
      
      let email;
      try {
        email = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset 2FA - Erster TAN-Code (Email)',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      // TAN-Code extrahieren
      console.log('🔍 Extrahiere ersten TAN-Code aus E-Mail...');
      console.log(`   Betreff: ${email!.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email!.body.substring(0, 200)}`);

      let tanCode: string | null = null;
      const subjectMatch = email!.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ Erster TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        const bodyMatch = email!.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
          console.log(`✅ Erster TAN-Code extrahiert aus Body: ${tanCode}`);
        } else {
          throw new Error('Konnte ersten TAN-Code nicht aus E-Mail extrahieren');
        }
      }

      console.log(`🔑 Erster TAN-Code erhalten: ${tanCode}`);

      // SCHRITT 6: Ersten TAN-Code eingeben
      console.log('🔍 SCHRITT 6: Suche erstes TAN-Eingabefeld...');
      
      let tanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            tanInput = input;
            console.log(`✅ Erstes TAN-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (tanInput) break;
      }

      if (!tanInput) {
        throw new Error('Konnte erstes TAN-Eingabefeld nicht finden');
      }

      await page.waitForTimeout(200);
      await tanInput.fill(tanCode);
      console.log('✅ Erster TAN-Code eingegeben');

      // SCHRITT 7: Warte auf nächsten Screen mit SMS-TAN-Anforderung
      console.log('⏳ SCHRITT 7: Warte auf Screen-Update (2FA SMS-TAN wird versendet)...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(1200);

      // SCHRITT 8: Zweiter TAN-Code per SMS aus weitergeleiteter E-Mail holen
      console.log('📱 SCHRITT 8: Warte auf zweiten TAN-Code per SMS (via iPhone-Weiterleitung)...');
      console.log(`📱 SMS wird an ${credentials.account.twoFactorPhone || credentials.account.phone} gesendet`);
      
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
          'Passwort-Reset 2FA - Zweiter TAN-Code (SMS)',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }

      if (!smsEmail) {
        throw new Error('SMS-Weiterleitungs-E-Mail vom iPhone nicht erhalten');
      }

      console.log(`✅ SMS-Weiterleitungs-Email erhalten von: ${smsEmail.from}`);
      console.log(`📧 Betreff: ${smsEmail.subject}`);

      const smsCode = emailClient.extractTanCode(smsEmail);
      if (!smsCode) {
        throw new Error('Zweiter TAN-Code (SMS) konnte nicht extrahiert werden');
      }

      console.log(`🔑 Zweiter TAN-Code (SMS) erhalten: ${smsCode}`);

      // SCHRITT 9: Suche nach 6 separaten Eingabefeldern für SMS-Code (wie beim 2FA Login)
      console.log('🔍 SCHRITT 9: Suche SMS-Code-Eingabefelder (6 separate Felder)...');
      await page.waitForTimeout(400);

      // CHECK24 verwendet 6 separate Input-Felder für den 6-stelligen Code
      const allCodeFields = page.locator('input[type="text"][placeholder=" "]');
      const allFieldsCount = await allCodeFields.count();
      
      // Filtere nach sichtbaren Feldern
      const visibleFields = [];
      for (let i = 0; i < allFieldsCount; i++) {
        const field = allCodeFields.nth(i);
        try {
          if (await field.isVisible({ timeout: 100 })) {
            visibleFields.push(field);
          }
        } catch (e) {
          // Nicht sichtbar
        }
      }
      
      console.log(`🔍 Sichtbare SMS-Code-Eingabefelder: ${visibleFields.length}`);
      
      if (visibleFields.length === 6) {
        // 6 separate Felder - Ziffer für Ziffer eingeben
        console.log('⌨️  Gebe SMS-Code ein (Ziffer für Ziffer in 6 Felder)...');
        
        for (let i = 0; i < 6; i++) {
          const digit = smsCode[i];
          const field = visibleFields[i];
          
          try {
            await field.fill(digit);
            console.log(`  ✓ Ziffer ${i + 1}/6 eingegeben: ${digit}`);
            await page.waitForTimeout(50);
          } catch (fillError) {
            console.log(`  ⚠️  Ziffer ${i + 1} fill() fehlgeschlagen, versuche JavaScript...`);
            await field.evaluate((el: any, d: string) => {
              el.value = d;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, digit);
            console.log(`  ✓ Ziffer ${i + 1}/6 eingegeben (JavaScript): ${digit}`);
          }
        }
        
        console.log('✅ SMS-Code vollständig eingegeben (6 Felder)');
      } else {
        // Fallback: Ein einzelnes Eingabefeld
        console.log('ℹ️  Keine 6 separaten Felder gefunden, suche einzelnes SMS-Eingabefeld...');
        
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

        await page.waitForTimeout(200);
        await smsInput.fill(smsCode);
        console.log('✅ SMS-Code eingegeben');
      }

      await page.waitForTimeout(400);

      // SCHRITT 10: Nach SMS-Code Enter drücken / Weiter klicken
      console.log('➡️  SCHRITT 10: Klicke "Weiter" nach SMS-Code-Eingabe...');
      
      try {
        // Versuche Enter im letzten Feld
        await visibleFields[5].press('Enter');
        console.log('✅ Enter gedrückt (im letzten SMS-Feld)');
      } catch (enterError) {
        // Button-Fallback
        const submitButton = page.locator('button[type="submit"], button:has-text("Weiter"), button:has-text("Bestätigen")').first();
        if (await submitButton.count() > 0) {
          await submitButton.click({ force: true });
          console.log('✅ Submit-Button geklickt');
        } else {
          console.log('ℹ️  Kein Submit-Button gefunden, warte auf automatische Weiterleitung');
        }
      }

      await page.waitForTimeout(600);

      // SCHRITT 11: Warte auf Screen mit "Passwort ändern" und "Weiter"
      console.log('🔍 SCHRITT 11: Warte auf Screen mit "Passwort ändern" / "Weiter"...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(200);

      const currentBodyText = await page.locator('body').textContent() || '';
      
      // Cookie-Banner schließen (wie in auth.ts / otp-happy-path: "geht klar" Button)
      if (currentBodyText.toLowerCase().includes('cookie') || currentBodyText.toLowerCase().includes('geht klar')) {
        console.log('🍪 Cookie-Banner erkannt - klicke "geht klar"...');
        const cookieBtn = page.locator(COOKIE_GEHT_KLAR_SELECTOR);
        if (await cookieBtn.count() > 0) {
          const clicked = await page.evaluate((sel: string) => {
            const g = globalThis as unknown as { document?: { querySelectorAll: (s: string) => unknown[] } };
            const doc = g.document;
            if (!doc) return false;
            const buttons = Array.from(doc.querySelectorAll(sel));
            for (const button of buttons) {
              const el = button as { innerText?: string; textContent?: string; getBoundingClientRect(): { width: number; height: number }; click(): void };
              const text = (el.innerText || el.textContent || '').trim().toLowerCase();
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && text === 'geht klar') {
                el.click();
                return true;
              }
            }
            return false;
          }, COOKIE_GEHT_KLAR_SELECTOR);
          if (clicked) {
            await page.waitForTimeout(COOKIE_AFTER_CLICK_MS);
            const blockingVisible = await page.locator('.c24-strict-blocking-layer').isVisible().catch(() => false);
            if (!blockingVisible) console.log('✅ Cookie-Banner geschlossen');
          }
        }
      }

      // SCHRITT 12: Klicke "Weiter" (ohne Passwort zu ändern) – ID wie von dir angegeben
      console.log('➡️  SCHRITT 12: Klicke "Weiter"...');
      const weiterButtonStep12 = page.locator('#c24-uli-pwr-login-btn');
      await weiterButtonStep12.waitFor({ state: 'visible', timeout: 10000 });
      await weiterButtonStep12.click();
      console.log('✅ "Weiter" geklickt');
      await page.waitForTimeout(1200);

      // SCHRITT 13: Login-Erfolg verifizieren
      console.log('🔍 SCHRITT 13: Prüfe Login-Erfolg...');
      await page.waitForLoadState('networkidle');
      
      try {
        await page.waitForURL(/kundenbereich\.check24\.de/, { timeout: 10000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
      }

      // Warte zusätzlich, da c24session Cookie möglicherweise verzögert gesetzt wird
      console.log('⏳ Warte zusätzliche Zeit für c24session Cookie...');
      await page.waitForTimeout(150);
      
      // Prüfe nochmal URL
      const finalUrl = page.url();
      console.log(`📍 Finale URL: ${finalUrl}`);

      // Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset mit 2FA vollständig erfolgreich (Doppel-TAN: Email + SMS): ${credentials.email}`);

      // Logout
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Passwort-Reset mit IBAN-Verifizierung - 2FA Account', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone + 2FA verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE_2FA');
      console.log(`🔐 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);
      console.log(`🏦 IBAN-Verifizierung Test`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      console.log(`🌍 Umgebung: ${process.env.TEST_ENVIRONMENT || 'PROD'} - ${loginUrl}`);
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 3: Selection Screen - E-Mail sollte bereits ausgewählt sein
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(200);
      
      const emailRadio = page.locator('#c24-uli-choose-email');
      const hasEmailOption = await emailRadio.count() > 0;

      if (hasEmailOption) {
        console.log('✅ Selection Screen erkannt - E-Mail sollte bereits ausgewählt sein');
        
        // Prüfe ob E-Mail bereits ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button already checked: ${isChecked}`);
        
        if (!isChecked) {
          console.log('🔘 E-Mail ist nicht ausgewählt, wähle jetzt...');
          try {
            await emailRadio.click({ timeout: 1500 });
            console.log('✅ E-Mail Radio Button geklickt');
          } catch (e) {
            await emailRadio.click({ force: true });
            console.log('✅ E-Mail Radio Button geklickt (force)');
          }
        }
      } else {
        console.log('ℹ️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken
      console.log('📧 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(150);

      // E-Mail Client initialisieren
      const emailClient = getEmailClient();

      // SCHRITT 5: TAN-Code aus E-Mail holen
      console.log('📧 SCHRITT 5: Warte auf TAN-Code per E-Mail...');
      
      let email;
      try {
        email = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset IBAN - TAN-Code',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      // TAN-Code extrahieren
      console.log('🔍 Extrahiere TAN-Code aus E-Mail...');
      console.log(`   Betreff: ${email!.subject}`);

      let tanCode: string | null = null;
      const subjectMatch = email!.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        const bodyMatch = email!.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
          console.log(`✅ TAN-Code extrahiert aus Body: ${tanCode}`);
        } else {
          throw new Error('Konnte TAN-Code nicht aus E-Mail extrahieren');
        }
      }

      console.log(`🔑 TAN-Code erhalten: ${tanCode}`);

      // SCHRITT 6: TAN-Code eingeben und Enter drücken
      console.log('🔍 SCHRITT 6: Suche TAN-Eingabefeld...');
      
      let tanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            tanInput = input;
            console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (tanInput) break;
      }

      if (!tanInput) {
        throw new Error('Konnte TAN-Eingabefeld nicht finden');
      }

      await page.waitForTimeout(200);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben');
      
      // Enter drücken
      await tanInput.press('Enter');
      console.log('✅ Enter gedrückt');

      // SCHRITT 7: Warte auf Phone-TAN Screen
      console.log('⏳ SCHRITT 7: Warte auf Phone-TAN Screen...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(150);

      // SCHRITT 8: Klicke "auf andere Art bestätigen" (Link kann in verstecktem Container sein)
      console.log('🔍 SCHRITT 8: Klicke "auf andere Art bestätigen"...');
      const alternativeAuthLink = page.locator('a.c24-uli-mfa-other').first();
      await alternativeAuthLink.waitFor({ state: 'attached', timeout: 10000 });
      await alternativeAuthLink.evaluate((el: unknown) => (el as { click(): void }).click());
      console.log('✅ "auf andere Art bestätigen" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 9: Sicherheitsfrage/IBAN-Eingabe (#cl_sq)
      console.log('🏦 SCHRITT 9: Eingabefeld für Sicherheitsfrage/IBAN...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(400);

      const ibanInput = page.locator('#cl_sq');
      await ibanInput.waitFor({ state: 'visible', timeout: 10000 });

      // IBAN eingeben (hart gecoded)
      const iban = 'DE57370502990101508141';
      console.log(`🏦 Gebe IBAN ein: ${iban}`);
      await page.waitForTimeout(200);
      await ibanInput.fill(iban);
      console.log('✅ IBAN eingegeben');

      await page.waitForTimeout(400);

      // SCHRITT 10: "Weiter" Button nach IBAN-Eingabe klicken
      console.log('➡️  SCHRITT 10: Suche "Weiter" Button nach IBAN-Eingabe...');
      
      const weiterButtonIbanSelectors = [
        'button[type="submit"]:has-text("weiter")',
        'button[type="submit"]:has-text("Weiter")',
        'button:has-text("weiter")',
        'button:has-text("Weiter")',
        'button[type="submit"]',
      ];

      let weiterButtonIban = null;
      for (const selector of weiterButtonIbanSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterButtonIban = btn;
              break;
            }
          }
          
          if (weiterButtonIban) break;
        } catch (e) {
          continue;
        }
      }

      if (!weiterButtonIban) {
        throw new Error('Konnte "Weiter" Button nach IBAN-Eingabe nicht finden');
      }

      try {
        await weiterButtonIban.click({ timeout: 3000 });
        console.log('✅ "Weiter" Button geklickt');
      } catch (e) {
        await weiterButtonIban.click({ force: true });
        console.log('✅ "Weiter" Button geklickt (force)');
      }

      await page.waitForTimeout(150);

      // SCHRITT 11: Warte auf nächsten Screen und klicke wieder auf "Weiter"
      console.log('⏳ SCHRITT 11: Warte auf nächsten Screen...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(400);

      console.log('➡️  SCHRITT 11: Suche finalen "Weiter" Button...');
      
      const finalWeiterSelectors = [
        'button[type="submit"]:has-text("weiter")',
        'button[type="submit"]:has-text("Weiter")',
        'button:has-text("weiter")',
        'button:has-text("Weiter")',
        'button[type="submit"]',
      ];

      let finalWeiterButton = null;
      for (const selector of finalWeiterSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              finalWeiterButton = btn;
              break;
            }
          }
          
          if (finalWeiterButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!finalWeiterButton) {
        throw new Error('Konnte finalen "Weiter" Button nicht finden');
      }

      console.log('✅ Klicke finalen "Weiter" Button...');
      
      try {
        await finalWeiterButton.click({ timeout: 3000 });
        console.log('✅ Finaler "Weiter" Button geklickt');
      } catch (e) {
        await finalWeiterButton.click({ force: true });
        console.log('✅ Finaler "Weiter" Button geklickt (force)');
      }

      // SCHRITT 12: Warte auf Weiterleitung zur Callback-Seite (Kundenbereich)
      console.log('⏳ SCHRITT 12: Warte auf Weiterleitung zur Callback-Seite...');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(150);

      // Warte auf Kundenbereich URL
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 10000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(1200);
      }

      // SCHRITT 13: Prüfe c24session Cookie
      console.log('🍪 SCHRITT 13: Prüfe c24session Cookie...');
      
      const finalUrl = page.url();
      console.log(`📍 Finale URL: ${finalUrl}`);

      // Alle Cookies holen
      const allCookies = await page.context().cookies();
      console.log(`📋 Alle Cookies (${allCookies.length}): ${allCookies.map(c => `${c.name} (Domain: ${c.domain})`).join(', ')}`);

      // c24session Cookie(s) suchen
      const c24sessionCookies = allCookies.filter(c => c.name === 'c24session');
      
      if (c24sessionCookies.length > 0) {
        console.log(`✅ c24session Cookie(s) gefunden: ${c24sessionCookies.length}x`);
        for (const cookie of c24sessionCookies) {
          console.log(`   - ${cookie.value.substring(0, 20)}... (Domain: ${cookie.domain})`);
        }
      } else {
        console.log('⚠️  c24session Cookie nicht gefunden');
        
        // Prüfe auf TEST Environment (Cookie-Check ist lenient)
        const isTestEnvironment = finalUrl.includes('check24-test.de');
        if (!isTestEnvironment) {
          throw new Error('Login nicht vollständig: c24session Cookie fehlt (PROD)');
        } else {
          console.log('⚠️  TEST Environment - Cookie-Check lenient');
        }
      }

      // Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset mit IBAN-Verifizierung vollständig erfolgreich: ${credentials.email}`);

      // Logout
      await logout(page);
      
      console.log('✅ Test komplett erfolgreich abgeschlossen');

    } finally {
      await context.close();
    }
  });

  test('Passwort-Reset mit IBAN-Verifizierung via SMS - 2FA Account', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone + 2FA verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE_2FA');
      console.log(`🔐 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);
      console.log(`🏦 IBAN-Verifizierung Test via SMS`);

      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      console.log(`🌍 Umgebung: ${process.env.TEST_ENVIRONMENT || 'PROD'} - ${loginUrl}`);
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(150);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(200);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(150);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Klicke "Passwort vergessen?"...');
      const forgotPasswordWrapper = page.locator('.c24-uli-cl-pwreset-wrapper').first();
      await forgotPasswordWrapper.waitFor({ state: 'visible', timeout: 10000 });
      await forgotPasswordWrapper.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 3: Selection Screen - SMS auswählen (statt E-Mail)
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(200);
      
      const smsRadio = page.locator('#c24-uli-choose-sms');
      const hasSmsOption = await smsRadio.count() > 0;

      if (hasSmsOption) {
        console.log('✅ Selection Screen erkannt - wähle SMS...');
        
        // SMS Radio Button auswählen
        try {
          await smsRadio.click({ timeout: 1500 });
          console.log('✅ SMS Radio Button geklickt (normal)');
        } catch (e) {
          console.log('⚠️  Normal-Click fehlgeschlagen, versuche force...');
          try {
            await smsRadio.click({ force: true });
            console.log('✅ SMS Radio Button geklickt (force)');
          } catch (e2) {
            // Fallback: Klicke auf das Label
            console.log('⚠️  Force-Click fehlgeschlagen, versuche Label...');
            const smsLabel = page.locator('label[for="c24-uli-choose-sms"]');
            await smsLabel.click({ force: true });
            console.log('✅ SMS Label geklickt (force)');
          }
        }
        
        await page.waitForTimeout(150);
        
        // Verifiziere dass SMS ausgewählt ist
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
        
        if (!isChecked) {
          throw new Error('SMS Radio Button konnte nicht ausgewählt werden');
        }
      } else {
        console.log('⚠️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken - SMS wird versendet
      console.log('📱 SCHRITT 4: Klicke "Code senden" - SMS wird versendet...');
      const codeSendenButton = page.locator('#c24-uli-pwr-choose-btn');
      await codeSendenButton.waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(150);

      // E-Mail Client initialisieren
      const emailClient = getEmailClient();

      // SCHRITT 5: SMS-Code aus weitergeleiteter E-Mail holen (iPhone-Weiterleitung)
      console.log('📱 SCHRITT 5: Warte auf weitergeleitete SMS per E-Mail vom iPhone...');
      console.log(`📱 SMS wird an ${credentials.account.phone} gesendet`);
      
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
          'Passwort-Reset IBAN SMS - TAN-Code',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }

      if (!smsEmail) {
        throw new Error('SMS-Weiterleitungs-E-Mail vom iPhone nicht erhalten');
      }

      console.log(`✅ SMS-Weiterleitungs-Email erhalten von: ${smsEmail.from}`);
      console.log(`📧 Betreff: ${smsEmail.subject}`);

      const smsCode = emailClient.extractTanCode(smsEmail);
      if (!smsCode) {
        throw new Error('SMS-Code konnte nicht extrahiert werden');
      }

      console.log(`🔑 SMS-Code erhalten: ${smsCode}`);

      // SCHRITT 6: SMS-Code eingeben und Enter drücken
      console.log('🔍 SCHRITT 6: Suche SMS-Eingabefeld...');
      
      let smsInput = null;
      const smsInputSelectors = ['input[type="tel"]', 'input[type="text"]', 'input[id*="tan"]'];
      
      for (const selector of smsInputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            smsInput = input;
            console.log(`✅ SMS-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (smsInput) break;
      }

      if (!smsInput) {
        throw new Error('SMS-Eingabefeld nicht gefunden');
      }

      await page.waitForTimeout(200);
      await smsInput.fill(smsCode);
      console.log('✅ SMS-Code eingegeben');
      
      // Enter drücken
      await smsInput.press('Enter');
      console.log('✅ Enter gedrückt');

      // SCHRITT 7: Warte auf E-Mail-TAN Screen
      console.log('⏳ SCHRITT 7: Warte auf E-Mail-TAN Screen...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(150);

      // SCHRITT 8: Klicke "auf andere Art bestätigen" (Link kann in verstecktem Container sein)
      console.log('🔍 SCHRITT 8: Klicke "auf andere Art bestätigen"...');
      const alternativeAuthLink = page.locator('a.c24-uli-mfa-other').first();
      await alternativeAuthLink.waitFor({ state: 'attached', timeout: 10000 });
      await alternativeAuthLink.evaluate((el: unknown) => (el as { click(): void }).click());
      console.log('✅ "auf andere Art bestätigen" geklickt');
      await page.waitForTimeout(150);

      // SCHRITT 9: Sicherheitsfrage/IBAN-Eingabe (#cl_sq)
      console.log('🏦 SCHRITT 9: Eingabefeld für Sicherheitsfrage/IBAN...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(400);

      const ibanInput = page.locator('#cl_sq');
      await ibanInput.waitFor({ state: 'visible', timeout: 10000 });

      // IBAN eingeben
      const iban = 'DE57370502990101508141';
      console.log(`🏦 Gebe IBAN ein: ${iban}`);
      await page.waitForTimeout(200);
      await ibanInput.fill(iban);
      console.log('✅ IBAN eingegeben');
      await page.waitForTimeout(400);

      // SCHRITT 10: "Weiter" Button nach IBAN-Eingabe klicken
      console.log('➡️  SCHRITT 10: Suche "Weiter" Button nach IBAN-Eingabe...');
      
      const weiterButtonIbanSelectors = [
        'button[type="submit"]:has-text("weiter")',
        'button[type="submit"]:has-text("Weiter")',
        'button:has-text("weiter")',
        'button[type="submit"]',
      ];

      let weiterButtonIban = null;
      for (const selector of weiterButtonIbanSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterButtonIban = btn;
              console.log(`✅ "Weiter" Button gefunden`);
              break;
            }
          }
          
          if (weiterButtonIban) break;
        } catch (e) {
          continue;
        }
      }

      if (!weiterButtonIban) {
        throw new Error('Konnte "Weiter" Button nach IBAN-Eingabe nicht finden');
      }

      console.log('✅ Klicke "Weiter" Button...');
      
      try {
        await weiterButtonIban.click({ timeout: 3000 });
        console.log('✅ "Weiter" Button geklickt (normal)');
      } catch (e) {
        await weiterButtonIban.click({ force: true });
        console.log('✅ "Weiter" Button geklickt (force)');
      }

      await page.waitForTimeout(150);

      // SCHRITT 11: Warte auf nächsten Screen und klicke wieder auf "Weiter"
      console.log('⏳ SCHRITT 11: Warte auf nächsten Screen...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(400);

      console.log('➡️  SCHRITT 11: Suche finalen "Weiter" Button...');
      
      const finalWeiterSelectors = [
        'button[type="submit"]:has-text("weiter")',
        'button:has-text("weiter")',
        'button[type="submit"]',
      ];

      let finalWeiterButton = null;
      for (const selector of finalWeiterSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              finalWeiterButton = btn;
              console.log(`✅ Finaler "Weiter" Button gefunden`);
              break;
            }
          }
          
          if (finalWeiterButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!finalWeiterButton) {
        throw new Error('Konnte finalen "Weiter" Button nicht finden');
      }

      console.log('✅ Klicke finalen "Weiter" Button...');
      
      try {
        await finalWeiterButton.click({ timeout: 3000 });
        console.log('✅ Finaler "Weiter" Button geklickt (normal)');
      } catch (e) {
        await finalWeiterButton.click({ force: true });
        console.log('✅ Finaler "Weiter" Button geklickt (force)');
      }

      // SCHRITT 12: Warte auf Weiterleitung zur Callback-Seite (Kundenbereich)
      console.log('⏳ SCHRITT 12: Warte auf Weiterleitung zur Callback-Seite...');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(150);

      // Warte auf Kundenbereich URL
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 10000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(1200);
      }

      // SCHRITT 13: Prüfe c24session Cookie
      console.log('🍪 SCHRITT 13: Prüfe c24session Cookie...');
      
      const finalUrl = page.url();
      console.log(`📍 Finale URL: ${finalUrl}`);

      // Alle Cookies holen
      const allCookies = await page.context().cookies();
      console.log(`📋 Alle Cookies (${allCookies.length}): ${allCookies.map(c => `${c.name} (Domain: ${c.domain})`).join(', ')}`);

      // c24session Cookie(s) suchen
      const c24sessionCookies = allCookies.filter(c => c.name === 'c24session');
      
      if (c24sessionCookies.length > 0) {
        console.log(`✅ c24session Cookie(s) gefunden: ${c24sessionCookies.length}x`);
        for (const cookie of c24sessionCookies) {
          console.log(`   - ${cookie.value.substring(0, 20)}... (Domain: ${cookie.domain})`);
        }
      } else {
        console.log('⚠️  c24session Cookie nicht gefunden');
        
        const isTestEnvironment = finalUrl.includes('check24-test.de');
        if (!isTestEnvironment) {
          throw new Error('Login nicht vollständig: c24session Cookie fehlt (PROD)');
        } else {
          console.log('⚠️  TEST Environment - Cookie-Check lenient');
        }
      }

      // Login-Erfolg verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Passwort-Reset mit IBAN-Verifizierung via SMS vollständig erfolgreich: ${credentials.email}`);

      // Logout
      await logout(page);
      
      console.log('✅ Test komplett erfolgreich abgeschlossen');

    } finally {
      await context.close();
    }
  });

});
