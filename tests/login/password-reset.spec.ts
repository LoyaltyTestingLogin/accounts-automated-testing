import { test, expect } from '@playwright/test';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl } from '../helpers/environment';
import dotenv from 'dotenv';

dotenv.config();

test.describe('CHECK24 Login - Passwort Reset', () => {

  test('Erfolgreicher Passwort-Reset - Account mit nur E-Mail', async ({ browser }) => {
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

      // SCHRITT 1: E-Mail eingeben
      console.log('📧 SCHRITT 1: Gebe E-Mail ein...');
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(500);

      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(800);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Suche "Passwort vergessen?" Link...');
      
      // Warte bis Passwort-Screen sichtbar ist
      await page.waitForTimeout(1000);
      
      const forgotPasswordSelectors = [
        'a:has-text("Passwort vergessen?")',
        'button:has-text("Passwort vergessen?")',
        '[href*="password-reset"]',
        '[href*="forgot"]',
        'a:has-text("vergessen")',
      ];

      let forgotPasswordClicked = false;
      for (const selector of forgotPasswordSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible()) {
            console.log(`✅ "Passwort vergessen?" gefunden mit: ${selector}`);
            await element.click();
            console.log('✅ "Passwort vergessen?" geklickt');
            forgotPasswordClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!forgotPasswordClicked) {
        throw new Error('Konnte "Passwort vergessen?" Button/Link nicht finden');
      }

      await page.waitForTimeout(1500);

      // SCHRITT 3: "Code senden" klicken (Email-Only Account)
      console.log('📧 SCHRITT 3: Klicke "Code senden"...');
      const codeSendenButton = page.getByRole('button', { name: 'Code senden' });
      await codeSendenButton.first().waitFor({ state: 'visible', timeout: 10000 });
      await codeSendenButton.first().click();
      console.log('✅ "Code senden" wurde geklickt');
      await page.waitForTimeout(2000);

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
      console.log(`   Betreff: ${email.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email.body.substring(0, 200)}`);

      // TAN aus Betreff extrahieren (z.B. "123456 ist Ihr CHECK24 Sicherheitscode")
      let tanCode: string | null = null;
      const subjectMatch = email.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = email.body.match(/(\d{6})/);
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
      await page.waitForTimeout(500);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');
      await page.waitForTimeout(1500);

      // SCHRITT 6: Warte auf Navigation / Screen-Update
      console.log('⏳ SCHRITT 6: Warte auf Screen-Update...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(1000);

      // SCHRITT 7: "Passwort ändern" Link klicken
      console.log('🔐 SCHRITT 7: Suche "Passwort ändern" Link...');
      
      const passwortAendernLink = page.locator('a:has-text("Passwort ändern")').first();
      await passwortAendernLink.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ "Passwort ändern" Link gefunden');
      
      await passwortAendernLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(2000);

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
      await page.waitForTimeout(300);

      // Zweites Passwort-Feld (Bestätigung)
      await visiblePasswordFields[1].fill(newPassword);
      console.log('✅ Passwort in zweites Feld eingegeben (Bestätigung)');
      await page.waitForTimeout(500);

      // SCHRITT 9: "Speichern und weiter" klicken
      console.log('💾 SCHRITT 9: Klicke "Speichern und weiter"...');
      
      const speichernSelectors = [
        'button:has-text("Speichern und weiter")',
        'button:has-text("speichern")',
        'button[type="submit"]',
      ];

      let speichernClicked = false;
      for (const selector of speichernSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible()) {
            console.log(`✅ "Speichern und weiter" gefunden mit: ${selector}`);
            await element.click();
            console.log('✅ "Speichern und weiter" geklickt');
            speichernClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!speichernClicked) {
        throw new Error('Konnte "Speichern und weiter" Button nicht finden');
      }

      await page.waitForTimeout(2000);

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
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail.subject}"`);
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
      await page.waitForTimeout(1000);
      
      const bodyText = await page.locator('body').textContent() || '';
      const hasPhoneCollector = bodyText.toLowerCase().includes('telefonnummer');

      if (hasPhoneCollector) {
        console.log('📱 Phone-Screen erkannt - klicke "später erinnern"...');
        
        const skipSelectors = [
          'a:has-text("später erinnern")',
          'button:has-text("später")',
          '[class*="skip"]',
        ];

        // Es gibt ZWEI "später erinnern" Links, die beide geklickt werden müssen
        // 1. Klick: Schließt ein Overlay/Popup
        // 2. Klick: Überspringt den Phone Collector Screen selbst
        let clickCount = 0;
        
        for (let attempt = 0; attempt < 2; attempt++) {
          let clicked = false;
          
          // Suche alle "später erinnern" Elemente und klicke das erste sichtbare
          for (const selector of skipSelectors) {
            try {
              const elements = await page.locator(selector).all();
              
              for (const element of elements) {
                const isVisible = await element.isVisible().catch(() => false);
                const text = await element.textContent().catch(() => '');
                
                if (isVisible && text?.toLowerCase().includes('später')) {
                  console.log(`   Klicke "später erinnern" Link ${clickCount + 1}...`);
                  
                  try {
                    await element.click({ timeout: 2000 });
                    console.log(`✅ "später erinnern" geklickt (Click ${clickCount + 1})`);
                    clicked = true;
                    clickCount++;
                    await page.waitForTimeout(1000);
                    break;
                  } catch (e) {
                    try {
                      await element.click({ force: true, timeout: 2000 });
                      console.log(`✅ "später erinnern" geklickt via force (Click ${clickCount + 1})`);
                      clicked = true;
                      clickCount++;
                      await page.waitForTimeout(1000);
                      break;
                    } catch (e2) {
                      continue;
                    }
                  }
                }
              }
              
              if (clicked) break;
            } catch (e) {
              continue;
            }
          }
          
          if (!clicked) {
            console.log(`   Kein weiterer "später erinnern" Link gefunden (${clickCount} Clicks gesamt)`);
            break;
          }
        }

        if (clickCount === 0) {
          console.warn('⚠️  Konnte Phone Collector nicht überspringen, fahre trotzdem fort...');
        } else if (clickCount === 1) {
          console.log(`✅ Phone Collector teilweise übersprungen (${clickCount} Click) - prüfe Weiterleitung...`);
        } else {
          console.log(`✅ Phone Collector vollständig übersprungen (${clickCount} Clicks)`);
        }

        // Warte auf Navigation zum Kundenbereich (erfolgt automatisch nach "später erinnern")
        console.log('⏳ Warte auf automatische Weiterleitung zum Kundenbereich...');
        
        // Warte auf networkidle (alle Netzwerkaktivitäten abgeschlossen)
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Prüfe finale URL
        const finalUrl = page.url();
        console.log(`📍 Finale URL: ${finalUrl}`);
        
        if (finalUrl.includes('kundenbereich.check24.de') || finalUrl.includes('kundenbereich.check24-test.de')) {
          console.log('✅ Zum Kundenbereich weitergeleitet');
        } else {
          console.log('⚠️  Noch nicht auf Kundenbereich - URL wird möglicherweise noch aktualisiert');
          await page.waitForTimeout(3000);
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
      await page.waitForTimeout(300);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(500);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Suche "Passwort vergessen?" Link...');
      
      const forgotPasswordSelectors = [
        'a:has-text("Passwort vergessen?")',
        'button:has-text("Passwort vergessen?")',
        '[data-tid*="forgot"]',
        'a:has-text("Passwort")',
      ];

      let forgotPasswordLink = null;
      for (const selector of forgotPasswordSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            forgotPasswordLink = element;
            console.log(`✅ "Passwort vergessen?" gefunden mit: ${selector}`);
            break;
          }
        }
      }

      if (!forgotPasswordLink) {
        throw new Error('Konnte "Passwort vergessen?" Link nicht finden');
      }

      await forgotPasswordLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 3: Selection Screen - E-Mail auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(500);
      
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
        
        await page.waitForTimeout(300);
        
        // Verifiziere dass E-Mail ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken
      console.log('📧 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.getByRole('button', { name: 'Code senden' });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(2000);

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
      console.log(`   Betreff: ${email.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email.body.substring(0, 200)}`);

      // TAN aus Betreff extrahieren (z.B. "123456 ist Ihr CHECK24 Sicherheitscode")
      let tanCode: string | null = null;
      const subjectMatch = email.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = email.body.match(/(\d{6})/);
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

      await page.waitForTimeout(500);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');

      // SCHRITT 7: Warte auf Auto-Submit
      console.log('⏳ SCHRITT 7: Warte auf Screen-Update...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // SCHRITT 8: "Passwort ändern" klicken
      console.log('🔐 SCHRITT 8: Suche "Passwort ändern" Link...');
      const passwordChangeLink = page.locator('a:has-text("Passwort ändern")').first();
      
      if (await passwordChangeLink.count() === 0) {
        throw new Error('Konnte "Passwort ändern" Link nicht finden');
      }

      console.log('✅ "Passwort ändern" Link gefunden');
      await passwordChangeLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(2000);

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
      
      const saveButtonSelectors = [
        'button:has-text("Speichern und weiter")',
        'button:has-text("Speichern")',
        '[type="submit"]:has-text("Speichern")',
      ];

      let saveButton = null;
      for (const selector of saveButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            saveButton = button;
            console.log(`✅ "Speichern und weiter" gefunden mit: ${selector}`);
            break;
          }
        }
      }

      if (!saveButton) {
        throw new Error('Konnte "Speichern und weiter" Button nicht finden');
      }

      await saveButton.click();
      console.log('✅ "Speichern und weiter" geklickt');

      await page.waitForTimeout(2000);

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
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail.subject}"`);
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
        await page.waitForTimeout(2000);
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
      await page.waitForTimeout(300);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(500);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Suche "Passwort vergessen?" Link...');
      
      const forgotPasswordSelectors = [
        'a:has-text("Passwort vergessen?")',
        'button:has-text("Passwort vergessen?")',
        '[data-tid*="forgot"]',
        'a:has-text("Passwort")',
      ];

      let forgotPasswordLink = null;
      for (const selector of forgotPasswordSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            forgotPasswordLink = element;
            console.log(`✅ "Passwort vergessen?" gefunden mit: ${selector}`);
            break;
          }
        }
      }

      if (!forgotPasswordLink) {
        throw new Error('Konnte "Passwort vergessen?" Link nicht finden');
      }

      await forgotPasswordLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 3: Selection Screen - SMS auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(500);
      
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
        
        await page.waitForTimeout(300);
        
        // Verifiziere dass SMS ausgewählt ist
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
      } else {
        console.log('⚠️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken - SMS wird versendet
      console.log('📱 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.getByRole('button', { name: 'Code senden' });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(2000);

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

      await page.waitForTimeout(500);
      await smsInput.fill(smsCode);
      console.log('✅ SMS-Code eingegeben');

      // SCHRITT 7: Warte auf Auto-Submit
      console.log('⏳ SCHRITT 7: Warte auf Auto-Submit und Navigation...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // SCHRITT 8: "Passwort ändern" klicken
      console.log('🔐 SCHRITT 8: Suche "Passwort ändern" Link...');
      const passwordChangeLink = page.locator('a:has-text("Passwort ändern")').first();
      
      if (await passwordChangeLink.count() === 0) {
        throw new Error('Konnte "Passwort ändern" Link nicht finden');
      }

      console.log('✅ "Passwort ändern" Link gefunden');
      await passwordChangeLink.click();
      console.log('✅ "Passwort ändern" geklickt');

      await page.waitForTimeout(2000);

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
      
      const saveButtonSelectors = [
        'button:has-text("Speichern und weiter")',
        'button:has-text("Speichern")',
        '[type="submit"]:has-text("Speichern")',
      ];

      let saveButton = null;
      for (const selector of saveButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            saveButton = button;
            console.log(`✅ "Speichern und weiter" gefunden mit: ${selector}`);
            break;
          }
        }
      }

      if (!saveButton) {
        throw new Error('Konnte "Speichern und weiter" Button nicht finden');
      }

      await saveButton.click();
      console.log('✅ "Speichern und weiter" geklickt');

      await page.waitForTimeout(2000);

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
        
        console.log(`✅ Bestätigungsmail erhalten: "${confirmationEmail.subject}"`);
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
        await page.waitForTimeout(2000);
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
      await page.waitForTimeout(300);
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(500);
      
      // "Weiter" klicken
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 2: "Passwort vergessen?" klicken
      console.log('🔑 SCHRITT 2: Suche "Passwort vergessen?" Link...');
      
      const forgotPasswordSelectors = [
        'a:has-text("Passwort vergessen?")',
        'button:has-text("Passwort vergessen?")',
        '[data-tid*="forgot"]',
        'a:has-text("Passwort")',
      ];

      let forgotPasswordLink = null;
      for (const selector of forgotPasswordSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            forgotPasswordLink = element;
            console.log(`✅ "Passwort vergessen?" gefunden mit: ${selector}`);
            break;
          }
        }
      }

      if (!forgotPasswordLink) {
        throw new Error('Konnte "Passwort vergessen?" Link nicht finden');
      }

      await forgotPasswordLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');

      await page.waitForTimeout(2000);

      // SCHRITT 3: Selection Screen - E-Mail auswählen
      console.log('🔍 SCHRITT 3: Prüfe auf Selection Screen...');
      await page.waitForTimeout(500);
      
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
        
        await page.waitForTimeout(300);
        
        // Verifiziere dass E-Mail ausgewählt ist
        const isChecked = await emailRadio.isChecked().catch(() => false);
        console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein Selection Screen erkannt - überspringe Auswahl');
      }

      // SCHRITT 4: "Code senden" klicken
      console.log('📧 SCHRITT 4: Klicke "Code senden"...');
      const codeSendenButton = page.getByRole('button', { name: 'Code senden' });
      await codeSendenButton.click();
      console.log('✅ "Code senden" wurde geklickt');

      await page.waitForTimeout(2000);

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
      console.log(`   Betreff: ${email.subject}`);
      console.log(`   Body (erste 200 Zeichen): ${email.body.substring(0, 200)}`);

      let tanCode: string | null = null;
      const subjectMatch = email.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ Erster TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        const bodyMatch = email.body.match(/(\d{6})/);
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

      await page.waitForTimeout(500);
      await tanInput.fill(tanCode);
      console.log('✅ Erster TAN-Code eingegeben');

      // SCHRITT 7: Warte auf nächsten Screen mit SMS-TAN-Anforderung
      console.log('⏳ SCHRITT 7: Warte auf Screen-Update (2FA SMS-TAN wird versendet)...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(3000);

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
      await page.waitForTimeout(1000);

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
            await page.waitForTimeout(100);
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

        await page.waitForTimeout(500);
        await smsInput.fill(smsCode);
        console.log('✅ SMS-Code eingegeben');
      }

      await page.waitForTimeout(1000);

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

      await page.waitForTimeout(1500);

      // SCHRITT 11: Warte auf Screen mit "Passwort ändern" und "Weiter"
      console.log('🔍 SCHRITT 11: Warte auf Screen mit "Passwort ändern" / "Weiter"...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForTimeout(500);

      const currentBodyText = await page.locator('body').textContent() || '';
      
      // Prüfe auf Cookie-Banner und akzeptiere BEVOR wir auf "Weiter" klicken
      if (currentBodyText.toLowerCase().includes('cookie') || currentBodyText.toLowerCase().includes('geht klar')) {
        console.log('🍪 Cookie-Banner erkannt - schließe schnell via JavaScript...');
        
        // Schließe Cookie-Banner schnell via JavaScript
        const cookieLink = page.locator('a:has-text("Nur notwendige Cookies")').first();
        if (await cookieLink.count() > 0) {
          try {
            await cookieLink.evaluate((e: any) => e.click());
            console.log('✅ Cookie-Banner geschlossen');
          } catch (e) {
            // Ignoriere
          }
        }
        await page.waitForTimeout(500);
      }

      // SCHRITT 12: Klicke "Weiter" (NICHT "Passwort ändern")
      console.log('➡️  SCHRITT 12: Klicke "Weiter" (ohne Passwort zu ändern)...');
      
      await page.waitForTimeout(300);
      
      // Finde den SICHTBAREN "weiter" Button (es gibt viele, aber nur einer ist sichtbar!)
      const allWeiterButtons = await page.locator('button[type="submit"]:has-text("weiter")').all();
      let weiterButtonStep12 = null;
      
      console.log(`🔍 Suche sichtbaren "weiter" Button unter ${allWeiterButtons.length} Buttons...`);
      
      for (const btn of allWeiterButtons) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          weiterButtonStep12 = btn;
          const btnText = await btn.textContent();
          console.log(`✅ SICHTBAREN "Weiter" Button gefunden: "${btnText?.trim()}"`);
          break;
        }
      }
      
      if (!weiterButtonStep12) {
        console.log('⚠️  Kein sichtbarer "weiter" Button gefunden, nehme ersten Button');
        weiterButtonStep12 = allWeiterButtons[0];
      }

      if (weiterButtonStep12) {
        try {
          const isVisible = await weiterButtonStep12.isVisible().catch(() => false);
          if (isVisible) {
            await weiterButtonStep12.click({ timeout: 5000 });
            console.log('✅ "Weiter" geklickt');
          } else {
            // Button nicht sichtbar, verwende JavaScript
            await weiterButtonStep12.evaluate((el: any) => el.click());
            console.log('✅ "Weiter" geklickt (via JavaScript)');
          }
        } catch (e) {
          throw new Error(`Konnte "Weiter" Button nicht klicken: ${e}`);
        }
      } else {
        throw new Error('Konnte "Weiter" Button nicht finden');
      }

      await page.waitForTimeout(3000);

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
      await page.waitForTimeout(5000);
      
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

});
