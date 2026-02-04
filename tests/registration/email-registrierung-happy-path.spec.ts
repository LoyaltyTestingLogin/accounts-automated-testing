import { test, expect } from '@playwright/test';
import { expectLoginSuccess } from '../helpers/auth';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CHECK24 Registrierung - E-Mail Happy Path Tests
 * 
 * Testet den vollständigen Registrierungs-Flow mit E-Mail-Adresse
 */

test.describe('CHECK24 Registrierung - E-Mail Happy Path', () => {

  test('Erfolgreiche E-Mail-Registrierung', async ({ browser }) => {
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

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(2000);

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

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton2 = page.getByRole('button', { name: 'Weiter' });
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(2000);

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

      await page.waitForTimeout(500);
      await tanInput.fill(tanCode);
      console.log('✅ TAN-Code eingegeben (6-stellig komplett)');

      // SCHRITT 5: Warte auf Auto-Submit und Callback-Weiterleitung
      console.log('⏳ SCHRITT 5: Warte auf Auto-Submit und Weiterleitung zum Kundenbereich...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 8000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(2000);
      }

      // SCHRITT 6: c24session Cookie verifizieren
      console.log('🔍 SCHRITT 6: Prüfe c24session Cookie...');
      await expectLoginSuccess(page);

      // SCHRITT 7: Starte asynchrone Prüfung auf Willkommensmail
      console.log('📧 SCHRITT 7: Starte asynchrone Prüfung auf Willkommensmail...');
      
      const welcomeEmailPromise = emailClient.waitForEmail(
        {
          subject: 'Herzlich willkommen bei CHECK24!',
        },
        30000,
        2000
      ).then((welcomeEmail) => {
        console.log(`✅ Willkommensmail erhalten: "${welcomeEmail.subject}"`);
        return welcomeEmail;
      }).catch(async () => {
        console.warn('⚠️  Willkommensmail nicht innerhalb von 30 Sekunden erhalten');
        await sendEmailTimeoutWarning(
          'E-Mail-Registrierung - Willkommensmail',
          'subject: Herzlich willkommen bei CHECK24!',
          30
        );
        return null;
      });

      console.log(`✅ E-Mail-Registrierung vollständig erfolgreich für: ${email}`);

      // SCHRITT 8: Konto wieder löschen (parallel zur Willkommensmail-Prüfung)
      console.log('🗑️  SCHRITT 8: Lösche das neu erstellte Konto (parallel zur Willkommensmail-Prüfung)...');
      
      // Cookie-Banner schließen (falls vorhanden)
      console.log('   Prüfe auf Cookie-Banner...');
      try {
        const cookieBannerButton = page.getByText('geht klar', { exact: true });
        const cookieButtonVisible = await cookieBannerButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (cookieButtonVisible) {
          await cookieBannerButton.click();
          await page.waitForTimeout(1000);
          console.log('   ✅ Cookie-Banner geschlossen');
        }
      } catch (e) {
        // Kein Cookie-Banner, weiter geht's
      }

      // Klick auf "Anmelden & Sicherheit"
      console.log('   Klicke auf "Anmelden & Sicherheit"...');
      const anmeldenSicherheitLink = page.getByRole('link', { name: 'Anmelden & Sicherheit' });
      await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
      await anmeldenSicherheitLink.click({ force: true });
      console.log('   ✅ "Anmelden & Sicherheit" geklickt');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Klick auf "Kundenkonto löschen"
      console.log('   Klicke auf "Kundenkonto löschen"...');
      const kundenkontoLoeschenLink = page.getByText('Kundenkonto löschen');
      await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
      await kundenkontoLoeschenLink.click();
      console.log('   ✅ "Kundenkonto löschen" geklickt');
      await page.waitForTimeout(1500);

      // Checkbox setzen (Name: "terms")
      console.log('   Setze Bestätigungs-Checkbox...');
      const checkbox = page.locator('input[name="terms"][type="checkbox"]');
      await checkbox.waitFor({ state: 'visible', timeout: 10000 });
      await checkbox.check();
      console.log('   ✅ Checkbox gesetzt');
      await page.waitForTimeout(500);

      // Klick auf "entfernen" Button
      console.log('   Klicke auf "entfernen"-Button...');
      const entfernenButton = page.getByRole('button', { name: 'entfernen', exact: true });
      await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
      await entfernenButton.click();
      console.log('   ✅ "entfernen" geklickt');
      await page.waitForTimeout(2000);

      console.log('✅ Konto erfolgreich gelöscht');

      // Warte auf Abschluss der Willkommensmail-Prüfung
      await welcomeEmailPromise;
    } finally {
      await context.close();
    }
  });

});
