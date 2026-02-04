import { test, expect } from '@playwright/test';
import { expectLoginSuccess } from '../helpers/auth';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CHECK24 Registrierung - Phone Happy Path Tests
 * 
 * Testet den vollständigen Registrierungs-Flow mit Phone
 */

test.describe('CHECK24 Registrierung - Phone Happy Path', () => {

  test('Erfolgreiche Phone-Registrierung', async ({ browser }) => {
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

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton = page.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(2000);

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

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton2 = page.getByRole('button', { name: 'Weiter' });
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(2000);

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

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton3 = page.getByRole('button', { name: 'Weiter' });
      await weiterButton3.click();
      console.log('✅ "Weiter" wurde geklickt');
      await page.waitForTimeout(2000);

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

      await page.waitForTimeout(500);
      await emailTanInput.fill(emailTanCode);
      console.log('✅ E-Mail-TAN-Code eingegeben');

      // SCHRITT 6: Warte auf nächsten Screen (SMS-Verifizierung)
      console.log('⏳ SCHRITT 6: Warte auf SMS-Verifizierungs-Screen...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);

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

      await page.waitForTimeout(500);
      await smsTanInput.fill(smsTanCode);
      console.log('✅ SMS-TAN-Code eingegeben');

      // SCHRITT 9: Warte auf Auto-Submit und Callback-Weiterleitung
      console.log('⏳ SCHRITT 9: Warte auf Auto-Submit und Weiterleitung zum Kundenbereich...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 8000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(2000);
      }

      // SCHRITT 10: c24session Cookie verifizieren
      console.log('🔍 SCHRITT 10: Prüfe c24session Cookie...');
      await expectLoginSuccess(page);

      // SCHRITT 11: Starte asynchrone Prüfung auf Willkommensmail
      console.log('📧 SCHRITT 11: Starte asynchrone Prüfung auf Willkommensmail...');
      
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
          'Phone-Registrierung - Willkommensmail',
          'subject: Herzlich willkommen bei CHECK24!',
          30
        );
        return null;
      });

      console.log(`✅ Phone-Registrierung vollständig erfolgreich für: ${phoneNumber} / ${email}`);

      // SCHRITT 12: Konto wieder löschen (parallel zur Willkommensmail-Prüfung)
      console.log('🗑️  SCHRITT 12: Lösche das neu erstellte Konto (parallel zur Willkommensmail-Prüfung)...');
      
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
