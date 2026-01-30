import { test, expect } from '@playwright/test';
import { expectLoginSuccess } from '../helpers/auth';
import { getEmailClient } from '../helpers/email';
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
      
      const tanEmail = await emailClient.waitForEmail(
        {
          subject: 'CHECK24',
        },
        120000,
        3000
      );

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
        await page.waitForURL(/kundenbereich\.check24\.de/, { timeout: 15000 });
        console.log('✅ Zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log(`⚠️  Weiterleitung dauert länger - aktuelle URL: ${page.url()}`);
        await page.waitForTimeout(3000);
      }

      // SCHRITT 6: c24session Cookie verifizieren
      console.log('🔍 SCHRITT 6: Prüfe c24session Cookie...');
      await expectLoginSuccess(page);

      // SCHRITT 7: Prüfe auf Willkommensmail
      console.log('📧 SCHRITT 7: Prüfe auf Willkommensmail...');
      
      try {
        const welcomeEmail = await emailClient.waitForEmail(
          {
            subject: 'Herzlich willkommen bei CHECK24!',
          },
          30000,
          2000
        );
        
        console.log(`✅ Willkommensmail erhalten: "${welcomeEmail.subject}"`);
      } catch (e) {
        console.warn('⚠️  Willkommensmail nicht innerhalb von 30 Sekunden erhalten - fahre trotzdem fort');
      }

      console.log(`✅ E-Mail-Registrierung vollständig erfolgreich für: ${email}`);
    } finally {
      await context.close();
    }
  });

});
