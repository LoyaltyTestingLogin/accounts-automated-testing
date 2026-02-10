import { test, expect } from '@playwright/test';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl, getKundenbereichUrl } from '../helpers/environment';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CHECK24 Login - PLZ/Birthday Challenge Tests
 * 
 * Testet Passwort-Reset und OTP-Login mit PLZ/Birthday-Challenge
 */

test.describe('CHECK24 Login - PLZ/Birthday Challenge', () => {

  test('Passwort-Reset mit PLZ/Birthday Challenge - Phone Account', async ({ browser }) => {
    console.log('\n🔐 === PASSWORT-RESET MIT PLZ/BIRTHDAY CHALLENGE ===\n');

    // TEIL 1: Account-Erstellung mit Phone-Registrierung
    console.log('📝 TEIL 1: Erstelle neuen Account via Phone-Registrierung...');
    
    const registrationContext = await browser.newContext();
    const registrationPage = await registrationContext.newPage();

    let phoneNumber: string;
    let email: string;

    try {
      // Zur Registrierungs-Seite navigieren
      const baseUrl = process.env.CHECK24_BASE_URL;
      if (!baseUrl) {
        throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
      }
      await registrationPage.goto(baseUrl);
      await registrationPage.waitForLoadState('networkidle');

      // SCHRITT 1: Generiere eindeutige Phone mit aktueller Uhrzeit
      // Prüfe, ob Account bereits existiert und versuche es ggf. mit anderer Extension
      let accountExists = true;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (accountExists && attempts < maxAttempts) {
        attempts++;
        
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        // Für den ersten Versuch: HHMM, danach: HHMM + Versuchsnummer
        let timeExtension;
        if (attempts === 1) {
          timeExtension = hours + minutes;
        } else {
          // Füge Sekunden oder Attempt-Counter hinzu
          const attemptSuffix = String(attempts - 1).padStart(2, '0');
          timeExtension = hours + minutes.slice(0, 2) + attemptSuffix;
        }
        
        phoneNumber = `01746760225 ext. ${timeExtension}`;
        
        console.log(`📱 SCHRITT 1 (Versuch ${attempts}/${maxAttempts}): Gebe Phone ein: ${phoneNumber}`);
        const phoneInput = registrationPage.locator('#cl_login');
        await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
        await registrationPage.waitForTimeout(300);
        
        // Lösche vorherigen Input falls vorhanden
        await phoneInput.clear();
        await phoneInput.fill(phoneNumber);
        await registrationPage.waitForTimeout(500);

        // Klick auf "Weiter"
        console.log('➡️  Klicke auf "Weiter"-Button...');
        const weiterButton = registrationPage.getByRole('button', { name: 'Weiter' });
        await weiterButton.click();
        console.log('✅ "Weiter" wurde geklickt');
        await registrationPage.waitForTimeout(1500);

        // Prüfe: Sind wir auf E-Mail-Eingabe (Registrierung) oder Passwort-Eingabe (Account existiert)?
        const emailInputVisible = await registrationPage.locator('#cl_email_registercheck').isVisible().catch(() => false);
        const passwordInputVisible = await registrationPage.locator('#cl_pw_login').isVisible().catch(() => false);
        
        if (emailInputVisible) {
          console.log('✅ E-Mail-Eingabe-Feld sichtbar → Neue Registrierung möglich');
          accountExists = false;
        } else if (passwordInputVisible) {
          console.log('⚠️  Passwort-Eingabe-Feld sichtbar → Account existiert bereits!');
          console.log('🔄 Gehe zurück und versuche andere Phone-Nummer...');
          
          // Gehe zurück
          await registrationPage.goBack();
          await registrationPage.waitForTimeout(1000);
          accountExists = true;
        } else {
          console.log('⚠️  Unerwarteter Screen - warte kurz...');
          await registrationPage.waitForTimeout(1000);
          
          // Nochmal prüfen
          const emailInputVisible2 = await registrationPage.locator('#cl_email_registercheck').isVisible().catch(() => false);
          if (emailInputVisible2) {
            console.log('✅ E-Mail-Eingabe-Feld nun sichtbar → Neue Registrierung möglich');
            accountExists = false;
          } else {
            console.log('❌ Konnte Screen nicht identifizieren');
            throw new Error('Konnte weder E-Mail- noch Passwort-Eingabe finden');
          }
        }
      }

      if (accountExists) {
        throw new Error(`Konnte nach ${maxAttempts} Versuchen keine eindeutige Phone-Nummer finden`);
      }

      console.log(`✅ Eindeutige Phone-Nummer gefunden: ${phoneNumber}`);

      // SCHRITT 2: E-Mail-Adresse eingeben
      const timestamp = new Date().toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 14);
      email = `loyaltytesting+${timestamp}@check24.de`;
      
      console.log(`📧 SCHRITT 2: Gebe E-Mail ein: ${email}`);
      const emailInput = registrationPage.locator('#cl_email_registercheck');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(email);
      console.log('   ✅ E-Mail eingegeben');
      await registrationPage.waitForTimeout(500);

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton2 = registrationPage.getByRole('button', { name: 'Weiter' });
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await registrationPage.waitForTimeout(1000);

      // SCHRITT 3: Registrierungsformular ausfüllen (normale Phone-Registrierung)
      console.log('📝 SCHRITT 3: Fülle Registrierungsformular aus...');
      
      // Vorname
      console.log('   Gebe Vorname ein: Loyalty');
      const vornameInput = registrationPage.locator('#cl_ul_firstname');
      await vornameInput.waitFor({ state: 'visible', timeout: 10000 });
      await vornameInput.fill('Loyalty');
      console.log('   ✅ Vorname eingegeben');
      
      // Nachname
      console.log('   Gebe Nachname ein: Testing');
      const nachnameInput = registrationPage.locator('#cl_ul_lastname');
      await nachnameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nachnameInput.fill('Testing');
      console.log('   ✅ Nachname eingegeben');
      
      // Passwort in beide Felder eingeben
      console.log('   Gebe Passwort ein: 1qay1qay');
      const password1 = registrationPage.locator('#cl_pw_register');
      await password1.waitFor({ state: 'visible', timeout: 10000 });
      await password1.fill('1qay1qay');
      console.log('   ✅ Passwort in erstes Feld eingegeben');
      
      const password2 = registrationPage.locator('#cl_ul_pw_register_repeat');
      await password2.waitFor({ state: 'visible', timeout: 10000 });
      await password2.fill('1qay1qay');
      console.log('   ✅ Passwort in zweites Feld eingegeben');

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton3 = registrationPage.getByRole('button', { name: 'Weiter' });
      await weiterButton3.click();
      console.log('✅ "Weiter" wurde geklickt');
      await registrationPage.waitForTimeout(1000);

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
          'Phone-Registrierung (PLZ/Birthday Test) - E-Mail-TAN-Verifizierung',
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
        const inputs = await registrationPage.locator(selector).all();
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

      await registrationPage.waitForTimeout(500);
      await emailTanInput.fill(emailTanCode);
      console.log('✅ E-Mail-TAN-Code eingegeben');

      // SCHRITT 6: Warte auf SMS-Verifizierungs-Screen
      console.log('⏳ SCHRITT 6: Warte auf SMS-Verifizierungs-Screen...');
      await registrationPage.waitForLoadState('networkidle', { timeout: 30000 });
      await registrationPage.waitForTimeout(1000);

      // SCHRITT 7: SMS-TAN aus weitergeleiteter SMS-E-Mail holen
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
          'Phone-Registrierung (PLZ/Birthday Test) - SMS-TAN-Verifizierung',
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
        const inputs = await registrationPage.locator(selector).all();
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

      await registrationPage.waitForTimeout(500);
      await smsTanInput.fill(smsTanCode);
      console.log('✅ SMS-TAN-Code eingegeben');

      // Warte auf Weiterleitung zum Kundenbereich
      console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
      await registrationPage.waitForLoadState('networkidle', { timeout: 30000 });
      
      try {
        await registrationPage.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅ Erfolgreich zum Kundenbereich weitergeleitet');
      } catch (e) {
        console.log('⏳ Warte zusätzlich auf Kundenbereich-URL...');
        await registrationPage.waitForTimeout(1000);
      }

      console.log('✅ Account erfolgreich registriert!');
      console.log(`   📱 Phone: ${phoneNumber}`);
      console.log(`   📧 E-Mail: ${email}`);

      // SCHRITT 9: Füge Geburtsdatum in Persönlichen Daten hinzu
      console.log('\n📝 SCHRITT 9: Füge Geburtsdatum in Persönlichen Daten hinzu...');
      
      // Cookie-Banner schließen falls vorhanden
      console.log('🍪 Prüfe auf Cookie-Banner...');
      await registrationPage.waitForTimeout(2000);
      
      try {
        const cookieBannerButton = registrationPage.getByText('geht klar', { exact: true });
        const cookieButtonVisible = await cookieBannerButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (cookieButtonVisible) {
          await cookieBannerButton.click();
          await registrationPage.waitForTimeout(1000);
          console.log('✅ Cookie-Banner geschlossen mit "geht klar"');
        } else {
          console.log('ℹ️  Kein Cookie-Banner mit "geht klar" gefunden');
        }
      } catch (e) {
        console.log('ℹ️  Cookie-Banner konnte nicht geschlossen werden oder ist nicht vorhanden');
      }

      // Klick auf "Profil" oben rechts
      console.log('👤 Suche "Profil" Link/Button...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      const profilSelectors = [
        'a:has-text("Profil")',
        'button:has-text("Profil")',
        'a:has-text("profil")',
        '[href*="profil"]',
        '[data-testid*="profil"]',
        'nav a, nav button', // Alle Links/Buttons in Navigation
      ];
      
      let profilLink = null;
      for (const selector of profilSelectors) {
        try {
          const elements = await registrationPage.locator(selector).all();
          for (const element of elements) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              const text = await element.textContent().catch(() => '');
              if (text && text.toLowerCase().includes('profil')) {
                profilLink = element;
                console.log(`✅ "Profil" Link gefunden: "${text.trim()}" (${selector})`);
                break;
              }
            }
          }
          if (profilLink) break;
        } catch (e) {
          continue;
        }
      }

      if (!profilLink) {
        console.log('⚠️  "Profil" Link nicht gefunden - liste alle sichtbaren Links/Buttons:');
        const allLinks = await registrationPage.locator('a, button').all();
        let count = 0;
        for (const link of allLinks) {
          const isVisible = await link.isVisible().catch(() => false);
          if (isVisible && count < 20) {
            const text = await link.textContent().catch(() => '');
            const href = await link.getAttribute('href').catch(() => '');
            if (text?.trim()) {
              console.log(`   ${count+1}. "${text.trim()}" (href: ${href || 'none'})`);
              count++;
            }
          }
        }
        throw new Error('Konnte "Profil" Link nicht finden');
      }

      try {
        await profilLink.click({ timeout: 5000 });
        console.log('✅ "Profil" geklickt');
      } catch (e) {
        console.log('⚠️  Normal-Click fehlgeschlagen, versuche force-click...');
        await profilLink.click({ force: true });
        console.log('✅ "Profil" geklickt (force)');
      }
      await registrationPage.waitForTimeout(1500);

      // Klick auf "Persönliche Daten"
      console.log('📋 Suche "Persönliche Daten" Link...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      const persoenlicheDatenSelectors = [
        'a:has-text("Persönliche Daten")',
        'button:has-text("Persönliche Daten")',
        'a:has-text("persönliche")',
        'a:has-text("Daten")',
        '[href*="persoenliche"]',
        '[href*="personal"]',
        '[href*="account"]',
      ];
      
      let persoenlicheDatenLink = null;
      for (const selector of persoenlicheDatenSelectors) {
        try {
          const elements = await registrationPage.locator(selector).all();
          for (const element of elements) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              const text = await element.textContent().catch(() => '');
              if (text && (text.toLowerCase().includes('persönliche') || text.toLowerCase().includes('daten'))) {
                persoenlicheDatenLink = element;
                console.log(`✅ "Persönliche Daten" Link gefunden: "${text.trim()}" (${selector})`);
                break;
              }
            }
          }
          if (persoenlicheDatenLink) break;
        } catch (e) {
          continue;
        }
      }

      if (!persoenlicheDatenLink) {
        console.log('⚠️  "Persönliche Daten" Link nicht gefunden - liste alle sichtbaren Links:');
        const allLinks = await registrationPage.locator('a, button').all();
        let count = 0;
        for (const link of allLinks) {
          const isVisible = await link.isVisible().catch(() => false);
          if (isVisible && count < 20) {
            const text = await link.textContent().catch(() => '');
            const href = await link.getAttribute('href').catch(() => '');
            if (text?.trim()) {
              console.log(`   ${count+1}. "${text.trim()}" (href: ${href || 'none'})`);
              count++;
            }
          }
        }
        throw new Error('Konnte "Persönliche Daten" Link nicht finden');
      }

      try {
        await persoenlicheDatenLink.click({ timeout: 5000 });
        console.log('✅ "Persönliche Daten" geklickt');
      } catch (e) {
        console.log('⚠️  Normal-Click fehlgeschlagen, versuche force-click...');
        await persoenlicheDatenLink.click({ force: true });
        console.log('✅ "Persönliche Daten" geklickt (force)');
      }
      await registrationPage.waitForTimeout(1500);

      // Klick auf "Geburtsdatum" links
      console.log('🎂 Klicke auf "Geburtsdatum"...');
      const geburtsdatumSelectors = [
        'a:has-text("Geburtsdatum")',
        'button:has-text("Geburtsdatum")',
        '[href*="geburtsdatum"]',
        '[href*="birthday"]',
      ];
      
      let geburtsdatumLink = null;
      for (const selector of geburtsdatumSelectors) {
        try {
          const element = registrationPage.locator(selector).first();
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            geburtsdatumLink = element;
            console.log(`✅ "Geburtsdatum" Link gefunden mit: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!geburtsdatumLink) {
        throw new Error('Konnte "Geburtsdatum" Link nicht finden');
      }

      try {
        await geburtsdatumLink.click({ timeout: 5000 });
        console.log('✅ "Geburtsdatum" geklickt');
      } catch (e) {
        console.log('⚠️  Normal-Click fehlgeschlagen, versuche force-click...');
        await geburtsdatumLink.click({ force: true });
        console.log('✅ "Geburtsdatum" geklickt (force)');
      }
      await registrationPage.waitForTimeout(1500);

      // Geburtsdatum eingeben
      // Das Feld hat ein maskiertes Format "TT.MM.JJJJ" - die Punkte werden automatisch eingefügt
      // Wir müssen nur die Zahlen eingeben: TTMMJJJJ
      const birthday = '26042000';  // Ohne Punkte!
      console.log(`📅 Suche Geburtsdatum-Eingabefeld...`);
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      // Warte kurz auf Seite
      await registrationPage.waitForTimeout(1500);
      
      let birthdayInput = null;
      
      // STRATEGIE 1: Suche Input-Feld über Label "Geburtsdatum"
      console.log('🔍 Strategie 1: Suche über Label "Geburtsdatum"...');
      try {
        // Finde alle Labels mit "Geburtsdatum"
        const labels = await registrationPage.locator('label').all();
        for (const label of labels) {
          const labelText = await label.textContent().catch(() => '');
          if (labelText && labelText.toLowerCase().includes('geburtsdatum')) {
            console.log(`   Gefundenes Label: "${labelText.trim()}"`);
            
            // Hole das "for" Attribut des Labels
            const forAttr = await label.getAttribute('for').catch(() => '');
            if (forAttr) {
              console.log(`   Label hat "for" Attribut: "${forAttr}"`);
              const input = registrationPage.locator(`#${forAttr}`);
              const isVisible = await input.isVisible().catch(() => false);
              if (isVisible) {
                birthdayInput = input;
                console.log(`✅ Geburtsdatum-Feld gefunden über Label-Verknüpfung!`);
                break;
              }
            } else {
              // Versuche Input-Feld direkt nach dem Label zu finden
              const nextInput = label.locator('xpath=following-sibling::input[1]');
              const isVisible = await nextInput.isVisible().catch(() => false);
              if (isVisible) {
                birthdayInput = nextInput;
                console.log(`✅ Geburtsdatum-Feld gefunden direkt nach Label!`);
                break;
              }
              
              // Oder Input innerhalb des Labels
              const inputInLabel = label.locator('input');
              const isVisibleInLabel = await inputInLabel.isVisible().catch(() => false);
              if (isVisibleInLabel) {
                birthdayInput = inputInLabel;
                console.log(`✅ Geburtsdatum-Feld gefunden innerhalb Label!`);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log(`⚠️  Strategie 1 fehlgeschlagen: ${e}`);
      }
      
      // STRATEGIE 2: Suche Input mit spezifischen Attributen (ohne Suchfeld)
      if (!birthdayInput) {
        console.log('🔍 Strategie 2: Suche über Input-Attribute...');
        const birthdayInputSelectors = [
          'input[name="birthdate"]',  // Das ist das richtige Feld!
          'input[name="birthday"]',
          'input[id="birthday"]',
          'input[name="geburtsdatum"]',
          'input[id="geburtsdatum"]',
          'input[placeholder*="TT.MM.JJJJ"]',
          'input[placeholder*="Geburtsdatum"]',
        ];
        
        for (const selector of birthdayInputSelectors) {
          try {
            const inputs = await registrationPage.locator(selector).all();
            for (const input of inputs) {
              const isVisible = await input.isVisible({ timeout: 500 }).catch(() => false);
              if (isVisible) {
                // Prüfe, ob es NICHT das Suchfeld ist
                const inputName = await input.getAttribute('name').catch(() => '');
                if (inputName === 'q' || inputName?.includes('search')) {
                  console.log(`   ⏭️  Überspringe Suchfeld mit name="${inputName}"`);
                  continue;
                }
                
                birthdayInput = input;
                console.log(`✅ Geburtsdatum-Feld gefunden mit: ${selector}`);
                break;
              }
            }
            if (birthdayInput) break;
          } catch (e) {
            continue;
          }
        }
      }

      if (!birthdayInput) {
        console.log('⚠️  Geburtsdatum-Eingabefeld nicht gefunden!');
        console.log('📋 Liste alle sichtbaren Input-Felder und Labels:');
        
        // Liste alle Labels
        const allLabels = await registrationPage.locator('label').all();
        console.log(`\n📝 Gefundene Labels (${allLabels.length}):`);
        for (let i = 0; i < Math.min(allLabels.length, 15); i++) {
          const label = allLabels[i];
          const isVisible = await label.isVisible().catch(() => false);
          if (isVisible) {
            const text = await label.textContent().catch(() => '');
            const forAttr = await label.getAttribute('for').catch(() => '');
            console.log(`   ${i+1}. "${text?.trim()}" (for: ${forAttr || 'none'})`);
          }
        }
        
        // Liste alle Input-Felder
        const allInputs = await registrationPage.locator('input').all();
        console.log(`\n📝 Gefundene Input-Felder (${allInputs.length}):`);
        let count = 0;
        for (const inp of allInputs) {
          const isVisible = await inp.isVisible().catch(() => false);
          if (isVisible && count < 15) {
            const type = await inp.getAttribute('type').catch(() => '');
            const name = await inp.getAttribute('name').catch(() => '');
            const id = await inp.getAttribute('id').catch(() => '');
            const placeholder = await inp.getAttribute('placeholder').catch(() => '');
            console.log(`   ${count+1}. type="${type}", name="${name}", id="${id}", placeholder="${placeholder}"`);
            count++;
          }
        }
        
        throw new Error('Konnte Geburtsdatum-Eingabefeld nicht finden');
      }

      // Geburtsdatum eingeben (maskiertes Feld mit Format TT.MM.JJJJ)
      const birthdayRaw = '26042000'; // Ohne Punkte
      console.log(`📅 Gebe Geburtsdatum ein: 26.04.2000`);
      
      // Strategie 1: Dreifacher Klick um alles zu markieren, dann tippen
      console.log('⌨️  Strategie 1: Dreifach-Klick + Eingabe...');
      await birthdayInput.click({ clickCount: 3 });
      await registrationPage.waitForTimeout(300);
      
      await birthdayInput.pressSequentially(birthdayRaw, { delay: 150 });
      await registrationPage.waitForTimeout(1000);
      
      let currentValue = await birthdayInput.inputValue();
      console.log(`🔍 Wert nach Strategie 1: "${currentValue}"`);
      
      const expectedValue = '26.04.2000';
      
      if (currentValue !== expectedValue) {
        console.log('⚠️  Strategie 1 fehlgeschlagen. Versuche Strategie 2: Backspace + Eingabe...');
        
        // Strategie 2: Klicke, dann Ctrl+A und Backspace
        await birthdayInput.click();
        await registrationPage.waitForTimeout(200);
        
        // Cmd+A auf Mac, Ctrl+A auf anderen
        await birthdayInput.press('Meta+A');
        await registrationPage.waitForTimeout(200);
        
        await birthdayInput.press('Backspace');
        await registrationPage.waitForTimeout(300);
        
        // Jetzt eingeben
        await birthdayInput.pressSequentially(birthdayRaw, { delay: 150 });
        await registrationPage.waitForTimeout(1000);
        
        currentValue = await birthdayInput.inputValue();
        console.log(`🔍 Wert nach Strategie 2: "${currentValue}"`);
      }
      
      if (currentValue !== expectedValue) {
        console.log('⚠️  Strategie 2 fehlgeschlagen. Versuche Strategie 3: Fill ohne Punkte...');
        
        // Strategie 3: fill() mit den Ziffern ohne Punkte
        await birthdayInput.click();
        await registrationPage.waitForTimeout(200);
        await birthdayInput.fill(birthdayRaw);
        await registrationPage.waitForTimeout(1000);
        
        currentValue = await birthdayInput.inputValue();
        console.log(`🔍 Wert nach Strategie 3: "${currentValue}"`);
      }
      
      if (currentValue !== expectedValue) {
        throw new Error(`Geburtsdatum-Eingabe fehlgeschlagen: Erwartet "${expectedValue}", erhalten "${currentValue}"`);
      }
      
      console.log('✅ Geburtsdatum korrekt eingegeben!');
      
      // Warte und prüfe ob der Wert stabil bleibt
      await registrationPage.waitForTimeout(1000);
      currentValue = await birthdayInput.inputValue();
      console.log(`🔍 Wert im Feld vor Speichern: "${currentValue}"`);
      
      if (currentValue !== expectedValue) {
        throw new Error(`Geburtsdatum wurde wieder gelöscht: "${currentValue}"`);
      }
      
      console.log('✅ Geburtsdatum bleibt stabil im Feld!');

      // Klick auf "speichern"
      console.log('💾 Klicke auf "speichern"...');
      const speichernSelectors = [
        'button:has-text("Speichern")',
        'button:has-text("speichern")',
        'button[type="submit"]',
      ];
      
      let speichernButton = null;
      for (const selector of speichernSelectors) {
        try {
          const buttons = await registrationPage.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              speichernButton = btn;
              console.log(`✅ "Speichern" Button gefunden mit: ${selector}`);
              break;
            }
          }
          if (speichernButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!speichernButton) {
        throw new Error('Konnte "Speichern" Button nicht finden');
      }

      await speichernButton.click();
      console.log('✅ "Speichern" geklickt');
      await registrationPage.waitForTimeout(2000);
      
      // Prüfe ob erfolgreich gespeichert wurde
      const successMessage = registrationPage.locator('text=/erfolgreich gespeichert/i');
      const isSuccess = await successMessage.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isSuccess) {
        console.log('✅ Geburtsdatum erfolgreich gespeichert!');
      } else {
        console.log('⚠️  Keine Erfolgsmeldung gefunden, prüfe trotzdem weiter...');
      }

    } finally {
      await registrationContext.close();
    }

    console.log('\n✅ TEIL 1 ABGESCHLOSSEN\n');
    
    // TEIL 2: Passwort-Reset mit PLZ/Birthday Challenge
    console.log('\n🔐 TEIL 2: Teste Passwort-Reset mit PLZ/Birthday Challenge...\n');

    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();

    try {
      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      console.log(`🌐 Navigiere zu: ${loginUrl}`);
      await resetPage.goto(loginUrl);
      await resetPage.waitForLoadState('networkidle');

      // SCHRITT 1: Phone-Nummer eingeben (nicht E-Mail!)
      console.log(`📱 SCHRITT 1: Gebe Phone-Nummer ein: ${phoneNumber}`);
      const phoneLoginInput = resetPage.locator('#cl_login');
      await phoneLoginInput.waitFor({ state: 'visible', timeout: 10000 });
      await phoneLoginInput.fill(phoneNumber);
      console.log('✅ Phone-Nummer eingegeben');

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"...');
      const weiterButton = resetPage.getByRole('button', { name: 'Weiter' });
      await weiterButton.click();
      await resetPage.waitForTimeout(1000);

      // SCHRITT 2: Klicke auf "Passwort vergessen?"
      console.log('🔍 SCHRITT 2: Klicke auf "Passwort vergessen?"...');
      
      const passwordForgottenSelectors = [
        'a:has-text("Passwort vergessen?")',
        'button:has-text("Passwort vergessen?")',
        'a:has-text("passwort vergessen")',
        '[href*="forgot"]',
        '[href*="reset"]',
      ];

      let passwordForgottenLink = null;
      for (const selector of passwordForgottenSelectors) {
        try {
          const element = resetPage.locator(selector).first();
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            passwordForgottenLink = element;
            console.log(`✅ "Passwort vergessen?" Link gefunden mit: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!passwordForgottenLink) {
        throw new Error('Konnte "Passwort vergessen?" Link nicht finden');
      }

      await passwordForgottenLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await resetPage.waitForTimeout(2000);

      // SCHRITT 3: Selection Screen - Wähle Phone/SMS TAN
      console.log('🔍 SCHRITT 3: Wähle SMS/Phone als Challenge-Methode...');
      console.log(`📍 Aktuelle URL: ${resetPage.url()}`);
      
      // Suche nach SMS/Phone Label (klicke auf das Label, nicht den Radio Button)
      const phoneLabelSelectors = [
        'label:has-text("SMS")',
        'label:has-text("Telefon")',
        'label[for*="sms"]',
        'label[for*="phone"]',
      ];

      let phoneLabel = null;
      for (const selector of phoneLabelSelectors) {
        try {
          const elements = await resetPage.locator(selector).all();
          for (const element of elements) {
            const isVisible = await element.isVisible().catch(() => false);
            if (isVisible) {
              phoneLabel = element;
              console.log(`✅ SMS/Phone Label gefunden mit: ${selector}`);
              break;
            }
          }
          if (phoneLabel) break;
        } catch (e) {
          continue;
        }
      }

      if (phoneLabel) {
        await phoneLabel.click();
        console.log('✅ SMS/Phone-Option ausgewählt');
        await resetPage.waitForTimeout(500);
      } else {
        console.log('⚠️  Phone/SMS-Option nicht gefunden - versuche fortzufahren');
      }

      await resetPage.waitForTimeout(1000);
      
      // Klick auf "Code senden" oder "Weiter"
      console.log('➡️  Klicke auf "Code senden"...');
      
      const submitButtonSelectors = [
        'button:has-text("Code senden")',
        'button:has-text("code senden")',
        'button:has-text("Senden")',
        'button:has-text("Weiter")',
        'button[type="submit"]',
        'button[type="button"]:has-text("Weiter")',
      ];

      let submitButton = null;
      for (const selector of submitButtonSelectors) {
        try {
          const buttons = await resetPage.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              const btnText = await btn.textContent().catch(() => '');
              submitButton = btn;
              console.log(`✅ Submit-Button gefunden: "${btnText?.trim()}" (${selector})`);
              break;
            }
          }
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!submitButton) {
        throw new Error('Konnte "Code senden" Button nicht finden');
      }

      await submitButton.click();
      console.log('✅ "Code senden" geklickt');
      await resetPage.waitForTimeout(2000);

      // SCHRITT 4: Warte auf SMS TAN (weitergeleitet per E-Mail)
      console.log('📱 SCHRITT 4: Warte auf SMS-TAN-Code (weitergeleitet per E-Mail)...');
      const emailClient = getEmailClient();
      
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
          'Passwort-Reset (PLZ/Birthday Test) - SMS-TAN',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }

      // SMS-TAN extrahieren
      console.log('🔍 Extrahiere SMS-TAN-Code aus weitergeleiteter SMS...');
      console.log(`   Betreff: ${smsTanEmail.subject}`);
      
      let smsTanCode: string | null = null;
      const smsMatch = smsTanEmail.body.match(/(\d{6})/);
      if (smsMatch) {
        smsTanCode = smsMatch[1];
        console.log(`✅ SMS-TAN-Code extrahiert aus Body: ${smsTanCode}`);
      } else {
        throw new Error('SMS-Code konnte nicht extrahiert werden');
      }

      // SCHRITT 5: SMS TAN eingeben
      console.log('🔍 SCHRITT 5: Gebe SMS-TAN-Code ein...');
      
      let smsTanInput = null;
      const tanInputSelectors = [
        'input[type="text"]',
        'input[type="tel"]',
        'input[id*="tan"]',
        'input[name*="tan"]',
        'input[placeholder*="Code"]',
      ];
      
      for (const selector of tanInputSelectors) {
        const inputs = await resetPage.locator(selector).all();
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

      await resetPage.waitForTimeout(500);
      await smsTanInput.fill(smsTanCode);
      console.log('✅ SMS-TAN-Code eingegeben');
      
      // Enter drücken
      await smsTanInput.press('Enter');
      console.log('✅ Enter gedrückt');
      await resetPage.waitForTimeout(2000);

      // SCHRITT 6: PLZ/Birthday Challenge - Geburtsdatum eingeben
      console.log('🎂 SCHRITT 6: Gebe Geburtsdatum für PLZ/Birthday Challenge ein...');
      console.log('📍 Aktuelle URL:', resetPage.url());
      
      // Suche nach Geburtsdatum-Eingabefeld
      const birthdayChallengSelectors = [
        'input[name*="birthday"]',
        'input[name*="birthdate"]',
        'input[name*="birth"]',
        'input[placeholder*="Geburtsdatum"]',
        'input[placeholder*="TT.MM.JJJJ"]',
        'input[type="text"]',
      ];
      
      let birthdayChallengeInput = null;
      for (const selector of birthdayChallengSelectors) {
        try {
          const inputs = await resetPage.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              birthdayChallengeInput = input;
              console.log(`✅ Geburtsdatum-Eingabefeld gefunden mit: ${selector}`);
              break;
            }
          }
          if (birthdayChallengeInput) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!birthdayChallengeInput) {
        console.log('⚠️  Geburtsdatum-Eingabefeld nicht gefunden!');
        console.log('📄 Body Text (erste 500 Zeichen):');
        const bodyText = await resetPage.locator('body').innerText();
        console.log(bodyText.substring(0, 500));
        throw new Error('Konnte Geburtsdatum-Eingabefeld nicht finden');
      }
      
      // Geburtsdatum eingeben (gleiche Strategie wie in Teil 1)
      const birthdayRaw = '26042000';
      console.log('📅 Gebe Geburtsdatum ein: 26.04.2000');
      
      await birthdayChallengeInput.click({ clickCount: 3 });
      await resetPage.waitForTimeout(300);
      
      await birthdayChallengeInput.pressSequentially(birthdayRaw, { delay: 150 });
      await resetPage.waitForTimeout(1000);
      
      let birthdayValue = await birthdayChallengeInput.inputValue();
      console.log(`🔍 Wert im Feld: "${birthdayValue}"`);
      
      if (birthdayValue !== '26.04.2000') {
        console.log('⚠️  Versuche alternative Eingabe-Methode...');
        await birthdayChallengeInput.click();
        await resetPage.waitForTimeout(200);
        await birthdayChallengeInput.press('Meta+A');
        await resetPage.waitForTimeout(200);
        await birthdayChallengeInput.press('Backspace');
        await resetPage.waitForTimeout(300);
        await birthdayChallengeInput.pressSequentially(birthdayRaw, { delay: 150 });
        await resetPage.waitForTimeout(1000);
        
        birthdayValue = await birthdayChallengeInput.inputValue();
        console.log(`🔍 Wert nach alternativer Methode: "${birthdayValue}"`);
      }
      
      if (birthdayValue !== '26.04.2000') {
        throw new Error(`Geburtsdatum-Eingabe fehlgeschlagen: Erwartet "26.04.2000", erhalten "${birthdayValue}"`);
      }
      
      console.log('✅ Geburtsdatum korrekt eingegeben');
      
      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"...');
      const weiterButtonChallengSelectors = [
        'button:has-text("Weiter")',
        'button:has-text("weiter")',
        'button[type="submit"]',
        'input[type="submit"]',
      ];
      
      let weiterButtonChallenge = null;
      for (const selector of weiterButtonChallengSelectors) {
        try {
          const buttons = await resetPage.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterButtonChallenge = btn;
              console.log(`✅ "Weiter" Button gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterButtonChallenge) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!weiterButtonChallenge) {
        throw new Error('Konnte "Weiter" Button nicht finden');
      }
      
      await weiterButtonChallenge.click();
      console.log('✅ "Weiter" geklickt (erster Screen)');
      await resetPage.waitForTimeout(2000);
      
      console.log('✅ PLZ/Birthday Challenge erfolgreich - erster Screen abgeschlossen');
      console.log('📍 Aktuelle URL:', resetPage.url());
      
      // SCHRITT 6b: Zweiter "Weiter"-Button auf dem nächsten Screen
      console.log('➡️  SCHRITT 6b: Klicke auf "Weiter" auf dem zweiten Screen...');
      
      const weiterButtonSecondSelectors = [
        'button:has-text("Weiter")',
        'button:has-text("weiter")',
        'button[type="submit"]',
        'input[type="submit"]',
      ];
      
      let weiterButtonSecond = null;
      for (const selector of weiterButtonSecondSelectors) {
        try {
          const buttons = await resetPage.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterButtonSecond = btn;
              console.log(`✅ Zweiter "Weiter" Button gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterButtonSecond) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!weiterButtonSecond) {
        console.log('⚠️  Zweiter "Weiter" Button nicht gefunden - möglicherweise direkte Weiterleitung');
      } else {
        await weiterButtonSecond.click();
        console.log('✅ Zweiter "Weiter" geklickt');
        await resetPage.waitForTimeout(1000);
      }
      
      console.log('✅ PLZ/Birthday Challenge vollständig abgeschlossen');
      
      // SCHRITT 7: Auf Callback-Seite warten und c24session Cookie prüfen
      console.log('⏳ SCHRITT 7: Warte auf Weiterleitung zur Callback-Seite...');
      
      const kundenbereichUrl = getKundenbereichUrl();
      const kundenbereichPattern = new RegExp(kundenbereichUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      try {
        await resetPage.waitForURL(kundenbereichPattern, { timeout: 10000 });
        console.log('✅ Zur Callback-Seite weitergeleitet');
      } catch (e) {
        console.log('⚠️  Timeout bei Weiterleitung, prüfe aktuelle URL...');
        console.log('📍 Aktuelle URL:', resetPage.url());
        
        if (resetPage.url().includes('kundenbereich')) {
          console.log('✅ Auf Kundenbereich-Seite');
        } else {
          await resetPage.waitForTimeout(3000);
        }
      }
      
      console.log('📍 Finale URL:', resetPage.url());
      
      // Prüfe auf c24session Cookie
      console.log('🔍 Prüfe c24session Cookie...');
      const cookies = await resetPage.context().cookies();
      const c24sessionCookie = cookies.find(c => c.name === 'c24session');
      
      if (c24sessionCookie) {
        console.log('✅ c24session Cookie gefunden!');
        console.log(`   Value: ${c24sessionCookie.value.substring(0, 20)}...`);
      } else {
        throw new Error('❌ c24session Cookie NICHT gefunden - Login fehlgeschlagen!');
      }
      
      console.log('\n✅ TEIL 2 ABGESCHLOSSEN (Phone TAN)\n');
      
    } finally {
      await resetContext.close();
    }
      
    // ================================================================================
    // TEIL 3: Passwort-Reset mit E-Mail TAN + PLZ/Birthday Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 3: Teste Passwort-Reset mit E-Mail TAN + PLZ/Birthday Challenge...\n');
    
    const resetContext3 = await browser.newContext();
    const resetPage3 = await resetContext3.newPage();
      
      try {
        await resetPage3.goto(getLoginUrl());
        await resetPage3.waitForLoadState('networkidle');
        
        console.log(`📱 Gebe Phone-Nummer ein: ${phoneNumber}`);
        const phoneInput3 = resetPage3.locator('#cl_login');
        await phoneInput3.fill(phoneNumber);
        
        const weiterBtn3 = resetPage3.getByRole('button', { name: 'Weiter' });
        await weiterBtn3.click();
        await resetPage3.waitForTimeout(1000);
        
        console.log('🔍 Klicke auf "Passwort vergessen?"...');
        const passwordForgottenLink3 = resetPage3.locator('a:has-text("Passwort vergessen?")').first();
        await passwordForgottenLink3.click();
        await resetPage3.waitForTimeout(2000);
        
        console.log('🔍 Wähle E-Mail TAN...');
        const emailLabelSelectors3 = [
          'label:has-text("E-Mail")',
          'label:has-text("email")',
          'label[for*="email"]',
        ];
        
        let emailLabel3Found = false;
        for (const selector of emailLabelSelectors3) {
          try {
            const labels = await resetPage3.locator(selector).all();
            for (const label of labels) {
              const isVisible = await label.isVisible().catch(() => false);
              if (isVisible) {
                await label.click();
                console.log(`✅ E-Mail-Option ausgewählt mit: ${selector}`);
                emailLabel3Found = true;
                break;
              }
            }
            if (emailLabel3Found) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!emailLabel3Found) {
          console.log('ℹ️  E-Mail-Option möglicherweise bereits vorausgewählt');
        }
        
        await resetPage3.waitForTimeout(1000);
        
        const submitBtnSelectors3 = [
          'button:has-text("Code senden")',
          'button:has-text("code senden")',
          'button:has-text("Senden")',
          'button:has-text("Weiter")',
          'button[type="submit"]',
        ];
        
        let submitBtn3 = null;
        for (const selector of submitBtnSelectors3) {
          try {
            const buttons = await resetPage3.locator(selector).all();
            for (const btn of buttons) {
              const isVisible = await btn.isVisible().catch(() => false);
              if (isVisible) {
                submitBtn3 = btn;
                console.log(`✅ Submit-Button gefunden mit: ${selector}`);
                break;
              }
            }
            if (submitBtn3) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!submitBtn3) {
          throw new Error('Konnte "Code senden" Button nicht finden');
        }
        
        await submitBtn3.click();
        console.log('✅ "Code senden" geklickt');
        await resetPage3.waitForTimeout(2000);
        
        console.log('📧 Warte auf E-Mail-TAN...');
        const emailClient3 = getEmailClient();
        const emailTan3 = await emailClient3.waitForEmail({ subject: 'CHECK24' }, 120000, 3000);
        const emailTanCode3 = emailTan3.subject.match(/(\d{6})/)?.[1];
        if (!emailTanCode3) throw new Error('E-Mail-TAN konnte nicht extrahiert werden');
        console.log(`✅ E-Mail-TAN: ${emailTanCode3}`);
        
        const tanInputSelectors3 = [
          'input[type="text"]',
          'input[type="tel"]',
          'input[id*="tan"]',
          'input[name*="tan"]',
          'input[placeholder*="Code"]',
        ];
        
        let tanInput3 = null;
        for (const selector of tanInputSelectors3) {
          const inputs = await resetPage3.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              tanInput3 = input;
              console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
              break;
            }
          }
          if (tanInput3) break;
        }
        
        if (!tanInput3) {
          throw new Error('Konnte TAN-Eingabefeld nicht finden');
        }
        
        await resetPage3.waitForTimeout(500);
        await tanInput3.fill(emailTanCode3);
        await tanInput3.press('Enter');
        console.log('✅ E-Mail-TAN eingegeben');
        await resetPage3.waitForTimeout(2000);
        
        console.log('🎂 Gebe Geburtsdatum ein...');
        
        const birthdaySelectors3 = [
          'input[name*="birthday"]',
          'input[name*="birthdate"]',
          'input[name*="birth"]',
          'input[placeholder*="Geburtsdatum"]',
          'input[placeholder*="TT.MM.JJJJ"]',
        ];
        
        let birthdayInput3 = null;
        for (const selector of birthdaySelectors3) {
          const inputs = await resetPage3.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              birthdayInput3 = input;
              console.log(`✅ Geburtsdatum-Feld gefunden mit: ${selector}`);
              break;
            }
          }
          if (birthdayInput3) break;
        }
        
        if (!birthdayInput3) throw new Error('Konnte Geburtsdatum-Feld nicht finden');
        
        await birthdayInput3.click({ clickCount: 3 });
        await resetPage3.waitForTimeout(300);
        await birthdayInput3.pressSequentially('26042000', { delay: 150 });
        await resetPage3.waitForTimeout(1000);
        console.log('✅ Geburtsdatum eingegeben');
        
        const weiterSelectors3 = [
          'button:has-text("Weiter")',
          'button:has-text("weiter")',
          'button[type="submit"]',
          'input[type="submit"]',
        ];
        
        let weiterBtn3a = null;
        for (const selector of weiterSelectors3) {
          const buttons = await resetPage3.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn3a = btn;
              console.log(`✅ Erster "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn3a) break;
        }
        
        if (!weiterBtn3a) throw new Error('Konnte ersten "Weiter" Button nicht finden');
        
        await weiterBtn3a.click();
        console.log('✅ Erster "Weiter" geklickt');
        await resetPage3.waitForTimeout(2000);
        
        let weiterBtn3b = null;
        for (const selector of weiterSelectors3) {
          const buttons = await resetPage3.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn3b = btn;
              console.log(`✅ Zweiter "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn3b) break;
        }
        
        if (!weiterBtn3b) {
          console.log('⚠️  Zweiter "Weiter" Button nicht gefunden - möglicherweise direkte Weiterleitung');
        } else {
          await weiterBtn3b.click();
          console.log('✅ Zweiter "Weiter" geklickt');
        }
        
        await resetPage3.waitForTimeout(3000);
        
        const cookies3 = await resetPage3.context().cookies();
        const c24Cookie3 = cookies3.find(c => c.name === 'c24session');
        if (c24Cookie3) {
          console.log('✅ c24session Cookie gefunden (E-Mail TAN)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (E-Mail TAN)!');
        }
      } finally {
        await resetContext3.close();
      }
      
      console.log('\n✅ TEIL 3 ABGESCHLOSSEN (E-Mail TAN)\n');
      
    // ================================================================================
    // TEIL 4: OTP Login mit Phone TAN + PLZ/Birthday Challenge (DEBUGGING)
    // ================================================================================
    console.log('\n🔐 TEIL 4: Teste OTP Login mit Phone TAN + PLZ/Birthday Challenge...\n');
    
    const resetContext4 = await browser.newContext();
    const resetPage4 = await resetContext4.newPage();
      
      try {
        await resetPage4.goto(getLoginUrl());
        await resetPage4.waitForLoadState('networkidle');
        
        console.log(`📱 Gebe Phone-Nummer ein: ${phoneNumber}`);
        const phoneInput4 = resetPage4.locator('#cl_login');
        await phoneInput4.fill(phoneNumber);
        console.log('✅ Phone-Nummer eingegeben');
        
        const weiterBtn4First = resetPage4.getByRole('button', { name: 'Weiter' });
        await weiterBtn4First.click();
        console.log('✅ "Weiter" geklickt');
        await resetPage4.waitForTimeout(2000);
        
        console.log('🔍 Suche "Mit Einmalcode anmelden" Button...');
        console.log(`📍 Aktuelle URL: ${resetPage4.url()}`);
        
        // Debug: Zeige Body-Text
        const bodyText4 = await resetPage4.locator('body').innerText();
        console.log(`📄 Body-Text (erste 1000 Zeichen):\n${bodyText4.substring(0, 1000)}`);
        
        // Debug: Liste alle sichtbaren Links und Buttons
        console.log('🔍 Liste alle sichtbaren Buttons...');
        const allButtons4 = await resetPage4.locator('button').all();
        for (let i = 0; i < allButtons4.length; i++) {
          const btn = allButtons4[i];
          const isVisible = await btn.isVisible().catch(() => false);
          if (isVisible) {
            const text = await btn.textContent().catch(() => '');
            const type = await btn.getAttribute('type').catch(() => '');
            console.log(`   Button ${i+1}: "${text?.trim()}" (type: ${type})`);
          }
        }
        
        console.log('🔍 Liste alle sichtbaren Links...');
        const allLinks4 = await resetPage4.locator('a').all();
        let visibleLinkCount = 0;
        for (let i = 0; i < allLinks4.length; i++) {
          const link = allLinks4[i];
          const isVisible = await link.isVisible().catch(() => false);
          if (isVisible) {
            const text = await link.textContent().catch(() => '');
            const href = await link.getAttribute('href').catch(() => '');
            if (text && text.trim().length > 0) {
              console.log(`   Link ${++visibleLinkCount}: "${text.trim()}" (href: ${href})`);
            }
          }
        }
        
        throw new Error('DEBUG STOP - Bitte prüfe die Ausgabe');
        
        console.log('🔍 Wähle SMS/Phone TAN...');
        const smsLabelSelectors4 = ['label:has-text("SMS")', 'label:has-text("Telefon")', 'label[for*="sms"]'];
        
        let smsLabel4Found = false;
        for (const selector of smsLabelSelectors4) {
          try {
            const labels = await resetPage4.locator(selector).all();
            for (const label of labels) {
              const isVisible = await label.isVisible().catch(() => false);
              if (isVisible) {
                await label.click();
                console.log(`✅ SMS-Option ausgewählt mit: ${selector}`);
                smsLabel4Found = true;
                break;
              }
            }
            if (smsLabel4Found) break;
          } catch (e) {
            continue;
          }
        }
        
        await resetPage4.waitForTimeout(1000);
        
        const submitBtnSelectors4 = ['button:has-text("Code senden")', 'button:has-text("Weiter")', 'button[type="submit"]'];
        let submitBtn4 = null;
        for (const selector of submitBtnSelectors4) {
          const buttons = await resetPage4.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              submitBtn4 = btn;
              console.log(`✅ Submit-Button gefunden mit: ${selector}`);
              break;
            }
          }
          if (submitBtn4) break;
        }
        
        if (!submitBtn4) throw new Error('Konnte "Code senden" Button nicht finden');
        
        await submitBtn4.click();
        console.log('✅ "Code senden" geklickt');
        await resetPage4.waitForTimeout(2000);
        
        console.log('📱 Warte auf SMS-TAN...');
        const emailClient4 = getEmailClient();
        const smsTan4 = await emailClient4.waitForEmail({ from: 'ulitesting@icloud.com' }, 120000, 3000);
        const smsTanCode4 = smsTan4.body.match(/(\d{6})/)?.[1];
        if (!smsTanCode4) throw new Error('SMS-TAN konnte nicht extrahiert werden');
        console.log(`✅ SMS-TAN: ${smsTanCode4}`);
        
        const tanInputSelectors4 = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
        let tanInput4 = null;
        for (const selector of tanInputSelectors4) {
          const inputs = await resetPage4.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              tanInput4 = input;
              console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
              break;
            }
          }
          if (tanInput4) break;
        }
        
        if (!tanInput4) throw new Error('Konnte TAN-Eingabefeld nicht finden');
        
        await resetPage4.waitForTimeout(500);
        await tanInput4.fill(smsTanCode4);
        await tanInput4.press('Enter');
        console.log('✅ SMS-TAN eingegeben');
        await resetPage4.waitForTimeout(2000);
        
        console.log('🎂 Gebe Geburtsdatum ein...');
        const birthdaySelectors4 = ['input[name*="birthday"]', 'input[name*="birthdate"]'];
        let birthdayInput4 = null;
        for (const selector of birthdaySelectors4) {
          const inputs = await resetPage4.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              birthdayInput4 = input;
              console.log(`✅ Geburtsdatum-Feld gefunden mit: ${selector}`);
              break;
            }
          }
          if (birthdayInput4) break;
        }
        
        if (!birthdayInput4) throw new Error('Konnte Geburtsdatum-Feld nicht finden');
        
        await birthdayInput4.click({ clickCount: 3 });
        await resetPage4.waitForTimeout(300);
        await birthdayInput4.pressSequentially('26042000', { delay: 150 });
        await resetPage4.waitForTimeout(1000);
        console.log('✅ Geburtsdatum eingegeben');
        
        const weiterSelectors4 = ['button:has-text("Weiter")', 'button[type="submit"]'];
        let weiterBtn4a = null;
        for (const selector of weiterSelectors4) {
          const buttons = await resetPage4.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn4a = btn;
              console.log(`✅ Erster "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn4a) break;
        }
        
        if (!weiterBtn4a) throw new Error('Konnte ersten "Weiter" Button nicht finden');
        
        await weiterBtn4a.click();
        console.log('✅ Erster "Weiter" geklickt');
        await resetPage4.waitForTimeout(2000);
        
        let weiterBtn4b = null;
        for (const selector of weiterSelectors4) {
          const buttons = await resetPage4.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn4b = btn;
              console.log(`✅ Zweiter "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn4b) break;
        }
        
        if (!weiterBtn4b) {
          console.log('⚠️  Zweiter "Weiter" Button nicht gefunden - möglicherweise direkte Weiterleitung');
        } else {
          await weiterBtn4b.click();
          console.log('✅ Zweiter "Weiter" geklickt');
        }
        
        await resetPage4.waitForTimeout(3000);
        
        const cookies4 = await resetPage4.context().cookies();
        const c24Cookie4 = cookies4.find(c => c.name === 'c24session');
        if (c24Cookie4) {
          console.log('✅ c24session Cookie gefunden (OTP Phone TAN)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (OTP Phone TAN)!');
        }
      } finally {
        await resetContext4.close();
      }
      
      console.log('\n✅ TEIL 4 ABGESCHLOSSEN (OTP Phone TAN)\n');
      
  } finally {
    await browser.close();
  }
});

});
/*
      const resetContext5 = await browser.newContext();
      const resetPage5 = await resetContext5.newPage();
      
      try {
        await resetPage5.goto(getLoginUrl());
        await resetPage5.waitForLoadState('networkidle');
        
        console.log(`📱 Gebe Phone-Nummer ein: ${phoneNumber}`);
        const phoneInput5 = resetPage5.locator('#cl_login');
        await phoneInput5.fill(phoneNumber);
        console.log('✅ Phone-Nummer eingegeben');
        
        const weiterBtn5First = resetPage5.getByRole('button', { name: 'Weiter' });
        await weiterBtn5First.click();
        console.log('✅ "Weiter" geklickt');
        await resetPage5.waitForTimeout(2000);
        
        console.log('🔍 Klicke auf "Mit Einmalcode anmelden"...');
        const otpSelectors5 = [
          'a:has-text("Mit Einmalcode anmelden")',
          'button:has-text("Mit Einmalcode anmelden")',
          'a:has-text("mit Einmalcode anmelden")',
          'button:has-text("mit Einmalcode anmelden")',
          'a:has-text("Einmalcode")',
          'button:has-text("Einmalcode")',
        ];
        
        let otpLink5 = null;
        for (const selector of otpSelectors5) {
          try {
            const elements = await resetPage5.locator(selector).all();
            for (const element of elements) {
              const isVisible = await element.isVisible().catch(() => false);
              if (isVisible) {
                otpLink5 = element;
                console.log(`✅ "Mit Einmalcode anmelden" gefunden mit: ${selector}`);
                break;
              }
            }
            if (otpLink5) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!otpLink5) {
          throw new Error('Konnte "Mit Einmalcode anmelden" nicht finden');
        }
        
        await otpLink5.click();
        await resetPage5.waitForTimeout(2000);
        
        console.log('🔍 Wähle E-Mail TAN...');
        const emailLabelSelectors5 = ['label:has-text("E-Mail")', 'label[for*="email"]'];
        
        let emailLabel5Found = false;
        for (const selector of emailLabelSelectors5) {
          try {
            const labels = await resetPage5.locator(selector).all();
            for (const label of labels) {
              const isVisible = await label.isVisible().catch(() => false);
              if (isVisible) {
                await label.click();
                console.log(`✅ E-Mail-Option ausgewählt mit: ${selector}`);
                emailLabel5Found = true;
                break;
              }
            }
            if (emailLabel5Found) break;
          } catch (e) {
            continue;
          }
        }
        
        await resetPage5.waitForTimeout(1000);
        
        const submitBtnSelectors5 = ['button:has-text("Code senden")', 'button:has-text("Weiter")', 'button[type="submit"]'];
        let submitBtn5 = null;
        for (const selector of submitBtnSelectors5) {
          const buttons = await resetPage5.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              submitBtn5 = btn;
              console.log(`✅ Submit-Button gefunden mit: ${selector}`);
              break;
            }
          }
          if (submitBtn5) break;
        }
        
        if (!submitBtn5) throw new Error('Konnte "Code senden" Button nicht finden');
        
        await submitBtn5.click();
        console.log('✅ "Code senden" geklickt');
        await resetPage5.waitForTimeout(2000);
        
        console.log('📧 Warte auf E-Mail-TAN...');
        const emailClient5 = getEmailClient();
        const emailTan5 = await emailClient5.waitForEmail({ subject: 'CHECK24' }, 120000, 3000);
        const emailTanCode5 = emailTan5.subject.match(/(\d{6})/)?.[1];
        if (!emailTanCode5) throw new Error('E-Mail-TAN konnte nicht extrahiert werden');
        console.log(`✅ E-Mail-TAN: ${emailTanCode5}`);
        
        const tanInputSelectors5 = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
        let tanInput5 = null;
        for (const selector of tanInputSelectors5) {
          const inputs = await resetPage5.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              tanInput5 = input;
              console.log(`✅ TAN-Eingabefeld gefunden mit ${selector}`);
              break;
            }
          }
          if (tanInput5) break;
        }
        
        if (!tanInput5) throw new Error('Konnte TAN-Eingabefeld nicht finden');
        
        await resetPage5.waitForTimeout(500);
        await tanInput5.fill(emailTanCode5);
        await tanInput5.press('Enter');
        console.log('✅ E-Mail-TAN eingegeben');
        await resetPage5.waitForTimeout(2000);
        
        console.log('🎂 Gebe Geburtsdatum ein...');
        const birthdaySelectors5 = ['input[name*="birthday"]', 'input[name*="birthdate"]'];
        let birthdayInput5 = null;
        for (const selector of birthdaySelectors5) {
          const inputs = await resetPage5.locator(selector).all();
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              birthdayInput5 = input;
              console.log(`✅ Geburtsdatum-Feld gefunden mit: ${selector}`);
              break;
            }
          }
          if (birthdayInput5) break;
        }
        
        if (!birthdayInput5) throw new Error('Konnte Geburtsdatum-Feld nicht finden');
        
        await birthdayInput5.click({ clickCount: 3 });
        await resetPage5.waitForTimeout(300);
        await birthdayInput5.pressSequentially('26042000', { delay: 150 });
        await resetPage5.waitForTimeout(1000);
        console.log('✅ Geburtsdatum eingegeben');
        
        const weiterSelectors5 = ['button:has-text("Weiter")', 'button[type="submit"]'];
        let weiterBtn5a = null;
        for (const selector of weiterSelectors5) {
          const buttons = await resetPage5.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn5a = btn;
              console.log(`✅ Erster "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn5a) break;
        }
        
        if (!weiterBtn5a) throw new Error('Konnte ersten "Weiter" Button nicht finden');
        
        await weiterBtn5a.click();
        console.log('✅ Erster "Weiter" geklickt');
        await resetPage5.waitForTimeout(2000);
        
        let weiterBtn5b = null;
        for (const selector of weiterSelectors5) {
          const buttons = await resetPage5.locator(selector).all();
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              weiterBtn5b = btn;
              console.log(`✅ Zweiter "Weiter" gefunden mit: ${selector}`);
              break;
            }
          }
          if (weiterBtn5b) break;
        }
        
        if (!weiterBtn5b) {
          console.log('⚠️  Zweiter "Weiter" Button nicht gefunden - möglicherweise direkte Weiterleitung');
        } else {
          await weiterBtn5b.click();
          console.log('✅ Zweiter "Weiter" geklickt');
        }
        
        await resetPage5.waitForTimeout(3000);
        
        const cookies5 = await resetPage5.context().cookies();
        const c24Cookie5 = cookies5.find(c => c.name === 'c24session');
        if (c24Cookie5) {
          console.log('✅ c24session Cookie gefunden (OTP E-Mail TAN)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (OTP E-Mail TAN)!');
        }
        
          console.log('\n✅ TEIL 5 ABGESCHLOSSEN (OTP E-Mail TAN)\n');
        
      } finally {
        await resetContext5.close();
      }
        
    // ================================================================================
    // SCHRITT 8: Lösche das Konto wieder
    // ================================================================================
    console.log('🗑️  SCHRITT 8: Lösche das neu erstellte Konto...');
        
        // Öffne nochmal den Kundenbereich mit einem neuen Kontext, da resetContext3 bereits geschlossen wurde
        const deleteContext = await browser.newContext();
        const deletePage = await deleteContext.newPage();
        
        try {
          // Navigiere zum Kundenbereich und logge dich mit Phone ein
          await deletePage.goto(getLoginUrl());
          await deletePage.waitForLoadState('networkidle');
          
          const phoneInputDelete = deletePage.locator('#cl_login');
          await phoneInputDelete.fill(phoneNumber);
          const weiterBtnDelete = deletePage.getByRole('button', { name: 'Weiter' });
          await weiterBtnDelete.click();
          await deletePage.waitForTimeout(1000);
          
          // Passwort eingeben
          const passwordInputDelete = deletePage.locator('#cl_pw_login');
          await passwordInputDelete.fill('1qay1qay');
          const anmeldenBtnDelete = deletePage.getByRole('button', { name: 'anmelden' });
          await anmeldenBtnDelete.click();
          
          // Warte auf Weiterleitung zum Kundenbereich
          const kundenbereichUrl = getKundenbereichUrl();
          const kundenbereichPattern = new RegExp(kundenbereichUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          
          try {
            await deletePage.waitForURL(kundenbereichPattern, { timeout: 10000 });
            console.log('✅ Zum Kundenbereich weitergeleitet');
          } catch (e) {
            await deletePage.waitForTimeout(3000);
          }
          
          console.log('✅ Eingeloggt für Kontolöschung');
          console.log(`📍 URL: ${deletePage.url()}`);
        
        // Cookie-Banner schließen (falls vorhanden)
        console.log('   Prüfe auf Cookie-Banner...');
        try {
          const cookieBannerButton = deletePage.getByText('geht klar', { exact: true });
          await cookieBannerButton.waitFor({ state: 'visible', timeout: 3000 });
          await cookieBannerButton.click();
          await deletePage.waitForTimeout(1000);
          console.log('   ✅ Cookie-Banner geschlossen');
        } catch (e) {
          console.log('   ℹ️  Kein Cookie-Banner gefunden');
        }
        
        // Klick auf "Profil"
        console.log('   Klicke auf "Profil"...');
        const profilLink = deletePage.getByRole('link', { name: 'Profil' });
        await profilLink.waitFor({ state: 'visible', timeout: 10000 });
        await profilLink.click({ force: true });
        console.log('   ✅ "Profil" geklickt');
        await deletePage.waitForTimeout(1000);

        // Klick auf "Anmelden & Sicherheit" (erster Link im Profil-Menü)
        console.log('   Klicke auf "Anmelden & Sicherheit"...');
        const anmeldenSicherheitLink = deletePage.getByRole('link', { name: 'Anmelden & Sicherheit' }).first();
        await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
        await anmeldenSicherheitLink.click({ force: true });
        console.log('   ✅ "Anmelden & Sicherheit" geklickt');
        await deletePage.waitForLoadState('networkidle');
        await deletePage.waitForTimeout(1000);

        // Klick auf "Kundenkonto löschen"
        console.log('   Klicke auf "Kundenkonto löschen"...');
        const kundenkontoLoeschenLink = deletePage.getByText('Kundenkonto löschen');
        await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
        await kundenkontoLoeschenLink.click();
        console.log('   ✅ "Kundenkonto löschen" geklickt');
        await deletePage.waitForTimeout(1500);

        // Checkbox setzen (Name: "terms")
        console.log('   Setze Bestätigungs-Checkbox...');
        const checkbox = deletePage.locator('input[name="terms"][type="checkbox"]');
        await checkbox.waitFor({ state: 'visible', timeout: 10000 });
        await checkbox.check();
        console.log('   ✅ Checkbox gesetzt');
        await deletePage.waitForTimeout(500);

        // Klick auf "entfernen" Button
        console.log('   Klicke auf "entfernen"-Button...');
        const entfernenButton = deletePage.getByRole('button', { name: 'entfernen', exact: true });
        await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
        await entfernenButton.click();
        console.log('   ✅ "entfernen" geklickt');
        await deletePage.waitForTimeout(1000);

        console.log('✅ Konto erfolgreich gelöscht');
        
        console.log('\n🎉 TEST ERFOLGREICH ABGESCHLOSSEN!\n');
        
    } finally {
      await deleteContext.close();
    }
  });

});
