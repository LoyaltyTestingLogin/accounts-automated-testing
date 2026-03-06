import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper für automatische Screenshot-Erstellung während Tests
 * Screenshots werden zunächst in einem temp-Ordner gespeichert und nur bei
 * erfolgreichem Test ins finale Verzeichnis kopiert.
 */

export interface ScreenshotConfig {
  flowName: string;  // z.B. 'login-password', 'email-registration'
  enabled: boolean;  // Ob Screenshots gemacht werden sollen
  tempDir: string;   // Temporäres Verzeichnis für Screenshots
  finalDir: string;  // Finales Verzeichnis für Screenshots
}

let currentConfig: ScreenshotConfig | null = null;
let screenshotCounter = 1;

/**
 * Aktiviert automatische Screenshots für einen Flow
 * Screenshots werden zunächst in einem temp-Ordner gespeichert
 */
export function enableAutoScreenshots(flowName: string) {
  const tempDir = path.join(process.cwd(), '.screenshots-temp', flowName);
  const finalDir = path.join(process.cwd(), 'public', 'flow-screenshots', flowName);
  
  currentConfig = {
    flowName,
    enabled: true,
    tempDir,
    finalDir
  };
  screenshotCounter = 1;
  
  // Lösche alte temp-Screenshots falls vorhanden
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  // Erstelle temp-Verzeichnis
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log(`📸 Auto-Screenshots aktiviert für Flow: ${flowName}`);
  console.log(`   Temp-Ordner: ${tempDir}`);
}

/**
 * Übernimmt die Screenshots aus dem temp-Ordner ins finale Verzeichnis
 * NUR aufrufen wenn der Test erfolgreich war!
 */
export function commitScreenshots() {
  if (!currentConfig) {
    console.log('⚠️  Keine Screenshots zu committen (nicht aktiviert)');
    return;
  }
  
  try {
    const { tempDir, finalDir, flowName } = currentConfig;
    
    if (!fs.existsSync(tempDir)) {
      console.log('⚠️  Temp-Ordner existiert nicht - keine Screenshots zu committen');
      return;
    }
    
    // Erstelle finales Verzeichnis falls nicht vorhanden
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    
    // Kopiere alle Screenshots vom temp-Ordner ins finale Verzeichnis
    const files = fs.readdirSync(tempDir);
    let copiedCount = 0;
    
    for (const file of files) {
      const tempFile = path.join(tempDir, file);
      const finalFile = path.join(finalDir, file);
      
      fs.copyFileSync(tempFile, finalFile);
      copiedCount++;
    }
    
    console.log(`✅ ${copiedCount} Screenshots übernommen für Flow: ${flowName}`);
    
    // Lösche temp-Ordner
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('❌ Fehler beim Übernehmen der Screenshots:', error);
  }
}

/**
 * Verwirft die Screenshots aus dem temp-Ordner
 * Wird aufgerufen wenn der Test fehlschlägt
 */
export function discardScreenshots() {
  if (!currentConfig) {
    return;
  }
  
  try {
    const { tempDir, flowName } = currentConfig;
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`🗑️  Screenshots verworfen für Flow: ${flowName} (Test fehlgeschlagen)`);
    }
  } catch (error) {
    console.error('⚠️  Fehler beim Verwerfen der Screenshots:', error);
  }
}

/**
 * Deaktiviert automatische Screenshots und räumt auf
 */
export function disableAutoScreenshots() {
  if (currentConfig) {
    // Lösche temp-Ordner falls noch vorhanden
    if (fs.existsSync(currentConfig.tempDir)) {
      fs.rmSync(currentConfig.tempDir, { recursive: true, force: true });
    }
    console.log(`📸 Auto-Screenshots deaktiviert für Flow: ${currentConfig.flowName}`);
  }
  currentConfig = null;
  screenshotCounter = 1;
}

/**
 * Macht einen Screenshot wenn Auto-Screenshots aktiviert sind
 * Screenshots werden im temp-Ordner gespeichert
 */
export async function takeAutoScreenshot(
  page: Page, 
  description: string,
  filename?: string
): Promise<void> {
  if (!currentConfig || !currentConfig.enabled) {
    return; // Screenshots nicht aktiviert
  }
  
  try {
    // Warte kurz für Stabilität
    await page.waitForTimeout(500);
    
    // Generiere Filename wenn nicht angegeben
    const finalFilename = filename || `${String(screenshotCounter).padStart(2, '0')}-${slugify(description)}.png`;
    
    // Speichere im TEMP-Ordner
    const screenshotPath = path.join(
      currentConfig.tempDir,
      finalFilename
    );
    
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`📸 Screenshot ${screenshotCounter}: ${description}`);
    screenshotCounter++;
  } catch (error) {
    console.error(`⚠️  Screenshot fehlgeschlagen für "${description}":`, error);
  }
}

/**
 * Hilfsfunktion: Konvertiert Text zu Slug (für Filenames)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Prüft ob Auto-Screenshots aktiviert sind
 */
export function isAutoScreenshotsEnabled(): boolean {
  return currentConfig !== null && currentConfig.enabled;
}

/**
 * Gibt die aktuelle Screenshot-Konfiguration zurück
 */
export function getAutoScreenshotConfig(): ScreenshotConfig | null {
  return currentConfig;
}
