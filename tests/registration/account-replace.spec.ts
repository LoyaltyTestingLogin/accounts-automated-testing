import { test, expect } from '../fixtures/test-hooks';
import type { Page } from '@playwright/test';
import { expectLoginSuccess } from '../helpers/auth';
import { getEmailClient } from '../helpers/email';
import { sendEmailTimeoutWarning } from '../helpers/slack';
import { getLoginUrl, getKundenbereichUrl, getEnvironment } from '../helpers/environment';
import { closeCookieGehtKlarIfVisible } from '../helpers/cookie-consent';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Kundenbereich: Profil → Anmelden & Sicherheit → Konto löschen (wie plz-birthday-challenge.spec.ts)
 */
async function deleteKontoViaSettingsOverview(page: Page): Promise<void> {
  await closeCookieGehtKlarIfVisible(page);

  const profilLink = page.locator('a.c24-customer-hover-wrapper').first();
  await profilLink.waitFor({ state: 'visible', timeout: 10000 });
  await profilLink.click({ force: true });
  await page.waitForTimeout(350);

  const anmeldenSicherheitLink = page.locator('a[href*="/settings/overview"]').first();
  await anmeldenSicherheitLink.waitFor({ state: 'visible', timeout: 10000 });
  await anmeldenSicherheitLink.click({ force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  const currentUrl = page.url();
  const environment = getEnvironment();
  if (environment === 'test') {
    if (currentUrl.includes('accounts.check24.com') && !currentUrl.includes('accounts.check24-test.com')) {
      await page.goto('https://accounts.check24-test.com/settings/overview');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
    }
  }

  const kundenkontoLoeschenLink = page
    .locator('.c24-acs__settings__overview-page__subHeadline a')
    .filter({ hasText: 'Kundenkonto löschen' })
    .first();
  await kundenkontoLoeschenLink.waitFor({ state: 'visible', timeout: 10000 });
  await kundenkontoLoeschenLink.click();
  await page.waitForTimeout(1500);

  const checkbox = page.locator('input[name="terms"][type="checkbox"]');
  await checkbox.waitFor({ state: 'visible', timeout: 10000 });
  await checkbox.check();
  await page.waitForTimeout(500);

  const entfernenButton = page.locator('button.c24-acs-button__primary').first();
  await entfernenButton.waitFor({ state: 'visible', timeout: 10000 });
  await entfernenButton.click();
  await page.waitForTimeout(1000);
}

/**
 * CHECK24 Registrierung - Account Replace Tests
 * 
 * Testet das Ersetzen eines bestehenden Accounts durch einen neuen Account
 * mit derselben E-Mail-Adresse oder Mobiltelefonnummer
 */

test.describe('CHECK24 Registrierung - Account Replace', () => {

  test('Account Replace - E-Mail-Adresse wiederverwenden', async ({ browser }) => {
    const timestamp = new Date().toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14);
    const email = `loyaltytesting+${timestamp}@check24.de`;
    
    console.log(`\n📧 Account Replace Test (E-Mail): ${email}\n`);
    
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    try {
      console.log('📝 Teil 1: Erstelle ersten Account...');
      
      const loginUrl = getLoginUrl();
      await page1.goto(loginUrl);
      await page1.waitForLoadState('networkidle');
      
      const emailInput = page1.locator('#cl_login');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await page1.waitForTimeout(300);
      await emailInput.fill(email);
      await page1.waitForTimeout(500);

      // Weiter: Login/Registrierung nach E-Mail (#cl_login) → gleicher ULI-Submit wie andere Login-Tests
      const weiterButton = page1.locator('#c24-uli-login-btn');
      await weiterButton.click();
      await page1.waitForTimeout(1000);

      const vornameInput = page1.locator('#cl_ul_firstname');
      await vornameInput.waitFor({ state: 'visible', timeout: 10000 });
      await vornameInput.fill('Loyalty');
      
      const nachnameInput = page1.locator('#cl_ul_lastname');
      await nachnameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nachnameInput.fill('Testing');
      
      const password1 = page1.locator('#cl_pw_register');
      await password1.waitFor({ state: 'visible', timeout: 10000 });
      await password1.fill('1qay1qay');
      
      const password2 = page1.locator('#cl_ul_pw_register_repeat');
      await password2.waitFor({ state: 'visible', timeout: 10000 });
      await password2.fill('1qay1qay');

      // Weiter: Registrierungsformular (Vorname/Nachname/Passwort) → vor E-Mail-TAN
      const weiterButton2 = page1.locator('#c24-uli-register-btn');
      await weiterButton2.waitFor({ state: 'visible', timeout: 10000 });
      await weiterButton2.scrollIntoViewIfNeeded();
      await weiterButton2.click();
      await page1.waitForTimeout(1000);

      console.log('📧 Warte auf E-Mail-TAN...');
      const emailClient = getEmailClient();
      
      let tanEmail;
      try {
        tanEmail = await emailClient.waitForEmail({ subject: 'CHECK24' }, 120000, 3000);
      } catch (error) {
        await sendEmailTimeoutWarning('Account Replace - Erste Registrierung', 'subject: CHECK24', 120);
        throw error;
      }

      let tanCode: string | null = null;
      const subjectMatch = tanEmail!.subject.match(/(\d{6})/);
      if (subjectMatch) {
        tanCode = subjectMatch[1];
      } else {
        const bodyMatch = tanEmail!.body.match(/(\d{6})/);
        if (bodyMatch) {
          tanCode = bodyMatch[1];
        } else {
          throw new Error('Konnte TAN-Code nicht extrahieren');
        }
      }

      let tanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page1.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            tanInput = input;
            break;
          }
        }
        if (tanInput) break;
      }

      if (!tanInput) {
        throw new Error('Konnte TAN-Eingabefeld nicht finden');
      }

      await page1.waitForTimeout(500);
      await tanInput.fill(tanCode);

      await page1.waitForLoadState('networkidle', { timeout: 30000 });
      
      for (let i = 0; i < 10; i++) {
        await page1.waitForTimeout(2000);
        if (page1.url().includes('kundenbereich.check24')) {
          break;
        }
      }

      await page1.waitForTimeout(3000);
      await expectLoginSuccess(page1);
      console.log('✅ Teil 1: Erster Account erstellt\n');
      
    } finally {
      await context1.close();
    }

    console.log('📝 Teil 2: Account Replace mit derselben E-Mail...');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    try {
      const loginUrl = getLoginUrl();
      await page2.goto(loginUrl);
      await page2.waitForLoadState('networkidle');

      const emailInput2 = page2.locator('#cl_login');
      await emailInput2.waitFor({ state: 'visible', timeout: 10000 });
      await page2.waitForTimeout(300);
      await emailInput2.fill(email);
      await page2.waitForTimeout(500);

      // Weiter: erneut E-Mail eingeben (Account existiert) → Hinweis „gleiche E-Mail“
      const weiterButton3 = page2.locator('#c24-uli-login-btn');
      await weiterButton3.click();
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      await closeCookieGehtKlarIfVisible(page2);

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
      
      if (!emailLink) {
        throw new Error('Konnte Link "dieser E-Mail-Adresse" nicht finden');
      }
      
      await emailLink.evaluate((el: any) => el.click());
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      const trotzdemButton = page2.locator('#c24-uli-renew-start-btn');
      await trotzdemButton.waitFor({ state: 'visible', timeout: 10000 });
      await trotzdemButton.click();
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      const emailClient2 = getEmailClient();
      let tanEmail2;
      try {
        tanEmail2 = await emailClient2.waitForEmail({ subject: 'Sicherheitscode' }, 120000, 3000);
      } catch (error) {
        await sendEmailTimeoutWarning('Account Replace - Zweite Registrierung TAN', 'subject: Sicherheitscode', 120);
        throw error;
      }

      let tanCode2: string | null = null;
      const subjectMatch2 = tanEmail2!.subject.match(/(\d{6})/);
      if (subjectMatch2) {
        tanCode2 = subjectMatch2[1];
      } else {
        const bodyMatch2 = tanEmail2!.body.match(/(\d{6})/);
        if (bodyMatch2) {
          tanCode2 = bodyMatch2[1];
        } else {
          throw new Error('Konnte TAN-Code nicht extrahieren');
        }
      }

      let tanInput2 = null;
      const inputSelectors2 = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors2) {
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

      if (!tanInput2) {
        throw new Error('Konnte TAN-Eingabefeld nicht finden');
      }

      await page2.waitForTimeout(500);
      await tanInput2.fill(tanCode2);
      
      await page2.waitForLoadState('networkidle', { timeout: 30000 });
      await page2.waitForTimeout(3000);
      
      await page2.locator('#cl_ul_firstname_renew').waitFor({ state: 'attached', timeout: 15000 });
      
      await page2.locator('#cl_ul_firstname_renew').fill('Loyalty', { force: true });
      await page2.locator('#cl_ul_lastname_renew').fill('Testing', { force: true });
      await page2.locator('#cl_pw_renew').fill('1qay1qay', { force: true });
      await page2.locator('#cl_pw_renew_repeat').fill('1qay1qay', { force: true });
      await page2.waitForTimeout(500);

      const speichernButton = page2.locator('#c24-uli-renew-pw-btn');
      await speichernButton.waitFor({ state: 'visible', timeout: 10000 });
      await speichernButton.click();
      
      await page2.waitForLoadState('networkidle', { timeout: 30000 });
      await page2.waitForTimeout(3000);
      
      const bodyText = await page2.locator('body').textContent() || '';
      if (bodyText.toLowerCase().includes('telefonnummer') || bodyText.toLowerCase().includes('später')) {
        const spaeterButton = page2.locator('[data-tid="later-button"]');
        const spaeterCount = await spaeterButton.count();
        
        if (spaeterCount > 0) {
          const isVisible = await spaeterButton.first().isVisible().catch(() => false);
          if (isVisible) {
            await spaeterButton.first().click();
            console.log('   ✅ Phone Collector übersprungen');
          } else {
            // Versuche mit evaluate zu klicken
            await spaeterButton.first().evaluate((el: any) => el.click()).catch(() => {});
            console.log('   ✅ Phone Collector übersprungen (force click)');
          }
          await page2.waitForLoadState('networkidle', { timeout: 15000 });
          await page2.waitForTimeout(2000);
        }
      }
      
      if (!page2.url().includes('kundenbereich.check24')) {
        const kundenbereichUrl = getKundenbereichUrl();
        await page2.goto(kundenbereichUrl);
        await page2.waitForLoadState('networkidle');
        await page2.waitForTimeout(2000);
      }

      await expectLoginSuccess(page2);
      console.log('✅ Account Replace erfolgreich - Login bestätigt');

      await page2.waitForTimeout(2000);

      await deleteKontoViaSettingsOverview(page2);

      console.log('✅ Account gelöscht\n');
      
    } finally {
      await context2.close();
    }
  });

  test('Account Replace - Mobiltelefonnummer wiederverwenden', async ({ browser }) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeExtension = hours + minutes;
    const phoneNumber = `01746760225 ext. ${timeExtension}`;
    
    console.log(`\n📱 Account Replace Test (Phone): ${phoneNumber}\n`);
    
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    try {
      console.log('📝 Teil 1: Erstelle ersten Account mit Phone...');
      
      const baseUrl = process.env.CHECK24_BASE_URL;
      if (!baseUrl) {
        throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
      }
      await page1.goto(baseUrl);
      await page1.waitForLoadState('networkidle');

      const phoneInput = page1.locator('#cl_login');
      await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
      await page1.waitForTimeout(300);
      await phoneInput.fill(phoneNumber);
      await page1.waitForTimeout(500);

      // Weiter: nach Telefonnummer (#cl_login)
      const weiterButton1 = page1.locator('#c24-uli-login-btn');
      await weiterButton1.click();
      await page1.waitForTimeout(1000);

      const timestamp = new Date().toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 14);
      const email = `loyaltytesting+${timestamp}@check24.de`;
      
      const emailInput = page1.locator('#cl_email_registercheck');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(email);
      await page1.waitForTimeout(500);

      // Weiter: nach E-Mail-Registrierungscheck (#cl_email_registercheck)
      const weiterButton2 = page1.locator('#c24-uli-registercheck-btn');
      await weiterButton2.click();
      await page1.waitForTimeout(1000);
      
      const vornameInput = page1.locator('#cl_ul_firstname');
      await vornameInput.waitFor({ state: 'visible', timeout: 10000 });
      await vornameInput.fill('Loyalty');
      
      const nachnameInput = page1.locator('#cl_ul_lastname');
      await nachnameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nachnameInput.fill('Testing');
      
      const password1 = page1.locator('#cl_pw_register');
      await password1.waitFor({ state: 'visible', timeout: 10000 });
      await password1.fill('1qay1qay');
      
      const password2 = page1.locator('#cl_ul_pw_register_repeat');
      await password2.waitFor({ state: 'visible', timeout: 10000 });
      await password2.fill('1qay1qay');

      // Weiter: Registrierungsformular (Vorname/Nachname/Passwort) → vor E-Mail-TAN
      const weiterButton3 = page1.locator('#c24-uli-register-btn');
      await weiterButton3.waitFor({ state: 'visible', timeout: 10000 });
      await weiterButton3.scrollIntoViewIfNeeded();
      await weiterButton3.click();
      await page1.waitForTimeout(1000);

      console.log('📧 Warte auf E-Mail-TAN...');
      const emailClient = getEmailClient();
      
      let emailTanEmail;
      try {
        emailTanEmail = await emailClient.waitForEmail({ subject: 'CHECK24' }, 120000, 3000);
      } catch (error) {
        await sendEmailTimeoutWarning('Account Replace Phone - E-Mail-TAN-Verifizierung', 'subject: CHECK24', 120);
        throw error;
      }

      let emailTanCode: string | null = null;
      const emailSubjectMatch = emailTanEmail.subject.match(/(\d{6})/);
      if (emailSubjectMatch) {
        emailTanCode = emailSubjectMatch[1];
      } else {
        const bodyMatch = emailTanEmail.body.match(/(\d{6})/);
        if (bodyMatch) {
          emailTanCode = bodyMatch[1];
        } else {
          throw new Error('Konnte E-Mail-TAN-Code nicht extrahieren');
        }
      }

      let emailTanInput = null;
      const inputSelectors = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors) {
        const inputs = await page1.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            emailTanInput = input;
            break;
          }
        }
        if (emailTanInput) break;
      }

      if (!emailTanInput) {
        throw new Error('Konnte E-Mail-TAN-Eingabefeld nicht finden');
      }

      await page1.waitForTimeout(500);
      await emailTanInput.fill(emailTanCode);

      await page1.waitForLoadState('networkidle', { timeout: 30000 });
      await page1.waitForTimeout(1000);

      console.log('📱 Warte auf SMS-TAN...');
      
      let smsTanEmail;
      try {
        smsTanEmail = await emailClient.waitForEmail({ from: 'ulitesting@icloud.com' }, 120000, 3000);
      } catch (error) {
        await sendEmailTimeoutWarning('Account Replace Phone - SMS-TAN-Verifizierung', 'from: ulitesting@icloud.com', 120);
        throw error;
      }

      let smsTanCode: string | null = null;
      const smsSubjectMatch = smsTanEmail.subject.match(/(\d{6})/);
      if (smsSubjectMatch) {
        smsTanCode = smsSubjectMatch[1];
      } else {
        const smsBodyMatch = smsTanEmail.body.match(/(\d{6})/);
        if (smsBodyMatch) {
          smsTanCode = smsBodyMatch[1];
        } else {
          throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
        }
      }

      let smsTanInput = null;
      for (const selector of inputSelectors) {
        const inputs = await page1.locator(selector).all();
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            smsTanInput = input;
            break;
          }
        }
        if (smsTanInput) break;
      }

      if (!smsTanInput) {
        throw new Error('Konnte SMS-TAN-Eingabefeld nicht finden');
      }

      await page1.waitForTimeout(500);
      await smsTanInput.fill(smsTanCode);

      await page1.waitForLoadState('networkidle', { timeout: 30000 });
      
      for (let i = 0; i < 10; i++) {
        await page1.waitForTimeout(1000);
        if (page1.url().includes('kundenbereich.check24')) {
          break;
        }
      }

      await page1.waitForTimeout(3000);
      await expectLoginSuccess(page1);
      console.log('✅ Teil 1: Erster Account mit Phone erstellt\n');
      
    } finally {
      await context1.close();
    }

    console.log('📝 Teil 2: Account Replace mit derselber Telefonnummer...');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    try {
      const baseUrl = process.env.CHECK24_BASE_URL;
      if (!baseUrl) {
        throw new Error('CHECK24_BASE_URL muss in .env definiert sein');
      }
      await page2.goto(baseUrl);
      await page2.waitForLoadState('networkidle');

      const phoneInput2 = page2.locator('#cl_login');
      await phoneInput2.waitFor({ state: 'visible', timeout: 10000 });
      await page2.waitForTimeout(300);
      await phoneInput2.fill(phoneNumber);
      await page2.waitForTimeout(500);

      // Weiter: nach Telefonnummer – gleiche Nummer, Account existiert
      const weiterButton = page2.locator('#c24-uli-login-btn');
      await weiterButton.click();
      await page2.waitForTimeout(1000);

      await closeCookieGehtKlarIfVisible(page2);

      const phoneLink = page2.locator('[data-tid="register-with-same-phone"]');
      await phoneLink.waitFor({ state: 'attached', timeout: 10000 });
      await phoneLink.evaluate((el: any) => el.click());
      await page2.waitForTimeout(1000);

      const trotzdemButton = page2.locator('#c24-uli-renew-start-btn');
      await trotzdemButton.waitFor({ state: 'visible', timeout: 10000 });
      await trotzdemButton.click();
      await page2.waitForLoadState('networkidle', { timeout: 30000 });
      await page2.waitForTimeout(1000);

      const emailClient2 = getEmailClient();
      
      let smsTanEmail2;
      try {
        smsTanEmail2 = await emailClient2.waitForEmail({ from: 'ulitesting@icloud.com' }, 120000, 3000);
      } catch (error) {
        await sendEmailTimeoutWarning('Account Replace Phone Teil 2 - SMS-TAN-Verifizierung', 'from: ulitesting@icloud.com', 120);
        throw error;
      }

      let smsTanCode2: string | null = null;
      const smsSubjectMatch2 = smsTanEmail2.subject.match(/(\d{6})/);
      if (smsSubjectMatch2) {
        smsTanCode2 = smsSubjectMatch2[1];
      } else {
        const smsBodyMatch2 = smsTanEmail2.body.match(/(\d{6})/);
        if (smsBodyMatch2) {
          smsTanCode2 = smsBodyMatch2[1];
        } else {
          throw new Error('Konnte SMS-TAN-Code nicht extrahieren');
        }
      }

      let tanInput2 = null;
      const inputSelectors2 = ['input[type="text"]', 'input[type="tel"]', 'input[id*="tan"]'];
      
      for (const selector of inputSelectors2) {
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

      if (!tanInput2) {
        throw new Error('Konnte SMS-TAN-Eingabefeld nicht finden');
      }

      await page2.waitForTimeout(500);
      await tanInput2.fill(smsTanCode2);
      
      await page2.waitForLoadState('networkidle', { timeout: 30000 });
      await page2.waitForTimeout(3000);
      
      await page2.locator('#cl_ul_firstname_renew').waitFor({ state: 'attached', timeout: 15000 });
      
      await page2.locator('#cl_ul_firstname_renew').fill('Loyalty', { force: true });
      await page2.locator('#cl_ul_lastname_renew').fill('Testing', { force: true });
      await page2.locator('#cl_pw_renew').fill('1qay1qay', { force: true });
      await page2.locator('#cl_pw_renew_repeat').fill('1qay1qay', { force: true });
      await page2.waitForTimeout(500);

      const speichernButton = page2.locator('#c24-uli-renew-pw-btn');
      await speichernButton.waitFor({ state: 'visible', timeout: 10000 });
      await speichernButton.click();
      
      await page2.waitForLoadState('networkidle', { timeout: 30000 });
      await page2.waitForTimeout(3000);
      
      const bodyText = await page2.locator('body').textContent() || '';
      if (bodyText.toLowerCase().includes('telefonnummer') || bodyText.toLowerCase().includes('später')) {
        const spaeterButton = page2.locator('[data-tid="later-button"]');
        const spaeterCount = await spaeterButton.count();
        
        if (spaeterCount > 0) {
          const isVisible = await spaeterButton.first().isVisible().catch(() => false);
          if (isVisible) {
            await spaeterButton.first().click();
          } else {
            await spaeterButton.first().evaluate((el: any) => el.click()).catch(() => {});
          }
          await page2.waitForLoadState('networkidle', { timeout: 15000 });
          await page2.waitForTimeout(2000);
        }
      }
      
      if (!page2.url().includes('kundenbereich.check24')) {
        const kundenbereichUrl = getKundenbereichUrl();
        await page2.goto(kundenbereichUrl);
        await page2.waitForLoadState('networkidle');
      }

      await expectLoginSuccess(page2);
      console.log('✅ Account Replace erfolgreich - Login bestätigt');

      await page2.waitForTimeout(2000);

      await deleteKontoViaSettingsOverview(page2);

      console.log('✅ Account gelöscht\n');
      
    } finally {
      await context2.close();
    }
  });

});
