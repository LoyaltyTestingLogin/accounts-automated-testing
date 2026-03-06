import { test, expect } from '../fixtures/test-hooks';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getEmailClient, EmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl, getKundenbereichUrl, getEnvironment } from '../helpers/environment';
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

    let phoneNumber: string = '';
    let email: string = '';

    try {
      // Zur Registrierungs-Seite navigieren
      await registrationPage.goto(getLoginUrl());
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
      console.log(`   Betreff: ${emailTanEmail!.subject}`);
      
      let emailTanCode: string | null = null;
      const emailSubjectMatch = emailTanEmail!.subject.match(/(\d{6})/);
      if (emailSubjectMatch) {
        emailTanCode = emailSubjectMatch[1];
        console.log(`✅ E-Mail-TAN-Code extrahiert aus Betreff: ${emailTanCode}`);
      } else {
        const bodyMatch = emailTanEmail!.body.match(/(\d{6})/);
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
      console.log(`   Betreff: ${smsTanEmail!.subject}`);
      console.log(`   Body (erste 500 Zeichen): ${smsTanEmail!.body.substring(0, 500)}`);
      
      let smsTanCode: string | null = null;
      
      // Versuche zuerst spezifische Patterns für den TAN-Code
      // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
      let smsMatch = smsTanEmail!.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
      if (smsMatch) {
        smsTanCode = smsMatch[1];
        console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCode}`);
      } else {
        // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
        smsMatch = smsTanEmail!.body.match(/(\d{6})\s+ist\s+Ihr/i);
        if (smsMatch) {
          smsTanCode = smsMatch[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCode}`);
        } else {
          // Pattern 3: Aus Betreff extrahieren
          smsMatch = smsTanEmail!.subject.match(/(\d{6})/);
          if (smsMatch) {
            smsTanCode = smsMatch[1];
            console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCode}`);
          } else {
            throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
          }
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
      console.log(`   Betreff: ${smsTanEmail!.subject}`);
      console.log(`   Body (erste 500 Zeichen): ${smsTanEmail!.body.substring(0, 500)}`);
      
      let smsTanCode: string | null = null;
      
      // Versuche zuerst spezifische Patterns für den TAN-Code
      // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
      let smsMatch = smsTanEmail!.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
      if (smsMatch) {
        smsTanCode = smsMatch[1];
        console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCode}`);
      } else {
        // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
        smsMatch = smsTanEmail!.body.match(/(\d{6})\s+ist\s+Ihr/i);
        if (smsMatch) {
          smsTanCode = smsMatch[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCode}`);
        } else {
          // Pattern 3: Aus Betreff extrahieren
          smsMatch = smsTanEmail!.subject.match(/(\d{6})/);
          if (smsMatch) {
            smsTanCode = smsMatch[1];
            console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCode}`);
          } else {
            throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
          }
        }
      }

      console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCode}`);

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
        const emailTanCode3 = emailTan3!.subject.match(/(\d{6})/)?.[1];
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
      
      console.log('\n✅ TEIL 3 ABGESCHLOSSEN (E-Mail TAN)\n');
      
    } finally {
      await resetContext3.close();
    }
    
    // ================================================================================
    // TEIL 4: OTP-Login (Einmalcode) mit SMS TAN + Geburtsdatum-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 4: Teste OTP-Login mit SMS TAN + Geburtsdatum-Challenge...\n');
    
    const otpSmsContext = await browser.newContext();
    const otpSmsPage = await otpSmsContext.newPage();
    
    try {
      await otpSmsPage.goto(getLoginUrl());
      await otpSmsPage.waitForLoadState('networkidle');
      
      // SCHRITT 1: Phone-Nummer eingeben
      console.log('📱 SCHRITT 1: Gebe Phone-Nummer ein:', phoneNumber);
      const phoneInputOtpSms = otpSmsPage.locator('#cl_login');
      await phoneInputOtpSms.fill(phoneNumber);
      const weiterBtnOtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
      await weiterBtnOtpSms.click();
      await otpSmsPage.waitForTimeout(1000);
      
      // SCHRITT 2: Klick auf "Mit Einmalcode anmelden"
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonSms = otpSmsPage.getByText('Mit Einmalcode anmelden');
      await einmalcodeButtonSms.waitFor({ state: 'visible', timeout: 10000 });
      await einmalcodeButtonSms.click();
      console.log('✅ "Mit Einmalcode anmelden" geklickt');
      await otpSmsPage.waitForTimeout(1000);
      
      // SCHRITT 3: Prüfe auf OTP Selection Screen und wähle SMS
      console.log('🔍 SCHRITT 3: Prüfe auf OTP Selection Screen...');
      await otpSmsPage.waitForTimeout(500);
      
      const smsRadio = otpSmsPage.locator('#c24-uli-choose-sms');
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
            const smsLabel = otpSmsPage.locator('label[for="c24-uli-choose-sms"]');
            await smsLabel.click({ force: true });
            console.log('✅ SMS Label geklickt (force)');
          }
        }
        
        await otpSmsPage.waitForTimeout(300);
        
        // Verifiziere dass SMS ausgewählt ist
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
      }
      
      // "Code senden" klicken
      const codeSendenBtnOtpSms = otpSmsPage.getByRole('button', { name: 'Code senden' });
      await codeSendenBtnOtpSms.click();
      console.log('✅ "Code senden" geklickt');
      await otpSmsPage.waitForTimeout(1000);
      
      // SCHRITT 4: SMS-TAN aus weitergeleiteter E-Mail holen
      console.log('📱 SCHRITT 4: Warte auf SMS-TAN-Code (weitergeleitet per E-Mail)...');
      const emailClientOtpSms = new EmailClient();
      
      try {
        const smsTanEmailOtp = await emailClientOtpSms.waitForEmail(
          { from: 'ulitesting@icloud.com' },
          30000,
          3000
        );
        
        if (!smsTanEmailOtp) {
          throw new Error('SMS-TAN E-Mail nicht erhalten (OTP SMS)');
        }
        
        console.log(`✅ E-Mail gefunden: ${smsTanEmailOtp.subject}`);
        console.log(`   Body (erste 500 Zeichen): ${smsTanEmailOtp.body.substring(0, 500)}`);
        
        let smsTanCodeOtp: string | null = null;
        
        // Versuche zuerst spezifische Patterns für den TAN-Code
        // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
        let bodyMatchOtpSms = smsTanEmailOtp.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
        if (bodyMatchOtpSms) {
          smsTanCodeOtp = bodyMatchOtpSms[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCodeOtp}`);
        } else {
          // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
          bodyMatchOtpSms = smsTanEmailOtp.body.match(/(\d{6})\s+ist\s+Ihr/i);
          if (bodyMatchOtpSms) {
            smsTanCodeOtp = bodyMatchOtpSms[1];
            console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCodeOtp}`);
          } else {
            // Pattern 3: Aus Betreff extrahieren
            bodyMatchOtpSms = smsTanEmailOtp.subject.match(/(\d{6})/);
            if (bodyMatchOtpSms) {
              smsTanCodeOtp = bodyMatchOtpSms[1];
              console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCodeOtp}`);
            } else {
              throw new Error('Konnte SMS-TAN-Code nicht extrahieren (OTP SMS)');
            }
          }
        }
        
        console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCodeOtp}`);
        
        // SCHRITT 5: TAN eingeben
        console.log('🔍 SCHRITT 5: Gebe SMS-TAN-Code ein...');
        await otpSmsPage.waitForTimeout(1000);
        
        const tanInputSelectors = [
          'input[id*="tan"]',
          'input[id*="code"]',
          'input[name*="tan"]',
          'input[placeholder*="Code"]',
          'input[type="tel"]:not([name*="phone"])',
          'input[type="text"]'
        ];
        
        let tanInputOtpSms = null;
        for (const selector of tanInputSelectors) {
          try {
            const inputs = await otpSmsPage.locator(selector).all();
            for (const input of inputs) {
              const isVisible = await input.isVisible().catch(() => false);
              if (isVisible) {
                tanInputOtpSms = input;
                console.log(`✅ TAN-Eingabefeld gefunden mit: ${selector}`);
                break;
              }
            }
            if (tanInputOtpSms) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!tanInputOtpSms) {
          throw new Error('TAN-Eingabefeld nicht gefunden (OTP SMS)');
        }
        
        await otpSmsPage.waitForTimeout(500);
        await tanInputOtpSms.fill(smsTanCodeOtp);
        await otpSmsPage.waitForTimeout(500);
        await tanInputOtpSms.press('Enter');
        console.log('✅ SMS-TAN-Code eingegeben und Enter gedrückt');
        await otpSmsPage.waitForTimeout(2000);
        
        // SCHRITT 6: Passkey Collector mit ESC wegklicken
        console.log('🔍 SCHRITT 6: Prüfe auf Passkey Collector...');
        try {
          const passkeyCollectorVisible = await otpSmsPage.getByText('Passkey', { exact: false }).isVisible({ timeout: 3000 });
          if (passkeyCollectorVisible) {
            console.log('✅ Passkey Collector erkannt - drücke ESC');
            await otpSmsPage.keyboard.press('Escape');
            await otpSmsPage.waitForTimeout(1000);
            console.log('✅ Passkey Collector mit ESC geschlossen');
          }
        } catch (e) {
          console.log('   ℹ️  Kein Passkey Collector gefunden (bereits geschlossen oder nicht vorhanden)');
        }
        
        // SCHRITT 7: Geburtsdatum-Challenge
        console.log('🎂 SCHRITT 7: Gebe Geburtsdatum für Challenge ein...');
        console.log('📍 Aktuelle URL:', otpSmsPage.url());
        
        const birthdayInputOtpSms = otpSmsPage.locator('input[name*="birthday"]').first();
        await birthdayInputOtpSms.waitFor({ state: 'visible', timeout: 10000 });
        await birthdayInputOtpSms.fill('26.04.2000');
        console.log('✅ Geburtsdatum eingegeben');
        
        const weiterBtn1OtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
        await weiterBtn1OtpSms.click();
        console.log('✅ Erster "Weiter" geklickt');
        await otpSmsPage.waitForTimeout(1000);
        
        // Zweiter "Weiter" Button (optional - manchmal gibt es einen zweiten Screen)
        try {
          const weiterBtn2OtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
          await weiterBtn2OtpSms.waitFor({ state: 'visible', timeout: 3000 });
          await weiterBtn2OtpSms.click();
          console.log('✅ Zweiter "Weiter" geklickt');
          await otpSmsPage.waitForTimeout(1000);
        } catch (e) {
          console.log('   ℹ️  Kein zweiter "Weiter"-Button (direkte Weiterleitung)');
        }
        
        await otpSmsPage.waitForTimeout(3000);
        
        // SCHRITT 8: c24session Cookie prüfen
        const cookiesOtpSms = await otpSmsPage.context().cookies();
        const c24CookieOtpSms = cookiesOtpSms.find(c => c.name === 'c24session');
        if (c24CookieOtpSms) {
          console.log('✅ c24session Cookie gefunden (OTP SMS)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (OTP SMS)!');
        }
        
      } catch (error) {
        await sendEmailTimeoutWarning(
          'OTP-Login SMS TAN + Geburtsdatum-Challenge',
          'SMS-TAN weitergeleitet von ulitesting@icloud.com',
          30
        );
        throw error;
      }
      
      console.log('\n✅ TEIL 4 ABGESCHLOSSEN (OTP SMS TAN)\n');
      
    } finally {
      await otpSmsContext.close();
    }
    
    // ================================================================================
    // TEIL 5: OTP-Login (Einmalcode) mit E-Mail TAN + Geburtsdatum-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 5: Teste OTP-Login mit E-Mail TAN + Geburtsdatum-Challenge...\n');
    
    const otpEmailContext = await browser.newContext();
    const otpEmailPage = await otpEmailContext.newPage();
    
    try {
      await otpEmailPage.goto(getLoginUrl());
      await otpEmailPage.waitForLoadState('networkidle');
      
      // SCHRITT 1: Phone-Nummer eingeben
      console.log('📱 SCHRITT 1: Gebe Phone-Nummer ein:', phoneNumber);
      const phoneInputOtpEmail = otpEmailPage.locator('#cl_login');
      await phoneInputOtpEmail.fill(phoneNumber);
      const weiterBtnOtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
      await weiterBtnOtpEmail.click();
      await otpEmailPage.waitForTimeout(1000);
      
      // SCHRITT 2: Klick auf "Mit Einmalcode anmelden"
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonEmail = otpEmailPage.getByText('Mit Einmalcode anmelden');
      await einmalcodeButtonEmail.waitFor({ state: 'visible', timeout: 10000 });
      await einmalcodeButtonEmail.click();
      console.log('✅ "Mit Einmalcode anmelden" geklickt');
      await otpEmailPage.waitForTimeout(1000);
      
      // Prüfe, ob wir bereits eingeloggt sind (Browser erinnert sich)
      const kundenbereichUrl = getKundenbereichUrl();
      const kundenbereichPattern = new RegExp(kundenbereichUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      if (otpEmailPage.url().match(kundenbereichPattern)) {
        console.log('✅ Browser hat sich "erinnert" - direkt zum Kundenbereich weitergeleitet!');
        console.log('   Überspringe OTP-Eingabe und Geburtsdatum-Challenge...');
      } else {
        // SCHRITT 3: Prüfe auf OTP Selection Screen und wähle E-Mail
        console.log('🔍 SCHRITT 3: Prüfe auf OTP Selection Screen...');
        await otpEmailPage.waitForTimeout(500);
        
        const emailRadio = otpEmailPage.locator('#c24-uli-choose-email');
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
              const emailLabel = otpEmailPage.locator('label[for="c24-uli-choose-email"]');
              await emailLabel.click({ force: true });
              console.log('✅ E-Mail Label geklickt (force)');
            }
          }
          
          await otpEmailPage.waitForTimeout(300);
          
          // Verifiziere dass E-Mail ausgewählt ist
          const isChecked = await emailRadio.isChecked().catch(() => false);
          console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
        } else {
          console.log('ℹ️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
        }
        
        // "Code senden" klicken
        const codeSendenBtnOtpEmail = otpEmailPage.getByRole('button', { name: 'Code senden' });
        await codeSendenBtnOtpEmail.click();
        console.log('✅ "Code senden" geklickt');
        await otpEmailPage.waitForTimeout(1000);
        
        // SCHRITT 4: E-Mail-TAN holen
        console.log('📧 SCHRITT 4: Warte auf E-Mail-TAN...');
        const emailClientOtpEmail = getEmailClient();
        
        try {
          const emailTanOtp = await emailClientOtpEmail.waitForEmail(
            { subject: 'CHECK24' },
            30000,
            3000
          );
          
          if (!emailTanOtp) {
            throw new Error('E-Mail-TAN nicht erhalten (OTP E-Mail)');
          }
          
          console.log(`✅ E-Mail gefunden: ${emailTanOtp.subject}`);
          
          const emailTanCodeOtp = emailTanOtp.subject.match(/(\d{6})/)?.[1];
          if (!emailTanCodeOtp) {
            throw new Error('E-Mail-TAN-Code konnte nicht extrahiert werden (OTP E-Mail)');
          }
          
          console.log(`✅ E-Mail-TAN: ${emailTanCodeOtp}`);
          
          // SCHRITT 5: TAN eingeben
          console.log('🔍 SCHRITT 5: Gebe E-Mail-TAN ein...');
          await otpEmailPage.waitForTimeout(1000);
          
          const tanInputSelectorsEmail = [
            'input[id*="tan"]',
            'input[id*="code"]',
            'input[name*="tan"]',
            'input[placeholder*="Code"]',
            'input[type="tel"]:not([name*="phone"])',
            'input[type="text"]'
          ];
          
          let tanInputOtpEmail = null;
          for (const selector of tanInputSelectorsEmail) {
            try {
              const inputs = await otpEmailPage.locator(selector).all();
              for (const input of inputs) {
                const isVisible = await input.isVisible().catch(() => false);
                if (isVisible) {
                  tanInputOtpEmail = input;
                  console.log(`✅ TAN-Eingabefeld gefunden mit: ${selector}`);
                  break;
                }
              }
              if (tanInputOtpEmail) break;
            } catch (e) {
              continue;
            }
          }
          
          if (!tanInputOtpEmail) {
            throw new Error('TAN-Eingabefeld nicht gefunden (OTP E-Mail)');
          }
          
          await otpEmailPage.waitForTimeout(500);
          await tanInputOtpEmail.fill(emailTanCodeOtp);
          await otpEmailPage.waitForTimeout(500);
          await tanInputOtpEmail.press('Enter');
          console.log('✅ E-Mail-TAN eingegeben und Enter gedrückt');
          await otpEmailPage.waitForTimeout(2000);
          
          // SCHRITT 6: Geburtsdatum-Challenge (kein Passkey Collector beim zweiten Login)
          console.log('🎂 SCHRITT 6: Gebe Geburtsdatum für Challenge ein...');
          console.log('📍 Aktuelle URL:', otpEmailPage.url());
          
          const birthdayInputOtpEmail = otpEmailPage.locator('input[name*="birthday"]').first();
          await birthdayInputOtpEmail.waitFor({ state: 'visible', timeout: 10000 });
          await birthdayInputOtpEmail.fill('26.04.2000');
          console.log('✅ Geburtsdatum eingegeben');
          
          const weiterBtn1OtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
          await weiterBtn1OtpEmail.click();
          console.log('✅ Erster "Weiter" geklickt');
          await otpEmailPage.waitForTimeout(1000);
          
          // Zweiter "Weiter" Button (optional - manchmal gibt es einen zweiten Screen)
          try {
            const weiterBtn2OtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
            await weiterBtn2OtpEmail.waitFor({ state: 'visible', timeout: 3000 });
            await weiterBtn2OtpEmail.click();
            console.log('✅ Zweiter "Weiter" geklickt');
            await otpEmailPage.waitForTimeout(1000);
          } catch (e) {
            console.log('   ℹ️  Kein zweiter "Weiter"-Button (direkte Weiterleitung)');
          }
          
          await otpEmailPage.waitForTimeout(3000);
          
        } catch (error) {
          await sendEmailTimeoutWarning(
            'OTP-Login E-Mail TAN + Geburtsdatum-Challenge',
            'subject: CHECK24',
            30
          );
          throw error;
        }
      }
      
      // c24session Cookie prüfen (unabhängig davon, ob automatisch eingeloggt oder manuell)
      await otpEmailPage.waitForTimeout(2000);
      const cookiesOtpEmail = await otpEmailPage.context().cookies();
      const c24CookieOtpEmail = cookiesOtpEmail.find(c => c.name === 'c24session');
      if (c24CookieOtpEmail) {
        console.log('✅ c24session Cookie gefunden (OTP E-Mail)!');
      } else {
        throw new Error('❌ c24session Cookie NICHT gefunden (OTP E-Mail)!');
      }
      
      console.log('\n✅ TEIL 5 ABGESCHLOSSEN (OTP E-Mail TAN)\n');
      
      // ================================================================================
      // SCHRITT 8: Lösche das Konto wieder (direkt im gleichen Browser)
      // ================================================================================
      console.log('🗑️  SCHRITT 8: Lösche das neu erstellte Konto...');
      console.log(`   Verwende bestehenden Browser-Context (bereits eingeloggt)`);
      console.log(`   Aktuelle URL: ${otpEmailPage.url()}`);
      
      // Cookie-Banner schließen (falls vorhanden)
      console.log('   Prüfe auf Cookie-Banner...');
      try {
        const cookieBannerButton = otpEmailPage.getByText('geht klar', { exact: true });
        await cookieBannerButton.waitFor({ state: 'visible', timeout: 3000 });
        await cookieBannerButton.click();
        await otpEmailPage.waitForTimeout(1000);
        console.log('   ✅ Cookie-Banner geschlossen');
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }
      
      // Klick auf "Profil"
      console.log('   Klicke auf "Profil"...');
      const profilLink = otpEmailPage.getByRole('link', { name: 'Profil' });
      await profilLink.waitFor({ state: 'visible', timeout: 10000 });
      await profilLink.click({ force: true });
      console.log('   ✅ "Profil" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      // Klick auf "Anmelden & Sicherheit" (erster Link im Profil-Menü)
      console.log('   Klicke auf "Anmelden & Sicherheit"...');
      const anmeldenSicherheitLink = otpEmailPage.getByRole('link', { name: 'Anmelden & Sicherheit' }).first();
      await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
      await anmeldenSicherheitLink.click({ force: true });
      console.log('   ✅ "Anmelden & Sicherheit" geklickt');
      await otpEmailPage.waitForLoadState('networkidle');
      await otpEmailPage.waitForTimeout(1000);
      
      // Prüfe auf TEST Environment, ob auf die richtige URL weitergeleitet wurde
      const currentUrl = otpEmailPage.url();
      console.log(`   📍 Aktuelle URL: ${currentUrl}`);
      
      const environment = getEnvironment();
      if (environment === 'test') {
        // Auf TEST muss es accounts.check24-test.com sein
        if (currentUrl.includes('accounts.check24.com') && !currentUrl.includes('accounts.check24-test.com')) {
          console.log('   ⚠️  Falsche URL erkannt (PROD statt TEST) - navigiere manuell...');
          const correctUrl = 'https://accounts.check24-test.com/settings/overview';
          await otpEmailPage.goto(correctUrl);
          await otpEmailPage.waitForLoadState('networkidle');
          await otpEmailPage.waitForTimeout(1000);
          console.log(`   ✅ Manuell zur korrekten URL navigiert: ${correctUrl}`);
        } else {
          console.log('   ✅ URL ist korrekt (TEST Environment)');
        }
      } else {
        console.log('   ✅ PROD Environment - URL sollte korrekt sein');
      }

      // Klick auf "Kundenkonto löschen"
      console.log('   Klicke auf "Kundenkonto löschen"...');
      const kundenkontoLoeschenLink = otpEmailPage.getByText('Kundenkonto löschen');
      await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
      await kundenkontoLoeschenLink.click();
      console.log('   ✅ "Kundenkonto löschen" geklickt');
      await otpEmailPage.waitForTimeout(1500);

      // Checkbox setzen (Name: "terms")
      console.log('   Setze Bestätigungs-Checkbox...');
      const checkbox = otpEmailPage.locator('input[name="terms"][type="checkbox"]');
      await checkbox.waitFor({ state: 'visible', timeout: 10000 });
      await checkbox.check();
      console.log('   ✅ Checkbox gesetzt');
      await otpEmailPage.waitForTimeout(500);

      // Klick auf "entfernen" Button
      console.log('   Klicke auf "entfernen"-Button...');
      const entfernenButton = otpEmailPage.getByRole('button', { name: 'entfernen', exact: true });
      await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
      await entfernenButton.click();
      console.log('   ✅ "entfernen" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      console.log('✅ Konto erfolgreich gelöscht');
      
      console.log('\n🎉 TEST ERFOLGREICH ABGESCHLOSSEN!\n');
      
    } finally {
      await otpEmailContext.close();
    }
  });

  test('Passwort-Reset mit PLZ-Challenge - Phone Account', async ({ browser }) => {
    console.log('\n🔐 === PASSWORT-RESET MIT PLZ-CHALLENGE ===\n');
    
    // TEIL 1: Account erstellen und PLZ hinterlegen
    console.log('📝 TEIL 1: Erstelle neuen Account via Phone-Registrierung...\n');
    
    const registrationContext = await browser.newContext();
    const registrationPage = await registrationContext.newPage();

    let phoneNumber: string = '';
    let email: string = '';

    try {
      // Zur Registrierungs-Seite navigieren
      await registrationPage.goto(getLoginUrl());
      await registrationPage.waitForLoadState('networkidle');

      // SCHRITT 1: Generiere eindeutige Phone mit aktueller Uhrzeit
      let accountExists = true;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (accountExists && attempts < maxAttempts) {
        attempts++;
        
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        let timeExtension;
        if (attempts === 1) {
          timeExtension = hours + minutes;
        } else {
          const attemptSuffix = String(attempts - 1).padStart(2, '0');
          timeExtension = hours + minutes.slice(0, 2) + attemptSuffix;
        }
        
        phoneNumber = `01746760225 ext. ${timeExtension}`;
        
        console.log(`📱 SCHRITT 1 (Versuch ${attempts}/${maxAttempts}): Gebe Phone ein: ${phoneNumber}`);
        const phoneInput = registrationPage.locator('#cl_login');
        await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
        await registrationPage.waitForTimeout(300);
        
        await phoneInput.clear();
        await phoneInput.fill(phoneNumber);
        await registrationPage.waitForTimeout(500);

        console.log('➡️  Klicke auf "Weiter"-Button...');
        const weiterButton = registrationPage.getByRole('button', { name: 'Weiter' });
        await weiterButton.click();
        console.log('✅ "Weiter" wurde geklickt');
        await registrationPage.waitForTimeout(1500);

        const emailInputVisible = await registrationPage.locator('#cl_email_registercheck').isVisible().catch(() => false);
        const passwordInputVisible = await registrationPage.locator('#cl_pw_login').isVisible().catch(() => false);
        
        if (emailInputVisible) {
          console.log('✅ E-Mail-Eingabe-Feld sichtbar → Neue Registrierung möglich');
          accountExists = false;
        } else if (passwordInputVisible) {
          console.log('⚠️  Passwort-Eingabe-Feld sichtbar → Account existiert bereits!');
          console.log('🔄 Gehe zurück und versuche andere Phone-Nummer...');
          
          await registrationPage.goBack();
          await registrationPage.waitForTimeout(1000);
          accountExists = true;
        } else {
          console.log('⚠️  Unerwarteter Screen - warte kurz...');
          await registrationPage.waitForTimeout(1000);
          
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

      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton2 = registrationPage.getByRole('button', { name: 'Weiter' });
      await weiterButton2.click();
      console.log('✅ "Weiter" wurde geklickt');
      await registrationPage.waitForTimeout(1000);

      // SCHRITT 3: Registrierungsformular ausfüllen
      console.log('📝 SCHRITT 3: Fülle Registrierungsformular aus...');
      
      console.log('   Gebe Vorname ein: Loyalty');
      const vornameInput = registrationPage.locator('#cl_ul_firstname');
      await vornameInput.waitFor({ state: 'visible', timeout: 10000 });
      await vornameInput.fill('Loyalty');
      console.log('   ✅ Vorname eingegeben');
      
      console.log('   Gebe Nachname ein: Testing');
      const nachnameInput = registrationPage.locator('#cl_ul_lastname');
      await nachnameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nachnameInput.fill('Testing');
      console.log('   ✅ Nachname eingegeben');
      
      console.log('   Gebe Passwort ein: 1qay1qay');
      const password1 = registrationPage.locator('#cl_pw_register');
      await password1.waitFor({ state: 'visible', timeout: 10000 });
      await password1.fill('1qay1qay');
      console.log('   ✅ Passwort in erstes Feld eingegeben');
      
      const password2 = registrationPage.locator('#cl_ul_pw_register_repeat');
      await password2.waitFor({ state: 'visible', timeout: 10000 });
      await password2.fill('1qay1qay');
      console.log('   ✅ Passwort in zweites Feld eingegeben');

      console.log('➡️  Klicke auf "Weiter"-Button...');
      const weiterButton3 = registrationPage.getByRole('button', { name: 'Weiter' });
      await weiterButton3.click();
      console.log('✅ "Weiter" wurde geklickt');
      await registrationPage.waitForTimeout(1000);

      // SCHRITT 4-8: E-Mail und SMS TAN (wie beim Geburtsdatum-Test)
      console.log('📧 SCHRITT 4: Warte auf E-Mail-TAN-Code...');
      const emailClient = getEmailClient();
      
      try {
        const emailTanEmail = await emailClient.waitForEmail(
          { subject: 'CHECK24' },
          30000,
          3000
        );
        
        if (!emailTanEmail) {
          throw new Error('E-Mail-TAN E-Mail nicht erhalten');
        }
        
        console.log(`✅ E-Mail gefunden: ${emailTanEmail.subject}`);
        
        console.log('🔍 Extrahiere E-Mail-TAN-Code...');
        console.log(`   Betreff: ${emailTanEmail.subject}`);
        
        const emailSubjectMatch = emailTanEmail.subject.match(/(\d{6})/);
        if (!emailSubjectMatch) {
          throw new Error('E-Mail-TAN-Code konnte nicht aus Betreff extrahiert werden');
        }
        
        const emailTanCode = emailSubjectMatch[1];
        console.log(`✅ E-Mail-TAN-Code extrahiert aus Betreff: ${emailTanCode}`);
        console.log(`🔑 E-Mail-TAN-Code erhalten: ${emailTanCode}`);
        
        console.log('🔍 SCHRITT 5: Gebe E-Mail-TAN-Code ein...');
        const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
        
        let emailTanInput = null;
        for (const selector of inputSelectors) {
          try {
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
          } catch (e) {
            continue;
          }
        }
        
        if (!emailTanInput) {
          throw new Error('E-Mail-TAN-Eingabefeld nicht gefunden');
        }
        
        await emailTanInput.fill(emailTanCode);
        console.log('✅ E-Mail-TAN-Code eingegeben');
        
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Phone-Registrierung (PLZ-Test) - E-Mail-TAN-Verifizierung',
          'subject: CHECK24',
          30
        );
        throw error;
      }
      
      console.log('⏳ SCHRITT 6: Warte auf SMS-Verifizierungs-Screen...');
      await registrationPage.waitForLoadState('networkidle', { timeout: 30000 });
      await registrationPage.waitForTimeout(1000);
      
      console.log('📱 SCHRITT 7: Warte auf SMS-TAN-Code (weitergeleitet per E-Mail)...');
      
      let smsTanEmail;
      try {
        smsTanEmail = await emailClient.waitForEmail(
          { from: 'ulitesting@icloud.com' },
          120000,
          3000
        );
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Phone-Registrierung (PLZ-Test) - SMS-TAN-Verifizierung',
          'from: ulitesting@icloud.com',
          120
        );
        throw error;
      }
      
      // SMS-TAN-Code extrahieren
      console.log('🔍 Extrahiere SMS-TAN-Code aus weitergeleiteter SMS...');
      console.log(`   Betreff: ${smsTanEmail!.subject}`);
      console.log(`   Body (erste 500 Zeichen): ${smsTanEmail!.body.substring(0, 500)}`);
      
      let smsTanCode: string | null = null;
      
      // Versuche zuerst spezifische Patterns für den TAN-Code
      // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
      let smsMatch = smsTanEmail!.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
      if (smsMatch) {
        smsTanCode = smsMatch[1];
        console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCode}`);
      } else {
        // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
        smsMatch = smsTanEmail!.body.match(/(\d{6})\s+ist\s+Ihr/i);
        if (smsMatch) {
          smsTanCode = smsMatch[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCode}`);
        } else {
          // Pattern 3: Aus Betreff extrahieren
          smsMatch = smsTanEmail!.subject.match(/(\d{6})/);
          if (smsMatch) {
            smsTanCode = smsMatch[1];
            console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCode}`);
          } else {
            throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
          }
        }
      }
      
      console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCode}`);
      
      // SCHRITT 8: SMS-TAN-Code eingeben
      console.log('🔍 SCHRITT 8: Gebe SMS-TAN-Code ein...');
      
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
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
      
      // SCHRITT 9: Warte auf Auto-Submit und Callback-Weiterleitung
      console.log('⏳ SCHRITT 9: Warte auf Auto-Submit und Weiterleitung zum Kundenbereich...');
      await registrationPage.waitForLoadState('networkidle', { timeout: 30000 });
      
      const kundenbereichUrl = getKundenbereichUrl();
      const kundenbereichPattern = new RegExp(kundenbereichUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      // Prüfe ob wir bereits im Kundenbereich sind
      if (!registrationPage.url().match(kundenbereichPattern)) {
        console.log(`⚠️  Noch nicht im Kundenbereich, aktuelle URL: ${registrationPage.url()}`);
        console.log('   Warte auf Weiterleitung...');
        
        try {
          await registrationPage.waitForURL(kundenbereichPattern, { timeout: 30000 });
          console.log('✅ Erfolgreich zum Kundenbereich weitergeleitet');
        } catch (e) {
          console.log(`⚠️  Timeout - finale URL: ${registrationPage.url()}`);
          
          // Auf TEST bleibt die Seite manchmal auf Login - versuche manuell zum Kundenbereich zu navigieren
          if (registrationPage.url().includes('accounts.check24')) {
            console.log('   Navigiere manuell zum Kundenbereich...');
            await registrationPage.goto(kundenbereichUrl);
            await registrationPage.waitForLoadState('networkidle');
            await registrationPage.waitForTimeout(2000);
            console.log(`   ✅ Manuell navigiert, URL: ${registrationPage.url()}`);
          }
        }
      } else {
        console.log('✅ Erfolgreich zum Kundenbereich weitergeleitet');
      }
      
      console.log('✅ Account erfolgreich registriert!');
      console.log(`   📱 Phone: ${phoneNumber}`);
      console.log(`   📧 E-Mail: ${email}`);

      // SCHRITT 9: Füge PLZ in Adresse hinzu
      console.log('\n📝 SCHRITT 9: Füge PLZ in Adresse hinzu...');
      
      console.log('🍪 Prüfe auf Cookie-Banner...');
      try {
        const cookieBanner = registrationPage.getByText('geht klar', { exact: true });
        await cookieBanner.waitFor({ state: 'visible', timeout: 3000 });
        await cookieBanner.click();
        await registrationPage.waitForTimeout(1000);
        console.log('✅ Cookie-Banner geschlossen mit "geht klar"');
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }
      
      console.log('👤 Suche "Profil" Link/Button...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      const profilSelectors = [
        'a:has-text("Profil")',
        'button:has-text("Profil")',
        '[data-testid*="profile"]',
        '[data-tid*="profile"]'
      ];
      
      let profilLink = null;
      for (const selector of profilSelectors) {
        try {
          const link = registrationPage.locator(selector).first();
          await link.waitFor({ state: 'visible', timeout: 3000 });
          profilLink = link;
          console.log(`✅ "Profil" Link gefunden: "${await link.textContent()}" (${selector})`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!profilLink) {
        throw new Error('Profil-Link nicht gefunden');
      }
      
      await profilLink.click({ force: true });
      console.log('✅ "Profil" geklickt');
      await registrationPage.waitForTimeout(1000);
      
      console.log('📋 Suche "Persönliche Daten" Link...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      const persDataSelectors = [
        'a:has-text("Persönliche Daten")',
        'button:has-text("Persönliche Daten")'
      ];
      
      let persDataLink = null;
      for (const selector of persDataSelectors) {
        try {
          const link = registrationPage.locator(selector).first();
          await link.waitFor({ state: 'visible', timeout: 3000 });
          persDataLink = link;
          console.log(`✅ "Persönliche Daten" Link gefunden: "${await link.textContent()}" (${selector})`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!persDataLink) {
        throw new Error('Persönliche Daten Link nicht gefunden');
      }
      
      await persDataLink.click({ force: true });
      console.log('✅ "Persönliche Daten" geklickt');
      await registrationPage.waitForTimeout(1000);
      
      console.log('🏠 Klicke auf "Adresse"...');
      const adresseLink = registrationPage.locator('a:has-text("Adresse")').first();
      await adresseLink.waitFor({ state: 'visible', timeout: 10000 });
      await adresseLink.click({ force: true });
      console.log('✅ "Adresse" geklickt');
      await registrationPage.waitForTimeout(1000);
      
      console.log('📍 Suche PLZ-Eingabefeld...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      
      const plzInput = registrationPage.locator('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"]').first();
      await plzInput.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ PLZ-Feld gefunden');
      
      console.log('📍 Gebe PLZ ein: 80636');
      await plzInput.click({ clickCount: 3 });
      await plzInput.fill('80636');
      await registrationPage.waitForTimeout(500);
      
      const plzValue = await plzInput.inputValue();
      console.log(`🔍 Wert im Feld: "${plzValue}"`);
      
      if (plzValue === '80636') {
        console.log('✅ PLZ korrekt eingegeben!');
      } else {
        throw new Error(`PLZ nicht korrekt: erwartet "80636", gefunden "${plzValue}"`);
      }
      
      console.log('💾 Klicke auf "speichern"...');
      const speichernButton = registrationPage.locator('button:has-text("Speichern"), button:has-text("speichern")').first();
      await speichernButton.waitFor({ state: 'visible', timeout: 10000 });
      await speichernButton.click();
      console.log('✅ "Speichern" geklickt');
      await registrationPage.waitForTimeout(2000);
      
      console.log('✅ PLZ erfolgreich gespeichert!');
      console.log('\n✅ TEIL 1 ABGESCHLOSSEN\n');
      
    } finally {
      await registrationContext.close();
    }
    
    // ================================================================================
    // TEIL 2: Passwort-Reset mit SMS TAN + PLZ-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 2: Teste Passwort-Reset mit PLZ-Challenge...\n');
    
    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();
    
    try {
      await resetPage.goto(getLoginUrl());
      await resetPage.waitForLoadState('networkidle');
      
      console.log('📱 SCHRITT 1: Gebe Phone-Nummer ein:', phoneNumber);
      const phoneInputReset = resetPage.locator('#cl_login');
      await phoneInputReset.fill(phoneNumber);
      const weiterBtnReset = resetPage.getByRole('button', { name: 'Weiter' });
      await weiterBtnReset.click();
      await resetPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Passwort vergessen?"...');
      const passwortVergessenLink = resetPage.locator('a:has-text("Passwort vergessen?")').first();
      await passwortVergessenLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwortVergessenLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await resetPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 3: Wähle SMS/Phone als Challenge-Methode...');
      const smsLabel = resetPage.locator('label').filter({ hasText: 'SMS' }).first();
      await smsLabel.waitFor({ state: 'visible', timeout: 10000 });
      await smsLabel.click();
      console.log('✅ SMS-Option ausgewählt');
      
      const codeSendenBtn = resetPage.getByRole('button', { name: 'Code senden' });
      await codeSendenBtn.click();
      console.log('✅ "Code senden" geklickt');
      await resetPage.waitForTimeout(1000);
      
      console.log('📱 SCHRITT 4: Warte auf SMS-TAN-Code...');
      const smsEmailClient = new EmailClient();
      
      try {
        const smsTanEmail = await smsEmailClient.waitForEmail(
          { from: 'ulitesting@icloud.com' },
          30000,
          3000
        );
        
        if (!smsTanEmail) {
          throw new Error('SMS-TAN E-Mail nicht erhalten');
        }
        
        console.log(`✅ E-Mail gefunden: ${smsTanEmail.subject}`);
        console.log(`   Body (erste 500 Zeichen): ${smsTanEmail.body.substring(0, 500)}`);
        
        let smsTanCode: string | null = null;
        
        // Versuche zuerst spezifische Patterns für den TAN-Code
        // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
        let bodyMatch = smsTanEmail.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
        if (bodyMatch) {
          smsTanCode = bodyMatch[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCode}`);
        } else {
          // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
          bodyMatch = smsTanEmail.body.match(/(\d{6})\s+ist\s+Ihr/i);
          if (bodyMatch) {
            smsTanCode = bodyMatch[1];
            console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCode}`);
          } else {
            // Pattern 3: Aus Betreff extrahieren
            bodyMatch = smsTanEmail.subject.match(/(\d{6})/);
            if (bodyMatch) {
              smsTanCode = bodyMatch[1];
              console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCode}`);
            } else {
              throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
            }
          }
        }
        
        console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCode}`);
        
        console.log('🔍 SCHRITT 5: Gebe SMS-TAN-Code ein...');
        const tanInputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
        
        let tanInput = null;
        for (const selector of tanInputSelectors) {
          try {
            const inputs = await resetPage.locator(selector).all();
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
          throw new Error('TAN-Eingabefeld nicht gefunden');
        }
        
        await tanInput.fill(smsTanCode);
        await tanInput.press('Enter');
        console.log('✅ SMS-TAN eingegeben');
        await resetPage.waitForTimeout(2000);
        
        console.log('📍 SCHRITT 6: Gebe PLZ für Challenge ein...');
        const plzInput = resetPage.locator('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"]').first();
        await plzInput.waitFor({ state: 'visible', timeout: 10000 });
        await plzInput.fill('80636');
        console.log('✅ PLZ eingegeben');
        
        const weiterBtn1 = resetPage.getByRole('button', { name: 'Weiter' });
        await weiterBtn1.click();
        console.log('✅ Erster "Weiter" geklickt');
        await resetPage.waitForTimeout(1000);
        
        const weiterBtn2 = resetPage.getByRole('button', { name: 'Weiter' });
        await weiterBtn2.click();
        console.log('✅ Zweiter "Weiter" geklickt');
        await resetPage.waitForTimeout(3000);
        
        const cookies = await resetPage.context().cookies();
        const c24Cookie = cookies.find(c => c.name === 'c24session');
        if (c24Cookie) {
          console.log('✅ c24session Cookie gefunden (SMS TAN)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (SMS TAN)!');
        }
        
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset SMS TAN + PLZ-Challenge',
          'SMS weitergeleitet von ulitesting@icloud.com',
          30
        );
        throw error;
      }
      
      console.log('\n✅ TEIL 2 ABGESCHLOSSEN (SMS TAN)\n');
      
    } finally {
      await resetContext.close();
    }
    
    // ================================================================================
    // TEIL 3: Passwort-Reset mit E-Mail TAN + PLZ-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 3: Teste Passwort-Reset mit E-Mail TAN + PLZ-Challenge...\n');
    
    const resetContext3 = await browser.newContext();
    const resetPage3 = await resetContext3.newPage();
    
    try {
      await resetPage3.goto(getLoginUrl());
      await resetPage3.waitForLoadState('networkidle');
      
      console.log('📱 Gebe Phone-Nummer ein:', phoneNumber);
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
        throw new Error('Submit-Button (Code senden) nicht gefunden');
      }
      
      await submitBtn3.click();
      console.log('✅ "Code senden" geklickt');
      await resetPage3.waitForTimeout(1000);
      
      console.log('📧 Warte auf E-Mail-TAN...');
      const emailClient3 = getEmailClient();
      
      try {
        const emailTan3 = await emailClient3.waitForEmail(
          { subject: 'CHECK24' },
          30000,
          3000
        );
        
        if (!emailTan3) {
          throw new Error('E-Mail-TAN nicht erhalten');
        }
        
        const emailTanCode3 = emailTan3.subject.match(/(\d{6})/)?.[1];
        if (!emailTanCode3) {
          throw new Error('E-Mail-TAN-Code konnte nicht extrahiert werden');
        }
        
        console.log(`✅ E-Mail-TAN: ${emailTanCode3}`);
        
        const tanInputSelectors3 = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
        
        let tanInput3 = null;
        for (const selector of tanInputSelectors3) {
          try {
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
          } catch (e) {
            continue;
          }
        }
        
        if (!tanInput3) {
          throw new Error('TAN-Eingabefeld nicht gefunden');
        }
        
        await tanInput3.fill(emailTanCode3);
        await tanInput3.press('Enter');
        console.log('✅ E-Mail-TAN eingegeben');
        await resetPage3.waitForTimeout(2000);
        
        console.log('📍 Gebe PLZ ein...');
        const plzInput3 = resetPage3.locator('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"]').first();
        await plzInput3.waitFor({ state: 'visible', timeout: 10000 });
        await plzInput3.fill('80636');
        console.log('✅ PLZ eingegeben');
        
        const weiterBtn1_3 = resetPage3.getByRole('button', { name: 'Weiter' });
        await weiterBtn1_3.click();
        console.log('✅ Erster "Weiter" geklickt');
        await resetPage3.waitForTimeout(1000);
        
        const weiterBtn2_3 = resetPage3.getByRole('button', { name: 'Weiter' });
        await weiterBtn2_3.click();
        console.log('✅ Zweiter "Weiter" geklickt');
        await resetPage3.waitForTimeout(3000);
        
        const cookies3 = await resetPage3.context().cookies();
        const c24Cookie3 = cookies3.find(c => c.name === 'c24session');
        if (c24Cookie3) {
          console.log('✅ c24session Cookie gefunden (E-Mail TAN)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (E-Mail TAN)!');
        }
        
      } catch (error) {
        await sendEmailTimeoutWarning(
          'Passwort-Reset E-Mail TAN + PLZ-Challenge',
          'subject: CHECK24',
          30
        );
        throw error;
      }
      
      console.log('\n✅ TEIL 3 ABGESCHLOSSEN (E-Mail TAN)\n');
      
    } finally {
      await resetContext3.close();
    }
    
    // ================================================================================
    // TEIL 4: OTP-Login mit SMS TAN + PLZ-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 4: Teste OTP-Login mit SMS TAN + PLZ-Challenge...\n');
    
    const otpSmsContext = await browser.newContext();
    const otpSmsPage = await otpSmsContext.newPage();
    
    try {
      await otpSmsPage.goto(getLoginUrl());
      await otpSmsPage.waitForLoadState('networkidle');
      
      console.log('📱 SCHRITT 1: Gebe Phone-Nummer ein:', phoneNumber);
      const phoneInputOtpSms = otpSmsPage.locator('#cl_login');
      await phoneInputOtpSms.fill(phoneNumber);
      const weiterBtnOtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
      await weiterBtnOtpSms.click();
      await otpSmsPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonSms = otpSmsPage.getByText('Mit Einmalcode anmelden');
      await einmalcodeButtonSms.waitFor({ state: 'visible', timeout: 10000 });
      await einmalcodeButtonSms.click();
      console.log('✅ "Mit Einmalcode anmelden" geklickt');
      await otpSmsPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 3: Prüfe auf OTP Selection Screen...');
      await otpSmsPage.waitForTimeout(500);
      
      const smsRadio = otpSmsPage.locator('#c24-uli-choose-sms');
      const hasSmsOption = await smsRadio.count() > 0;
      
      if (hasSmsOption) {
        console.log('✅ OTP Selection Screen erkannt - wähle SMS...');
        
        try {
          await smsRadio.click({ timeout: 1500 });
          console.log('✅ SMS Radio Button geklickt (normal)');
        } catch (e) {
          try {
            await smsRadio.click({ force: true });
            console.log('✅ SMS Radio Button geklickt (force)');
          } catch (e2) {
            const smsLabel = otpSmsPage.locator('label[for="c24-uli-choose-sms"]');
            await smsLabel.click({ force: true });
            console.log('✅ SMS Label geklickt (force)');
          }
        }
        
        await otpSmsPage.waitForTimeout(300);
        
        const isChecked = await smsRadio.isChecked().catch(() => false);
        console.log(`📱 SMS Radio Button checked: ${isChecked}`);
      } else {
        console.log('ℹ️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
      }
      
      const codeSendenBtnOtpSms = otpSmsPage.getByRole('button', { name: 'Code senden' });
      await codeSendenBtnOtpSms.click();
      console.log('✅ "Code senden" geklickt');
      await otpSmsPage.waitForTimeout(1000);
      
      console.log('📱 SCHRITT 4: Warte auf SMS-TAN-Code (weitergeleitet per E-Mail)...');
      const emailClientOtpSms = new EmailClient();
      
      try {
        const smsTanEmailOtp = await emailClientOtpSms.waitForEmail(
          { from: 'ulitesting@icloud.com' },
          30000,
          3000
        );
        
        if (!smsTanEmailOtp) {
          throw new Error('SMS-TAN E-Mail nicht erhalten (OTP SMS)');
        }
        
        console.log(`✅ E-Mail gefunden: ${smsTanEmailOtp.subject}`);
        console.log(`   Body (erste 500 Zeichen): ${smsTanEmailOtp.body.substring(0, 500)}`);
        
        let smsTanCodeOtp: string | null = null;
        
        // Versuche zuerst spezifische Patterns für den TAN-Code
        // Pattern 1: "Sicherheitscode ist XXXXXX" (TEST Environment)
        let bodyMatchOtpSms = smsTanEmailOtp.body.match(/Sicherheitscode\s+ist\s+(\d{6})/i);
        if (bodyMatchOtpSms) {
          smsTanCodeOtp = bodyMatchOtpSms[1];
          console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "Sicherheitscode ist XXXXXX": ${smsTanCodeOtp}`);
        } else {
          // Pattern 2: "XXXXXX ist Ihr" (PROD Environment)
          bodyMatchOtpSms = smsTanEmailOtp.body.match(/(\d{6})\s+ist\s+Ihr/i);
          if (bodyMatchOtpSms) {
            smsTanCodeOtp = bodyMatchOtpSms[1];
            console.log(`✅ SMS-TAN-Code extrahiert mit Pattern "XXXXXX ist Ihr": ${smsTanCodeOtp}`);
          } else {
            // Pattern 3: Aus Betreff extrahieren
            bodyMatchOtpSms = smsTanEmailOtp.subject.match(/(\d{6})/);
            if (bodyMatchOtpSms) {
              smsTanCodeOtp = bodyMatchOtpSms[1];
              console.log(`✅ SMS-TAN-Code extrahiert aus Betreff: ${smsTanCodeOtp}`);
            } else {
              throw new Error('Konnte SMS-TAN-Code nicht extrahieren (OTP SMS)');
            }
          }
        }
        
        console.log(`🔑 SMS-TAN-Code erhalten: ${smsTanCodeOtp}`);
        
        console.log('🔍 SCHRITT 5: Gebe SMS-TAN-Code ein...');
        await otpSmsPage.waitForTimeout(1000);
        
        const tanInputSelectors = [
          'input[id*="tan"]',
          'input[id*="code"]',
          'input[name*="tan"]',
          'input[placeholder*="Code"]',
          'input[type="tel"]:not([name*="phone"])',
          'input[type="text"]'
        ];
        
        let tanInputOtpSms = null;
        for (const selector of tanInputSelectors) {
          try {
            const inputs = await otpSmsPage.locator(selector).all();
            for (const input of inputs) {
              const isVisible = await input.isVisible().catch(() => false);
              if (isVisible) {
                tanInputOtpSms = input;
                console.log(`✅ TAN-Eingabefeld gefunden mit: ${selector}`);
                break;
              }
            }
            if (tanInputOtpSms) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!tanInputOtpSms) {
          throw new Error('TAN-Eingabefeld nicht gefunden (OTP SMS)');
        }
        
        await otpSmsPage.waitForTimeout(500);
        await tanInputOtpSms.fill(smsTanCodeOtp);
        await otpSmsPage.waitForTimeout(500);
        await tanInputOtpSms.press('Enter');
        console.log('✅ SMS-TAN-Code eingegeben und Enter gedrückt');
        await otpSmsPage.waitForTimeout(2000);
        
        console.log('🔍 SCHRITT 6: Prüfe auf Passkey Collector...');
        try {
          const passkeyCollectorVisible = await otpSmsPage.getByText('Passkey', { exact: false }).isVisible({ timeout: 3000 });
          if (passkeyCollectorVisible) {
            console.log('✅ Passkey Collector erkannt - drücke ESC');
            await otpSmsPage.keyboard.press('Escape');
            await otpSmsPage.waitForTimeout(1000);
            console.log('✅ Passkey Collector mit ESC geschlossen');
          }
        } catch (e) {
          console.log('   ℹ️  Kein Passkey Collector gefunden');
        }
        
        console.log('📍 SCHRITT 7: Gebe PLZ für Challenge ein...');
        console.log('📍 Aktuelle URL:', otpSmsPage.url());
        
        const plzInputOtpSms = otpSmsPage.locator('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"]').first();
        await plzInputOtpSms.waitFor({ state: 'visible', timeout: 10000 });
        await plzInputOtpSms.fill('80636');
        console.log('✅ PLZ eingegeben');
        
        const weiterBtn1OtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
        await weiterBtn1OtpSms.click();
        console.log('✅ Erster "Weiter" geklickt');
        await otpSmsPage.waitForTimeout(1000);
        
        try {
          const weiterBtn2OtpSms = otpSmsPage.getByRole('button', { name: 'Weiter' });
          await weiterBtn2OtpSms.waitFor({ state: 'visible', timeout: 3000 });
          await weiterBtn2OtpSms.click();
          console.log('✅ Zweiter "Weiter" geklickt');
          await otpSmsPage.waitForTimeout(1000);
        } catch (e) {
          console.log('   ℹ️  Kein zweiter "Weiter"-Button (direkte Weiterleitung)');
        }
        
        await otpSmsPage.waitForTimeout(3000);
        
        const cookiesOtpSms = await otpSmsPage.context().cookies();
        const c24CookieOtpSms = cookiesOtpSms.find(c => c.name === 'c24session');
        if (c24CookieOtpSms) {
          console.log('✅ c24session Cookie gefunden (OTP SMS)!');
        } else {
          throw new Error('❌ c24session Cookie NICHT gefunden (OTP SMS)!');
        }
        
      } catch (error) {
        await sendEmailTimeoutWarning(
          'OTP-Login SMS TAN + PLZ-Challenge',
          'SMS-TAN weitergeleitet von ulitesting@icloud.com',
          30
        );
        throw error;
      }
      
      console.log('\n✅ TEIL 4 ABGESCHLOSSEN (OTP SMS TAN)\n');
      
    } finally {
      await otpSmsContext.close();
    }
    
    // ================================================================================
    // TEIL 5: OTP-Login mit E-Mail TAN + PLZ-Challenge
    // ================================================================================
    console.log('\n🔐 TEIL 5: Teste OTP-Login mit E-Mail TAN + PLZ-Challenge...\n');
    
    const otpEmailContext = await browser.newContext();
    const otpEmailPage = await otpEmailContext.newPage();
    
    try {
      await otpEmailPage.goto(getLoginUrl());
      await otpEmailPage.waitForLoadState('networkidle');
      
      console.log('📱 SCHRITT 1: Gebe Phone-Nummer ein:', phoneNumber);
      const phoneInputOtpEmail = otpEmailPage.locator('#cl_login');
      await phoneInputOtpEmail.fill(phoneNumber);
      const weiterBtnOtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
      await weiterBtnOtpEmail.click();
      await otpEmailPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonEmail = otpEmailPage.getByText('Mit Einmalcode anmelden');
      await einmalcodeButtonEmail.waitFor({ state: 'visible', timeout: 10000 });
      await einmalcodeButtonEmail.click();
      console.log('✅ "Mit Einmalcode anmelden" geklickt');
      await otpEmailPage.waitForTimeout(1000);
      
      const kundenbereichUrl = getKundenbereichUrl();
      const kundenbereichPattern = new RegExp(kundenbereichUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      if (otpEmailPage.url().match(kundenbereichPattern)) {
        console.log('✅ Browser hat sich "erinnert" - direkt zum Kundenbereich weitergeleitet!');
        console.log('   Überspringe OTP-Eingabe und PLZ-Challenge...');
      } else {
        console.log('🔍 SCHRITT 3: Prüfe auf OTP Selection Screen...');
        await otpEmailPage.waitForTimeout(500);
        
        const emailRadio = otpEmailPage.locator('#c24-uli-choose-email');
        const hasEmailOption = await emailRadio.count() > 0;
        
        if (hasEmailOption) {
          console.log('✅ OTP Selection Screen erkannt - wähle E-Mail...');
          
          try {
            await emailRadio.click({ timeout: 1500 });
            console.log('✅ E-Mail Radio Button geklickt (normal)');
          } catch (e) {
            try {
              await emailRadio.click({ force: true });
              console.log('✅ E-Mail Radio Button geklickt (force)');
            } catch (e2) {
              const emailLabel = otpEmailPage.locator('label[for="c24-uli-choose-email"]');
              await emailLabel.click({ force: true });
              console.log('✅ E-Mail Label geklickt (force)');
            }
          }
          
          await otpEmailPage.waitForTimeout(300);
          
          const isChecked = await emailRadio.isChecked().catch(() => false);
          console.log(`📧 E-Mail Radio Button checked: ${isChecked}`);
        } else {
          console.log('ℹ️  Kein OTP Selection Screen erkannt - überspringe Auswahl');
        }
        
        const codeSendenBtnOtpEmail = otpEmailPage.getByRole('button', { name: 'Code senden' });
        await codeSendenBtnOtpEmail.click();
        console.log('✅ "Code senden" geklickt');
        await otpEmailPage.waitForTimeout(1000);
        
        console.log('📧 SCHRITT 4: Warte auf E-Mail-TAN...');
        const emailClientOtpEmail = getEmailClient();
        
        try {
          const emailTanOtp = await emailClientOtpEmail.waitForEmail(
            { subject: 'CHECK24' },
            30000,
            3000
          );
          
          if (!emailTanOtp) {
            throw new Error('E-Mail-TAN nicht erhalten (OTP E-Mail)');
          }
          
          console.log(`✅ E-Mail gefunden: ${emailTanOtp.subject}`);
          
          const emailTanCodeOtp = emailTanOtp.subject.match(/(\d{6})/)?.[1];
          if (!emailTanCodeOtp) {
            throw new Error('E-Mail-TAN-Code konnte nicht extrahiert werden (OTP E-Mail)');
          }
          
          console.log(`✅ E-Mail-TAN: ${emailTanCodeOtp}`);
          
          console.log('🔍 SCHRITT 5: Gebe E-Mail-TAN ein...');
          await otpEmailPage.waitForTimeout(1000);
          
          const tanInputSelectorsEmail = [
            'input[id*="tan"]',
            'input[id*="code"]',
            'input[name*="tan"]',
            'input[placeholder*="Code"]',
            'input[type="tel"]:not([name*="phone"])',
            'input[type="text"]'
          ];
          
          let tanInputOtpEmail = null;
          for (const selector of tanInputSelectorsEmail) {
            try {
              const inputs = await otpEmailPage.locator(selector).all();
              for (const input of inputs) {
                const isVisible = await input.isVisible().catch(() => false);
                if (isVisible) {
                  tanInputOtpEmail = input;
                  console.log(`✅ TAN-Eingabefeld gefunden mit: ${selector}`);
                  break;
                }
              }
              if (tanInputOtpEmail) break;
            } catch (e) {
              continue;
            }
          }
          
          if (!tanInputOtpEmail) {
            throw new Error('TAN-Eingabefeld nicht gefunden (OTP E-Mail)');
          }
          
          await otpEmailPage.waitForTimeout(500);
          await tanInputOtpEmail.fill(emailTanCodeOtp);
          await otpEmailPage.waitForTimeout(500);
          await tanInputOtpEmail.press('Enter');
          console.log('✅ E-Mail-TAN eingegeben und Enter gedrückt');
          await otpEmailPage.waitForTimeout(2000);
          
          console.log('📍 SCHRITT 6: Gebe PLZ für Challenge ein...');
          console.log('📍 Aktuelle URL:', otpEmailPage.url());
          
          const plzInputOtpEmail = otpEmailPage.locator('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"]').first();
          await plzInputOtpEmail.waitFor({ state: 'visible', timeout: 10000 });
          await plzInputOtpEmail.fill('80636');
          console.log('✅ PLZ eingegeben');
          
          const weiterBtn1OtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
          await weiterBtn1OtpEmail.click();
          console.log('✅ Erster "Weiter" geklickt');
          await otpEmailPage.waitForTimeout(1000);
          
          try {
            const weiterBtn2OtpEmail = otpEmailPage.getByRole('button', { name: 'Weiter' });
            await weiterBtn2OtpEmail.waitFor({ state: 'visible', timeout: 3000 });
            await weiterBtn2OtpEmail.click();
            console.log('✅ Zweiter "Weiter" geklickt');
            await otpEmailPage.waitForTimeout(1000);
          } catch (e) {
            console.log('   ℹ️  Kein zweiter "Weiter"-Button (direkte Weiterleitung)');
          }
          
          await otpEmailPage.waitForTimeout(3000);
          
        } catch (error) {
          await sendEmailTimeoutWarning(
            'OTP-Login E-Mail TAN + PLZ-Challenge',
            'subject: CHECK24',
            30
          );
          throw error;
        }
      }
      
      await otpEmailPage.waitForTimeout(2000);
      const cookiesOtpEmail = await otpEmailPage.context().cookies();
      const c24CookieOtpEmail = cookiesOtpEmail.find(c => c.name === 'c24session');
      if (c24CookieOtpEmail) {
        console.log('✅ c24session Cookie gefunden (OTP E-Mail)!');
      } else {
        throw new Error('❌ c24session Cookie NICHT gefunden (OTP E-Mail)!');
      }
      
      console.log('\n✅ TEIL 5 ABGESCHLOSSEN (OTP E-Mail TAN)\n');
      
      // ================================================================================
      // SCHRITT 8: Lösche das Konto wieder (direkt im gleichen Browser)
      // ================================================================================
      console.log('🗑️  SCHRITT 8: Lösche das neu erstellte Konto...');
      console.log(`   Verwende bestehenden Browser-Context (bereits eingeloggt)`);
      console.log(`   Aktuelle URL: ${otpEmailPage.url()}`);
      
      console.log('   Prüfe auf Cookie-Banner...');
      try {
        const cookieBannerButton = otpEmailPage.getByText('geht klar', { exact: true });
        await cookieBannerButton.waitFor({ state: 'visible', timeout: 3000 });
        await cookieBannerButton.click();
        await otpEmailPage.waitForTimeout(1000);
        console.log('   ✅ Cookie-Banner geschlossen');
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }
      
      console.log('   Klicke auf "Profil"...');
      const profilLink = otpEmailPage.getByRole('link', { name: 'Profil' });
      await profilLink.waitFor({ state: 'visible', timeout: 10000 });
      await profilLink.click({ force: true });
      console.log('   ✅ "Profil" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      console.log('   Klicke auf "Anmelden & Sicherheit"...');
      const anmeldenSicherheitLink = otpEmailPage.getByRole('link', { name: 'Anmelden & Sicherheit' }).first();
      await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
      await anmeldenSicherheitLink.click({ force: true });
      console.log('   ✅ "Anmelden & Sicherheit" geklickt');
      await otpEmailPage.waitForLoadState('networkidle');
      await otpEmailPage.waitForTimeout(1000);
      
      // Prüfe auf TEST Environment, ob auf die richtige URL weitergeleitet wurde
      const currentUrl = otpEmailPage.url();
      console.log(`   📍 Aktuelle URL: ${currentUrl}`);
      
      const environment = getEnvironment();
      if (environment === 'test') {
        // Auf TEST muss es accounts.check24-test.com sein
        if (currentUrl.includes('accounts.check24.com') && !currentUrl.includes('accounts.check24-test.com')) {
          console.log('   ⚠️  Falsche URL erkannt (PROD statt TEST) - navigiere manuell...');
          const correctUrl = 'https://accounts.check24-test.com/settings/overview';
          await otpEmailPage.goto(correctUrl);
          await otpEmailPage.waitForLoadState('networkidle');
          await otpEmailPage.waitForTimeout(1000);
          console.log(`   ✅ Manuell zur korrekten URL navigiert: ${correctUrl}`);
        } else {
          console.log('   ✅ URL ist korrekt (TEST Environment)');
        }
      } else {
        console.log('   ✅ PROD Environment - URL sollte korrekt sein');
      }

      console.log('   Klicke auf "Kundenkonto löschen"...');
      const kundenkontoLoeschenLink = otpEmailPage.getByText('Kundenkonto löschen');
      await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
      await kundenkontoLoeschenLink.click();
      console.log('   ✅ "Kundenkonto löschen" geklickt');
      await otpEmailPage.waitForTimeout(1500);

      console.log('   Setze Bestätigungs-Checkbox...');
      const checkbox = otpEmailPage.locator('input[name="terms"][type="checkbox"]');
      await checkbox.waitFor({ state: 'visible', timeout: 10000 });
      await checkbox.check();
      console.log('   ✅ Checkbox gesetzt');
      await otpEmailPage.waitForTimeout(500);

      console.log('   Klicke auf "entfernen"-Button...');
      const entfernenButton = otpEmailPage.getByRole('button', { name: 'entfernen', exact: true });
      await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
      await entfernenButton.click();
      console.log('   ✅ "entfernen" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      console.log('✅ Konto erfolgreich gelöscht');
      
      console.log('\n🎉 TEST ERFOLGREICH ABGESCHLOSSEN!\n');
      
    } finally {
      await otpEmailContext.close();
    }
    
  });

});
