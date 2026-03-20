import { test, expect } from '../fixtures/test-hooks';
import type { Page } from '@playwright/test';
import { expectLoginSuccess, logout } from '../helpers/auth';
import { getEmailClient, EmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl, getKundenbereichUrl, getEnvironment } from '../helpers/environment';
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Nach der Geburtsdatum-Challenge (bzw. PLZ-Challenge) im Passwort-Reset kommt der Screen mit
 * „Passwort ändern“ (a.c24-uli-pwr-pw-link) und „weiter“ (#c24-uli-pwr-login-btn) – nicht direkt nach der TAN.
 */
async function clickWeiterNachPasswortResetChallenge(page: Page): Promise<void> {
  const weiterOhnePwAendern = page.locator('#c24-uli-pwr-login-btn');
  try {
    await weiterOhnePwAendern.waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    console.log('ℹ️  #c24-uli-pwr-login-btn nicht sichtbar – evtl. direkte Weiterleitung');
    return;
  }
  console.log('➡️  Screen nach Challenge: klicke „weiter“ (#c24-uli-pwr-login-btn)...');
  await weiterOhnePwAendern.scrollIntoViewIfNeeded();
  await weiterOhnePwAendern.click();
  console.log('✅ „weiter“ geklickt (ohne Passwort zu ändern)');
  await page.waitForTimeout(1200);
}

/** ULI Passwort-Reset: Geburtsdatum in #cl_birthday_lc (gleiche Eingabe-Strategie wie TEIL 2 / SMS-TAN). */
async function fillUliGeburtsdatumChallengeField(page: Page): Promise<void> {
  const birthdayChallengeInput = page.locator('#cl_birthday_lc');
  await birthdayChallengeInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Geburtsdatum-Challenge-Feld (#cl_birthday_lc)');

  const birthdayRaw = '26042000';
  console.log('📅 Gebe Geburtsdatum ein: 26.04.2000');

  await birthdayChallengeInput.click({ clickCount: 3 });
  await page.waitForTimeout(300);

  await birthdayChallengeInput.pressSequentially(birthdayRaw, { delay: 150 });
  await page.waitForTimeout(1000);

  let birthdayValue = await birthdayChallengeInput.inputValue();
  console.log(`🔍 Wert im Feld: "${birthdayValue}"`);

  if (birthdayValue !== '26.04.2000') {
    console.log('⚠️  Versuche alternative Eingabe-Methode...');
    await birthdayChallengeInput.click();
    await page.waitForTimeout(200);
    await birthdayChallengeInput.press('Meta+A');
    await page.waitForTimeout(200);
    await birthdayChallengeInput.press('Backspace');
    await page.waitForTimeout(300);
    await birthdayChallengeInput.pressSequentially(birthdayRaw, { delay: 150 });
    await page.waitForTimeout(1000);

    birthdayValue = await birthdayChallengeInput.inputValue();
    console.log(`🔍 Wert nach alternativer Methode: "${birthdayValue}"`);
  }

  if (birthdayValue !== '26.04.2000') {
    throw new Error(`Geburtsdatum-Eingabe fehlgeschlagen: Erwartet "26.04.2000", erhalten "${birthdayValue}"`);
  }

  console.log('✅ Geburtsdatum korrekt eingegeben');
}

async function clickUliGeburtsdatumChallengeWeiterFirst(page: Page): Promise<void> {
  console.log('➡️  Klicke "Weiter" (#c24-uli-lc-bd-btn)...');
  const weiterButtonChallenge = page.locator('#c24-uli-lc-bd-btn');
  await weiterButtonChallenge.waitFor({ state: 'visible', timeout: 10000 });
  await weiterButtonChallenge.scrollIntoViewIfNeeded();
  await weiterButtonChallenge.click();
  console.log('✅ "Weiter" geklickt (erster Screen)');
  await page.waitForTimeout(2000);

  console.log('✅ PLZ/Birthday Challenge erfolgreich - erster Screen abgeschlossen');
  console.log('📍 Aktuelle URL:', page.url());
}

async function clickUliGeburtsdatumChallengeWeiterSecondOptional(page: Page): Promise<void> {
  console.log('➡️  SCHRITT 6b: Zweiter "Weiter" (falls gleicher Button erneut sichtbar)...');
  const weiterButtonSecond = page.locator('#c24-uli-lc-bd-btn');
  if (await weiterButtonSecond.isVisible().catch(() => false)) {
    await weiterButtonSecond.scrollIntoViewIfNeeded();
    await weiterButtonSecond.click();
    console.log('✅ Zweiter "Weiter" geklickt');
    await page.waitForTimeout(800);
  } else {
    console.log('ℹ️  Kein zweiter #c24-uli-lc-bd-btn sichtbar – evtl. direkte Weiterleitung');
  }

  console.log('✅ PLZ/Birthday Challenge vollständig abgeschlossen');
}

/** ULI PLZ-Challenge nach TAN: Eingabe #cl_zipcode_lc, „Weiter“ #c24-uli-lc-zipcode-btn */
async function fillUliPlzChallengeField(page: Page, plz: string = '80636'): Promise<void> {
  const plzInput = page.locator('#cl_zipcode_lc');
  await plzInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ PLZ-Challenge-Feld (#cl_zipcode_lc)');

  await plzInput.click({ clickCount: 3 });
  await page.waitForTimeout(200);
  await plzInput.fill(plz);
  await page.waitForTimeout(400);

  let value = await plzInput.inputValue();
  console.log(`🔍 Wert im PLZ-Feld: "${value}"`);

  if (value !== plz) {
    console.log('⚠️  PLZ: alternative Eingabe (Select All + erneut)...');
    await plzInput.click();
    await page.waitForTimeout(150);
    await plzInput.press('Meta+A');
    await page.waitForTimeout(100);
    await plzInput.press('Backspace');
    await page.waitForTimeout(150);
    await plzInput.pressSequentially(plz, { delay: 80 });
    await page.waitForTimeout(400);
    value = await plzInput.inputValue();
    console.log(`🔍 Wert nach Alternative: "${value}"`);
  }

  if (value !== plz) {
    throw new Error(`PLZ-Challenge: erwartet "${plz}", erhalten "${value}"`);
  }
  console.log(`✅ PLZ ${plz} eingegeben`);
}

async function clickUliPlzChallengeWeiterFirst(page: Page): Promise<void> {
  console.log('➡️  Klicke "Weiter" (#c24-uli-lc-zipcode-btn)...');
  const btn = page.locator('#c24-uli-lc-zipcode-btn');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  console.log('✅ "Weiter" nach PLZ-Challenge geklickt (erster Schritt)');
  await page.waitForTimeout(2000);
  console.log('📍 Aktuelle URL:', page.url());
}

async function clickUliPlzChallengeWeiterSecondOptional(page: Page): Promise<void> {
  console.log('➡️  Zweiter "Weiter" PLZ-Challenge (falls #c24-uli-lc-zipcode-btn erneut sichtbar)...');
  const btn = page.locator('#c24-uli-lc-zipcode-btn');
  if (await btn.isVisible().catch(() => false)) {
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    console.log('✅ Zweiter "Weiter" (#c24-uli-lc-zipcode-btn) geklickt');
    await page.waitForTimeout(800);
  } else {
    console.log('ℹ️  Kein zweiter #c24-uli-lc-zipcode-btn sichtbar');
  }
}

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
        const weiterButton = registrationPage.locator('#c24-uli-login-btn');
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

      // Klick auf "Weiter" nach E-Mail (Registrierungs-Check-Screen)
      console.log('➡️  Klicke auf "Weiter" (#c24-uli-registercheck-btn)...');
      const weiterButton2 = registrationPage.locator('#c24-uli-registercheck-btn');
      await weiterButton2.waitFor({ state: 'visible', timeout: 10000 });
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

      // Klick auf "Weiter" (Registrierungsformular)
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
        const gehtKlar = registrationPage.locator('a.c24-cookie-consent-button').filter({ hasText: /^geht klar$/i }).first();
        if (await gehtKlar.isVisible({ timeout: 2000 }).catch(() => false)) {
          await gehtKlar.click();
          await registrationPage.waitForTimeout(400);
          console.log('✅ Cookie-Banner geschlossen mit "geht klar"');
        } else {
          console.log('ℹ️  Kein Cookie-Banner mit "geht klar" gefunden');
        }
      } catch (e) {
        console.log('ℹ️  Cookie-Banner konnte nicht geschlossen werden oder ist nicht vorhanden');
      }

      // Klick auf "Profil" (Kundenbereich-Header)
      console.log('👤 Klicke "Profil" (c24-customer-hover-wrapper)...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      const profilLink = registrationPage.locator('a.c24-customer-hover-wrapper').first();
      await profilLink.waitFor({ state: 'visible', timeout: 15000 });
      await profilLink.click({ force: true });
      console.log('✅ "Profil" geklickt');
      await registrationPage.waitForTimeout(800);

      // Klick auf "Persönliche Daten"
      console.log('📋 Klicke "Persönliche Daten" (href personal-data)...');
      const persoenlicheDatenLink = registrationPage.locator('a[href*="personal-data"]').first();
      await persoenlicheDatenLink.waitFor({ state: 'visible', timeout: 15000 });
      await persoenlicheDatenLink.click({ force: true });
      console.log('✅ "Persönliche Daten" geklickt');
      await registrationPage.waitForTimeout(800);

      // Klick auf "Geburtsdatum" (Menü links)
      console.log('🎂 Klicke "Geburtsdatum" (c24-kb__menu-bar__item__container)...');
      const geburtsdatumLink = registrationPage.locator('a.c24-kb__menu-bar__item__container[title="Geburtsdatum"]').first();
      await geburtsdatumLink.waitFor({ state: 'visible', timeout: 15000 });
      await geburtsdatumLink.click({ force: true });
      console.log('✅ "Geburtsdatum" geklickt');
      await registrationPage.waitForTimeout(800);

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

      // Klick auf "speichern" (Kundenbereich Primary-Button)
      console.log('💾 Klicke auf "speichern" (c24-kb-button__primary)...');
      const speichernButton = registrationPage.locator('button.c24-kb-button__primary[type="submit"]').first();
      await speichernButton.waitFor({ state: 'visible', timeout: 15000 });
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
    
    enableAutoScreenshots('login-plz-birthday-challenge');

    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();

    try {
      // Zur Login-Seite navigieren
      const loginUrl = getLoginUrl();
      console.log(`🌐 Navigiere zu: ${loginUrl}`);
      await resetPage.goto(loginUrl);
      await resetPage.waitForLoadState('networkidle');
      
      await takeAutoScreenshot(resetPage, 'login-screen-leer');

      // SCHRITT 1: Phone-Nummer eingeben (nicht E-Mail!)
      console.log(`📱 SCHRITT 1: Gebe Phone-Nummer ein: ${phoneNumber}`);
      const phoneLoginInput = resetPage.locator('#cl_login');
      await phoneLoginInput.waitFor({ state: 'visible', timeout: 10000 });
      await phoneLoginInput.fill(phoneNumber);
      console.log('✅ Phone-Nummer eingegeben');
      
      await takeAutoScreenshot(resetPage, 'phone-eingegeben');

      // Klick auf "Weiter"
      console.log('➡️  Klicke auf "Weiter"...');
      const weiterButton = resetPage.locator('#c24-uli-login-btn');
      await weiterButton.click();
      await resetPage.waitForTimeout(1000);

      // SCHRITT 2: Klicke auf "Passwort vergessen?" (Wrapper-Klasse)
      console.log('🔍 SCHRITT 2: Klicke auf "Passwort vergessen?"...');
      const passwordForgottenLink = resetPage.locator('.c24-uli-cl-pwreset-wrapper').first();
      await passwordForgottenLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwordForgottenLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await resetPage.waitForTimeout(2000);
      
      await takeAutoScreenshot(resetPage, 'password-reset-selection-screen');

      // SCHRITT 3: Selection Screen – SMS (#c24-uli-choose-sms)
      console.log('🔍 SCHRITT 3: Wähle SMS als Challenge-Methode...');
      console.log(`📍 Aktuelle URL: ${resetPage.url()}`);
      const smsRadioReset = resetPage.locator('#c24-uli-choose-sms');
      if (await smsRadioReset.count() > 0) {
        try {
          await smsRadioReset.click({ timeout: 2000 });
        } catch {
          await resetPage.locator('label[for="c24-uli-choose-sms"]').click({ force: true });
        }
        console.log('✅ SMS-Option ausgewählt');
      } else {
        console.log('⚠️  SMS-Radio nicht gefunden - versuche fortzufahren');
      }
      await resetPage.waitForTimeout(400);
      await takeAutoScreenshot(resetPage, 'sms-option-ausgewaehlt');

      console.log('➡️  Klicke "Code senden" (#c24-uli-pwr-choose-btn)...');
      const submitButton = resetPage.locator('#c24-uli-pwr-choose-btn');
      await submitButton.waitFor({ state: 'visible', timeout: 10000 });
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
      
      await takeAutoScreenshot(resetPage, 'plz-birthday-challenge-screen-leer');

      await fillUliGeburtsdatumChallengeField(resetPage);
      await takeAutoScreenshot(resetPage, 'geburtsdatum-eingegeben');

      await clickUliGeburtsdatumChallengeWeiterFirst(resetPage);
      await takeAutoScreenshot(resetPage, 'nach-erstem-weiter');

      await clickUliGeburtsdatumChallengeWeiterSecondOptional(resetPage);
      await clickWeiterNachPasswortResetChallenge(resetPage);
      
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
        await takeAutoScreenshot(resetPage, 'kundenbereich-erfolgreich');
      } else {
        throw new Error('❌ c24session Cookie NICHT gefunden - Login fehlgeschlagen!');
      }
      
      console.log('\n✅ TEIL 2 ABGESCHLOSSEN (Phone TAN)\n');
      
      // Test erfolgreich - Screenshots übernehmen
      commitScreenshots();
      
    } finally {
      disableAutoScreenshots();
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
        
        const weiterBtn3 = resetPage3.locator('#c24-uli-login-btn');
        await weiterBtn3.click();
        await resetPage3.waitForTimeout(1000);
        
        console.log('🔍 Klicke auf "Passwort vergessen?"...');
        const passwordForgottenLink3 = resetPage3.locator('.c24-uli-cl-pwreset-wrapper').first();
        await passwordForgottenLink3.waitFor({ state: 'visible', timeout: 10000 });
        await passwordForgottenLink3.click();
        await resetPage3.waitForTimeout(2000);

        console.log('🔍 Wähle E-Mail TAN (#c24-uli-choose-email)...');
        const emailRadio3 = resetPage3.locator('#c24-uli-choose-email');
        if (await emailRadio3.count() > 0) {
          try {
            await emailRadio3.click({ timeout: 2000 });
          } catch {
            await resetPage3.locator('label[for="c24-uli-choose-email"]').click({ force: true });
          }
          console.log('✅ E-Mail-Option ausgewählt');
        } else {
          console.log('ℹ️  E-Mail-Radio nicht gefunden – evtl. bereits vorausgewählt');
        }
        await resetPage3.waitForTimeout(400);

        const submitBtn3 = resetPage3.locator('#c24-uli-pwr-choose-btn');
        await submitBtn3.waitFor({ state: 'visible', timeout: 10000 });
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
        
        // Geburtsdatum-Challenge: gleiche Logik wie TEIL 2 (SMS-TAN + Passwort-Reset)
        console.log('🎂 SCHRITT 6: Gebe Geburtsdatum für PLZ/Birthday Challenge ein...');
        console.log('📍 Aktuelle URL:', resetPage3.url());

        await fillUliGeburtsdatumChallengeField(resetPage3);

        await clickUliGeburtsdatumChallengeWeiterFirst(resetPage3);

        await clickUliGeburtsdatumChallengeWeiterSecondOptional(resetPage3);
        await clickWeiterNachPasswortResetChallenge(resetPage3);
        await resetPage3.waitForTimeout(2000);
        
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
      const weiterBtnOtpSms = otpSmsPage.locator('#c24-uli-login-btn');
      await weiterBtnOtpSms.click();
      await otpSmsPage.waitForTimeout(1000);
      
      // SCHRITT 2: Klick auf "Mit Einmalcode anmelden"
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonSms = otpSmsPage.locator('.c24-uli-trigger-otp-button').first();
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
      const codeSendenBtnOtpSms = otpSmsPage.locator('#c24-uli-pwr-choose-btn');
      await codeSendenBtnOtpSms.waitFor({ state: 'visible', timeout: 10000 });
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
        
        // SCHRITT 7: Geburtsdatum-Challenge (gleiche Helper wie Passwort-Reset TEIL 2)
        console.log('🎂 SCHRITT 7: Gebe Geburtsdatum für Challenge ein...');
        console.log('📍 Aktuelle URL:', otpSmsPage.url());

        await fillUliGeburtsdatumChallengeField(otpSmsPage);
        await clickUliGeburtsdatumChallengeWeiterFirst(otpSmsPage);
        await clickUliGeburtsdatumChallengeWeiterSecondOptional(otpSmsPage);

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
      const weiterBtnOtpEmail = otpEmailPage.locator('#c24-uli-login-btn');
      await weiterBtnOtpEmail.click();
      await otpEmailPage.waitForTimeout(1000);
      
      // SCHRITT 2: Klick auf "Mit Einmalcode anmelden"
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonEmail = otpEmailPage.locator('.c24-uli-trigger-otp-button').first();
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
        const codeSendenBtnOtpEmail = otpEmailPage.locator('#c24-uli-pwr-choose-btn');
        await codeSendenBtnOtpEmail.waitFor({ state: 'visible', timeout: 10000 });
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
          
          // SCHRITT 6: Geburtsdatum-Challenge (gleiche Helper wie Passwort-Reset TEIL 2)
          console.log('🎂 SCHRITT 6: Gebe Geburtsdatum für Challenge ein...');
          console.log('📍 Aktuelle URL:', otpEmailPage.url());

          await fillUliGeburtsdatumChallengeField(otpEmailPage);
          await clickUliGeburtsdatumChallengeWeiterFirst(otpEmailPage);
          await clickUliGeburtsdatumChallengeWeiterSecondOptional(otpEmailPage);

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
        const cookieBannerButton = otpEmailPage.locator('a.c24-cookie-consent-button').filter({ hasText: /^geht klar$/i }).first();
        if (await cookieBannerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cookieBannerButton.click();
          await otpEmailPage.waitForTimeout(400);
          console.log('   ✅ Cookie-Banner geschlossen');
        }
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }

      console.log('   Klicke auf "Profil" (c24-customer-hover-wrapper)...');
      const profilLink = otpEmailPage.locator('a.c24-customer-hover-wrapper').first();
      await profilLink.waitFor({ state: 'visible', timeout: 10000 });
      await profilLink.click({ force: true });
      console.log('   ✅ "Profil" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      console.log('   Klicke auf "Anmelden & Sicherheit" (href settings/overview)...');
      const anmeldenSicherheitLink = otpEmailPage.locator('a[href*="/settings/overview"]').first();
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

      // Klick auf "Kundenkonto löschen" (Link in SubHeadline)
      console.log('   Klicke auf "Kundenkonto löschen"...');
      const kundenkontoLoeschenLink = otpEmailPage.locator('.c24-acs__settings__overview-page__subHeadline a').filter({ hasText: 'Kundenkonto löschen' }).first();
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

      // Klick auf "entfernen" (Primary ACS-Button)
      console.log('   Klicke auf "entfernen"-Button...');
      const entfernenButton = otpEmailPage.locator('button.c24-acs-button__primary').first();
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
        const weiterButton = registrationPage.locator('#c24-uli-login-btn');
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

      console.log('➡️  Klicke auf "Weiter" (#c24-uli-registercheck-btn)...');
      const weiterButton2 = registrationPage.locator('#c24-uli-registercheck-btn');
      await weiterButton2.waitFor({ state: 'visible', timeout: 10000 });
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
        const cookieBanner = registrationPage.locator('a.c24-cookie-consent-button').filter({ hasText: /^geht klar$/i }).first();
        if (await cookieBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cookieBanner.click();
          await registrationPage.waitForTimeout(400);
          console.log('✅ Cookie-Banner geschlossen mit "geht klar"');
        }
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }

      console.log('👤 Klicke "Profil" (c24-customer-hover-wrapper)...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);
      const profilLinkPlz = registrationPage.locator('a.c24-customer-hover-wrapper').first();
      await profilLinkPlz.waitFor({ state: 'visible', timeout: 15000 });
      await profilLinkPlz.click({ force: true });
      console.log('✅ "Profil" geklickt');
      await registrationPage.waitForTimeout(800);

      console.log('📋 Klicke "Persönliche Daten" (a[href*="personal-data.html"])...');
      const persDataLink = registrationPage.locator('a[href*="user/account/personal-data.html"]').first();
      await persDataLink.waitFor({ state: 'visible', timeout: 15000 });
      await persDataLink.scrollIntoViewIfNeeded();
      await persDataLink.click({ force: true });
      console.log('✅ "Persönliche Daten" geklickt');
      await registrationPage.waitForTimeout(800);

      console.log('🏠 Klicke auf "Adresse" (a.c24-kb__menu-bar__item__container[title="Adresse"])...');
      const adresseLink = registrationPage
        .locator('a.c24-kb__menu-bar__item__container[title="Adresse"][href*="address.html"]')
        .first();
      await adresseLink.waitFor({ state: 'visible', timeout: 15000 });
      await adresseLink.scrollIntoViewIfNeeded();
      await adresseLink.click({ force: true });
      console.log('✅ "Adresse" geklickt');
      await registrationPage.waitForTimeout(1000);

      console.log('📍 Suche PLZ-Eingabefeld (input[name="zipcode"].c24-kb-text-field__input)...');
      console.log(`📍 Aktuelle URL: ${registrationPage.url()}`);

      const plzInput = registrationPage
        .locator('input.text-field__input.c24-kb-text-field__input[name="zipcode"]')
        .first();
      await plzInput.waitFor({ state: 'visible', timeout: 15000 });
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

      console.log('💾 Klicke auf "speichern" (button.c24-kb-button__primary[type="submit"])...');
      const speichernButton = registrationPage
        .locator('button.c24-kb-button.c24-kb__button-area__button.c24-kb-button__primary[type="submit"]')
        .filter({ hasText: /speichern/i })
        .first();
      await speichernButton.waitFor({ state: 'visible', timeout: 15000 });
      await speichernButton.scrollIntoViewIfNeeded();
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
      const weiterBtnReset = resetPage.locator('#c24-uli-login-btn');
      await weiterBtnReset.click();
      await resetPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Passwort vergessen?"...');
      const passwortVergessenLink = resetPage.locator('.c24-uli-cl-pwreset-wrapper').first();
      await passwortVergessenLink.waitFor({ state: 'visible', timeout: 10000 });
      await passwortVergessenLink.click();
      console.log('✅ "Passwort vergessen?" geklickt');
      await resetPage.waitForTimeout(1000);

      console.log('🔍 SCHRITT 3: Wähle SMS (#c24-uli-choose-sms)...');
      const smsRadioPlz = resetPage.locator('#c24-uli-choose-sms');
      try {
        await smsRadioPlz.click({ timeout: 3000 });
      } catch {
        await resetPage.locator('label[for="c24-uli-choose-sms"]').click({ force: true });
      }
      console.log('✅ SMS-Option ausgewählt');

      const codeSendenBtn = resetPage.locator('#c24-uli-pwr-choose-btn');
      await codeSendenBtn.waitFor({ state: 'visible', timeout: 10000 });
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
        
        console.log('📍 SCHRITT 6: Gebe PLZ für ULI-Challenge ein (#cl_zipcode_lc)...');
        await fillUliPlzChallengeField(resetPage, '80636');

        await clickUliPlzChallengeWeiterFirst(resetPage);
        await clickUliPlzChallengeWeiterSecondOptional(resetPage);
        await resetPage.waitForTimeout(1000);
        await clickWeiterNachPasswortResetChallenge(resetPage);
        await resetPage.waitForTimeout(2000);
        
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
      
      const weiterBtn3 = resetPage3.locator('#c24-uli-login-btn');
      await weiterBtn3.click();
      await resetPage3.waitForTimeout(1000);
      
      console.log('🔍 Klicke auf "Passwort vergessen?"...');
      const passwordForgottenLink3 = resetPage3.locator('.c24-uli-cl-pwreset-wrapper').first();
      await passwordForgottenLink3.waitFor({ state: 'visible', timeout: 10000 });
      await passwordForgottenLink3.click();
      await resetPage3.waitForTimeout(2000);

      console.log('🔍 Wähle E-Mail TAN (#c24-uli-choose-email)...');
      const emailRadioPlz3b = resetPage3.locator('#c24-uli-choose-email');
      if (await emailRadioPlz3b.count() > 0) {
        try {
          await emailRadioPlz3b.click({ timeout: 2000 });
        } catch {
          await resetPage3.locator('label[for="c24-uli-choose-email"]').click({ force: true });
        }
        console.log('✅ E-Mail-Option ausgewählt');
      } else {
        console.log('ℹ️  E-Mail-Radio nicht gefunden – evtl. vorausgewählt');
      }
      await resetPage3.waitForTimeout(400);

      const submitBtn3 = resetPage3.locator('#c24-uli-pwr-choose-btn');
      await submitBtn3.waitFor({ state: 'visible', timeout: 10000 });
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
        
        console.log('📍 Gebe PLZ für ULI-Challenge ein (#cl_zipcode_lc)...');
        await fillUliPlzChallengeField(resetPage3, '80636');

        await clickUliPlzChallengeWeiterFirst(resetPage3);
        await clickUliPlzChallengeWeiterSecondOptional(resetPage3);
        await resetPage3.waitForTimeout(1000);
        await clickWeiterNachPasswortResetChallenge(resetPage3);
        await resetPage3.waitForTimeout(2000);
        
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
      const weiterBtnOtpSms = otpSmsPage.locator('#c24-uli-login-btn');
      await weiterBtnOtpSms.click();
      await otpSmsPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonSms = otpSmsPage.locator('.c24-uli-trigger-otp-button').first();
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
      
      const codeSendenBtnOtpSms = otpSmsPage.locator('#c24-uli-pwr-choose-btn');
      await codeSendenBtnOtpSms.waitFor({ state: 'visible', timeout: 10000 });
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
        
        console.log('📍 SCHRITT 7: Gebe PLZ für ULI-Challenge ein (#cl_zipcode_lc)...');
        console.log('📍 Aktuelle URL:', otpSmsPage.url());

        await fillUliPlzChallengeField(otpSmsPage, '80636');
        await clickUliPlzChallengeWeiterFirst(otpSmsPage);
        await clickUliPlzChallengeWeiterSecondOptional(otpSmsPage);

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
      const weiterBtnOtpEmail = otpEmailPage.locator('#c24-uli-login-btn');
      await weiterBtnOtpEmail.click();
      await otpEmailPage.waitForTimeout(1000);
      
      console.log('🔍 SCHRITT 2: Klicke auf "Mit Einmalcode anmelden"...');
      const einmalcodeButtonEmail = otpEmailPage.locator('.c24-uli-trigger-otp-button').first();
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
        
        const codeSendenBtnOtpEmail = otpEmailPage.locator('#c24-uli-pwr-choose-btn');
        await codeSendenBtnOtpEmail.waitFor({ state: 'visible', timeout: 10000 });
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
          
          console.log('📍 SCHRITT 6: Gebe PLZ für ULI-Challenge ein (#cl_zipcode_lc)...');
          console.log('📍 Aktuelle URL:', otpEmailPage.url());

          await fillUliPlzChallengeField(otpEmailPage, '80636');
          await clickUliPlzChallengeWeiterFirst(otpEmailPage);
          await clickUliPlzChallengeWeiterSecondOptional(otpEmailPage);
          
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
        const cookieBannerButton = otpEmailPage.locator('a.c24-cookie-consent-button').filter({ hasText: /^geht klar$/i }).first();
        if (await cookieBannerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cookieBannerButton.click();
          await otpEmailPage.waitForTimeout(400);
          console.log('   ✅ Cookie-Banner geschlossen');
        }
      } catch (e) {
        console.log('   ℹ️  Kein Cookie-Banner gefunden');
      }

      console.log('   Klicke auf "Profil"...');
      const profilLink = otpEmailPage.locator('a.c24-customer-hover-wrapper').first();
      await profilLink.waitFor({ state: 'visible', timeout: 10000 });
      await profilLink.click({ force: true });
      console.log('   ✅ "Profil" geklickt');
      await otpEmailPage.waitForTimeout(1000);

      console.log('   Klicke auf "Anmelden & Sicherheit" (href settings/overview)...');
      const anmeldenSicherheitLink = otpEmailPage.locator('a[href*="/settings/overview"]').first();
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
      const kundenkontoLoeschenLink = otpEmailPage.locator('.c24-acs__settings__overview-page__subHeadline a').filter({ hasText: 'Kundenkonto löschen' }).first();
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

      console.log('   Klicke auf "entfernen"-Button (c24-acs-button__primary)...');
      const entfernenButton = otpEmailPage.locator('button.c24-acs-button__primary').first();
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
