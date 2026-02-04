# Configuration

Diese Konfigurationsdateien können sicher ins Git-Repository committed werden.

## Slack-Konfiguration (`slack.ts`)

### Webhook URL einrichten

1. Gehe zu https://api.slack.com/apps
2. Erstelle eine neue App oder wähle eine bestehende aus
3. Aktiviere "Incoming Webhooks"
4. Erstelle einen neuen Webhook für deinen gewünschten Channel
5. Kopiere die Webhook URL
6. Füge sie in `src/config/slack.ts` ein:

```typescript
export const SLACK_CONFIG = {
  webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
  dashboardUrl: 'https://your-dashboard-url.com',
};
```

### Test-Benachrichtigungen

Wenn die Webhook URL konfiguriert ist, werden automatisch Slack-Benachrichtigungen gesendet bei:

- ❌ **Fehlgeschlagenen Tests** mit Details und Link
- ⏰ **Timeout Tests** mit Grund
- ✅ **Recovery** (wenn Test wieder funktioniert nach Fehler)

Jede Benachrichtigung enthält:
- Test-Name und Suite
- Status und Dauer
- Fehlermeldung
- Link zu Screenshots/Videos/Traces
- Button "📊 Details anzeigen" → Link zur Detail-Seite

### Priorität der Konfiguration

1. Parameter beim Aufruf
2. `SLACK_CONFIG` in `slack.ts` (empfohlen)
3. ENV-Variable `SLACK_WEBHOOK_URL` (Fallback)
