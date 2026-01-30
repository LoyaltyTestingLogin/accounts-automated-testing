import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Playwright Test Konfiguration für CHECK24 Login E2E Tests
 */
export default defineConfig({
  testDir: './tests',
  
  // Maximale Zeit für einen Test
  timeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
  
  // Expect-Timeouts
  expect: {
    timeout: 5000,
  },
  
  // Parallele Ausführung
  fullyParallel: false,
  workers: 1, // Seriell für Login-Tests
  
  // Retry bei Fehlschlag
  retries: process.env.CI ? 2 : 1,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  
  // Artefakte-Ordner
  outputDir: 'test-results/artifacts',
  
  use: {
    // Keine baseURL, da wir die vollständige URL mit Parametern direkt in den Tests verwenden
    // baseURL: wird nicht gesetzt
    
    // Browser-Kontext
    viewport: { width: 1920, height: 1080 },
    
    // Screenshots
    screenshot: (process.env.PLAYWRIGHT_SCREENSHOT as 'on' | 'off' | 'only-on-failure') || 'only-on-failure',
    
    // Video
    video: process.env.PLAYWRIGHT_VIDEO === 'true' ? 'retain-on-failure' : 'off',
    
    // Trace bei Fehlschlag
    trace: 'retain-on-failure',
    
    // Timeouts
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '60000'),
    actionTimeout: 10000,
    
    // Locale
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Headed mode für Live-Ansicht optional
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        // Verlangsamung für bessere Sichtbarkeit (500ms zwischen Aktionen)
        // Macht Tests langsamer, aber man kann alles sehen
        slowMo: 500,
        // Browser-Launch-Optionen
        launchOptions: {
          // Browser auf rechten 2/3 positionieren (für Live-Monitoring)
          // Wird nur aktiviert wenn BROWSER_POSITION=right gesetzt ist
          args: process.env.BROWSER_POSITION === 'right' ? [
            // Annahme: 1920x1080 Bildschirm (oder höher)
            // Log nimmt 1/3 (640px), Browser nimmt 2/3 (1280px)
            '--window-size=1280,2000',   // 2/3 der Bildschirmbreite, große Höhe (wird automatisch angepasst)
            '--window-position=640,0',   // Beginnt nach dem Log-Fenster (1/3)
            '--disable-infobars',        // Entfernt Info-Leisten für mehr Platz
          ] : [],
        },
      },
    },
    
    // Weitere Browser können später hinzugefügt werden:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Webserver für lokale Tests (optional)
  // webServer: {
  //   command: 'npm run start:web',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
