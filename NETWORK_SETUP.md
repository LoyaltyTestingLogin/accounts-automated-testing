# Netzwerk-Setup: Testimate im lokalen Netzwerk

Diese Anleitung zeigt, wie du Testimate auf einem Server-Rechner installierst und von anderen Rechnern im gleichen Netzwerk darauf zugreifen kannst.

## 🎯 Ziel
- **Server-Rechner**: Läuft 24/7, hostet Testimate
- **Client-Rechner**: Greifen über Browser auf die Weboberfläche zu (keine Installation nötig)

---

## 📋 Setup auf dem Server-Rechner

### 1. Server-IP-Adresse ermitteln

**macOS/Linux:**
```bash
ifconfig | grep "inet "
# oder
hostname -I
```

**Windows:**
```bash
ipconfig
```

Beispiel: `192.168.1.100`

### 2. Environment-Variablen konfigurieren

Bearbeite die `.env` Datei auf dem Server:

```bash
# API-Server Host (0.0.0.0 = alle Netzwerk-Interfaces)
API_HOST=0.0.0.0
API_PORT=4000

# Next.js Frontend Host (für API-Proxy)
# Bei lokalem Setup: localhost
# Bei Netzwerk-Setup: Server-IP-Adresse
NEXT_PUBLIC_API_HOST=localhost

# Optional: Dashboard Base URL für Slack-Links
DASHBOARD_BASE_URL=http://192.168.1.100:3000
```

**Wichtig:** 
- `API_HOST=0.0.0.0` macht den Server im Netzwerk erreichbar
- `NEXT_PUBLIC_API_HOST=localhost` funktioniert, weil Next.js als Proxy fungiert

### 3. Firewall konfigurieren

Erlaube eingehende Verbindungen auf Port 3000 und 4000:

**macOS:**
```bash
# Firewall-Regel hinzufügen (falls Firewall aktiv ist)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

**Linux (ufw):**
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 4000/tcp
sudo ufw reload
```

**Windows:**
```powershell
# Windows Defender Firewall Regel
New-NetFirewallRule -DisplayName "Testimate Web" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Testimate API" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

### 4. Server starten

```bash
npm run dev
# oder für Production:
npm run build:web
npm run start:web &
npm run start:api &
npm run start:worker &
```

### 5. Verbindung testen

Auf dem **Server-Rechner** selbst:
```bash
curl http://localhost:4000/api/health
```

Von einem **anderen Rechner** im Netzwerk:
```bash
curl http://192.168.1.100:4000/api/health
```

Sollte antworten:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123
}
```

---

## 💻 Zugriff von Client-Rechnern

### Web-Browser öffnen

Von jedem Rechner im gleichen Netzwerk:

```
http://192.168.1.100:3000
```

Ersetze `192.168.1.100` mit der tatsächlichen IP-Adresse deines Server-Rechners.

**Das war's!** Keine Installation auf dem Client-Rechner nötig. Nur ein moderner Browser (Chrome, Firefox, Safari, Edge).

---

## 🔧 Troubleshooting

### Problem: "Connection refused" oder Seite lädt nicht

**1. Überprüfe, ob Server läuft:**
```bash
# Auf dem Server-Rechner:
ps aux | grep node
netstat -an | grep 3000
netstat -an | grep 4000
```

**2. Überprüfe Firewall:**
```bash
# Teste von Client-Rechner:
telnet 192.168.1.100 3000
# Sollte verbinden, drücke Ctrl+C zum Beenden
```

**3. Überprüfe Netzwerk:**
```bash
# Ping vom Client zum Server:
ping 192.168.1.100
```

**4. Überprüfe Browser-Konsole:**
- Öffne F12 / Developer Tools
- Schaue unter "Network" oder "Console" nach Fehlern

### Problem: "API calls failing" / CORS-Fehler

Falls direkte API-Calls von außen nötig sind, ist CORS bereits konfiguriert (siehe `src/api/server.ts`).

Wenn CORS-Fehler auftreten, überprüfe die `NEXT_PUBLIC_API_HOST` Variable.

### Problem: Live-Logging funktioniert nicht

Server-Sent Events (SSE) müssen durch das Netzwerk funktionieren. Stelle sicher:
1. Keine Proxy/VPN dazwischen
2. Firewall erlaubt persistente Verbindungen
3. Browser unterstützt SSE (alle modernen Browser tun das)

---

## 🐳 Alternative: Docker Setup

Für einfacheres Deployment kannst du auch Docker verwenden:

```bash
# Auf dem Server-Rechner:
docker-compose up -d
```

Die Ports 3000 und 4000 werden automatisch exponiert.

**Hinweis:** Docker-Setup ist bereits vorbereitet (`docker-compose.yml` vorhanden).

---

## 📱 Zugriff von außerhalb des Netzwerks (optional)

Um von überall (Internet) zugreifen zu können:

### Option 1: Port-Forwarding im Router
1. Router-Admin-Interface öffnen (z.B. `192.168.1.1`)
2. Port-Forwarding einrichten:
   - Extern Port 3000 → Server-IP:3000
   - Extern Port 4000 → Server-IP:4000
3. Deine öffentliche IP ermitteln: `curl ifconfig.me`
4. Zugriff über: `http://DEINE-ÖFFENTLICHE-IP:3000`

⚠️ **Sicherheitshinweis:** Bei öffentlichem Zugriff solltest du:
- HTTPS/SSL verwenden (z.B. mit Nginx + Let's Encrypt)
- Authentifizierung hinzufügen
- Firewall-Regeln einschränken

### Option 2: VPN
- Verwende Tailscale, WireGuard oder einen anderen VPN-Dienst
- Greife sicher auf dein Heimnetzwerk zu
- Keine Router-Konfiguration nötig

### Option 3: Ngrok (für temporären Zugriff)
```bash
# Auf dem Server:
ngrok http 3000
# Gibt eine öffentliche URL aus: https://abc123.ngrok.io
```

---

## ✅ Zusammenfassung

**Auf dem Server:**
1. `.env` mit `API_HOST=0.0.0.0` konfigurieren
2. Firewall Ports 3000 und 4000 öffnen
3. `npm run dev` oder `docker-compose up -d`
4. Server-IP notieren (z.B. `192.168.1.100`)

**Auf Client-Rechnern:**
1. Browser öffnen
2. `http://SERVER-IP:3000` aufrufen
3. Tests starten und zuschauen! 🎉

Keine Installation, keine Konfiguration nötig!
