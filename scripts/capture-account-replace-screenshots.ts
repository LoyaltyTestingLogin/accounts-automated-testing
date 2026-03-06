import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getEmailClient } from '../tests/helpers/email';

dotenv.config();

const SCREENSHOTS_DIR = path.join(process.cwd(), 'public', 'flow-screenshots', 'account-replace-email');

// Stelle sicher, dass Screenshot-Verzeichnis existiert
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function takeScreenshot(page: Page, filename: string, description: string) {
  await page.waitForTimeout(1000); // Kurz warten damit Seite stabil ist
  await page.screenshot({ 
    path: path.join(SCREENSHOTS_DIR, filename), 
    fullPage: true 
  });
  console.log(`✅ ${description}`);
}

async function main() {
  console.log('\n📸 CHECK24 Account Replace Flow - Screenshot Capture\n');
  console.log('=' .repeat(60));
  console.log('Screenshots werden IMMER VOR der Eingabe gemacht!');
  console.log('=' .repeat(60) + '\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const email = `loyaltytesting+${timestamp}@check24.de`;
    
    console.log(`📧 Test-Email: ${email}\n`);
    
    const loginUrl = 'https://accounts.check24.com/login?callback=https%3A%2F%2Fkundenbereich.check24.de%2Findex.html%3Fls%3D2%26loc%3Dde_DE%26api_product%3Dcheck24_sso&api_product=check24_sso&loc=de_DE&deviceoutput=desktop&ls=1&context_ref=https%3A%2F%2Fkundenbereich.check24.de%2Findex.html%3Fls%3D2%26loc%3Dde_DE%26api_product%3Dcheck24_sso';
    
    // ========== TEIL 1: Erste Registrierung ==========
    console.log('\n📝 TEIL 1: Erste Registrierung\n');
    
    await page.goto(loginUrl);
    await page.waitForLoadState('networkidle');
    
    // Screenshot 1: Login-Screen (BEVOR Email eingegeben wird)
    await takeScreenshot(page, '01-login-screen-initial.png', 'Screenshot 1: Login-Screen (leer)');
    
    // JETZT Email eingeben
    await page.locator('#cl_login').fill(email);
    await page.waitForTimeout(500);
    
    // Screenshot 2: Email eingegeben
    await takeScreenshot(page, '02-email-entered.png', 'Screenshot 2: Email eingegeben');
    
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.waitForLoadState('networkidle');
    
    // Screenshot 3: Registrierungsformular (BEVOR ausgefüllt)
    await takeScreenshot(page, '03-registration-form-empty.png', 'Screenshot 3: Registrierungsformular (leer)');
    
    // JETZT Formular ausfüllen
    await page.locator('#cl_ul_firstname').fill('Loyalty');
    await page.locator('#cl_ul_lastname').fill('Testing');
    await page.locator('#cl_pw_register').fill('1qay1qay');
    await page.locator('#cl_ul_pw_register_repeat').fill('1qay1qay');
    
    // Screenshot 4: Formular ausgefüllt
    await takeScreenshot(page, '04-registration-form-filled.png', 'Screenshot 4: Registrierungsformular ausgefüllt');
    
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.waitForLoadState('networkidle');
    
    // Screenshot 5: TAN-Eingabe-Screen (BEVOR TAN eingegeben)
    await takeScreenshot(page, '05-tan-input-screen-empty.png', 'Screenshot 5: TAN-Eingabe-Screen (leer)');
    
    // TAN holen und eingeben
    console.log('📧 Warte auf E-Mail-TAN...');
    const emailClient = getEmailClient();
    const tanEmail = await emailClient.waitForEmail({ subject: 'CHECK24' }, 120000, 3000);
    const tanCode = tanEmail!.subject.match(/(\d{6})/)?.[1];
    console.log(`✅ TAN empfangen: ${tanCode}`);
    
    let tanInput = null;
    const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
    for (const selector of inputSelectors) {
      const inputs = await page.locator(selector).all();
      for (const input of inputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          tanInput = input;
          break;
        }
      }
      if (tanInput) break;
    }
    
    if (tanInput && tanCode) {
      await tanInput.fill(tanCode);
      
      // Screenshot 6: TAN eingegeben
      await takeScreenshot(page, '06-tan-entered.png', 'Screenshot 6: TAN eingegeben');
    }
    
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Warte bis zum Kundenbereich
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      if (page.url().includes('kundenbereich.check24')) {
        break;
      }
    }
    
    // Screenshot 7: Kundenbereich nach Registrierung
    await takeScreenshot(page, '07-kundenbereich-after-registration.png', 'Screenshot 7: Kundenbereich nach Registrierung');
    
    await context.close();
    
    // ========== TEIL 2: Account Replace ==========
    console.log('\n📝 TEIL 2: Account Replace Flow\n');
    
    const context2 = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page2 = await context2.newPage();
    
    await page2.goto(loginUrl);
    await page2.waitForLoadState('networkidle');
    
    // Screenshot 8: Login-Screen für zweiten Versuch (leer)
    await takeScreenshot(page2, '08-login-screen-second-attempt-empty.png', 'Screenshot 8: Login-Screen (zweiter Versuch, leer)');
    
    // Email eingeben
    await page2.locator('#cl_login').fill(email);
    
    // Screenshot 9: Gleiche Email eingegeben
    await takeScreenshot(page2, '09-same-email-entered.png', 'Screenshot 9: Gleiche Email eingegeben');
    
    await page2.getByRole('button', { name: 'Weiter' }).click();
    await page2.waitForLoadState('networkidle');
    
    // Cookie Banner wegklicken falls vorhanden
    try {
      const cookieBanner = page2.getByText('geht klar', { exact: true });
      if (await cookieBanner.isVisible({ timeout: 2000 })) {
        await cookieBanner.click();
        await page2.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // Screenshot 10: Account-Replace-Screen (Email bereits verwendet)
    await takeScreenshot(page2, '10-account-replace-screen.png', 'Screenshot 10: Account bereits vorhanden Screen');
    
    // Klicke auf "dieser E-Mail-Adresse" Link
    let emailLink = null;
    try {
      emailLink = page2.locator('[data-tid="register-with-same-email"]').first();
      await emailLink.waitFor({ state: 'attached', timeout: 5000 });
    } catch (e) {
      try {
        emailLink = page2.locator('text="dieser E-Mail-Adresse"').first();
        await emailLink.waitFor({ state: 'attached', timeout: 5000 });
      } catch (e2) {
        emailLink = page2.locator('.c24-uli-cl-r-sameemail-trigger').first();
        await emailLink.waitFor({ state: 'attached', timeout: 5000 });
      }
    }
    
    if (emailLink) {
      await emailLink.evaluate((el: any) => el.click());
      await page2.waitForLoadState('networkidle');
    }
    
    // Screenshot 11: "Trotzdem neues Konto erstellen" Screen
    await takeScreenshot(page2, '11-trotzdem-neues-konto-screen.png', 'Screenshot 11: "Trotzdem neues Konto erstellen" Screen');
    
    const trotzdemButton = page2.getByRole('button', { name: /trotzdem neues Konto erstellen/i });
    const trotzdemCount = await trotzdemButton.count();
    
    if (trotzdemCount > 0) {
      await trotzdemButton.waitFor({ state: 'visible', timeout: 10000 });
      await trotzdemButton.click();
      await page2.waitForLoadState('networkidle');
    }
    
    // Screenshot 12: Zweite TAN-Eingabe (BEVOR TAN eingegeben)
    await takeScreenshot(page2, '12-second-tan-input-empty.png', 'Screenshot 12: Zweite TAN-Eingabe (leer)');
    
    // Zweite TAN holen
    console.log('📧 Warte auf zweite E-Mail-TAN...');
    const emailClient2 = getEmailClient();
    const tanEmail2 = await emailClient2.waitForEmail({ subject: 'Sicherheitscode' }, 120000, 3000);
    const tanCode2 = tanEmail2!.subject.match(/(\d{6})/)?.[1];
    console.log(`✅ TAN empfangen: ${tanCode2}`);
    
    let tanInput2 = null;
    for (const selector of inputSelectors) {
      const inputs = await page2.locator(selector).all();
      for (const input of inputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          tanInput2 = input;
          break;
        }
      }
      if (tanInput2) break;
    }
    
    if (tanInput2 && tanCode2) {
      await tanInput2.fill(tanCode2);
      
      // Screenshot 13: Zweite TAN eingegeben
      await takeScreenshot(page2, '13-second-tan-entered.png', 'Screenshot 13: Zweite TAN eingegeben');
    }
    
    await page2.waitForLoadState('networkidle', { timeout: 30000 });
    await page2.waitForTimeout(3000);
    
    // Screenshot 14: Renew-Formular (BEVOR ausgefüllt)
    await takeScreenshot(page2, '14-renew-form-empty.png', 'Screenshot 14: Renew-Formular (leer)');
    
    // Formular ausfüllen
    await page2.locator('#cl_ul_firstname_renew').fill('Loyalty', { force: true });
    await page2.locator('#cl_ul_lastname_renew').fill('Testing', { force: true });
    await page2.locator('#cl_pw_renew').fill('1qay1qay', { force: true });
    await page2.locator('#cl_pw_renew_repeat').fill('1qay1qay', { force: true });
    
    // Screenshot 15: Renew-Formular ausgefüllt
    await takeScreenshot(page2, '15-renew-form-filled.png', 'Screenshot 15: Renew-Formular ausgefüllt');
    
    await page2.getByRole('button', { name: /speichern und weiter|weiter/i }).click();
    await page2.waitForLoadState('networkidle', { timeout: 30000 });
    await page2.waitForTimeout(3000);
    
    // Prüfe auf Phone Collector
    const bodyText = await page2.locator('body').textContent() || '';
    if (bodyText.toLowerCase().includes('telefonnummer') || bodyText.toLowerCase().includes('später')) {
      // Screenshot 16: Phone Collector (BEVOR weggeklickt)
      await takeScreenshot(page2, '16-phone-collector.png', 'Screenshot 16: Phone Collector');
      
      const spaeterButton = page2.locator('[data-tid="later-button"]');
      if (await spaeterButton.count() > 0) {
        try {
          const isVisible = await spaeterButton.first().isVisible().catch(() => false);
          if (isVisible) {
            await spaeterButton.first().click();
          } else {
            await spaeterButton.first().evaluate((el: any) => el.click());
          }
          await page2.waitForLoadState('networkidle', { timeout: 15000 });
          await page2.waitForTimeout(2000);
        } catch (e) {
          console.log('⚠️  Phone Collector konnte nicht weggeklickt werden');
        }
      }
    }
    
    // Stelle sicher, dass wir im Kundenbereich sind
    if (!page2.url().includes('kundenbereich.check24')) {
      const kundenbereichUrl = 'https://kundenbereich.check24.de/';
      await page2.goto(kundenbereichUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);
    }
    
    // Screenshot 17: Kundenbereich nach Account Replace
    await takeScreenshot(page2, '17-kundenbereich-after-replace.png', 'Screenshot 17: Kundenbereich nach Account Replace');
    
    await context2.close();
    
    console.log('\n✅ ALLE Screenshots erfolgreich erstellt!\n');
    console.log(`📁 Gespeichert in: ${SCREENSHOTS_DIR}\n`);
    
    const screenshotFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    console.log(`📊 Anzahl Screenshots: ${screenshotFiles.length}\n`);
    console.log('Screenshots:');
    screenshotFiles.sort().forEach(f => console.log(`  - ${f}`));
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Fehler beim Screenshot-Capture:', error);
  } finally {
    await browser.close();
  }
}

// Führe Script aus
main();
