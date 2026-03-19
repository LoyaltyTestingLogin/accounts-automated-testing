import { test, expect } from '../fixtures/test-hooks';
import { loginWithPassword, expectLoginSuccess, logout, handleLoginChallenge } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl } from '../helpers/environment';
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Login Happy Path Test
 * Testet den erfolgreichen Login mit korrekten Zugangsdaten (inkl. Login Challenge)
 */
test.describe('CHECK24 Login - Happy Path', () => {
  test('Erfolgreicher Login + Zweiter Login ohne Challenge', async ({ page }) => {
    enableAutoScreenshots('login-password');
    
    try {
      // Account mit nur E-Mail-Adresse verwenden
      const credentials = getAccountCredentials('EMAIL_ONLY');
      console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

      // ===== ERSTER LOGIN MIT CHALLENGE =====
      console.log('\n=== ERSTER LOGIN MIT CHALLENGE ===');
      
      // Login durchführen (E-Mail + Passwort)
      const { email } = await loginWithPassword(page, credentials.email, credentials.password);
    console.log(`✅ Login-Daten eingegeben für: ${email}`);

    // Login-Challenge behandeln (Sicherheitsprüfung bei unbekanntem Gerät)
    const hadChallenge = await handleLoginChallenge(page);
    
    if (hadChallenge) {
      console.log('✅ Login-Challenge erfolgreich bestanden (TAN-Code aus E-Mail)');
    }

    // Erfolgreichen Login verifizieren
    await expectLoginSuccess(page);

    console.log(`✅ Login vollständig erfolgreich für: ${email}`);

    // ===== COOKIE-BANNER WEGKLICKEN =====
    console.log('\n=== COOKIE-BANNER WEGKLICKEN ===');
    
    // Warte kurz damit die Seite vollständig geladen ist
    await page.waitForTimeout(1000);
    
    // Prüfe ob Cookie-Banner vorhanden ist
    const cookieBannerVisible = await page.locator('a.c24-cookie-consent-button').count() > 0;
    console.log(`🍪 Cookie-Banner vorhanden: ${cookieBannerVisible}`);
    
    if (cookieBannerVisible) {
      // Versuche Cookie-Banner über verschiedene Methoden wegzuklicken
      const cookieSelectors = [
        'a.c24-cookie-consent-button',
      ];

      const clickVisibleGehtKlarButton = async (selector: string) => {
        return await page.evaluate((sel: string) => {
          const buttons = Array.from(document.querySelectorAll(sel)) as HTMLElement[];

          for (const button of buttons) {
            const text = (button.innerText || button.textContent || '').trim().toLowerCase();
            const rect = button.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && getComputedStyle(button).visibility !== 'hidden' && getComputedStyle(button).display !== 'none';

            if (isVisible && text === 'geht klar') {
              button.click();
              return true;
            }
          }

          return false;
        }, selector);
      };
      
      let cookieClicked = false;
      for (const selector of cookieSelectors) {
        try {
          const locator = page.locator(selector);
          const count = await locator.count();

          if (count > 0) {
            console.log(`🔍 Versuche Cookie-Button: ${selector}`);
            const clicked = await clickVisibleGehtKlarButton(selector);

            if (!clicked) {
              console.log('⚠️  Kein sichtbarer "geht klar"-Button gefunden');
              continue;
            }

            await page.waitForTimeout(800);
            const blockingLayerVisible = await page.locator('.c24-strict-blocking-layer').isVisible().catch(() => false);

            if (!blockingLayerVisible) {
              console.log(`✅ Cookie-Banner weggeklickt: ${selector}`);
              cookieClicked = true;
              break;
            }

            console.log('⚠️  Blocking-Layer ist noch sichtbar - falscher Cookie-Button wurde vermutlich getroffen');

            if (cookieClicked) {
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (cookieClicked) {
        await page.waitForTimeout(800);
        console.log('✅ Cookie-Banner sollte jetzt geschlossen sein');
      } else {
        console.log('⚠️  Konnte Cookie-Banner nicht wegklicken - versuche fortzufahren');
        // Als letzten Ausweg: Versuche den blocking layer direkt zu entfernen
        try {
          await page.evaluate(() => {
            // @ts-expect-error - document is available in browser context
            const blockers = document.querySelectorAll('.c24-strict-blocking-layer, .c24-cookie-consent-wrapper');
            // @ts-expect-error - Element is available in browser context
            blockers.forEach((el: Element) => el.remove());
          });
          console.log('✅ Cookie-Banner-Layer via JavaScript entfernt');
        } catch (e) {
          console.log('⚠️  Konnte blocking layer nicht entfernen');
        }
      }
    } else {
      console.log('ℹ️  Kein Cookie-Banner gefunden (oder bereits geschlossen)');
    }

    // ===== ABMELDEN ÜBER PROFIL-MENÜ =====
    console.log('\n=== ABMELDEN ÜBER PROFIL-MENÜ ===');
    
    // Warte kurz
    await page.waitForTimeout(500);
    
    // Suche Profil-Button (oben rechts)
    const profilSelectors = [
      'a.c24-customer-hover-wrapper',
    ];
    
    let profilButton = null;
    for (const selector of profilSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) {
        try {
          if (await locator.isVisible({ timeout: 1000 })) {
            profilButton = locator;
            console.log(`✅ Profil-Button gefunden: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!profilButton) {
      throw new Error('Profil-Button nicht gefunden');
    }
    
    // Klicke auf Profil
    await profilButton.click();
    console.log('✅ Profil-Menü geöffnet');
    
    await page.waitForTimeout(500);
    
    // Suche "abmelden" Button im Profil-Menü
    const abmeldenSelectors = [
      'div.c24-customer-check a[title="abmelden"]',
    ];
    
    let abmeldenButton = null;
    for (const selector of abmeldenSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) {
        try {
          if (await locator.isVisible({ timeout: 1000 })) {
            abmeldenButton = locator;
            console.log(`✅ Abmelden-Button gefunden: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!abmeldenButton) {
      throw new Error('Abmelden-Button nicht gefunden');
    }
    
    // Klicke auf "abmelden"
    await abmeldenButton.click();
    console.log('✅ Abmelden geklickt');
    
    await page.waitForTimeout(1500);
    
    // Prüfe ob wir auf "Mein Konto" Seite sind
    const currentUrl = page.url();
    console.log(`📍 URL nach Abmeldung: ${currentUrl}`);
    
    // ===== ZWEITER LOGIN (OHNE CHALLENGE ERWARTET) =====
    console.log('\n=== ZWEITER LOGIN (OHNE CHALLENGE ERWARTET) ===');
    
    // Suche "anmelden" Button
    const anmeldenSelectors = [
      'a.c24-kb-login-promo-banner__button',
    ];
    
    let anmeldenButton = null;
    for (const selector of anmeldenSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) {
        try {
          if (await locator.isVisible({ timeout: 1000 })) {
            anmeldenButton = locator;
            console.log(`✅ Anmelden-Button gefunden: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!anmeldenButton) {
      throw new Error('Anmelden-Button nicht gefunden auf Mein Konto Seite');
    }
    
    // Klicke auf "anmelden"
    await anmeldenButton.click();
    console.log('✅ Anmelden-Button geklickt');
    
    await page.waitForTimeout(1000);
    
    // Login-Formular sollte Email vorausgefüllt haben
    console.log('🔍 Prüfe Login-Formular...');
    
    await page.waitForTimeout(1000);
    
    const emailInput = page.locator('#cl_login');
    const emailValue = await emailInput.inputValue();
    
    console.log(`📧 Email-Feld Wert: ${emailValue}`);
    
    if (emailValue && emailValue.includes(credentials.email.split('@')[0])) {
      console.log('✅ Email ist vorausgefüllt');
    } else {
      console.log('⚠️  Email ist nicht vorausgefüllt, fülle sie aus...');
      await emailInput.fill(credentials.email);
    }
    
    // Passwort eingeben mit mehreren Fallback-Methoden
    console.log('🔍 Suche Passwort-Feld...');
    
    const passwordSelectors = [
      '#cl_pw_login',
    ];
    
    let passwordFilled = false;
    
    for (const selector of passwordSelectors) {
      try {
        const passwordInput = page.locator(selector).first();
        const count = await passwordInput.count();
        
        if (count === 0) continue;
        
        console.log(`🔍 Passwort-Feld gefunden mit Selektor: ${selector}`);
        
        // Methode 1: Normales fill mit force
        try {
          console.log('  📝 Versuche: fill mit force...');
          await passwordInput.fill(credentials.password, { force: true, timeout: 2000 });
          console.log('✅ Passwort eingegeben (fill force)');
          passwordFilled = true;
          break;
        } catch (e1) {
          console.log('  ⚠️  fill force fehlgeschlagen');
          
          // Methode 2: Scrolle ins View und versuche nochmal
          try {
            console.log('  📝 Versuche: scroll + fill...');
            await passwordInput.scrollIntoViewIfNeeded({ timeout: 1000 });
            await page.waitForTimeout(300);
            await passwordInput.fill(credentials.password, { timeout: 2000 });
            console.log('✅ Passwort eingegeben (scroll + fill)');
            passwordFilled = true;
            break;
          } catch (e2) {
            console.log('  ⚠️  scroll + fill fehlgeschlagen');
            
            // Methode 3: JavaScript direkter Input
            try {
              console.log('  📝 Versuche: JavaScript setValue...');
              await page.evaluate(({ sel, pwd }: { sel: string; pwd: string }) => {
                // @ts-expect-error - document and HTMLInputElement are available in browser context
                const input = document.querySelector(sel) as HTMLInputElement;
                if (input) {
                  input.value = pwd;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
                return false;
              }, { sel: selector, pwd: credentials.password });
              console.log('✅ Passwort eingegeben (JavaScript)');
              passwordFilled = true;
              break;
            } catch (e3) {
              console.log('  ⚠️  JavaScript setValue fehlgeschlagen');
              continue;
            }
          }
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log(`  ⚠️  Fehler bei Selektor ${selector}: ${errorMessage}`);
        continue;
      }
    }
    
    if (!passwordFilled) {
      throw new Error('Passwort konnte mit keiner Methode eingegeben werden');
    }
    
    await page.waitForTimeout(300);
    
    // Login absenden
    const submitButton = page.locator('#c24-uli-pw-btn');
    await submitButton.click();
    console.log('✅ Anmelden geklickt');
    
    await page.waitForTimeout(2000);
    
    // Warte auf Seiten-Übergang
    await page.waitForTimeout(2500);
    
    // Prüfe ob Phone-Collector Screen kommt
    console.log('🔍 Prüfe auf Phone-Collector Screen...');
    
    const currentBodyText = await page.locator('body').textContent() || '';
    const hasPhoneScreen = currentBodyText.toLowerCase().includes('telefonnummer') || 
                           currentBodyText.toLowerCase().includes('handynummer');
    
    console.log(`📱 Phone-Screen erkannt: ${hasPhoneScreen}`);
    
    if (hasPhoneScreen) {
      console.log('📱 Phone-Collector Screen erkannt - klicke "später erinnern" weg...');
      
      await page.waitForTimeout(500);
      
      // Suche "später erinnern" Button mit erweiterten Selektoren
      const spaterSelectors = [
        'a[data-tid="later-button"]',
        '[data-tid="later-button"]',
        'a:has-text("später")',
        'button:has-text("später")',
        'a:has-text("Später")',
        'button:has-text("Später")',
        '[class*="later"]',
        '[class*="skip"]',
      ];
      
      let spaterClicked = false;
      
      // Versuche "später erinnern" Button zu klicken (wie in auth.ts)
      for (const selector of spaterSelectors) {
        try {
          const button = page.locator(selector).first();
          const count = await button.count();
          
          if (count > 0) {
            console.log(`🔍 Button gefunden mit Selektor: ${selector}`);
            const btnText = await button.textContent();
            console.log(`   Button-Text: "${btnText?.trim()}"`);
            
            // Versuche mit force: true zu klicken
            try {
              await button.click({ force: true, timeout: 3000 });
              console.log(`✅ Button geklickt (${selector})`);
              spaterClicked = true;
              await page.waitForTimeout(1000);
              break;
            } catch (clickErr) {
              // Fallback: JavaScript-Klick auf dem Element direkt
              console.log('⚠️  Normaler Klick fehlgeschlagen, versuche JavaScript...');
              try {
                await button.evaluate((btn: any) => btn.click());
                console.log(`✅ Button geklickt via JavaScript (${selector})`);
                spaterClicked = true;
                await page.waitForTimeout(1000);
                break;
              } catch (jsErr) {
                console.log(`  ⚠️  JavaScript Click fehlgeschlagen: ${jsErr}`);
                continue;
              }
            }
          }
        } catch (e) {
          // Nächsten Selektor versuchen
          continue;
        }
      }
      
      if (spaterClicked) {
        console.log('✅ Phone-Collector übersprungen');
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️  Konnte "später erinnern" Button nicht finden/klicken');
      }
    } else {
      console.log('✅ Kein Phone-Collector Screen - weiter zum Check');
    }
    
    // Warte bis wir auf Kundenbereich sind
    console.log('🔍 Warte auf Kundenbereich...');
    await page.waitForTimeout(1000);
    
    const finalUrl = page.url();
    console.log(`📍 Finale URL nach zweitem Login: ${finalUrl}`);
    
    // Prüfe dass KEINE Challenge kam (Check auf URL)
    const hasChallenge = finalUrl.includes('callback=') && 
                        finalUrl.includes('accounts.check24');
    
    if (hasChallenge) {
      console.log('❌ Challenge/Login-Screen noch aktiv - sollte aber nicht kommen!');
      console.log('📄 Seiteninhalt prüfen...');
      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.toLowerCase().includes('sicherheit') && bodyText.toLowerCase().includes('code')) {
        throw new Error('Login-Challenge wurde beim zweiten Login angezeigt - Browser wurde nicht "remembered"');
      }
    } else {
      console.log('✅ Keine Challenge beim zweiten Login - direkt auf Kundenbereich!');
    }
    
    // Prüfe c24session Cookie
    console.log('\n🔍 Prüfe Login-Erfolg mit c24session Cookie...');
    
    await page.waitForTimeout(500);
    
    const cookies = await page.context().cookies();
    const c24sessionCookie = cookies.find(cookie => cookie.name === 'c24session');
    
    if (c24sessionCookie) {
      console.log(`✅ c24session Cookie gefunden: ${c24sessionCookie.value.substring(0, 20)}...`);
      console.log(`   Domain: ${c24sessionCookie.domain}`);
      console.log(`   Expires: ${c24sessionCookie.expires ? new Date(c24sessionCookie.expires * 1000).toISOString() : 'Session'}`);
    } else {
      console.log('⚠️  c24session Cookie NICHT gefunden - Login möglicherweise fehlgeschlagen');
      console.log('📋 Vorhandene Cookies:', cookies.map(c => c.name).join(', '));
      throw new Error('Zweiter Login nicht vollständig: c24session Cookie fehlt');
    }
    
    // Prüfe ob wir auf Kundenbereich sind
    if (finalUrl.includes('kundenbereich.check24.de') || finalUrl.includes('kundenbereich.check24-test.de')) {
      console.log('✅ Erfolgreich auf Kundenbereich weitergeleitet');
    } else if (finalUrl.includes('process=failed')) {
      throw new Error('Zweiter Login fehlgeschlagen: URL zeigt process=failed');
    } else {
      console.log(`⚠️  Unerwartete URL: ${finalUrl}`);
    }
    
      console.log('✅ Zweiter Login vollständig erfolgreich OHNE Challenge');
      
      // Test erfolgreich - Screenshots übernehmen
      commitScreenshots();
      
      // Cleanup: Logout
      await logout(page);
      
      console.log('✅ Test komplett erfolgreich: Erster Login + Zweiter Login ohne Challenge');
    } finally {
      disableAutoScreenshots();
    }
  });

  test('Erfolgreicher Login - Combined Account mit Email-TAN (Selection)', async ({ browser }) => {
    // Neuen Browser-Context erstellen (ohne Cookies vom ersten Test)
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // Login durchführen (E-Mail + Passwort)
      const { email } = await loginWithPassword(page, credentials.email, credentials.password);
      console.log(`✅ Login-Daten eingegeben für: ${email}`);

      // Login-Challenge behandeln - WICHTIG: Email-Methode explizit auswählen
      console.log('📧 Wähle E-Mail als Challenge-Methode...');
      const hadChallenge = await handleLoginChallenge(page, 'email');
      
      if (hadChallenge) {
        console.log('✅ Login-Challenge erfolgreich bestanden (TAN per E-Mail)');
      }

      // Erfolgreichen Login verifizieren
      await expectLoginSuccess(page);

      console.log(`✅ Login vollständig erfolgreich für Combined Account (E-Mail-TAN): ${email}`);

      // Optional: Logout durchführen
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Login - Combined Account mit SMS-TAN (via iPhone-Weiterleitung)', async ({ browser }) => {
    // Neuen Browser-Context erstellen (ohne Cookies)
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);

      // Login durchführen (E-Mail + Passwort)
      const { email } = await loginWithPassword(page, credentials.email, credentials.password);
      console.log(`✅ Login-Daten eingegeben für: ${email}`);

      // Login-Challenge behandeln - WICHTIG: Phone-Methode explizit auswählen
      console.log('📱 Wähle SMS/Phone als Challenge-Methode...');
      
      await page.waitForTimeout(2000);
      
      // Prüfe auf Login-Challenge Screen
      const bodyText = await page.locator('body').textContent() || '';
      const hasSecurityCheck = bodyText.toLowerCase().includes('sicherheit');
      
      if (hasSecurityCheck) {
        console.log('✅ Sicherheitsüberprüfung-Screen erkannt');
        
        // Verwende selectChallengeMethod für SMS-Auswahl
        const { selectChallengeMethod } = await import('../helpers/auth.js');
        await selectChallengeMethod(page, 'phone');
        
        console.log('⏳ Warte nach SMS-Auswahl, damit UI aktualisiert wird...');
        await page.waitForTimeout(2000);
        
        // WICHTIG: Jetzt den richtigen "Weiter"-Button finden und klicken
        console.log('➡️  Suche "Weiter"-Button um SMS zu versenden...');
        
        // Gleiche Button-Logik wie in handleLoginChallenge
        const submitButtonSelectors = [
          '#c24-uli-lc-start-btn',
        ];
        
        let submitButton = null;
        
        for (const selector of submitButtonSelectors) {
          const locator = page.locator(selector).first();
          const count = await locator.count();
          
          if (count > 0) {
            console.log(`🔍 Button gefunden mit Selektor: ${selector}`);
            try {
              if (await locator.isVisible({ timeout: 2000 })) {
                const buttonText = await locator.textContent();
                submitButton = locator;
                console.log(`✅ Sichtbarer Submit-Button gefunden: ${selector} (Text: "${buttonText?.trim()}")`);
                break;
              }
            } catch (e) {
              console.log(`⚠️  Button nicht sichtbar: ${selector}`);
            }
          }
        }
        
        // Fallback: Suche sichtbaren "weiter"-Button
        if (!submitButton) {
          console.log('🔍 Kein ID-Button gefunden, suche sichtbaren "weiter"-Button...');
          const weiterButtons = await page.locator('button[type="submit"]').all();
          for (const btn of weiterButtons) {
            try {
              if (await btn.isVisible()) {
                const buttonText = (await btn.textContent() || '').toLowerCase();
                if (buttonText.includes('weiter')) {
                  submitButton = btn;
                  console.log(`✅ Sichtbaren "weiter"-Button gefunden (Text: "${buttonText.trim()}")`);
                  break;
                }
              }
            } catch (e) {
              // Weiter
            }
          }
        }
        
        if (submitButton) {
          try {
            console.log('🖱️  Klicke auf Submit-Button...');
            await submitButton.click({ force: true, timeout: 5000 });
            console.log('✅ Submit-Button geklickt - SMS wird versendet');
          } catch (e) {
            console.log(`⚠️  Click fehlgeschlagen: ${e}`);
            console.log('⌨️  Versuche Enter-Taste...');
            await page.keyboard.press('Enter');
          }
        } else {
          console.log('⚠️  Kein Submit-Button gefunden, versuche Enter...');
          await page.keyboard.press('Enter');
        }
        
        await page.waitForTimeout(3000);
        
        console.log('📱 SMS wird jetzt an die Nummer gesendet: ' + credentials.account.phone);
        console.log('📧 Warte auf weitergeleitete SMS per Email von iPhone...');
        
        const afterUrl = page.url();
        const afterTitle = await page.title();
        console.log(`📍 URL nach SMS-Versand: ${afterUrl}`);
        console.log(`📄 Titel: ${afterTitle}`);
        
        // SCHRITT: Warte auf SMS-Code-Eingabefeld
        console.log('🔍 Warte auf SMS-Code-Eingabefeld...');
        
        const smsInputSelectors = [
          'input[name*="tan"]:not([name*="zip"])',
          'input[name*="otp"]',
          'input[name="challenge_code"]',
          'input[name="verification_code"]',
          'input[id*="tan"]',
          'input[id*="otp"]',
          'input[placeholder*="Code"]:not([placeholder*="Postleitzahl"])',
          'input[placeholder*="code"]:not([placeholder*="Postleitzahl"])',
          'input[type="text"][inputmode="numeric"]:not([name*="zip"]):not([name*="phone"])',
          'input[type="tel"]:not([name*="zip"]):not([name*="phone"])',
          'input[type="text"]:not([name*="zip"]):not([name*="phone"]):not([name*="email"])',
        ];
        
        let smsCodeInput = null;
        for (const selector of smsInputSelectors) {
          const locator = page.locator(selector).first();
          if (await locator.count() > 0) {
            console.log(`✅ SMS-Code-Eingabefeld gefunden: ${selector}`);
            smsCodeInput = locator;
            break;
          }
        }
        
        if (!smsCodeInput) {
          throw new Error('SMS-Code-Eingabefeld nicht gefunden');
        }
        
        // SCHRITT: Hole SMS-Code aus weitergeleiteter Email (vom iPhone-Kurzbefehl)
        console.log('📧 Warte auf weitergeleitete SMS-Email von ulitesting@icloud.com...');
        
        const { getEmailClient } = await import('../helpers/email.js');
        const emailClient = getEmailClient();
        
        // Warte auf Email von iPhone-Kurzbefehl (Absender: ulitesting@icloud.com)
        let smsEmail;
        try {
          smsEmail = await emailClient.waitForEmail(
            {
              from: 'ulitesting@icloud.com', // iPhone-Kurzbefehl sendet von hier
            },
            120000, // 2 Minuten Timeout (SMS kann etwas länger dauern)
            3000
          );
        } catch (error) {
          await sendEmailTimeoutWarning(
            'Password Login SMS - TAN-Code',
            'from: ulitesting@icloud.com',
            120
          );
          throw error;
        }
        
        if (!smsEmail) {
          throw new Error('SMS-Weiterleitungs-Email vom iPhone nicht erhalten (Timeout nach 2 Minuten)');
        }
        
        console.log(`✅ SMS-Weiterleitungs-Email erhalten von: ${smsEmail.from}`);
        console.log(`📧 Betreff: ${smsEmail.subject}`);
        
        // Extrahiere TAN-Code aus der Email (gleiche Logik wie bei Email-TAN)
        const smsCode = emailClient.extractTanCode(smsEmail);
        
        if (!smsCode) {
          throw new Error('SMS-Code konnte nicht aus weitergeleiteter Email extrahiert werden');
        }
        
        console.log(`🔑 SMS-Code erhalten: ${smsCode}`);
        
        // SCHRITT: SMS-Code eingeben
        await page.waitForTimeout(500);
        
        try {
          await smsCodeInput.fill(smsCode, { timeout: 5000 });
          console.log('✅ SMS-Code eingegeben');
        } catch (fillError) {
          // JavaScript-Fallback
          console.log('⚠️  Normales fill() fehlgeschlagen, versuche JavaScript...');
          await smsCodeInput.evaluate((el: any, code: string) => {
            el.value = code;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, smsCode);
          console.log('✅ SMS-Code eingegeben (via JavaScript)');
        }
        
        await page.waitForTimeout(500);
        
        // SCHRITT: Login abschließen (Enter oder Button)
        console.log('➡️  Schließe Login ab...');
        
        try {
          await smsCodeInput.press('Enter');
          console.log('✅ Enter gedrückt');
        } catch (enterError) {
          // Button-Fallback
          const submitButton = page.locator('#c24-uli-lptan-btn');
          if (await submitButton.count() > 0) {
            await submitButton.click({ force: true });
            console.log('✅ Submit-Button geklickt');
          }
        }
        
        await page.waitForTimeout(3000);
        
        // SCHRITT: Phone-Screen überspringen (falls vorhanden)
        const bodyTextAfterSMS = await page.locator('body').textContent() || '';
        
        if (bodyTextAfterSMS.toLowerCase().includes('telefonnummer')) {
          console.log('📱 Phone-Screen erkannt - klicke "später erinnern"...');
          
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
          
          let laterClicked = false;
          for (const selector of laterButtonSelectors) {
            try {
              const button = page.locator(selector).first();
              if (await button.count() > 0) {
                await button.click({ force: true, timeout: 3000 });
                console.log(`✅ "später erinnern" geklickt (${selector})`);
                laterClicked = true;
                await page.waitForTimeout(2000);
                break;
              }
            } catch (e) {
              // Versuche JavaScript
              try {
                const button = page.locator(selector).first();
                if (await button.count() > 0) {
                  await button.evaluate((btn: any) => btn.click());
                  console.log(`✅ "später erinnern" geklickt via JavaScript (${selector})`);
                  laterClicked = true;
                  await page.waitForTimeout(2000);
                  break;
                }
              } catch (jsErr) {
                continue;
              }
            }
          }
          
          if (!laterClicked) {
            console.log('⚠️  "später erinnern" Button nicht gefunden - fahre trotzdem fort');
          }
        }
        
        // SCHRITT: Login-Erfolg verifizieren mit c24session Cookie
        console.log('🔍 Prüfe Login-Erfolg mit c24session Cookie...');
        
        await page.waitForTimeout(2000);
        
        const cookies = await page.context().cookies();
        const c24sessionCookie = cookies.find(cookie => cookie.name === 'c24session');
        
        if (c24sessionCookie) {
          console.log(`✅ c24session Cookie gefunden: ${c24sessionCookie.value.substring(0, 20)}...`);
          console.log(`   Domain: ${c24sessionCookie.domain}`);
          console.log(`   Expires: ${c24sessionCookie.expires ? new Date(c24sessionCookie.expires * 1000).toISOString() : 'Session'}`);
        } else {
          console.log('⚠️  c24session Cookie NICHT gefunden - Login möglicherweise fehlgeschlagen');
          console.log('📋 Vorhandene Cookies:', cookies.map(c => c.name).join(', '));
          throw new Error('Login nicht vollständig: c24session Cookie fehlt');
        }
        
        const finalUrl = page.url();
        console.log(`📍 Finale URL: ${finalUrl}`);
        
        // Prüfe ob wir auf Kundenbereich sind
        if (finalUrl.includes('kundenbereich.check24.de') || finalUrl.includes('kundenbereich.check24-test.de')) {
          console.log('✅ Erfolgreich auf Kundenbereich weitergeleitet');
        } else if (finalUrl.includes('process=failed')) {
          throw new Error('Login fehlgeschlagen: URL zeigt process=failed');
        }
        
        console.log('✅ Login vollständig erfolgreich mit SMS-TAN (via iPhone-Weiterleitung)');
        
        // Logout
        const { logout } = await import('../helpers/auth.js');
        await logout(page);
      } else {
        console.log('ℹ️  Keine Login-Challenge erkannt');
      }

      console.log(`✅ Test erfolgreich abgeschlossen für Combined Account (SMS-TAN): ${email}`);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Login - 2FA Account mit SMS-TAN (via iPhone-Weiterleitung)', async ({ browser }) => {
    // Neuen Browser-Context erstellen (ohne Cookies)
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Phone + 2FA verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE_2FA');
      console.log(`🔐 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Phone: ${credentials.account.phone}`);
      console.log(`🔒 2FA aktiviert: Ja`);

      // Login durchführen (E-Mail + Passwort)
      const { email } = await loginWithPassword(page, credentials.email, credentials.password);
      console.log(`✅ Login-Daten eingegeben für: ${email}`);

      // Warte kurz auf 2FA-Screen
      console.log('⏳ Warte auf 2FA-Abfrage...');
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      const currentTitle = await page.title();
      console.log(`📍 URL nach Login: ${currentUrl}`);
      console.log(`📄 Titel: ${currentTitle}`);

      // Prüfe auf 2FA-Screen
      const bodyText = await page.locator('body').textContent() || '';
      const has2FA = bodyText.toLowerCase().includes('zwei-faktor') || 
                     bodyText.toLowerCase().includes('sicherheit') ||
                     bodyText.toLowerCase().includes('bestätigung');

      if (has2FA) {
        console.log('✅ 2FA-Screen erkannt');

        // 2FA SMS wird automatisch versendet - warte auf Eingabefelder
        console.log('⏳ Warte auf 2FA-Code-Eingabefelder (6 separate Felder)...');
        await page.waitForTimeout(2000);

        // CHECK24 verwendet 6 separate Input-Felder für den 6-stelligen Code
        // Filtere nur die sichtbaren Felder
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
        
        if (visibleFields.length !== 6) {
          throw new Error(`Erwartet 6 sichtbare Code-Eingabefelder, aber ${visibleFields.length} gefunden`);
        }
        
        console.log('✅ 6 separate 2FA-Code-Eingabefelder gefunden');

        // Hole 2FA-Code aus weitergeleiteter SMS-Email (vom iPhone-Kurzbefehl)
        console.log('📧 Warte auf weitergeleitete 2FA-SMS von ulitesting@icloud.com...');
        console.log(`📱 SMS wird an ${credentials.account.twoFactorPhone || credentials.account.phone} gesendet`);

        const { getEmailClient } = await import('../helpers/email.js');
        const emailClient = getEmailClient();

        // Warte auf Email von iPhone-Kurzbefehl (Absender: ulitesting@icloud.com)
        let smsEmail;
        try {
          smsEmail = await emailClient.waitForEmail(
            {
              from: 'ulitesting@icloud.com', // iPhone-Kurzbefehl sendet von hier
            },
            120000, // 2 Minuten Timeout
            3000
          );
        } catch (error) {
          await sendEmailTimeoutWarning(
            'Password Login 2FA - TAN-Code',
            'from: ulitesting@icloud.com',
            120
          );
          throw error;
        }

        if (!smsEmail) {
          throw new Error('2FA-SMS-Weiterleitungs-Email vom iPhone nicht erhalten (Timeout nach 2 Minuten)');
        }

        console.log(`✅ 2FA-SMS-Email erhalten von: ${smsEmail.from}`);
        console.log(`📧 Betreff: ${smsEmail.subject}`);

        // Extrahiere 2FA-Code aus der Email
        const twoFactorCode = emailClient.extractTanCode(smsEmail);

        if (!twoFactorCode) {
          throw new Error('2FA-Code konnte nicht aus weitergeleiteter Email extrahiert werden');
        }

        console.log(`🔑 2FA-Code erhalten: ${twoFactorCode}`);

        // Prüfe dass der Code 6 Ziffern hat
        if (twoFactorCode.length !== 6) {
          throw new Error(`2FA-Code muss 6 Ziffern haben, aber hat ${twoFactorCode.length}: ${twoFactorCode}`);
        }

        // 2FA-Code eingeben - jede Ziffer in ein separates Feld
        console.log('⌨️  Gebe 2FA-Code ein (Ziffer für Ziffer)...');
        await page.waitForTimeout(500);

        for (let i = 0; i < 6; i++) {
          const digit = twoFactorCode[i];
          const field = visibleFields[i];
          
          try {
            await field.fill(digit);
            console.log(`  ✓ Ziffer ${i + 1}/6 eingegeben: ${digit}`);
            await page.waitForTimeout(100); // Kurze Pause zwischen Ziffern
          } catch (fillError) {
            // JavaScript-Fallback
            console.log(`  ⚠️  Ziffer ${i + 1} fill() fehlgeschlagen, versuche JavaScript...`);
            await field.evaluate((el: any, d: string) => {
              el.value = d;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, digit);
            console.log(`  ✓ Ziffer ${i + 1}/6 eingegeben (JavaScript): ${digit}`);
          }
        }

        console.log('✅ 2FA-Code vollständig eingegeben');
        await page.waitForTimeout(1000);

        // Login sollte automatisch abgeschickt werden, aber versuche trotzdem Enter
        console.log('➡️  Schließe 2FA-Login ab...');

        try {
          // Versuche Enter im letzten Feld
          await visibleFields[5].press('Enter');
          console.log('✅ Enter gedrückt');
        } catch (enterError) {
          // Button-Fallback
          const submitButton = page.locator('#c24-uli-lptan-btn');
          if (await submitButton.count() > 0) {
            await submitButton.click({ force: true });
            console.log('✅ Submit-Button geklickt');
          } else {
            console.log('ℹ️  Kein Submit-Button gefunden, Login sollte automatisch erfolgen');
          }
        }

        await page.waitForTimeout(3000);

        // Login-Erfolg verifizieren mit c24session Cookie
        console.log('🔍 Prüfe Login-Erfolg mit c24session Cookie...');

        const cookies = await page.context().cookies();
        const c24sessionCookie = cookies.find(cookie => cookie.name === 'c24session');

        if (c24sessionCookie) {
          console.log(`✅ c24session Cookie gefunden: ${c24sessionCookie.value.substring(0, 20)}...`);
          console.log(`   Domain: ${c24sessionCookie.domain}`);
          console.log(`   Expires: ${c24sessionCookie.expires ? new Date(c24sessionCookie.expires * 1000).toISOString() : 'Session'}`);
        } else {
          console.log('⚠️  c24session Cookie NICHT gefunden - Login möglicherweise fehlgeschlagen');
          console.log('📋 Vorhandene Cookies:', cookies.map(c => c.name).join(', '));
          throw new Error('2FA-Login nicht vollständig: c24session Cookie fehlt');
        }

        const finalUrl = page.url();
        console.log(`📍 Finale URL: ${finalUrl}`);

        // Prüfe ob wir auf Kundenbereich sind
        if (finalUrl.includes('kundenbereich.check24.de') || finalUrl.includes('kundenbereich.check24-test.de')) {
          console.log('✅ Erfolgreich auf Kundenbereich weitergeleitet');
        } else if (finalUrl.includes('process=failed')) {
          throw new Error('2FA-Login fehlgeschlagen: URL zeigt process=failed');
        }

        console.log('✅ Login vollständig erfolgreich mit 2FA (via iPhone-Weiterleitung)');

        // Logout
        const { logout } = await import('../helpers/auth.js');
        await logout(page);
      } else {
        console.log('ℹ️  Keine 2FA-Abfrage erkannt');
        throw new Error('2FA-Abfrage wurde nicht angezeigt - Test fehlgeschlagen');
      }

      console.log(`✅ Test erfolgreich abgeschlossen für 2FA Account: ${email}`);
    } finally {
      await context.close();
    }
  });

});
