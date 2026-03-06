import { test, expect } from '../fixtures/test-hooks';
import { chromium } from '@playwright/test';
import { TEST_ACCOUNTS } from '../fixtures/accounts';
import { getLoginUrl, getKundenbereichUrl } from '../helpers/environment';
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
  test('Test Case 1: Passkey Login über Passkey-Button', async () => {
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
      const baseUrl = getLoginUrl();
      const kundenbereichUrl = getKundenbereichUrl();
      const loginUrl = `${baseUrl}/login?redirect_uri=${kundenbereichUrl}`;
      
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
      
      // 5. Nativer Passkey-Dialog automatisieren: Enter → Passwort → Enter
      console.log('⏳ Warte 3 Sekunden auf nativen Dialog...');
      await page.waitForTimeout(3000);
      
      console.log('🍎 Automatisiere nativen Passkey-Dialog (AuthenticationServicesAgent)...');
      
      const password = '1qay1qay';
      
      // Robustes AppleScript mit Dialog-Aktivierung und mehreren Versuchen
      const appleScriptComplete = `
        tell application "System Events"
          -- Warte kurz damit Dialog vollständig geladen ist
          delay 0.5
          
          -- Schritt 1: Enter drücken (Fortfahren)
          keystroke return
          delay 2.0
          
          -- Schritt 2: Passwort eingeben (mit längerer Wartezeit)
          keystroke "${password}"
          delay 1.0
          
          -- Schritt 3: Enter drücken (Bestätigen)
          keystroke return
          delay 0.5
        end tell
      `;
      
      console.log('   🔄 Führe kompletten Dialog-Flow aus...');
      console.log('      1. Enter (Fortfahren) - Wartezeit: 2.0s');
      console.log('      2. Passwort eingeben - Wartezeit: 1.0s');
      console.log('      3. Enter (Bestätigen)');
      
      try {
        await execAsync(`osascript -e '${appleScriptComplete}'`);
        console.log('   ✅ Dialog-Automatisierung abgeschlossen');
      } catch (error) {
        console.log('   ⚠️  Fehler bei Dialog-Automatisierung:', (error as Error).message.split('\n')[0]);
        
        // Fallback: Versuche nochmal mit längeren Delays
        console.log('   🔄 Versuche Fallback mit längeren Wartezeiten...');
        const fallbackScript = `
          tell application "System Events"
            delay 1.0
            keystroke return
            delay 3.0
            keystroke "${password}"
            delay 1.5
            keystroke return
          end tell
        `;
        try {
          await execAsync(`osascript -e '${fallbackScript}'`);
          console.log('   ✅ Fallback erfolgreich');
        } catch (fallbackError) {
          console.log('   ⚠️  Auch Fallback fehlgeschlagen');
        }
      }
      
      // 6. Warte auf Weiterleitung zur Kundenbereich-Seite
      console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅✅✅ LOGIN ERFOLGREICH - Weitergeleitet! ✅✅✅');
      } catch (error) {
        console.log('⚠️  Keine automatische Weiterleitung innerhalb 5 Sekunden');
        const currentUrl = page.url();
        console.log('📍 Aktuelle URL:', currentUrl);
        
        if (currentUrl.includes('kundenbereich')) {
          console.log('✅ URL enthält "kundenbereich" - Login vermutlich erfolgreich!');
        }
      }
      
      await page.waitForTimeout(2000);
      
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

  test('Test Case 2: Passkey Login über Conditional UI (Email-Feld)', async () => {
    console.log('\n🔐 Starte Passkey Login via Conditional UI...\n');

    // Verwende echtes Chrome mit frischem Test-Profil
    const testProfilePath = path.join(os.tmpdir(), 'chrome-passkey-conditional-' + Date.now());
    
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
      const baseUrl = getLoginUrl();
      const kundenbereichUrl = getKundenbereichUrl();
      const loginUrl = `${baseUrl}/login?redirect_uri=${kundenbereichUrl}`;
      
      console.log('📍 Navigiere zu:', loginUrl);
      await page.goto(loginUrl);
      await page.waitForLoadState('networkidle');

      // 2. Auf Email-Inputfeld klicken (löst Conditional UI aus)
      console.log('🖱️  Klicke auf Email-Inputfeld...');
      const emailInput = page.locator('#cl_login');
      await emailInput.click();
      
      console.log('⏳ Warte 2 Sekunden auf Passkey-Vorschlag (Conditional UI)...');
      await page.waitForTimeout(2000);
      
      // 3. Passkey-Vorschlag mit AppleScript auswählen
      console.log('🍎 Automatisiere Passkey-Auswahl mit AppleScript...');
      
      const appleScriptSelectPasskey = `
        tell application "System Events"
          -- Pfeil-Runter zum Auswählen
          keystroke (ASCII character 31)
          delay 0.5
          -- Enter zum Bestätigen
          keystroke return
        end tell
      `;
      
      console.log('   → Drücke Pfeil-Runter (Passkey auswählen)...');
      console.log('   → Drücke Enter (Passkey bestätigen)...');
      
      try {
        await execAsync(`osascript -e '${appleScriptSelectPasskey}'`);
        console.log('   ✅ Passkey-Auswahl abgeschlossen');
      } catch (error) {
        console.log('   ⚠️  Fehler bei Passkey-Auswahl:', (error as Error).message.split('\n')[0]);
      }
      
      // 4. Nativer Passkey-Dialog automatisieren: Enter → Passwort → Enter
      console.log('⏳ Warte 3 Sekunden auf nativen Passkey-Dialog...');
      await page.waitForTimeout(3000);
      
      console.log('🍎 Automatisiere nativen Passkey-Dialog...');
      
      const password = '1qay1qay';
      
      const appleScriptComplete = `
        tell application "System Events"
          -- Warte kurz damit Dialog vollständig geladen ist
          delay 0.5
          
          -- Schritt 1: Enter drücken (Fortfahren)
          keystroke return
          delay 2.0
          
          -- Schritt 2: Passwort eingeben (mit längerer Wartezeit)
          keystroke "${password}"
          delay 1.0
          
          -- Schritt 3: Enter drücken (Bestätigen)
          keystroke return
          delay 0.5
        end tell
      `;
      
      console.log('   🔄 Führe kompletten Dialog-Flow aus...');
      console.log('      1. Enter (Fortfahren) - Wartezeit: 2.0s');
      console.log('      2. Passwort eingeben - Wartezeit: 1.0s');
      console.log('      3. Enter (Bestätigen)');
      
      try {
        await execAsync(`osascript -e '${appleScriptComplete}'`);
        console.log('   ✅ Dialog-Automatisierung abgeschlossen');
      } catch (error) {
        console.log('   ⚠️  Fehler bei Dialog-Automatisierung:', (error as Error).message.split('\n')[0]);
        
        // Fallback: Versuche nochmal mit längeren Delays
        console.log('   🔄 Versuche Fallback mit längeren Wartezeiten...');
        const fallbackScript = `
          tell application "System Events"
            delay 1.0
            keystroke return
            delay 3.0
            keystroke "${password}"
            delay 1.5
            keystroke return
          end tell
        `;
        try {
          await execAsync(`osascript -e '${fallbackScript}'`);
          console.log('   ✅ Fallback erfolgreich');
        } catch (fallbackError) {
          console.log('   ⚠️  Auch Fallback fehlgeschlagen');
        }
      }
      
      // 5. Warte auf Weiterleitung zur Kundenbereich-Seite
      console.log('⏳ Warte auf Weiterleitung zum Kundenbereich...');
      
      try {
        await page.waitForURL(/kundenbereich\.check24(-test)?\.de/, { timeout: 5000 });
        console.log('✅✅✅ LOGIN ERFOLGREICH - Weitergeleitet! ✅✅✅');
      } catch (error) {
        console.log('⚠️  Keine automatische Weiterleitung innerhalb 5 Sekunden');
        const currentUrl = page.url();
        console.log('📍 Aktuelle URL:', currentUrl);
        
        if (currentUrl.includes('kundenbereich')) {
          console.log('✅ URL enthält "kundenbereich" - Login vermutlich erfolgreich!');
        }
      }
      
      // 6. c24session Cookie prüfen
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
        
        console.log('\n🎉 Passkey-Login via Conditional UI erfolgreich!\n');
      } else {
        console.log('❌ c24session Cookie NICHT gefunden');
        console.log('Verfügbare Cookies:', cookies.map(c => c.name));
        console.log('\n⚠️  Mögliche Gründe:');
        console.log('   1. Conditional UI hat keinen Passkey-Vorschlag angezeigt');
        console.log('   2. Passkey-Dialog wurde nicht automatisiert');
        console.log('   3. Dialog erfordert manuelle Bestätigung');
        
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
          throw new Error('Passkey-Login (Conditional UI) fehlgeschlagen: c24session Cookie nicht gefunden');
        }
      }
      
    } finally {
      // Browser schließen
      await browser.close();
      console.log('\n✅ Test abgeschlossen\n');
    }
  });
});
