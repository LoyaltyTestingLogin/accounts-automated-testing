import { test as base } from '@playwright/test';
import { sendTestFailureNotification } from '../helpers/slack';

/**
 * Erweiterte Test-Fixtures mit automatischen Slack-Benachrichtigungen bei Fehlern
 */
export const test = base.extend({
  // Automatische Fehler-Benachrichtigung nach jedem Test
  autoFixture: [async ({}, use, testInfo) => {
    // Vor dem Test: nichts zu tun
    await use();
    
    // Nach dem Test: Prüfe auf Fehler
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      // Nur beim letzten Retry benachrichtigen (nicht bei jedem Retry-Versuch)
      const isLastRetry = testInfo.retry === testInfo.project.retries;
      
      if (isLastRetry) {
        const testTitle = testInfo.title;
        const testFile = testInfo.file.split('/').slice(-2).join('/'); // Nur die letzten 2 Pfad-Teile
        const errorMessage = testInfo.error?.message || 'Unbekannter Fehler';
        const retryCount = testInfo.retry;
        
        console.log(`\n🚨 Test fehlgeschlagen nach ${retryCount} Retry(s) - sende Slack-Benachrichtigung...\n`);
        
        await sendTestFailureNotification(
          testTitle,
          errorMessage.substring(0, 500), // Limit auf 500 Zeichen
          testFile,
          retryCount
        );
      }
    }
  }, { auto: true }],
});

export { expect } from '@playwright/test';
