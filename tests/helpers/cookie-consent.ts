import type { Page } from '@playwright/test';

/**
 * Cookie-Banner „geht klar“ (Consent Familie)
 * @example
 * <a class="c24-cookie-consent-button" onclick="Check24.cookieBanner.c24consent.giveConsent('fam')">geht klar</a>
 */
export const COOKIE_GEHT_KLAR_SELECTOR =
  'a.c24-cookie-consent-button[onclick*="giveConsent(\'fam\')"]';

/**
 * Kurze Sichtbarkeits-Probe (nur noch für Stellen mit explizitem isVisible – nicht für closeCookieGehtKlarIfVisible).
 */
export const COOKIE_BANNER_PROBE_TIMEOUT_MS = 400;

/** Minimale Pause nach Klick (Banner/DOM)
 * (früher länger; der eigentliche Flaschenhals war Playwright-click + actionTimeout) */
export const COOKIE_AFTER_CLICK_MS = 120;

/**
 * Schließt den Cookie-Banner, falls vorhanden.
 *
 * **Warum nicht `isVisible` + `locator.click()`?**
 * - `isVisible({ timeout })` wartet bis zu N ms, wenn das Element (noch) nicht als „sichtbar“ gilt.
 * - `click()` ohne `force` hängt an `actionTimeout` (z. B. 10s) und wartet auf Actionability
 *   (Overlay, Animation) – wirkt im Browser wie „ewiges Stehen“ auf dem Banner.
 *
 * Stattdessen: **synchroner `element.click()` im Seitenkontext** – ein Roundtrip, kein Actionability-Wait.
 */
export async function closeCookieGehtKlarIfVisible(page: Page): Promise<void> {
  const t0 = Date.now();
  try {
    const clicked = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a.c24-cookie-consent-button')
      );
      const onclick = (a: HTMLAnchorElement) => a.getAttribute('onclick') || '';
      const byOnclick = links.find((a) => {
        const oc = onclick(a);
        return (
          oc.includes("giveConsent('fam')") ||
          oc.includes('giveConsent("fam")') ||
          oc.includes('c24consent.giveConsent')
        );
      });
      const link =
        byOnclick ??
        links.find((a) => (a.textContent || '').trim().toLowerCase() === 'geht klar');
      if (!link) return false;
      link.click();
      return true;
    });
    const ms = Date.now() - t0;
    if (clicked) {
      await page.waitForTimeout(COOKIE_AFTER_CLICK_MS);
      console.log(`🍪 Cookie-Banner „geht klar“ geklickt (${ms}ms bis Klick)`);
    } else {
      console.log(`🍪 Kein Cookie-Banner-Link im DOM (${ms}ms)`);
    }
  } catch {
    /* kein Banner / Cross-Origin */
    console.log(`🍪 Cookie-Banner: Ausnahme nach ${Date.now() - t0}ms`);
  }
}
