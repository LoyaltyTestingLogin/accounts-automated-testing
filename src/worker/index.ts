import cron from 'node-cron';
import dotenv from 'dotenv';
import { getPlaywrightRunner } from '../runner/playwright-runner';
import { getDatabase } from '../database/schema';

dotenv.config();

/**
 * 24/7 Test-Scheduler Worker
 * Führt automatisch in konfigurierbaren Intervallen E2E-Tests aus
 */

export class TestScheduler {
  private runner = getPlaywrightRunner();
  private db = getDatabase();
  private isRunning = false;
  private cronJobProd: cron.ScheduledTask | null = null;
  private cronJobTest: cron.ScheduledTask | null = null;
  private isPausedProd = false;
  private isPausedTest = false;
  private currentIntervalMinutes = 15;

  constructor() {
    console.log('🤖 Test-Scheduler initialisiert');
  }

  /**
   * Pausiert den Scheduler für eine Environment
   */
  pause(environment: 'prod' | 'test' = 'prod') {
    const currentlyPaused = this.db.isSchedulerPaused(environment);
    if (currentlyPaused) {
      console.log(`⏸️  Scheduler für ${environment.toUpperCase()} ist bereits pausiert`);
      return false;
    }
    
    this.db.setSchedulerPaused(true, environment);
    if (environment === 'prod') {
      this.isPausedProd = true;
    } else {
      this.isPausedTest = true;
    }
    console.log(`⏸️  Scheduler für ${environment.toUpperCase()} pausiert - automatische Tests gestoppt`);
    return true;
  }

  /**
   * Setzt den Scheduler für eine Environment fort
   */
  resume(environment: 'prod' | 'test' = 'prod') {
    const currentlyPaused = this.db.isSchedulerPaused(environment);
    if (!currentlyPaused) {
      console.log(`▶️  Scheduler für ${environment.toUpperCase()} läuft bereits`);
      return false;
    }
    
    this.db.setSchedulerPaused(false, environment);
    if (environment === 'prod') {
      this.isPausedProd = false;
    } else {
      this.isPausedTest = false;
    }
    console.log(`▶️  Scheduler für ${environment.toUpperCase()} fortgesetzt - automatische Tests laufen wieder`);
    return true;
  }

  /**
   * Gibt den aktuellen Status zurück
   */
  getStatus() {
    const isPausedProd = this.db.isSchedulerPaused('prod');
    const isPausedTest = this.db.isSchedulerPaused('test');
    this.isPausedProd = isPausedProd; // Sync Memory-State mit DB
    this.isPausedTest = isPausedTest;
    
    return {
      isPausedProd,
      isPausedTest,
      isRunning: this.isRunning,
      intervalMinutes: this.currentIntervalMinutes,
      cronExpression: this.cronJobProd ? this.getCronExpression(this.currentIntervalMinutes) : null,
    };
  }

  /**
   * Startet den Scheduler
   */
  start() {
    // Lese Intervall aus Datenbank (oder verwende Fallback aus ENV)
    let intervalMinutes = this.db.getSchedulerInterval();
    
    // Fallback auf ENV wenn DB leer
    if (!intervalMinutes) {
      intervalMinutes = parseInt(process.env.TEST_INTERVAL_MINUTES || '15');
      this.db.setSchedulerInterval(intervalMinutes);
    }
    
    this.currentIntervalMinutes = intervalMinutes;
    
    console.log(`⏰ Starte 24/7 Monitoring mit ${intervalMinutes}-Minuten-Intervall`);

    // Cron-Expression erstellen: Alle X Minuten
    const cronExpression = this.getCronExpression(intervalMinutes);
    
    console.log(`📅 Cron-Expression: ${cronExpression}`);

    // Cron-Job für PROD erstellen
    this.cronJobProd = cron.schedule(cronExpression, async () => {
      await this.executeScheduledTests('prod');
    });

    // Cron-Job für TEST erstellen (gleiche Expression)
    this.cronJobTest = cron.schedule(cronExpression, async () => {
      await this.executeScheduledTests('test');
    });

    console.log('✅ Scheduler gestartet (PROD & TEST)');

    // Optional: Ersten Test sofort ausführen
    if (process.env.RUN_TESTS_ON_STARTUP === 'true') {
      console.log('🚀 Führe initialen Test-Durchlauf aus...');
      setTimeout(() => {
        this.executeScheduledTests('prod');
        this.executeScheduledTests('test');
      }, 5000); // Nach 5 Sekunden
    }
  }

