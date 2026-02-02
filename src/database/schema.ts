import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * Datenbank-Schema für Test-Ergebnisse
 */

export interface TestRun {
  id: number;
  testName: string;
  testSuite: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'timeout' | 'cancelled';
  startTime: string;
  endTime: string | null;
  duration: number | null;
  errorMessage: string | null;
  screenshotPath: string | null;
  videoPath: string | null;
  tracePath: string | null;
  triggeredBy: 'manual' | 'scheduled';
  slackNotified: boolean;
  progress: number | null; // 0-100 für Fortschritt
  totalTests: number | null; // Anzahl der Tests in dieser Suite
  completedTests: number | null; // Anzahl abgeschlossener Tests
  processPid: number | null; // PID des laufenden Playwright-Prozesses
}

export interface TestRunInsert {
  testName: string;
  testSuite: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'timeout' | 'cancelled';
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  errorMessage?: string | null;
  screenshotPath?: string | null;
  videoPath?: string | null;
  tracePath?: string | null;
  triggeredBy: 'manual' | 'scheduled';
  slackNotified?: boolean;
  progress?: number | null;
  totalTests?: number | null;
  completedTests?: number | null;
  processPid?: number | null;
}

export class TestDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Sicherstellen dass der Ordner existiert
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    // Test-Runs Tabelle
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        testName TEXT NOT NULL,
        testSuite TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'passed', 'failed', 'timeout', 'cancelled')),
        startTime TEXT NOT NULL,
        endTime TEXT,
        duration INTEGER,
        errorMessage TEXT,
        screenshotPath TEXT,
        videoPath TEXT,
        tracePath TEXT,
        triggeredBy TEXT NOT NULL CHECK(triggeredBy IN ('manual', 'scheduled')),
        slackNotified INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        totalTests INTEGER DEFAULT 1,
        completedTests INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
      CREATE INDEX IF NOT EXISTS idx_test_runs_startTime ON test_runs(startTime DESC);
      CREATE INDEX IF NOT EXISTS idx_test_runs_testSuite ON test_runs(testSuite);
      
      -- Scheduler-Status Tabelle (für Pause/Resume über Prozesse hinweg)
      CREATE TABLE IF NOT EXISTS scheduler_status (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Migration: Füge neue Spalten zu bestehenden Tabellen hinzu
    const columns = this.db.pragma("table_info(test_runs)").map((col: any) => col.name);
    if (!columns.includes('progress')) {
      this.db.exec('ALTER TABLE test_runs ADD COLUMN progress INTEGER DEFAULT 0');
    }
    if (!columns.includes('processPid')) {
      this.db.exec('ALTER TABLE test_runs ADD COLUMN processPid INTEGER');
    }
    if (!columns.includes('totalTests')) {
      this.db.exec('ALTER TABLE test_runs ADD COLUMN totalTests INTEGER DEFAULT 1');
    }
    if (!columns.includes('completedTests')) {
      this.db.exec('ALTER TABLE test_runs ADD COLUMN completedTests INTEGER DEFAULT 0');
    }

    console.log('✅ Datenbank-Schema initialisiert');
  }

  /**
   * Neuen Test-Run erstellen
   */
  createTestRun(testRun: TestRunInsert): number {
    const stmt = this.db.prepare(`
      INSERT INTO test_runs (
        testName, testSuite, status, startTime, endTime, duration,
        errorMessage, screenshotPath, videoPath, tracePath, triggeredBy, slackNotified,
        progress, totalTests, completedTests
      ) VALUES (
        @testName, @testSuite, @status, @startTime, @endTime, @duration,
        @errorMessage, @screenshotPath, @videoPath, @tracePath, @triggeredBy, @slackNotified,
        @progress, @totalTests, @completedTests
      )
    `);

    const result = stmt.run({
      ...testRun,
      endTime: testRun.endTime || null,
      duration: testRun.duration || null,
      errorMessage: testRun.errorMessage || null,
      screenshotPath: testRun.screenshotPath || null,
      videoPath: testRun.videoPath || null,
      tracePath: testRun.tracePath || null,
      slackNotified: testRun.slackNotified ? 1 : 0,
      progress: testRun.progress || 0,
      totalTests: testRun.totalTests || 1,
      completedTests: testRun.completedTests || 0,
    });

    return result.lastInsertRowid as number;
  }

  /**
   * Test-Run aktualisieren
   */
  updateTestRun(id: number, updates: Partial<TestRunInsert>) {
    const fields = Object.keys(updates)
      .filter(key => updates[key as keyof TestRunInsert] !== undefined)
      .map(key => `${key} = @${key}`)
      .join(', ');

    if (fields.length === 0) return;

    const stmt = this.db.prepare(`
      UPDATE test_runs SET ${fields} WHERE id = @id
    `);

    const params: any = { id, ...updates };
    if ('slackNotified' in updates) {
      params.slackNotified = updates.slackNotified ? 1 : 0;
    }

    stmt.run(params);
  }

  /**
   * Test-Run nach ID abrufen
   */
  getTestRun(id: number): TestRun | undefined {
    const stmt = this.db.prepare('SELECT * FROM test_runs WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;

    return this.mapRowToTestRun(row);
  }

  /**
   * Letzte Test-Runs abrufen
   */
  getRecentTestRuns(limit = 50): TestRun[] {
    const stmt = this.db.prepare(`
      SELECT * FROM test_runs 
      ORDER BY startTime DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToTestRun(row));
  }

  /**
   * Test-Runs nach Status filtern
   */
  getTestRunsByStatus(status: TestRun['status'], limit = 50): TestRun[] {
    const stmt = this.db.prepare(`
      SELECT * FROM test_runs 
      WHERE status = ?
      ORDER BY startTime DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(status, limit) as any[];
    return rows.map(row => this.mapRowToTestRun(row));
  }

  /**
   * Statistiken abrufen (cancelled Tests werden nicht mitgezählt)
   */
  getStatistics() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avgDuration
      FROM test_runs
      WHERE startTime >= datetime('now', '-7 days')
        AND status != 'cancelled'
    `).get();

    return stats;
  }

  /**
   * Alte Test-Runs löschen (Cleanup)
   */
  cleanupOldRuns(daysToKeep = 4) {
    const stmt = this.db.prepare(`
      DELETE FROM test_runs 
      WHERE startTime < datetime('now', '-' || ? || ' days')
    `);
    
    const result = stmt.run(daysToKeep);
    console.log(`🧹 ${result.changes} alte Test-Runs (älter als ${daysToKeep} Tage) gelöscht`);
    return result.changes;
  }

  /**
   * Hilfsfunktion zum Mappen von DB-Zeile zu TestRun
   */
  private mapRowToTestRun(row: any): TestRun {
    return {
      ...row,
      slackNotified: Boolean(row.slackNotified),
    };
  }

  /**
   * Test-Run löschen
   */
  deleteTestRun(id: number): void {
    const stmt = this.db.prepare('DELETE FROM test_runs WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Scheduler-Status setzen (für Pause/Resume)
   */
  setSchedulerPaused(isPaused: boolean): void {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_status (key, value, updatedAt)
      VALUES ('isPaused', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = CURRENT_TIMESTAMP
    `);
    stmt.run(isPaused ? '1' : '0');
  }

  /**
   * Scheduler-Status abfragen
   */
  isSchedulerPaused(): boolean {
    const stmt = this.db.prepare('SELECT value FROM scheduler_status WHERE key = ?');
    const result = stmt.get('isPaused') as { value: string } | undefined;
    return result?.value === '1';
  }

  /**
   * Scheduler-Intervall setzen (in Minuten)
   */
  setSchedulerInterval(minutes: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_status (key, value, updatedAt)
      VALUES ('intervalMinutes', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = CURRENT_TIMESTAMP
    `);
    stmt.run(String(minutes));
  }

  /**
   * Scheduler-Intervall abfragen (in Minuten, default: 15)
   */
  getSchedulerInterval(): number {
    const stmt = this.db.prepare('SELECT value FROM scheduler_status WHERE key = ?');
    const result = stmt.get('intervalMinutes') as { value: string } | undefined;
    return result ? parseInt(result.value) : 15;
  }

  /**
   * Prüft, ob gerade manuelle Tests laufen
   */
  hasRunningManualTests(): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM test_runs 
      WHERE status IN ('pending', 'running') 
        AND triggeredBy = 'manual'
    `);
    const result = stmt.get() as { count: number };
    return result.count > 0;
  }

  /**
   * Prüft, ob irgendwelche Tests laufen
   */
  hasRunningTests(): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM test_runs 
      WHERE status IN ('pending', 'running')
    `);
    const result = stmt.get() as { count: number };
    return result.count > 0;
  }

  /**
   * Datenbank schließen
   */
  close() {
    this.db.close();
  }
}

// Singleton-Instanz
let dbInstance: TestDatabase | null = null;

export function getDatabase(): TestDatabase {
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_PATH || './data/testresults.db';
    dbInstance = new TestDatabase(dbPath);
  }
  return dbInstance;
}
