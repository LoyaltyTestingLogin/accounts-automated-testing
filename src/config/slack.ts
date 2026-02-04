/**
 * Slack-Konfiguration für Test-Benachrichtigungen
 * Diese Datei kann ins Git-Repository committed werden
 */

export const SLACK_CONFIG = {
  // Slack Webhook URL für Test-Benachrichtigungen
  // Wenn leer, sind Slack-Benachrichtigungen deaktiviert
  webhookUrl: '',
  
  // Dashboard-Base-URL für Links in Slack-Nachrichten
  dashboardUrl: process.env.DASHBOARD_BASE_URL || 'http://localhost:3000',
};

/**
 * Beispiel Webhook URL:
 * webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX'
 * 
 * Um eine Webhook URL zu erstellen:
 * 1. Gehe zu https://api.slack.com/apps
 * 2. Erstelle eine neue App oder wähle eine bestehende aus
 * 3. Aktiviere "Incoming Webhooks"
 * 4. Erstelle einen neuen Webhook für deinen gewünschten Channel
 * 5. Kopiere die Webhook URL hierher
 */
