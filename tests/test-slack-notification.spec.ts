import { test, expect } from './fixtures/test-hooks';

/**
 * Test-Datei zum Testen der automatischen Slack-Benachrichtigungen bei Fehlern
 * DIESER TEST SOLL FEHLSCHLAGEN um die Slack-Benachrichtigung zu testen
 */

test.describe('Slack-Benachrichtigungs-Test', () => {
  test.skip('Test der automatischen Slack-Benachrichtigung bei Fehler', async ({ page }) => {
    console.log('🧪 Dieser Test schlägt absichtlich fehl, um Slack-Benachrichtigungen zu testen');
    
    // Simuliere einen echten Test-Fehler
    await page.goto('https://example.com');
    
    // Dieser Expect schlägt absichtlich fehl
    expect(1).toBe(2);
  });
});
