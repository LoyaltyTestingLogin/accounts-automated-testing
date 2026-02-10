import { test, expect } from '@playwright/test';
import { getLoginUrl, getKundenbereichUrl } from '../helpers/environment';

test.describe('DEBUG: OTP "Mit Einmalcode anmelden" Button finden', () => {
  test('Finde "Mit Einmalcode anmelden" auf Passwort-Seite', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Verwende eine bekannte Phone-Nummer mit Passwort
      const testPhone = '+49 (170) 4567890';  // Beispiel - passe an existierende Nummer an
      
      await page.goto(getLoginUrl());
      await page.waitForLoadState('networkidle');

      console.log(`📱 Gebe Phone-Nummer ein: ${testPhone}`);
      const phoneInput = page.locator('#cl_login');
      await phoneInput.fill(testPhone);
      console.log('✅ Phone-Nummer eingegeben');

      const weiterBtn = page.getByRole('button', { name: 'Weiter' });
      await weiterBtn.click();
      console.log('✅ "Weiter" geklickt');
      await page.waitForTimeout(2000);

      console.log('🔍 Analysiere aktuelle Seite...');
      console.log(`📍 Aktuelle URL: ${page.url()}`);

      // Debug: Zeige Body-Text
      const bodyText = await page.locator('body').innerText();
      console.log(`\n📄 Body-Text (vollständig):\n${bodyText}\n`);

      // Debug: Liste alle sichtbaren Buttons
      console.log('\n🔍 Liste alle sichtbaren Buttons...');
      const allButtons = await page.locator('button').all();
      for (let i = 0; i < allButtons.length; i++) {
        const btn = allButtons[i];
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          const text = await btn.textContent().catch(() => '');
          const type = await btn.getAttribute('type').catch(() => '');
          const classes = await btn.getAttribute('class').catch(() => '');
          console.log(`   Button ${i+1}: "${text?.trim()}" (type: ${type}, class: ${classes})`);
        }
      }

      // Debug: Liste alle sichtbaren Links
      console.log('\n🔍 Liste alle sichtbaren Links...');
      const allLinks = await page.locator('a').all();
      let visibleLinkCount = 0;
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        const isVisible = await link.isVisible().catch(() => false);
        if (isVisible) {
          const text = await link.textContent().catch(() => '');
          const href = await link.getAttribute('href').catch(() => '');
          const classes = await link.getAttribute('class').catch(() => '');
          if (text && text.trim().length > 0) {
            console.log(`   Link ${++visibleLinkCount}: "${text.trim()}" (href: ${href}, class: ${classes})`);
          }
        }
      }

      // Warte 10 Sekunden, damit du es im Browser sehen kannst
      await page.waitForTimeout(10000);

      console.log('\n✅ DEBUG ABGESCHLOSSEN\n');

    } finally {
      await context.close();
    }
  });
});
