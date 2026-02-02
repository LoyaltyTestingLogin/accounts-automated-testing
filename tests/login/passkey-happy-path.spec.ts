import { test, expect, chromium } from '@playwright/test';
import { TEST_ACCOUNTS } from '../fixtures/accounts';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CHECK24 Login - Passkey Happy Path
 * 
 * Testet den Login mit Passkey über Apple Keychain.
 * Nutzt AppleScript zur Automatisierung des macOS Keychain-Dialogs.
 */

test.describe('CHECK24 Login - Passkey', () => {
  test('Passkey Login - Happy Path', async () => {
    console.log('\n🔐 Starte Passkey Login Happy Path...\n');

    // Verwende echtes Chrome mit frischem Test-Profil
    const testProfilePath = path.join(os.tmpdir(), 'chrome-passkey-test-' + Date.now());
    
    console.log('📁 Chrome Test-Profil:', testProfilePath);

    const browser = await chromium.launchPersistentContext(testProfilePath, {
      headless: false,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const page = await browser.newPage();

    try {
      // 1. Zur Login-Seite navigieren
      const baseUrl = process.env.CHECK24_BASE_URL || 'https://accounts.check24.com';
      const loginUrl = `${baseUrl}/login?redirect_uri=https://kundenbereich.check24.de`;
      
      console.log('📍 Navigiere zu:', loginUrl);
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // 2. E-Mail eingeben
      const account = TEST_ACCOUNTS.EMAIL_PHONE;
      console.log('📧 Gebe E-Mail ein:', account.email);
      
      await page.locator('#cl_login').fill(account.email);

      // 3. "Weiter" klicken
      console.log('🖱️  Klicke auf "Weiter"');
      await page.getByRole('button', { name: 'Weiter' }).click();
      await page.waitForLoadState('networkidle');
      
      console.log('⏳ Warte 3 Sekunden auf Passkey-Button...');
      await page.waitForTimeout(3000);

      // 4. Passkey-Button finden und klicken
      console.log('🔍 Suche "mit Passkey anmelden" Button...');
      
      const passkeyButton = page.getByText(/mit Passkey anmelden/i);
      await passkeyButton.waitFor({ state: 'visible', timeout: 10000 });
      
      console.log('✅ Passkey-Button gefunden!');
      console.log('🖱️  Klicke auf "mit Passkey anmelden"...');
      await passkeyButton.click();
      
      // 5. Apple Keychain Dialog mit AppleScript automatisieren
      console.log('⏳ Warte 1 Sekunde auf Keychain-Dialog...');
      await page.waitForTimeout(1000);
      
      console.log('🍎 Versuche Keychain-Dialog mit AppleScript zu bestätigen...');
      
      // Strategie 1: Enter-Taste drücken
      console.log('   Versuch 1: Enter-Taste...');
      const appleScriptEnter = `
        tell application "System Events"
          keystroke return
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptEnter}'`);
        console.log('   ✅ Enter gedrückt');
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log('   ⚠️  Enter fehlgeschlagen:', (error as Error).message.split('\n')[0]);
      }
      
      // Strategie 2: Space-Taste (für Buttons)
      console.log('   Versuch 2: Space-Taste...');
      const appleScriptSpace = `
        tell application "System Events"
          keystroke space
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptSpace}'`);
        console.log('   ✅ Space gedrückt');
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log('   ⚠️  Space fehlgeschlagen');
      }
      
      // Strategie 3: Tab + Enter (zum Button navigieren und bestätigen)
      console.log('   Versuch 3: Tab + Enter...');
      const appleScriptTabEnter = `
        tell application "System Events"
          keystroke tab
          delay 0.5
          keystroke return
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptTabEnter}'`);
        console.log('   ✅ Tab + Enter gedrückt');
        await page.waitForTimeout(1500);
      } catch (error) {
        console.log('   ⚠️  Tab + Enter fehlgeschlagen');
      }
      
      // Strategie 4: Suche nach Dialog und klicke auf Button
      console.log('   Versuch 4: Dialog-Button suchen und klicken...');
      const appleScriptClickButton = `
        tell application "System Events"
          if exists (button 1 of window 1 of application process "SecurityAgent") then
            click button 1 of window 1 of application process "SecurityAgent"
            return "clicked"
          end if
          if exists (button 1 of window 1 of application process "Google Chrome") then
            click button 1 of window 1 of application process "Google Chrome"
            return "clicked"
          end if
          return "not found"
        end tell
      `;
      
      try {
        const { stdout } = await execAsync(`osascript -e '${appleScriptClickButton}'`);
        console.log('   ✅ AppleScript Ergebnis:', stdout.trim());
        await page.waitForTimeout(2000);
      } catch (error) {
        console.log('   ⚠️  Button-Klick fehlgeschlagen');
      }
      
      // 6. Warte auf Weiterleitung zur Kundenbereich-Seite
      console.log('⏳ Warte auf Weiterleitung zur kundenbereich.check24.de...');
      
      try {
        await page.waitForURL('**/kundenbereich.check24.de/**', { timeout: 15000 });
        console.log('✅✅✅ LOGIN ERFOLGREICH - Weitergeleitet! ✅✅✅');
      } catch (error) {
        console.log('⚠️  Keine automatische Weiterleitung innerhalb 15 Sekunden');
        const currentUrl = page.url();
        console.log('📍 Aktuelle URL:', currentUrl);
        
        if (currentUrl.includes('kundenbereich')) {
          console.log('✅ URL enthält "kundenbereich" - Login vermutlich erfolgreich!');
        }
      }
      
      // 7. c24session Cookie prüfen
      console.log('🍪 Prüfe c24session Cookie...');
      const cookies = await page.context().cookies();
      const c24session = cookies.find(c => c.name === 'c24session');
      
      if (c24session) {
        console.log('✅✅✅ c24session Cookie gefunden! LOGIN ERFOLGREICH! ✅✅✅');
        console.log('   Domain:', c24session.domain);
        console.log('   Wert (erste 20 Zeichen):', c24session.value.substring(0, 20) + '...');
        
        expect(c24session).toBeTruthy();
        expect(c24session.value).toBeTruthy();
        expect(c24session.value.length).toBeGreaterThan(0);
        
        console.log('\n🎉 Passkey-Login erfolgreich abgeschlossen!\n');
      } else {
        console.log('❌ c24session Cookie NICHT gefunden');
        console.log('Verfügbare Cookies:', cookies.map(c => c.name));
        console.log('\n⚠️  Mögliche Gründe:');
        console.log('   1. Keychain-Dialog erfordert manuelle Bestätigung (Touch ID/Passwort)');
        console.log('   2. AppleScript hat keinen Zugriff auf den Dialog');
        console.log('   3. Dialog wurde nicht erkannt/gefunden');
        console.log('\n💡 Tipp: Prüfe ob der Dialog noch offen ist und bestätige ihn manuell.');
        
        // Gebe dem Nutzer 15 Sekunden Zeit zur manuellen Bestätigung
        console.log('\n⏳ Warte 15 Sekunden für manuelle Bestätigung...\n');
        await page.waitForTimeout(15000);
        
        // Prüfe erneut
        const cookiesAfterWait = await page.context().cookies();
        const c24sessionAfterWait = cookiesAfterWait.find(c => c.name === 'c24session');
        
        if (c24sessionAfterWait) {
          console.log('✅ c24session nach manueller Bestätigung gefunden!');
          expect(c24sessionAfterWait.value).toBeTruthy();
        } else {
          console.log('❌ Login fehlgeschlagen - Cookie auch nach Wartezeit nicht vorhanden');
          throw new Error('Passkey-Login fehlgeschlagen: c24session Cookie nicht gefunden');
        }
      }
      
    } finally {
      // Browser schließen
      await browser.close();
      console.log('\n✅ Test abgeschlossen\n');
    }
  });
});
