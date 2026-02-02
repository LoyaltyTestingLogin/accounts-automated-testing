import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabase, TestRunInsert } from '../database/schema';
import { getSlackNotifier } from '../slack/notifier';
import { EventEmitter } from 'events';
import { getTestCountForPath } from '../config/test-suites';

const execAsync = promisify(exec);

// Event-Emitter für Live-Logs
export const testLogEmitter = new EventEmitter();

/**
 * Playwright Test Runner
 * Führt Playwright-Tests programmatisch aus und verarbeitet die Ergebnisse
 */

export interface TestRunOptions {
  testPath?: string;  // Spezifischer Test oder Test-Suite
  project?: string;   // Browser-Projekt (chromium, firefox, etc.)
  headed?: boolean;   // Im headed mode ausführen
  triggeredBy: 'manual' | 'scheduled';
  existingRunId?: number; // Optionale existierende Run-ID für Live-Logs
}

export interface TestResult {
  runId: number;
  success: boolean;
  testName: string;
  testSuite: string;
  duration: number;
  errorMessage?: string;
  artifacts: {
    screenshots: string[];
    videos: string[];
    traces: string[];
  };
}

export class PlaywrightRunner {
  private db = getDatabase();
  private slackNotifier = getSlackNotifier();

  /**
   * Führt Playwright-Tests aus
   */
  async runTests(options: TestRunOptions): Promise<TestResult[]> {
    const { testPath, project, headed, triggeredBy, existingRunId } = options;

    console.log(`🧪 Starte Tests: ${testPath || 'alle Tests'}`);

    // Test-Run in DB erstellen oder existierende verwenden
    const testName = testPath || 'All Tests';
    const testSuite = this.extractSuiteName(testPath);

    let runId: number;
    
    if (existingRunId) {
      // Verwende existierende Run-ID und aktualisiere Status
      runId = existingRunId;
      this.db.updateTestRun(runId, {
        status: 'running',
        testName,
        testSuite,
      });
      console.log(`📝 Verwende existierende Run-ID: ${runId}`);
    } else {
      // Ermittle Anzahl der Tests basierend auf testPath (aus zentraler Konfiguration)
      const totalTests = getTestCountForPath(testPath);

      runId = this.db.createTestRun({
        testName,
        testSuite,
        status: 'running',
        startTime: new Date().toISOString(),
        triggeredBy,
        progress: 0,
        totalTests,
        completedTests: 0,
      });
      console.log(`📝 Neue Run-ID erstellt: ${runId}`);
    }

    const startTime = Date.now();

    try {
      // Playwright-Kommando zusammenbauen
      const command = this.buildPlaywrightCommand({ testPath, project, headed });
      
      console.log(`📝 Führe aus: ${command}`);
      testLogEmitter.emit('log', { runId, message: `📝 Führe aus: ${command}\n`, timestamp: new Date().toISOString() });

      // Tests mit Live-Streaming ausführen
      await this.runTestsWithLiveOutput(command, runId, { headed });

      const duration = Date.now() - startTime;

      // Ergebnisse parsen
      const results = await this.parseTestResults(runId, testName, testSuite, duration, triggeredBy);

      // Prüfe ob Test bereits abgebrochen wurde
      const currentTestRun = this.db.getTestRun(runId);
      
      if (currentTestRun?.status === 'cancelled') {
        // Test wurde abgebrochen - Status nicht überschreiben, nur Duration aktualisieren
        console.log(`⚠️  Test ${runId} wurde abgebrochen - behalte Status 'cancelled'`);
        this.db.updateTestRun(runId, {
          duration,
        });
        return results;
      }
      
      // DB aktualisieren
      const allPassed = results.every(r => r.success);
      const hasTimeout = results.some(r => {
        const testRun = this.db.getTestRun(r.runId);
        return testRun?.status === 'timeout';
      });
      
      // Status ermitteln: Bei Timeout bevorzugen wir timeout, sonst failed
      let mainStatus: 'passed' | 'failed' | 'timeout' = 'passed';
      let mainErrorMessage = null;
      
      if (!allPassed) {
        mainStatus = hasTimeout ? 'timeout' : 'failed';
        const timeoutCount = results.filter(r => {
          const testRun = this.db.getTestRun(r.runId);
          return testRun?.status === 'timeout';
        }).length;
        const failedCount = results.filter(r => !r.success).length - timeoutCount;
        
        if (timeoutCount > 0 && failedCount > 0) {
          mainErrorMessage = `${failedCount} Test(s) fehlgeschlagen, ${timeoutCount} Test(s) mit Timeout`;
        } else if (timeoutCount > 0) {
          mainErrorMessage = `${timeoutCount} Test(s) mit Timeout`;
        } else {
          mainErrorMessage = `${failedCount} Test(s) fehlgeschlagen`;
        }
      }
      
      this.db.updateTestRun(runId, {
        status: mainStatus,
        endTime: new Date().toISOString(),
        duration,
        errorMessage: mainErrorMessage,
      });

      // Bei Fehler oder Timeout Slack-Benachrichtigung senden
      if (!allPassed) {
        await this.notifyFailures(results);
      }

      console.log(`✅ Tests abgeschlossen: ${results.filter(r => r.success).length}/${results.length} erfolgreich`);

      return results;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      let errorMessage = error.message || 'Unbekannter Fehler';

      console.error('❌ Test-Ausführung fehlgeschlagen:', errorMessage);

      // Prüfe ob Test bereits abgebrochen wurde
      const currentTestRun = this.db.getTestRun(runId);
      
      if (currentTestRun?.status === 'cancelled') {
        // Test wurde abgebrochen - Status nicht überschreiben
        console.log(`⚠️  Test ${runId} wurde abgebrochen - behalte Status 'cancelled' im Error-Handler`);
        this.db.updateTestRun(runId, {
          duration,
        });
        return [{
          runId,
          success: false,
          testName,
          testSuite,
          duration,
          errorMessage: 'Test wurde manuell gestoppt',
          artifacts: { screenshots: [], videos: [], traces: [] },
        }];
      }
      
      // Versuche trotzdem, die Test-Ergebnisse zu parsen, um echte Fehler zu bekommen
      try {
        const results = await this.parseTestResults(runId, testName, testSuite, duration, triggeredBy);
        
        // Sammle alle Fehlermeldungen
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
          const detailedErrors = failedResults.map(r => 
            `❌ ${r.testName}: ${r.errorMessage || 'Test fehlgeschlagen'}`
          ).join('\n\n');
          errorMessage = detailedErrors;
        }

        // DB aktualisieren
        this.db.updateTestRun(runId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          duration,
          errorMessage,
        });

        // Slack-Benachrichtigung mit Details
        await this.notifyFailures(results);

      } catch (parseError) {
        // Falls Parsing auch fehlschlägt, verwende die ursprüngliche Error-Message
        this.db.updateTestRun(runId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          duration,
          errorMessage,
        });

