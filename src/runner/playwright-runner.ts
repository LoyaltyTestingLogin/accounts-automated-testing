import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabase, TestRunInsert } from '../database/schema';
import { getSlackNotifier } from '../slack/notifier';

const execAsync = promisify(exec);

/**
 * Playwright Test Runner
 * Führt Playwright-Tests programmatisch aus und verarbeitet die Ergebnisse
 */

export interface TestRunOptions {
  testPath?: string;  // Spezifischer Test oder Test-Suite
  project?: string;   // Browser-Projekt (chromium, firefox, etc.)
  headed?: boolean;   // Im headed mode ausführen
  triggeredBy: 'manual' | 'scheduled';
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
    const { testPath, project, headed, triggeredBy } = options;

    console.log(`🧪 Starte Tests: ${testPath || 'alle Tests'}`);

    // Test-Run in DB erstellen
    const testName = testPath || 'All Tests';
    const testSuite = this.extractSuiteName(testPath);

    // Schätze Anzahl der Tests (wird später beim Parsen aktualisiert)
    const estimatedTests = testPath?.includes('password-happy-path') ? 1 : 1;

    const runId = this.db.createTestRun({
      testName,
      testSuite,
      status: 'running',
      startTime: new Date().toISOString(),
      triggeredBy,
      progress: 0,
      totalTests: estimatedTests,
      completedTests: 0,
    });

    const startTime = Date.now();

    try {
      // Playwright-Kommando zusammenbauen
      const command = this.buildPlaywrightCommand({ testPath, project, headed });
      
      console.log(`📝 Führe aus: ${command}`);

      // Tests ausführen
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024, // 10MB Buffer
      });

      const duration = Date.now() - startTime;

      console.log('📋 Playwright Output:', stdout);
      if (stderr) console.error('⚠️  Playwright Errors:', stderr);

      // Ergebnisse parsen
      const results = await this.parseTestResults(runId, testName, testSuite, duration, triggeredBy);

      // DB aktualisieren
      const allPassed = results.every(r => r.success);
      this.db.updateTestRun(runId, {
        status: allPassed ? 'passed' : 'failed',
        endTime: new Date().toISOString(),
        duration,
        errorMessage: allPassed ? null : 'Einige Tests sind fehlgeschlagen',
      });

      // Bei Fehler Slack-Benachrichtigung senden
      if (!allPassed) {
        await this.notifyFailures(results);
      }

      console.log(`✅ Tests abgeschlossen: ${results.filter(r => r.success).length}/${results.length} erfolgreich`);

      return results;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      let errorMessage = error.message || 'Unbekannter Fehler';

      console.error('❌ Test-Ausführung fehlgeschlagen:', errorMessage);

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

            // Einzelnen Test-Run in DB speichern
            const testRunId = this.db.createTestRun({
              testName: testTitle,
              testSuite: suite.title || testSuite,
              status: success ? 'passed' : 'failed',
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
   * Sendet Slack-Benachrichtigungen für fehlgeschlagene Tests
   */
  private async notifyFailures(results: TestResult[]): Promise<void> {
    const failures = results.filter(r => !r.success);

    for (const failure of failures) {
      const testRun = this.db.getTestRun(failure.runId);
      
      if (testRun && !testRun.slackNotified) {
        const notified = await this.slackNotifier.notifyTestFailure({ testRun });
        
        if (notified) {
          this.db.updateTestRun(failure.runId, { slackNotified: true });
        }
      }
    }
  }
}

// Singleton-Instanz
let runnerInstance: PlaywrightRunner | null = null;

export function getPlaywrightRunner(): PlaywrightRunner {
  if (!runnerInstance) {
    runnerInstance = new PlaywrightRunner();
  }
  return runnerInstance;
}
