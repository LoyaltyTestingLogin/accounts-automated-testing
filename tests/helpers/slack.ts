import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sendet eine Warnung an Slack ohne @channel Mention
 */
export async function sendSlackWarning(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('⚠️  SLACK_WEBHOOK_URL nicht konfiguriert - Warnung wird nicht gesendet');
    return;
  }

  try {
    await axios.post(webhookUrl, {
      text: `⚠️ ${message}`,
      unfurl_links: false,
      unfurl_media: false,
    }, {
      timeout: 5000,
    });
    console.log('📤 Slack-Warnung gesendet');
  } catch (error: any) {
    console.error('❌ Fehler beim Senden der Slack-Warnung:', error.message);
  }
}

/**
 * Sendet eine Warnung über eine fehlende E-Mail an Slack
 */
export async function sendEmailTimeoutWarning(
  testName: string,
  emailFilter: string,
  timeoutSeconds: number
): Promise<void> {
  const message = `🚨 *E-MAIL NICHT ANGEKOMMEN* - Timeout nach ${timeoutSeconds}s\n\n` +
    `*Test:* ${testName}\n` +
    `*Erwartete E-Mail:* ${emailFilter}\n` +
    `*Problem:* E-Mail ist nicht innerhalb von ${timeoutSeconds} Sekunden angekommen\n` +
    `*Zeit:* ${new Date().toISOString()}`;
  
  await sendSlackWarning(message);
}

/**
 * Sendet eine Benachrichtigung über einen Test-Fehler an Slack
 */
export async function sendTestFailureNotification(
  testTitle: string,
  errorMessage: string,
  testFile: string,
  retryNumber: number
): Promise<void> {
  // Nur bei PROD Environment Benachrichtigungen senden
  const environment = process.env.TEST_ENVIRONMENT || 'prod';
  if (environment !== 'prod') {
    console.log(`ℹ️  Test-Fehler auf ${environment.toUpperCase()} - keine Slack-Benachrichtigung`);
    return;
  }

  const message = `❌ *TEST FEHLGESCHLAGEN* (nach ${retryNumber} Retry${retryNumber === 1 ? '' : 's'})\n\n` +
    `*Test:* ${testTitle}\n` +
    `*Datei:* ${testFile}\n` +
    `*Environment:* ${environment.toUpperCase()}\n` +
    `*Fehler:* ${errorMessage}\n` +
    `*Zeit:* ${new Date().toISOString()}`;
  
  await sendSlackWarning(message);
}