  /**
   * Aktualisiert das Intervall und startet den Cron-Job neu
   */
  updateInterval(intervalMinutes: number) {
    console.log(`🔄 Ändere Scheduler-Intervall von ${this.currentIntervalMinutes} auf ${intervalMinutes} Minuten`);
    
    // Stoppe aktuellen Cron-Job
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Alter Cron-Job gestoppt');
    }
    
    // Aktualisiere Intervall
    this.currentIntervalMinutes = intervalMinutes;
    
    // Erstelle neuen Cron-Job mit neuem Intervall
    const cronExpression = this.getCronExpression(intervalMinutes);
    console.log(`📅 Neue Cron-Expression: ${cronExpression}`);
    
    this.cronJobProd = cron.schedule(cronExpression, async () => {
      await this.executeScheduledTests('prod');
    });
    
    this.cronJobTest = cron.schedule(cronExpression, async () => {
      await this.executeScheduledTests('test');
    });
    
    console.log(`✅ Scheduler neu gestartet mit ${intervalMinutes}-Minuten-Intervall (PROD & TEST)`);
  }

  /**
   * Stoppt den Scheduler
   */
  stop() {
    if (this.cronJobProd) {
      this.cronJobProd.stop();
    }
    if (this.cronJobTest) {
      this.cronJobTest.stop();
    }
    console.log('⏹️  Scheduler gestoppt (PROD & TEST)');
  }

  /**
   * Führt geplante Tests aus
   */
  private async executeScheduledTests(environment: 'prod' | 'test' = 'prod') {
    // Prüfe Pause-Status aus Datenbank (für Prozess-übergreifende Kommunikation)
    const isPaused = this.db.isSchedulerPaused(environment);
    if (isPaused) {
      console.log(`⏸️  Scheduler für ${environment.toUpperCase()} ist pausiert, überspringe Test-Durchlauf`);
      return;
    }

    // Prüfe, ob gerade manuelle Tests laufen
    const hasManualTests = this.db.hasRunningManualTests();
    if (hasManualTests) {
      console.log('👤 Manuelle Tests laufen gerade, überspringe automatischen Test-Durchlauf');
      return;
    }

    if (this.isRunning) {
      console.log('⏭️  Test läuft bereits, überspringe diesen Durchlauf');
      return;
    }

    this.isRunning = true;

    try {
      console.log('\n' + '='.repeat(80));
      console.log(`🔄 Automatischer Test-Durchlauf (${environment.toUpperCase()}): ${new Date().toLocaleString('de-DE')}`);
      console.log('='.repeat(80) + '\n');

      // Alle Login-Tests ausführen
      const results = await this.runner.runTests({
        testPath: 'tests/login',
        triggeredBy: 'scheduled',
        headed: false,
        environment,
      });

      // Zusammenfassung loggen
      const passed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('\n' + '='.repeat(80));
      console.log(`📊 Durchlauf abgeschlossen: ${passed} erfolgreich, ${failed} fehlgeschlagen`);
      console.log('='.repeat(80) + '\n');

      // Statistiken abrufen
      this.logStatistics();

    } catch (error) {
      console.error('❌ Fehler beim automatischen Test-Durchlauf:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Erstellt Cron-Expression basierend auf Intervall in Minuten
   */
  private getCronExpression(intervalMinutes: number): string {
    if (intervalMinutes <= 0 || intervalMinutes > 1440) {
      console.warn(`⚠️  Ungültiges Intervall ${intervalMinutes}, verwende 15 Minuten`);
      intervalMinutes = 15;
    }

    // Für Intervalle die 60 teilen (5, 10, 15, 20, 30, 60)
    if (60 % intervalMinutes === 0) {
      return `*/${intervalMinutes} * * * *`;
    }

    // Für andere Intervalle: Jede Minute prüfen (nicht optimal, aber funktional)
    // In Produktion sollte man hier eine bessere Lösung verwenden
    console.warn(`⚠️  Intervall ${intervalMinutes} ist nicht ideal für Cron, verwende */15`);
    return `*/15 * * * *`;
  }

  /**
   * Loggt Statistiken
   */
  private logStatistics() {
    const stats = this.db.getStatistics();
    
    console.log('\n📈 Statistiken (letzte 7 Tage):');
    console.log(`   Total: ${stats.total}`);
    console.log(`   ✅ Erfolgreich: ${stats.passed}`);
    console.log(`   ❌ Fehlgeschlagen: ${stats.failed}`);
    console.log(`   ⏱️  Ø Dauer: ${stats.avgDuration ? (stats.avgDuration / 1000).toFixed(2) + 's' : 'N/A'}`);
    console.log();
  }

  /**
   * Cleanup: Alte Test-Runs löschen
   */
  async cleanup(daysToKeep = 4) {
    console.log('\n' + '='.repeat(80));
    console.log(`🧹 Starte automatischen Cleanup: ${new Date().toLocaleString('de-DE')}`);
    console.log(`   Lösche Test-Runs älter als ${daysToKeep} Tage...`);
    console.log('='.repeat(80) + '\n');
    
    const deletedCount = this.db.cleanupOldRuns(daysToKeep);
    
    if (deletedCount > 0) {
      console.log(`✅ ${deletedCount} alte Test-Run(s) erfolgreich gelöscht\n`);
    } else {
      console.log('✅ Keine alten Test-Runs zum Löschen gefunden\n');
    }
  }
}

// Globale Scheduler-Instanz für externe Zugriffe (z.B. API)
let globalScheduler: TestScheduler | null = null;

export function getScheduler(): TestScheduler | null {
  return globalScheduler;
}

/**
 * Benachrichtigt den Worker über eine Intervall-Änderung
 * Wird vom API-Server aufgerufen
 */
export async function notifyIntervalChange(intervalMinutes: number): Promise<void> {
  if (globalScheduler) {
    globalScheduler.updateInterval(intervalMinutes);
    console.log(`✅ Worker über Intervall-Änderung benachrichtigt: ${intervalMinutes} Minuten`);
  } else {
    console.warn('⚠️  Kein globaler Scheduler vorhanden - Intervall wird beim nächsten Start übernommen');
  }
}

// Hauptfunktion
async function main() {
  console.log('🚀 CHECK24 Login Testing - 24/7 Worker');
  console.log('=========================================\n');

  const scheduler = new TestScheduler();
  globalScheduler = scheduler;
  scheduler.start();

  // Cleanup jeden Tag um 3 Uhr (löscht alte Test-Runs)
  const cleanupDays = parseInt(process.env.CLEANUP_DAYS || '4');
  cron.schedule('0 3 * * *', async () => {
    await scheduler.cleanup(cleanupDays);
  });
  
  console.log(`🧹 Automatischer Cleanup konfiguriert: Test-Runs älter als ${cleanupDays} Tage werden täglich um 3 Uhr gelöscht\n`);

  // Graceful Shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Beende Worker...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Beende Worker...');
    scheduler.stop();
    process.exit(0);
  });

  console.log('✅ Worker läuft. Drücke Ctrl+C zum Beenden.\n');
}

// Starte Worker wenn direkt ausgeführt
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fataler Fehler:', error);
    process.exit(1);
  });
}

export default TestScheduler;
