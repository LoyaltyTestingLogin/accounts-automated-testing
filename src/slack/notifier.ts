import axios from 'axios';
import { TestRun } from '../database/schema';
import { SLACK_CONFIG } from '../config/slack';

/**
 * Slack-Integration für Test-Benachrichtigungen
 */

export interface SlackNotificationOptions {
  testRun: TestRun;
  dashboardUrl?: string;
}

export class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    // Priorität: 1. Parameter, 2. Config-Datei, 3. ENV-Variable (Fallback)
    this.webhookUrl = webhookUrl || SLACK_CONFIG.webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
    
    if (!this.webhookUrl) {
      console.warn('⚠️  Slack Webhook URL nicht konfiguriert - Benachrichtigungen deaktiviert');
      console.warn('⚠️  Setze die URL in src/config/slack.ts');
    }
  }

  /**
   * Sendet eine Benachrichtigung über einen fehlgeschlagenen Test
   */
  async notifyTestFailure(options: SlackNotificationOptions): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('Slack-Benachrichtigung übersprungen (keine Webhook-URL)');
      return false;
    }

    const { testRun, dashboardUrl } = options;
    
    try {
      const message = this.buildFailureMessage(testRun, dashboardUrl);
      
      await axios.post(this.webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log(`✅ Slack-Benachrichtigung gesendet für Test: ${testRun.testName}`);
      return true;
    } catch (error) {
      console.error('❌ Fehler beim Senden der Slack-Benachrichtigung:', error);
      return false;
    }
  }

  /**
   * Sendet eine Benachrichtigung über einen Timeout
   */
  async notifyTestTimeout(options: SlackNotificationOptions): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('Slack-Benachrichtigung übersprungen (keine Webhook-URL)');
      return false;
    }

    const { testRun, dashboardUrl } = options;
    
    try {
      const message = this.buildTimeoutMessage(testRun, dashboardUrl);
      
      await axios.post(this.webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log(`⚠️  Slack-Timeout-Benachrichtigung gesendet für Test: ${testRun.testName}`);
      return true;
    } catch (error) {
      console.error('❌ Fehler beim Senden der Slack-Benachrichtigung:', error);
      return false;
    }
  }

  /**
   * Sendet eine Benachrichtigung über einen erfolgreichen Test
   * (Optional, normalerweise nur bei Wiederherstellung nach Fehler)
   */
  async notifyTestRecovery(options: SlackNotificationOptions): Promise<boolean> {
    if (!this.webhookUrl) return false;

    const { testRun, dashboardUrl } = options;
    
    try {
      const message = this.buildRecoveryMessage(testRun, dashboardUrl);
      
      await axios.post(this.webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log(`✅ Slack-Recovery-Benachrichtigung gesendet für Test: ${testRun.testName}`);
      return true;
    } catch (error) {
      console.error('❌ Fehler beim Senden der Slack-Benachrichtigung:', error);
      return false;
    }
  }

  /**
   * Erstellt Slack-Message für Testfehler
   */
  private buildFailureMessage(testRun: TestRun, dashboardUrl?: string) {
    const baseUrl = dashboardUrl || SLACK_CONFIG.dashboardUrl;
    const detailUrl = `${baseUrl}/test-runs/${testRun.id}`;
    
    const duration = testRun.duration ? `${(testRun.duration / 1000).toFixed(2)}s` : 'N/A';
    
    return {
      text: `<!channel> 🚨 CHECK24 Login E2E Test FAILED`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '<!channel> *Wichtig:* Ein automatischer Login-Test ist fehlgeschlagen!',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Login E2E Test FAILED',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Test:*\n${testRun.testName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Suite:*\n${testRun.testSuite}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n❌ Failed`,
            },
            {
              type: 'mrkdwn',
              text: `*Dauer:*\n${duration}`,
            },
            {
              type: 'mrkdwn',
              text: `*Zeitpunkt:*\n${new Date(testRun.startTime).toLocaleString('de-DE')}`,
            },
            {
              type: 'mrkdwn',
              text: `*Trigger:*\n${testRun.triggeredBy === 'scheduled' ? '⏰ Automatisch' : '👤 Manuell'}`,
            },
          ],
        },
        ...(this.getTestDescription(testRun.testName) ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Test-Details:*\n${this.getTestDescription(testRun.testName)}`,
            },
          },
        ] : []),
        ...(testRun.errorMessage ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Fehlermeldung:*\n\`\`\`${this.truncateText(testRun.errorMessage, 2000)}\`\`\``,
            },
          },
        ] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Verfügbare Artefakte:*\n${this.getArtifactsText(testRun)}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 Details anzeigen',
                emoji: true,
              },
              url: detailUrl,
              style: 'primary',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test-ID: #${testRun.id} | CHECK24 Login Testing System`,
            },
          ],
        },
      ],
    };
  }

  /**
   * Erstellt Slack-Message für Test-Timeout
   */
  private buildTimeoutMessage(testRun: TestRun, dashboardUrl?: string) {
    const baseUrl = dashboardUrl || SLACK_CONFIG.dashboardUrl;
    const detailUrl = `${baseUrl}/test-runs/${testRun.id}`;
    
    const duration = testRun.duration ? `${(testRun.duration / 1000).toFixed(2)}s` : 'N/A';
    
    return {
      text: `⚠️ CHECK24 Login E2E Test TIMEOUT`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Warnung:* Ein automatischer Login-Test hat ungewöhnlich lange gedauert.',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Test dauert zu lange',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Test:*\n${testRun.testName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Suite:*\n${testRun.testSuite}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n⏱️ Timeout`,
            },
            {
              type: 'mrkdwn',
              text: `*Dauer:*\n${duration}`,
            },
            {
              type: 'mrkdwn',
              text: `*Zeitpunkt:*\n${new Date(testRun.startTime).toLocaleString('de-DE')}`,
            },
            {
              type: 'mrkdwn',
              text: `*Trigger:*\n${testRun.triggeredBy === 'scheduled' ? '⏰ Automatisch' : '👤 Manuell'}`,
            },
          ],
        },
        ...(this.getTestDescription(testRun.testName) ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Test-Details:*\n${this.getTestDescription(testRun.testName)}`,
            },
          },
        ] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*ℹ️ Hinweis:*\nDer Test ist möglicherweise nicht fehlgeschlagen, aber die Ausführung hat länger gedauert als erwartet. Dies könnte auf Performance-Probleme oder langsame Netzwerkverbindungen hinweisen.',
          },
        },
        ...(testRun.errorMessage ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Details:*\n\`\`\`${this.truncateText(testRun.errorMessage, 2000)}\`\`\``,
            },
          },
        ] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Verfügbare Artefakte:*\n${this.getArtifactsText(testRun)}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 Details anzeigen',
                emoji: true,
              },
              url: detailUrl,
              style: 'primary',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test-ID: #${testRun.id} | CHECK24 Login Testing System`,
            },
          ],
        },
      ],
    };
  }

  /**
   * Erstellt Slack-Message für Test-Wiederherstellung
   */
  private buildRecoveryMessage(testRun: TestRun, dashboardUrl?: string) {
    const baseUrl = dashboardUrl || SLACK_CONFIG.dashboardUrl;
    const detailUrl = `${baseUrl}/test-runs/${testRun.id}`;
    
    const duration = testRun.duration ? `${(testRun.duration / 1000).toFixed(2)}s` : 'N/A';
    
    return {
      text: `✅ CHECK24 Login E2E Test RECOVERED`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ Login E2E Test wieder erfolgreich',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Test:*\n${testRun.testName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n✅ Passed`,
            },
            {
              type: 'mrkdwn',
              text: `*Dauer:*\n${duration}`,
            },
            {
              type: 'mrkdwn',
              text: `*Zeitpunkt:*\n${new Date(testRun.startTime).toLocaleString('de-DE')}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 Details anzeigen',
                emoji: true,
              },
              url: detailUrl,
            },
          ],
        },
      ],
    };
  }

  /**
   * Hilfsfunktion: Test-Beschreibung basierend auf Test-Namen ermitteln
   */
  private getTestDescription(testName: string): string | null {
    const descriptions: Record<string, string> = {
      'Login - Passwort Login inklusive Login Challenge': 
        'Vollständiger Passwort Login-Flow inklusive Testing vollständiger Login Challenge\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n• Test 2: Combined Account (TAN per E-Mail)\n• Test 3: Combined Account (TAN per SMS)',
      'Login - OTP (Einmalcode) Login': 
        'Vollständiger OTP Login-Flow mit Einmalcode statt Passwort\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n• Test 2: Combined Account (TAN per E-Mail)\n• Test 3: Combined Account (TAN per SMS)',
      'Login - Passwort Reset': 
        'Vollständiger Passwort-Reset Flow mit TAN-Verifizierung\n\n• Test 1: E-Mail only Account (TAN per E-Mail + Phone Collector)\n• Test 2: Combined Account (TAN per E-Mail)\n• Test 3: Combined Account (TAN per SMS)',
      'Registrierung - E-Mail Registrierung': 
        'Vollständiger E-Mail-Registrierungs-Flow\n\n• E-Mail eingeben\n• Passwort wählen\n• TAN-Verifizierung per E-Mail\n• Registrierung abschließen\n• Konto automatisch löschen',
      'Registrierung - Phone Registrierung': 
        'Vollständiger Phone-Registrierungs-Flow\n\n• Phone eingeben\n• E-Mail & Passwort wählen\n• TAN-Verifizierung per E-Mail\n• TAN-Verifizierung per SMS\n• Registrierung abschließen\n• Konto automatisch löschen',
    };
    
    return descriptions[testName] || null;
  }

  /**
   * Hilfsfunktion: Artefakte-Text erstellen
   */
  private getArtifactsText(testRun: TestRun): string {
    const artifacts: string[] = [];
    
    if (testRun.screenshotPath) artifacts.push('📸 Screenshot');
    if (testRun.videoPath) artifacts.push('🎥 Video');
    if (testRun.tracePath) artifacts.push('🔍 Trace');
    
    return artifacts.length > 0 ? artifacts.join(' • ') : 'Keine Artefakte verfügbar';
  }

  /**
   * Hilfsfunktion: Text kürzen
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Testet die Slack-Verbindung
   */
  async testConnection(): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('❌ Keine Slack-Webhook-URL konfiguriert');
      return false;
    }

    try {
      await axios.post(this.webhookUrl, {
        text: '✅ CHECK24 Login Testing System - Verbindungstest erfolgreich',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *Slack-Integration erfolgreich eingerichtet*\n\nDas CHECK24 Login Testing System ist bereit, Benachrichtigungen zu senden.',
            },
          },
        ],
      });

      console.log('✅ Slack-Verbindung erfolgreich getestet');
      return true;
    } catch (error) {
      console.error('❌ Slack-Verbindungstest fehlgeschlagen:', error);
      return false;
    }
  }
}

// Singleton-Instanz
let notifierInstance: SlackNotifier | null = null;

export function getSlackNotifier(): SlackNotifier {
  if (!notifierInstance) {
    notifierInstance = new SlackNotifier();
  }
  return notifierInstance;
}
