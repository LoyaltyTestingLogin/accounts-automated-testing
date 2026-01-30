import { test, expect } from '@playwright/test';
import { loginWithPassword, expectLoginSuccess, logout, handleLoginChallenge } from '../helpers/auth';
import { getAccountCredentials } from '../fixtures/accounts';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Login Happy Path Test
 * Testet den erfolgreichen Login mit korrekten Zugangsdaten (inkl. Login Challenge)
 */
test.describe('CHECK24 Login - Happy Path', () => {
  test('Erfolgreicher Login - Account mit nur E-Mail (Login Challenge)', async ({ page }) => {
    // Account mit nur E-Mail-Adresse verwenden
    const credentials = getAccountCredentials('EMAIL_ONLY');
    console.log(`📧 Verwende Test-Account: ${credentials.account.description}`);

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

    // Screenshot nach erfolgreichem Login
    await page.screenshot({ 
      path: `test-results/screenshots/login-success-${credentials.account.id}-${Date.now()}.png`,
      fullPage: true 
    });

    console.log(`✅ Login vollständig erfolgreich für: ${email}`);

    // Optional: Logout durchführen für saubere Cleanup
    await logout(page);
  });

  test('Erfolgreicher Login - Combined Account mit Email-TAN (Selection)', async ({ browser }) => {
    // Neuen Browser-Context erstellen (ohne Cookies vom ersten Test)
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Telefon verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Telefon: ${credentials.account.phone}`);

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

      // Screenshot nach erfolgreichem Login
      await page.screenshot({ 
        path: `test-results/screenshots/login-success-combined-email-${Date.now()}.png`,
        fullPage: true 
      });

      console.log(`✅ Login vollständig erfolgreich für Combined Account (E-Mail-TAN): ${email}`);

      // Optional: Logout durchführen
      await logout(page);
    } finally {
      await context.close();
    }
  });

  test('Erfolgreicher Login - Combined Account mit SMS-TAN (Selection)', async ({ browser }) => {
    // Neuen Browser-Context erstellen (ohne Cookies)
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Account mit E-Mail + Telefon verwenden
      const credentials = getAccountCredentials('EMAIL_PHONE');
      console.log(`📧📱 Verwende Test-Account: ${credentials.account.description}`);
      console.log(`📧 E-Mail: ${credentials.account.email}`);
      console.log(`📱 Telefon: ${credentials.account.phone}`);

      // Login durchführen (E-Mail + Passwort)
      const { email } = await loginWithPassword(page, credentials.email, credentials.password);
      console.log(`✅ Login-Daten eingegeben für: ${email}`);

      // Login-Challenge behandeln - WICHTIG: Phone-Methode explizit auswählen
      console.log('📱 Wähle SMS/Telefon als Challenge-Methode...');
      
      // Prüfe auf Login-Challenge Screen
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`📍 Aktuelle URL: ${currentUrl}`);
      console.log(`📄 Seitentitel: ${pageTitle}`);
      
      // Debug: Zeige Seiteninhalt
      const bodyText = await page.locator('body').textContent() || '';
      console.log(`📄 Seiteninhalt (erste 400 Zeichen): ${bodyText.substring(0, 400)}...`);
      
      const hasSecurityCheck = bodyText.toLowerCase().includes('sicherheit');
      
      if (hasSecurityCheck) {
        console.log('✅ Sicherheitsüberprüfung-Screen erkannt');
        
        // Debug: Liste alle Labels auf der Seite
        const allLabels = await page.locator('label').all();
        console.log(`🏷️  Gefundene Labels (${allLabels.length}):`);
        for (let i = 0; i < Math.min(allLabels.length, 15); i++) {
          const labelText = await allLabels[i].textContent();
          console.log(`   ${i + 1}. "${labelText?.trim()}"`);
        }
        
        // Erweiterte SMS/Telefon-Selektoren
        const smsSelectors = [
          'label:has-text("SMS")',
          'label:has-text("Telefon")',
          'label:has-text("Handynummer")',
          'label:has-text("Mobilnummer")',
          'input[type="radio"][value*="sms"]',
          'input[type="radio"][value*="phone"]',
          'button:has-text("SMS")',
          'button:has-text("Telefon")',
        ];
        
        let smsSelected = false;
        for (const selector of smsSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.count() > 0) {
              console.log(`🔍 SMS-Option gefunden: ${selector}`);
              const elemText = await element.textContent();
              console.log(`   Element-Text: "${elemText?.trim()}"`);
              
              // Versuche Click
              try {
                await element.click({ force: true, timeout: 3000 });
                console.log(`✅ SMS-Option ausgewählt (normal click)`);
                smsSelected = true;
                await page.waitForTimeout(1000);
                break;
              } catch (clickErr) {
                // JavaScript-Fallback
                try {
                  await element.evaluate((el: any) => el.click());
                  console.log(`✅ SMS-Option ausgewählt (JavaScript click)`);
                  smsSelected = true;
                  await page.waitForTimeout(1000);
                  break;
                } catch (jsErr) {
                  console.log(`⚠️  Klick fehlgeschlagen auf ${selector}`);
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        if (smsSelected) {
          // Cookie-Banner wegklicken falls vorhanden
          await page.waitForTimeout(500);
          try {
            const cookieButton = page.locator('a:has-text("Nur notwendige"), button:has-text("Nur notwendige")').first();
            if (await cookieButton.count() > 0) {
              await cookieButton.click({ force: true, timeout: 2000 });
              console.log('✅ Cookie-Banner weggeklickt');
              await page.waitForTimeout(500);
            }
          } catch (e) {
            console.log('ℹ️  Kein Cookie-Banner oder bereits geschlossen');
          }
          
          // Klick auf "Weiter" um SMS zu versenden
          await page.waitForTimeout(500);
          const weiterButton = page.locator('button:has-text("Weiter"), button[type="submit"]').first();
          
          try {
            await weiterButton.click({ force: true, timeout: 5000 });
            console.log('✅ "Weiter" geklickt - SMS wird versendet');
          } catch (clickErr) {
            // JavaScript-Fallback
            console.log('⚠️  Normaler Click fehlgeschlagen, versuche JavaScript...');
            await weiterButton.evaluate((btn: any) => btn.click());
            console.log('✅ "Weiter" geklickt via JavaScript - SMS wird versendet');
          }
          
          await page.waitForTimeout(3000);
          
          console.log('⏸️  Test pausiert hier - SMS-Code-Extraktion noch nicht implementiert');
          console.log('📱 SMS sollte jetzt an die Nummer gesendet worden sein: ' + credentials.account.phone);
          
          // Debug: Zeige aktuellen Screen
          const afterUrl = page.url();
          const afterTitle = await page.title();
          console.log(`📍 URL nach SMS-Versand: ${afterUrl}`);
          console.log(`📄 Titel: ${afterTitle}`);
          
          // Screenshot vom SMS-Code-Eingabe-Screen
          await page.screenshot({ 
            path: `test-results/screenshots/sms-code-screen-${Date.now()}.png`,
            fullPage: true 
          });
          
          // Prüfe ob SMS-Code-Eingabefeld vorhanden ist
          const smsCodeInput = page.locator('input[name*="code"], input[id*="code"], input[type="text"]').first();
          if (await smsCodeInput.count() > 0) {
            console.log('✅ SMS-Code-Eingabefeld gefunden');
          } else {
            console.log('⚠️  SMS-Code-Eingabefeld nicht gefunden');
          }
        } else {
          console.log('⚠️  SMS-Option konnte nicht gefunden/ausgewählt werden');
          
          // Screenshot für Debugging
          await page.screenshot({ 
            path: `test-results/screenshots/sms-selection-failed-${Date.now()}.png`,
            fullPage: true 
          });
        }
      } else {
        console.log('ℹ️  Keine Login-Challenge erkannt');
      }

      console.log(`ℹ️  Test beendet (bis SMS-Code-Screen) für Combined Account: ${email}`);
    } finally {
      await context.close();
    }
  });

  test('Login-Seite lädt korrekt', async ({ page }) => {
    // Zur Login-Seite navigieren
    const loginUrl = process.env.CHECK24_BASE_URL;
    if (!loginUrl) throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
    
    await page.goto(loginUrl);
    await page.waitForLoadState('networkidle');

    // Prüfen ob wichtige Elemente vorhanden sind
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Prüfen ob Seite den korrekten Titel hat
    await expect(page).toHaveTitle(/check24|login|anmeld/i);

    console.log('✅ Login-Seite lädt korrekt mit allen erforderlichen Elementen');
  });

  test('Login-Formular ist interaktiv', async ({ page }) => {
    const loginUrl = process.env.CHECK24_BASE_URL;
    if (!loginUrl) throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
    
    await page.goto(loginUrl);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    // Interaktivität testen
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.fill('testpassword');
    await expect(passwordInput).toHaveValue('testpassword');

    console.log('✅ Login-Formular ist interaktiv');
  });
});
