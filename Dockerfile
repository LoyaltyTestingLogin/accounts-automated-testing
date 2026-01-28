# CHECK24 Login Testing - Dockerfile
FROM node:20-bullseye

# Arbeitsverzeichnis
WORKDIR /app

# System-Dependencies für Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcursor1 \
    libxi6 \
    libxtst6 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Package-Dateien kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm install

# Playwright-Browser installieren
RUN npx playwright install chromium

# Projekt-Dateien kopieren
COPY . .

# Next.js Build
RUN npm run build:web

# Daten-Verzeichnis erstellen
RUN mkdir -p /app/data /app/test-results

# Port freigeben
EXPOSE 3000
EXPOSE 4000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start-Script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
