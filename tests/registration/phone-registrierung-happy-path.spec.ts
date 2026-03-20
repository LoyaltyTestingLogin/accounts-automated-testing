import { test } from '../fixtures/test-hooks';
import { expectLoginSuccess } from '../helpers/auth';
import { closeCookieGehtKlarIfVisible } from '../helpers/cookie-consent';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getEnvironment } from '../helpers/environment';
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CHECK24 Registrierung - Phone Happy Path Tests
 * 
 * Testet den vollständigen Registrierungs-Flow mit Phone
 */

test.describe('CHECK24 Registrierung - Phone Happy Path', () => {

  test('Erfolgreiche Phone-Registrierung', async ({ browser }) => {
    enableAutoScreenshots('phone-registration');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      console.log('📱 Starte Phone-Registrierung...');

      // Zur Login/Registrierungs-Seite navigieren
      const baseUrl = process.env.CHECK24_BASE_URL;
      if (!baseUrl) {
        throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
      }
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
      
      await takeAutoScreenshot(page, 'login-screen-empty');

      // SCHRITT 1: Generiere eindeutige Phone mit aktueller Uhrzeit
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeExtension = hours + minutes; // z.B. "1430" für 14:30
      const phoneNumber = `01746760225 ext. ${timeExtension}`;
      
      console.log(`📱 SCHRITT 1: Gebe Phone ein: ${phoneNumber}`);
      const phoneInput = page.locator('#cl_login');
      await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);
      await phoneInput.fill(phoneNumber);
      await page.waitForTimeout(500);
      
      await takeAutoScreenshot(page, 'phone-entered');

      // Klick auf "Weiter" (nach Telefon – Login-Screen)
      console.log('➡️  Klicke auf "Weiter"-Button (#c24-uli-login-btn)...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(1000);
      
      await takeAutoScreenshot(page, 'email-input-screen');

      // SCHRITT 2: E-Mail-Adresse eingeben
      const timestamp = new Date().toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 14); // Format: YYYYMMDDHHMMSS
      const email = `loyaltytesting+${timestamp}@check24.de`;
      
      console.log(`📧 SCHRITT 2: Gebe E-Mail ein: ${email}`);
      const emailInput = page.locator('#cl_email_registercheck');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(email);
      console.log('   ✅ E-Mail eingegeben');
      await page.waitForTimeout(500);
      
      await takeAutoScreenshot(page, 'email-entered');

      // Klick auf "Weiter" (Registercheck / E-Mail-Zwischenschritt)
      console.log('➡️  Klicke auf "Weiter"-Button (#c24-uli-registercheck-btn)...');
      const weiterButton2 = page.locator('#c24-uli-registercheck-btn');
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(1000);
      
      await takeAutoScreenshot(page, 'registration-form-empty');

      // SCHRITT 3: Registrierungsformular ausfüllen
      console.log('📝 SCHRITT 3: Fülle Registrierungsformular aus...');
      
      // Vorname eingeben
      console.log('   Gebe Vorname ein: Loyalty');
      const vornameInput = page.locator('#cl_ul_firstname');
      await vornameInput.waitFor({ state: 'visible', timeout: 10000 });
      await vornameInput.fill('Loyalty');
      console.log('   ✅ Vorname eingegeben');
      
      // Nachname eingeben
      console.log('   Gebe Nachname ein: Testing');
      const nachnameInput = page.locator('#cl_ul_lastname');
      await nachnameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nachnameInput.fill('Testing');
      console.log('   ✅ Nachname eingegeben');
      
      // Passwort in beide Felder eingeben
      console.log('   Gebe Passwort ein: 1qay1qay');
      const password1 = page.locator('#cl_pw_register');
      await password1.waitFor({ state: 'visible', timeout: 10000 });
      await password1.fill('1qay1qay');
      console.log('   ✅ Passwort in erstes Feld eingegeben');
      
      const password2 = page.locator('#cl_ul_pw_register_repeat');
      await password2.waitFor({ state: 'visible', timeout: 10000 });
      await password2.fill('1qay1qay');
      console.log('   ✅ Passwort in zweites Feld eingegeben');
      
      await takeAutoScreenshot(page, 'registration-form-filled');

      // Klick auf "Weiter" (Registrierungsformular)
      console.log('➡️  Klicke auf "Weiter"-Button (#c24-uli-register-btn)...');
      const weiterButton3 = page.locator('#c24-uli-register-btn');
      await weiterButton3.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(1000);

      // SCHRITT 4: E-Mail-Verifizierung - TAN aus E-Mail holen
      console.log('📧 SCHRITT 4: Warte auf E-Mail-TAN-Code...');
      const emailClient = getEmailClient();
      
      let emailTanEmail;
      try {
        emailTanEmail = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Phone-Registrierung - E-Mail-TAN-Verifizierung',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      if (!emailTanEmail) {
        throw new Error('E-Mail-TAN E-Mail nicht erhalten');
      }

      // E-Mail-TAN-Code extrahieren
      console.log('🔍 Extrahiere E-Mail-TAN-Code...');
      console.log(`   Betreff: ${emailTanEmail.subject}`);
      
      let emailTanCode: string | null = null;
      const emailSubjectMatch = emailTanEmail.subject.match(/(\d{6})/);
      if (emailSubjectMatch) {
        emailTanCode = emailSubjectMatch[1];
        console.log(`✅ E-Mail-TAN-Code extrahiert aus Betreff: ${emailTanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = emailTanEmail.body.match(/(\d{6})/);
        if (bodyMatch) {
          emailTanCode = bodyMatch[1];
          console.log(`✅ E-Mail-TAN-Code extrahiert aus Body: ${emailTanCode}`);
        } else {
          throw new Error('Konnte E-Mail-TAN-Code nicht extrahieren');
        }
      }

      console.log(`🔑 E-Mail-TAN-Code erhalten: ${emailTanCode}`);

      // SCHRITT 5: E-Mail-TAN-Code eingeben
      console.log('🔍 SCHRITT 5: Gebe E-Mail-TAN-Code ein...');
      
      let emailTanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            emailTanInput = input;
            console.log(`✅ E-Mail-TAN-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (emailTanInput) break;
      }

      if (!emailTanInput) {
        throw new Error('Konnte E-Mail-TAN-Eingabefeld nicht finden');
      }
      
      await takeAutoScreenshot(page, 'email-tan-input-screen');

      await page.waitForTimeout(500);
      await emailTanInput.fill(emailTanCode);
      console.log('✅ E-Mail-TAN-Code eingegeben');
      
      await takeAutoScreenshot(page, 'email-tan-entered');

      // SCHRITT 6: Warte auf nächsten Screen (SMS-Verifizierung)
      console.log('⏳ SCHRITT 6: Warte auf SMS-Verifizierungs-Screen...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(1000);
      
      await takeAutoScreenshot(page, 'sms-verification-screen');

      // SCHRITT 7: SMS-Verifizierung - TAN aus weitergeleiteter SMS-E-Mail holen
      console.log('📱 SCHRITT 7: Warte auf SMS-TAN-Code (weitergeleitet per E-Mail)...');
      
      let smsTanEmail;
      try {
        smsTanEmail = await emailClient.waitForEmail(
          {
            from: 'ulitesting@icloud.com',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Phone-Registrierung - SMS-TAN-Verifizierung',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }

      if (!smsTanEmail) {
        throw new Error('SMS-TAN E-Mail nicht erhalten');
      }

      // SMS-TAN-Code extrahieren
      console.log('🔍 Extrahiere SMS-TAN-Code aus weitergeleiteter SMS...');
      console.log(`   Betreff: ${smsTanEmail.subject}`);
      
      let smsTanCode: string | null = null;
      const smsSubjectMatch = smsTanEmail.subject.match(/(\d{6})/);
      if (smsSubjectMatch) {
        smsTanCode = smsSubjectMatch[1];
        console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const smsBodyMatch = smsTanEmail.body.match(/(\d{6})/);
        if (smsBodyMatch) {
          smsTanCode = smsBodyMatch[1];
          console.log(`✅ SMS-TAN-Code extrahiert aus Body: ${smsTanCode}`);
        } else {
          throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
        }
      }

      console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCode}`);

      // SCHRITT 8: SMS-TAN-Code eingeben
      console.log('🔍 SCHRITT 8: Gebe SMS-TAN-Code ein...');
      
      let smsTanInput = null;
      for (const selector of inputSelectors) {
        const inputs = await page.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            smsTanInput = input;
            console.log(`✅ SMS-TAN-Eingabefeld gefunden mit ${selector}`);
            break;
          }
        }
        if (smsTanInput) break;
      }

      if (!smsTanInput) {
        throw new Error('Konnte SMS-TAN-Eingabefeld nicht finden');
      }
      
      await takeAutoScreenshot(page, 'sms-tan-input-screen');

      await page.waitForTimeout(500);
      await smsTanInput.fill(smsTanCode);
      console.log('✅ SMS-TAN-Code eingegeben');
      
      await takeAutoScreenshot(page, 'sms-tan-entered');

      // SCHRITT 9: Warte auf Auto-Submit und Callback-Weiterleitung
      console.log('⏳ SCHRITT 9: Warte auf Auto-Submit und Weiterleitung zum Kundenbereich...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(1000);
      }

      // Warte zusätzlich, damit alle Cookies gesetzt werden
      console.log('⏳ Warte auf Cookie-Setzung...');
      await page.waitForTimeout(3000);

      // SCHRITT 10: c24session Cookie verifizieren
      console.log('🔍 SCHRITT 10: Prüfe c24session Cookie...');
      await expectLoginSuccess(page);

      // Cookie-HTML-Banner sofort weg (Overlay blockiert sonst Profil/Navigation)
      console.log('🍪 Schließe Cookie-Banner („geht klar“), sobald Kundenbereich steht...');
      await closeCookieGehtKlarIfVisible(page);

      await takeAutoScreenshot(page, 'kundenbereich');

      console.log(`✅ Phone-Registrierung (Flow) abgeschlossen für: ${phoneNumber} / ${email}`);
      
      // Test erfolgreich - Screenshots übernehmen
      commitScreenshots();

      // SCHRITT 11: Konto wieder löschen (wie account-replace: Profil → Einstellungen → löschen)
      console.log('🗑️  SCHRITT 11: Lösche das neu erstellte Konto...');

      // Nochmals falls Banner zwischenzeitlich wieder kam (günstig: nur DOM-click)
      await closeCookieGehtKlarIfVisible(page);
      console.log('   ✅ Cookie-Banner vor Cleanup geprüft');

      console.log('   Klicke Profil-Menü...');
      const profilLink = page.locator('a.c24-customer-hover-wrapper').first();
      await profilLink.waitFor({ state: 'visible', timeout: 10000 });
      await profilLink.click({ force: true });
      await page.waitForTimeout(350);

      console.log('   Klicke auf "Anmelden & Sicherheit" (settings/overview)...');
      const anmeldenSicherheitLink = page.locator('a[href*="/settings/overview"]').first();
      await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
      await anmeldenSicherheitLink.click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);

      const currentUrl = page.url();
      const environment = getEnvironment();
      if (environment === 'test') {
        if (currentUrl.includes('accounts.check24.com') && !currentUrl.includes('accounts.check24-test.com')) {
          await page.goto('https://accounts.check24-test.com/settings/overview');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(400);
        }
      }

      console.log('   Klicke auf "Kundenkonto löschen"...');
      const kundenkontoLoeschenLink = page
        .locator('.c24-acs__settings__overview-page__subHeadline a')
        .filter({ hasText: 'Kundenkonto löschen' })
        .first();
      await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
      await kundenkontoLoeschenLink.click();
      await page.waitForTimeout(1500);

      console.log('   Setze Bestätigungs-Checkbox (wie account-replace)...');
      const checkbox = page.locator('input[name="terms"][type="checkbox"]');
      await checkbox.waitFor({ state: 'visible', timeout: 10000 });
      await checkbox.check();
      console.log('   ✅ Checkbox gesetzt');
      await page.waitForTimeout(500);

      console.log('   Klicke auf Primär-Button „entfernen“ (c24-acs-button__primary)...');
      const entfernenButton = page.locator('button.c24-acs-button__primary').first();
      await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
      await entfernenButton.click();
      console.log('   ✅ Entfernen geklickt');
      await page.waitForTimeout(1000);

      console.log('✅ Konto erfolgreich gelöscht');
    } finally {
      disableAutoScreenshots();
      await context.close();
    }
  });

});
