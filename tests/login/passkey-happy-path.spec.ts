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
      
      // 5. Keychain Dialog automatisieren: Enter → Passwort → Enter
      console.log('⏳ Warte 1 Sekunde auf Dialog...');
      await page.waitForTimeout(1000);
      
      console.log('🍎 Automatisiere Keychain-Dialog mit AppleScript...');
      
      // Schritt 1: Enter drücken (für "Fortfahren" Button)
      console.log('   Schritt 1: Enter drücken (Fortfahren)...');
      const appleScriptStep1 = `
        tell application "System Events"
          keystroke return
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptStep1}'`);
        console.log('   ✅ Enter gedrückt');
      } catch (error) {
        console.log('   ⚠️  Enter fehlgeschlagen:', (error as Error).message.split('\n')[0]);
      }
      
      // Kurz warten
      await page.waitForTimeout(1000);
      
      // Schritt 2: Passwort "Ch12LoRoSTART" eingeben
      console.log('   Schritt 2: Passwort eingeben...');
      const password = 'Ch12LoRoSTART';
      const appleScriptStep2 = `
        tell application "System Events"
          keystroke "${password}"
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptStep2}'`);
        console.log('   ✅ Passwort eingegeben');
      } catch (error) {
        console.log('   ⚠️  Passwort-Eingabe fehlgeschlagen');
      }
      
      // Kurz warten
      await page.waitForTimeout(500);
      
      // Schritt 3: Enter drücken (bestätigen)
      console.log('   Schritt 3: Enter drücken (Bestätigen)...');
      const appleScriptStep3 = `
        tell application "System Events"
          keystroke return
        end tell
      `;
      
      try {
        await execAsync(`osascript -e '${appleScriptStep3}'`);
        console.log('   ✅ Enter gedrückt (Bestätigung)');
      } catch (error) {
        console.log('   ⚠️  Bestätigung fehlgeschlagen');
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