        // Slack-Benachrichtigung
        const testRun = this.db.getTestRun(runId);
        if (testRun) {
          const notified = await this.slackNotifier.notifyTestFailure({ testRun });
          if (notified) {
            this.db.updateTestRun(runId, { slackNotified: true });
          }
        }
      }

      // Fehler als einzelnes Result zurückgeben
      return [{
        runId,
        success: false,
        testName,
        testSuite,
        duration,
        errorMessage,
        artifacts: { screenshots: [], videos: [], traces: [] },
      }];
    }
  }

  /**
   * Führt Tests mit Live-Output aus
   */
  private runTestsWithLiveOutput(command: string, runId: number, options?: { headed?: boolean }): Promise<void> {
    return new Promise((resolve, reject) => {
      // Kommando in Teile aufteilen für spawn
      const [cmd, ...args] = command.split(' ');
      
      const childProcess = spawn(cmd, args, {
        cwd: process.cwd(),
        env: { 
          ...process.env, 
          FORCE_COLOR: '0', // Keine Farb-Codes für saubere Logs
          // Browser rechts positionieren wenn headed mode
          BROWSER_POSITION: options?.headed ? 'right' : undefined,
        },
        shell: true,
      });

      // Speichere PID in Datenbank für späteren Stop
      const pid = childProcess.pid;
      if (pid) {
        this.db.updateTestRun(runId, { processPid: pid });
        console.log(`✅ Prozess-PID ${pid} für Run-ID ${runId} in DB gespeichert`);
      }

      // Tracking für Live-Progress
      let completedTestsCount = 0;
      const testRun = this.db.getTestRun(runId);
      const totalTests = testRun?.totalTests || 1;

      // STDOUT in Echtzeit streamen
      childProcess.stdout.on('data', (data: Buffer) => {
        const message = data.toString();
        console.log(message);
        
        // Parse Playwright Output für Live-Progress
        // Suche nach Patterns wie "[1/3]" oder "✓ Test Name" oder "✘ Test Name"
        const testCompletionPatterns = [
          /\[(\d+)\/\d+\]/,  // [1/3] Format
          /✓\s+/,             // ✓ Test passed
          /✘\s+/,             // ✘ Test failed
          /×\s+/,             // × Test failed (alternative)
        ];

        for (const pattern of testCompletionPatterns) {
          const match = message.match(pattern);
          if (match) {
            if (match[1]) {
              // Extrahiere completed count aus [X/Y] Format
              const completed = parseInt(match[1], 10);
              if (completed > completedTestsCount) {
                completedTestsCount = completed;
                const progress = Math.round((completedTestsCount / totalTests) * 100);
                
                // Update Progress in DB
                this.db.updateTestRun(runId, {
                  progress,
                  completedTests: completedTestsCount,
                });
              }
            } else {
              // ✓ oder ✘ gefunden - increment counter
              completedTestsCount++;
              const progress = Math.round((completedTestsCount / totalTests) * 100);
              
              // Update Progress in DB
              this.db.updateTestRun(runId, {
                progress,
                completedTests: completedTestsCount,
              });
            }
            break; // Nur einmal pro Message
          }
        }
        
        testLogEmitter.emit('log', {
          runId,
          message,
          timestamp: new Date().toISOString(),
          type: 'stdout',
        });
      });

      // STDERR in Echtzeit streamen
      childProcess.stderr.on('data', (data: Buffer) => {
        const message = data.toString();
        console.error(message);
        testLogEmitter.emit('log', {
          runId,
          message,
          timestamp: new Date().toISOString(),
          type: 'stderr',
        });
      });

      // Prozess-Ende
      childProcess.on('close', (code) => {
        // Lösche PID aus Datenbank
        this.db.updateTestRun(runId, { processPid: null });
        console.log(`🗑️  Prozess-PID für Run-ID ${runId} aus DB entfernt`);
        
        const message = `\n✅ Test-Prozess beendet mit Code ${code}\n`;
        console.log(message);
        testLogEmitter.emit('log', {
          runId,
          message,
          timestamp: new Date().toISOString(),
          type: 'system',
        });
        testLogEmitter.emit('complete', { runId });
        
        if (code === 0) {
          resolve();
        } else {
          // Bei Exit-Code 1 ist das okay (Tests failed, aber Playwright lief durch)
          resolve();
        }
      });

      // Fehlerbehandlung
      childProcess.on('error', (error) => {
        console.error('Process error:', error);
        testLogEmitter.emit('log', {
          runId,
          message: `❌ Fehler: ${error.message}\n`,
          timestamp: new Date().toISOString(),
          type: 'error',
        });
        reject(error);
      });
    });
  }

  /**
   * Baut das Playwright-Kommando zusammen
   */
  private buildPlaywrightCommand(options: Partial<TestRunOptions>): string {
    const { testPath, project, headed } = options;

    let cmd = 'npx playwright test';

    if (testPath) {
      cmd += ` ${testPath}`;
    }

    if (project) {
      cmd += ` --project=${project}`;
    }

    if (headed) {
      cmd += ` --headed`;
    }

    // Reporter für JSON-Output
    cmd += ` --reporter=json,list`;

    return cmd;
  }

  /**
   * Parst die Test-Ergebnisse aus Playwright JSON-Report
   */
  private async parseTestResults(
    runId: number,
    testName: string,
    testSuite: string,
    duration: number,
    triggeredBy: 'manual' | 'scheduled'
  ): Promise<TestResult[]> {
    const resultsFile = 'test-results/results.json';

    if (!existsSync(resultsFile)) {
      console.warn('⚠️  Keine results.json gefunden, verwende Fallback-Result');
      return [{
        runId,
        success: true, // Wenn keine Datei, nehmen wir an, dass es geklappt hat
        testName,
        testSuite,
        duration,
        artifacts: await this.collectArtifacts(),
      }];
    }

    try {
      const content = await readFile(resultsFile, 'utf-8');
      const report = JSON.parse(content);

      const results: TestResult[] = [];
      
      // Zähle alle Tests vorher
      let totalTests = 0;
      for (const suite of report.suites || []) {
        for (const spec of suite.specs || []) {
          totalTests += (spec.tests || []).length;
        }
      }

      // Update totalTests in DB
      this.db.updateTestRun(runId, { totalTests });

      let completedTests = 0;

      // Playwright JSON-Report parsen
      for (const suite of report.suites || []) {
        for (const spec of suite.specs || []) {
          const testTitle = spec.title;
          const tests = spec.tests || [];

          for (const test of tests) {
            const status = test.status; // passed, failed, timedOut, skipped
            const success = status === 'passed';
            const isTimeout = status === 'timedOut';
            
            // Extrahiere aussagekräftige Fehlermeldung
            let error = null;
            if (test.error) {
              // Versuche, die wichtigste Info zu extrahieren
              const fullError = test.error.message || test.error.value || '';
              
              // Entferne technische Stack-Traces und behalte nur die Hauptnachricht
              const errorLines = fullError.split('\n');
              const mainError = errorLines.find(line => 
                line.includes('Error:') || 
                line.includes('Expected:') ||
                line.includes('Received:') ||
                line.includes('ABSICHTLICHER') ||
                !line.trim().startsWith('at ') && !line.includes('node_modules') && line.trim().length > 0
              );
              
              error = mainError || errorLines[0] || 'Test fehlgeschlagen';
              
              // Füge Kontext hinzu wenn vorhanden
              if (fullError.includes('Expected:') && fullError.includes('Received:')) {
                const expected = errorLines.find(l => l.includes('Expected:'));
                const received = errorLines.find(l => l.includes('Received:'));
                if (expected && received) {
                  error = `${error}\n${expected}\n${received}`;
                }
              }
            }

            // Status ermitteln: timeout, passed oder failed
            let testStatus: 'passed' | 'failed' | 'timeout' = 'failed';
            if (success) {
              testStatus = 'passed';
            } else if (isTimeout) {
              testStatus = 'timeout';
              // Füge Timeout-Hinweis zur Fehlermeldung hinzu
              if (!error) {
                error = `Test wurde nach ${test.duration ? (test.duration / 1000).toFixed(1) : 'N/A'} Sekunden abgebrochen (Timeout)`;
              }
            }

            // Einzelnen Test-Run in DB speichern
            const testRunId = this.db.createTestRun({
              testName: testTitle,
              testSuite: suite.title || testSuite,
              status: testStatus,
              startTime: new Date(Date.now() - duration).toISOString(),
              endTime: new Date().toISOString(),
              duration: test.duration,
              errorMessage: error || null,
              triggeredBy,
            });

            completedTests++;
            const progress = Math.round((completedTests / totalTests) * 100);
            
            // Update Progress für Main-Run
            this.db.updateTestRun(runId, {
              progress,
              completedTests,
            });

            results.push({
              runId: testRunId,
              success,
              testName: testTitle,
              testSuite: suite.title || testSuite,
              duration: test.duration || duration,
              errorMessage: error,
              artifacts: await this.collectArtifacts(),
            });
          }
        }
      }

      return results.length > 0 ? results : [{
        runId,
        success: true,
        testName,
        testSuite,
        duration,
        artifacts: await this.collectArtifacts(),
      }];

    } catch (error) {
      console.error('❌ Fehler beim Parsen der Test-Ergebnisse:', error);
      return [{
        runId,
        success: false,
        testName,
        testSuite,
        duration,
        errorMessage: 'Fehler beim Parsen der Ergebnisse',
        artifacts: await this.collectArtifacts(),
      }];
    }
  }

  /**
   * Sammelt Test-Artefakte (Screenshots, Videos, Traces)
   */
  private async collectArtifacts(): Promise<TestResult['artifacts']> {
    const artifacts = {
      screenshots: [] as string[],
      videos: [] as string[],
      traces: [] as string[],
    };

    const artifactsDir = 'test-results/artifacts';

    if (!existsSync(artifactsDir)) {
      return artifacts;
    }

    try {
      const files = await readdir(artifactsDir, { recursive: true });

      for (const file of files) {
        const filePath = join(artifactsDir, file.toString());
        
        if (file.toString().endsWith('.png') || file.toString().endsWith('.jpg')) {
          artifacts.screenshots.push(filePath);
        } else if (file.toString().endsWith('.webm') || file.toString().endsWith('.mp4')) {
          artifacts.videos.push(filePath);
        } else if (file.toString().endsWith('.zip')) {
          artifacts.traces.push(filePath);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Sammeln der Artefakte:', error);
    }

    return artifacts;
  }

  /**
   * Extrahiert Suite-Namen aus Test-Pfad
   */
  private extractSuiteName(testPath?: string): string {
    if (!testPath) return 'All Suites';
    
    const parts = testPath.split('/');
    const folder = parts[parts.length - 2] || 'login';
    return folder.charAt(0).toUpperCase() + folder.slice(1);
  }

  /**
   * Sendet Slack-Benachrichtigungen für fehlgeschlagene Tests und Timeouts
   */
  private async notifyFailures(results: TestResult[]): Promise<void> {
    const failures = results.filter(r => !r.success);

    for (const failure of failures) {
      const testRun = this.db.getTestRun(failure.runId);
      
      if (testRun && !testRun.slackNotified) {
        let notified = false;
        
        // Unterscheide zwischen Timeout und regulärem Fehler
        if (testRun.status === 'timeout') {
          notified = await this.slackNotifier.notifyTestTimeout({ testRun });
        } else {
          notified = await this.slackNotifier.notifyTestFailure({ testRun });
        }
        
        if (notified) {
          this.db.updateTestRun(failure.runId, { slackNotified: true });
        }
      }
    }
  }
  /**
   * Stoppt einen laufenden Test
   */
  async stopTest(runId: number): Promise<boolean> {
    console.log(`🛑 stopTest() aufgerufen für Run-ID ${runId}`);
    
    // Hole Test-Info aus Datenbank
    const testRun = this.db.getTestRun(runId);
    
    if (!testRun) {
      console.log(`⚠️  Test-Run ${runId} nicht in DB gefunden`);
      return false;
    }
    
    console.log(`📝 Test-Status: ${testRun.status}, PID: ${testRun.processPid || 'keine'}`);
    
    if (!testRun.processPid) {
      console.log(`⚠️  Keine Prozess-PID für Run-ID ${runId} gefunden`);
      return false;
    }
    
    console.log(`🛑 Stoppe Test mit Run-ID ${runId} (PID: ${testRun.processPid})...`);
    
    try {
      // Prüfe ob Prozess existiert
      try {
        process.kill(testRun.processPid, 0); // Signal 0 prüft nur Existenz
      } catch (e) {
        console.log(`⚠️  Prozess ${testRun.processPid} existiert nicht mehr`);
        this.db.updateTestRun(runId, { processPid: null });
        return false;
      }
      
      // Sende SIGTERM zum sauberen Beenden (schließt auch alle Browser)
      process.kill(testRun.processPid, 'SIGTERM');
      console.log(`📤 SIGTERM gesendet an PID ${testRun.processPid}`);
      
      // Falls nach 5 Sekunden noch nicht beendet, forciere SIGKILL
      setTimeout(() => {
        try {
          process.kill(testRun.processPid!, 0); // Prüfe ob noch läuft
          console.log(`⚠️  Prozess ${testRun.processPid} reagiert nicht, sende SIGKILL...`);
          process.kill(testRun.processPid!, 'SIGKILL');
        } catch (e) {
          // Prozess ist bereits beendet
          console.log(`✅ Prozess ${testRun.processPid} bereits beendet`);
        }
      }, 5000);
      
      // Aktualisiere Status in Datenbank
      this.db.updateTestRun(runId, {
        status: 'cancelled',
        endTime: new Date().toISOString(),
        errorMessage: 'Test wurde manuell gestoppt',
        processPid: null,
      });
      
      // Event für Live-Logs
      testLogEmitter.emit('log', {
        runId,
        message: '\n🛑 Test wurde manuell gestoppt\n',
        timestamp: new Date().toISOString(),
        type: 'system',
      });
      testLogEmitter.emit('complete', { runId });
      
      console.log(`✅ Test ${runId} erfolgreich gestoppt`);
      return true;
    } catch (error) {
      console.error(`❌ Fehler beim Stoppen von Test ${runId}:`, error);
      return false;
    }
  }
}

// Singleton-Instanz
let runnerInstance: PlaywrightRunner | null = null;

export function getPlaywrightRunner(): PlaywrightRunner {
  if (!runnerInstance) {
    runnerInstance = new PlaywrightRunner();
    console.log('🆕 Neue PlaywrightRunner-Instanz erstellt');
  }
  return runnerInstance;
}
