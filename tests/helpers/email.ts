import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

interface EmailMessage {
  subject: string;
  body: string;
  receivedDateTime: string;
  from: string;
}

/**
 * E-Mail-Client für Microsoft Graph API
 */
export class EmailClient {
  private client: Client | null = null;
  private mailbox: string;

  constructor() {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.mailbox = process.env.EMAIL_ACCOUNT || 'loyaltytesting@check24.de';

    if (!tenantId || !clientId || !clientSecret) {
      console.warn('⚠️  Azure credentials not configured. 2FA tests will fail.');
      return;
    }

    try {
      // Azure Credentials
      const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

      // Microsoft Graph Client
      this.client = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const token = await credential.getToken('https://graph.microsoft.com/.default');
            return token?.token || '';
          },
        },
      });

      console.log('✅ E-Mail Client initialisiert');
    } catch (error) {
      console.error('❌ Fehler beim Initialisieren des E-Mail Clients:', error);
    }
  }

  /**
   * Neueste E-Mails abrufen
   */
  async getRecentEmails(maxResults = 10): Promise<EmailMessage[]> {
    if (!this.client) {
      throw new Error('E-Mail Client nicht initialisiert');
    }

    try {
      const response = await this.client
        .api(`/users/${this.mailbox}/messages`)
        .top(maxResults)
        .orderby('receivedDateTime DESC')
        .select('subject,body,receivedDateTime,from')
        .get();

      return response.value.map((msg: any) => ({
        subject: msg.subject || '',
        body: msg.body?.content || '',
        receivedDateTime: msg.receivedDateTime,
        from: msg.from?.emailAddress?.address || '',
      }));
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der E-Mails:', error);
      throw error;
    }
  }

  /**
   * Wartet auf eine E-Mail mit bestimmtem Betreff oder Absender
   * @param filter Filterkriterien (subject oder from)
   * @param timeoutMs Timeout in Millisekunden
   * @param checkIntervalMs Prüfintervall in Millisekunden
   */
  async waitForEmail(
    filter: { subject?: string; from?: string },
    timeoutMs = 60000,
    checkIntervalMs = 3000
  ): Promise<EmailMessage | null> {
    if (!this.client) {
      throw new Error('E-Mail Client nicht initialisiert');
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      console.log(`📧 Suche E-Mail mit Filter: ${JSON.stringify(filter)}...`);

      const emails = await this.getRecentEmails(20);

      // Nach Kriterien filtern
      const matchingEmail = emails.find((email) => {
        const emailReceivedTime = new Date(email.receivedDateTime).getTime();
        const isRecent = Date.now() - emailReceivedTime < 120000; // Letzte 2 Minuten

        if (!isRecent) return false;

        if (filter.subject && !email.subject.toLowerCase().includes(filter.subject.toLowerCase())) {
          return false;
        }

        if (filter.from && !email.from.toLowerCase().includes(filter.from.toLowerCase())) {
          return false;
        }

        return true;
      });

      if (matchingEmail) {
        console.log(`✅ E-Mail gefunden: ${matchingEmail.subject}`);
        return matchingEmail;
      }

      console.log(`⏳ E-Mail noch nicht angekommen, warte ${checkIntervalMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    console.error('❌ Timeout: E-Mail nicht gefunden');
    return null;
  }

  /**
   * Extrahiert TAN/OTP Code aus E-Mail
   * Unterstützt gängige Formate:
   * - "Ihr Code: 123456"
   * - "Code: 123456"
   * - "123456 ist Ihr Code"
   * - 6-stellige Zahlen
   */
  extractTanCode(email: EmailMessage): string | null {
    const text = email.body;

    // Verschiedene Muster für TAN-Codes
    const patterns = [
      /(?:code|tan|otp|verification code|bestätigungscode|sicherheitscode)[:\s]+([0-9]{4,8})/gi,
      /([0-9]{6})\s+(?:ist|is)\s+(?:ihr|your|dein)\s+(?:code|tan)/gi,
      /\b([0-9]{6})\b/g, // 6-stellige Zahl (fallback)
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const code = match[1];
        console.log(`✅ TAN-Code extrahiert: ${code}`);
        return code;
      }
    }

    console.warn('⚠️  Kein TAN-Code in E-Mail gefunden');
    console.log('E-Mail Betreff:', email.subject);
    console.log('E-Mail Body (Vorschau):', text.substring(0, 500));
    return null;
  }

  /**
   * Kombinierte Funktion: Wartet auf E-Mail und extrahiert TAN-Code
   */
  async waitForTanCode(
    filter: { subject?: string; from?: string },
    timeoutMs = 60000
  ): Promise<string | null> {
    const email = await this.waitForEmail(filter, timeoutMs);

    if (!email) {
      return null;
    }

    return this.extractTanCode(email);
  }
}

/**
 * Singleton-Instanz für Tests
 */
let emailClientInstance: EmailClient | null = null;

export function getEmailClient(): EmailClient {
  if (!emailClientInstance) {
    emailClientInstance = new EmailClient();
  }
  return emailClientInstance;
}
