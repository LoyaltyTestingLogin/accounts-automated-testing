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
  private cronJob: cron.ScheduledTask | null = null;
  private isPaused = false;

  constructor() {
    console.log('🤖 Test-Scheduler initialisiert');
  }

  /**
   * Pausiert den Scheduler (Tests laufen nicht mehr automatisch)
   */
  pause() {
    const currentlyPaused = this.db.isSchedulerPaused();
    if (currentlyPaused) {
      console.log('⏸️  Scheduler ist bereits pausiert');
      return false;
    }
    
    this.db.setSchedulerPaused(true);
    this.isPaused = true;
    console.log('⏸️  Scheduler pausiert - automatische Tests gestoppt');
    return true;
  }

  /**
   * Setzt den Scheduler fort (Tests laufen wieder automatisch)
   */
  resume() {
    const currentlyPaused = this.db.isSchedulerPaused();
    if (!currentlyPaused) {
      console.log('▶️  Scheduler läuft bereits');
      return false;
    }
    
    this.db.setSchedulerPaused(false);
    this.isPaused = false;
    console.log('▶️  Scheduler fortgesetzt - automatische Tests laufen wieder');
    return true;
  }

  /**
   * Gibt den aktuellen Status zurück
   */
  getStatus() {
    const isPaused = this.db.isSchedulerPaused();
    this.isPaused = isPaused; // Sync Memory-State mit DB
    
    return {
      isPaused: isPaused,
      isRunning: this.isRunning,
      cronExpression: this.cronJob ? process.env.TEST_INTERVAL_MINUTES || '15' : null,
    };
  }

  /**
   * Startet den Scheduler
   */
  start() {
    const intervalMinutes = parseInt(process.env.TEST_INTERVAL_MINUTES || '15');
    
    console.log(`⏰ Starte 24/7 Monitoring mit ${intervalMinutes}-Minuten-Intervall`);

    // Cron-Expression erstellen: Alle X Minuten
    const cronExpression = this.getCronExpression(intervalMinutes);
    
    console.log(`📅 Cron-Expression: ${cronExpression}`);

    // Cron-Job erstellen
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.executeScheduledTests();
    });

    console.log('✅ Scheduler gestartet');

    // Optional: Ersten Test sofort ausführen
    if (process.env.RUN_TESTS_ON_STARTUP === 'true') {
      console.log('🚀 Führe initialen Test-Durchlauf aus...');
      setTimeout(() => this.executeScheduledTests(), 5000); // Nach 5 Sekunden
    }
  }

  /**
   * Stoppt den Scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Scheduler gestoppt');
    }
  }

  /**
   * Führt geplante Tests aus
   */
  private async executeScheduledTests() {
    // Prüfe Pause-Status aus Datenbank (für Prozess-übergreifende Kommunikation)
    const isPaused = this.db.isSchedulerPaused();
    if (isPaused) {
      console.log('⏸️  Scheduler ist pausiert, überspringe Test-Durchlauf');
      return;
    }

    if (this.isRunning) {
      console.log('⏭️  Test läuft bereits, überspringe diesen Durchlauf');
      return;
    }

    this.isRunning = true;

    try {
      console.log('\n' + '='.repeat(80));
      console.log(`🔄 Automatischer Test-Durchlauf: ${new Date().toLocaleString('de-DE')}`);
      console.log('='.repeat(80) + '\n');

      // Alle Login-Tests ausführen
      const results = await this.runner.runTests({
        testPath: 'tests/login',
        triggeredBy: 'scheduled',
        headed: false,
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
