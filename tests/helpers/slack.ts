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
  const message = `E-Mail-Timeout in Test "${testName}"\n` +
    `Filter: ${emailFilter}\n` +
    `Timeout: ${timeoutSeconds}s\n` +
    `Timestamp: ${new Date().toISOString()}`;
  
  await sendSlackWarning(message);
}
