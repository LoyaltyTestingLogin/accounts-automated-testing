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
 * CHECK24 Registrierung - E-Mail Happy Path Tests
 * 
 * Testet den vollständigen Registrierungs-Flow mit E-Mail-Adresse
 */

test.describe('CHECK24 Registrierung - E-Mail Happy Path', () => {

  test('Erfolgreiche E-Mail-Registrierung', async ({ browser }) => {
    enableAutoScreenshots('email-registration');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      console.log('📝 Starte E-Mail-Registrierung...');

      // Zur Login/Registrierungs-Seite navigieren
      const baseUrl = process.env.CHECK24_BASE_URL;
      if (!baseUrl) {
        throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
      }
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
      
      await takeAutoScreenshot(page, 'login-screen-empty');

      // SCHRITT 1: Generiere eindeutige E-Mail-Adresse mit Timestamp
      const timestamp = new Date().toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 14); // Format: YYYYMMDDHHMMSS
      const email = `loyaltytesting+${timestamp}@check24.de`;
      
      console.log(`📧 SCHRITT 1: Gebe E-Mail ein: ${email}`);
      const emailInput = page.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);
      await emailInput.fill(email);
      await page.waitForTimeout(500);
      
      await takeAutoScreenshot(page, 'email-entered');

      // Klick auf "Weiter" (Login-Screen, gleiche ID wie otp-happy-path)
      console.log('➡️  Klicke auf "Weiter"-Button (#c24-uli-login-btn)...');
      const weiterButton = page.locator('#c24-uli-login-btn');
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(1000);
      
      await takeAutoScreenshot(page, 'registration-form-empty');

      // SCHRITT 2: Registrierungsformular ausfüllen
      console.log('📝 SCHRITT 2: Fülle Registrierungsformular aus...');
      
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
      const weiterButton2 = page.locator('#c24-uli-register-btn');
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(1000);

      // SCHRITT 3: E-Mail-Verifizierung - TAN aus E-Mail holen
      console.log('📧 SCHRITT 3: Warte auf TAN-Code per E-Mail...');
      const emailClient = getEmailClient();
      
      let tanEmail;
      try {
        tanEmail = await emailClient.waitForEmail(
          {
            subject: 'CHECK24',
          },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'E-Mail-Registrierung - TAN-Verifizierung',
          'subject: CHECK24',
          120
        );
        throw error;
      }

      // TAN-Code extrahieren
      console.log('🔍 Extrahiere TAN-Code aus E-Mail...');
      console.log(`   Betreff: ${tanEmail.subject}`);
      
      let tanCode: string | null = null;
      const subjectMatch = tanEmail.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
        console.log(`✅ TAN-Code extrahiert aus Betreff: ${tanCode}`);
      } else {
        // Fallback: Aus Body extrahieren
        const bodyMatch = tanEmail.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
          console.log(`✅ TAN-Code extrahiert aus Body: ${tanCode}`);
        } else {
          throw new Error('Konnte TAN-Code nicht aus E-Mail extrahieren');
        }
      }

      console.log(`🔑 TAN-Code erhalten: ${tanCode}`);

      // SCHRITT 4: TAN-Code eingeben
      console.log('🔍 SCHRITT 4: Suche TAN-Eingabefeld...');
      
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
      
      await takeAutoScreenshot(page, 'tan-input-screen');

      await page.waitForTimeout(500);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');
      
      await takeAutoScreenshot(page, 'tan-entered');

      // SCHRITT 5: Warte auf Auto-Submit und Callback-Weiterleitung
      console.log('⏳ SCHRITT 5: Warte auf Auto-Submit und Weiterleitung zum Kundenbereich...');
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

      // SCHRITT 6: c24session Cookie verifizieren
      console.log('🔍 SCHRITT 6: Prüfe c24session Cookie...');
      await expectLoginSuccess(page);

      // Cookie-HTML-Banner sofort weg (Overlay blockiert sonst Profil/Navigation)
      console.log('🍪 Schließe Cookie-Banner („geht klar“), sobald Kundenbereich steht...');
      await closeCookieGehtKlarIfVisible(page);

      await takeAutoScreenshot(page, 'kundenbereich');

      console.log(`✅ E-Mail-Registrierung (Flow) abgeschlossen für: ${email}`);
      
      // Test erfolgreich - Screenshots übernehmen
      commitScreenshots();

      // SCHRITT 7: Konto wieder löschen (wie account-replace: Profil → Einstellungen → löschen)
      console.log('🗑️  SCHRITT 7: Lösche das neu erstellte Konto...');

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
