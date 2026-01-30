import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabase } from '../database/schema';
import { getPlaywrightRunner, testLogEmitter } from '../runner/playwright-runner';
import { getSlackNotifier } from '../slack/notifier';

dotenv.config();

/**
 * Express API Server für das Test-Dashboard
 */

const app = express();
const PORT = process.env.API_PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('test-results')); // Statische Dateien für Artefakte

const db = getDatabase();
const runner = getPlaywrightRunner();
const slackNotifier = getSlackNotifier();

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CHECK24 Login Testing API',
  });
});

/**
 * GET /api/test-runs
 * Gibt letzte Test-Runs zurück
 */
app.get('/api/test-runs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    let testRuns;
    
    if (status && ['pending', 'running', 'passed', 'failed'].includes(status)) {
      testRuns = db.getTestRunsByStatus(status as any, limit);
    } else {
      testRuns = db.getRecentTestRuns(limit);
    }

    res.json({
      success: true,
      data: testRuns,
      count: testRuns.length,
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen der Test-Runs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/test-runs/:id
 * Gibt einzelnen Test-Run mit allen zugehörigen Tests zurück
 */
app.get('/api/test-runs/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const testRun = db.getTestRun(id);

    if (!testRun) {
      return res.status(404).json({
        success: false,
        error: 'Test-Run nicht gefunden',
      });
    }

    // Finde alle Tests, die im gleichen Batch gelaufen sind (±10 Sekunden)
    const startTime = new Date(testRun.startTime).getTime();
    const allRuns = db.getRecentTestRuns(100); // Hole mehr Runs
    
    const batchRuns = allRuns.filter(run => {
      const runTime = new Date(run.startTime).getTime();
      const diff = Math.abs(runTime - startTime);
      return diff < 10000; // 10 Sekunden Toleranz
    });

    res.json({
      success: true,
      data: {
        mainRun: testRun,
        batchRuns: batchRuns,
        summary: {
          total: batchRuns.length,
          passed: batchRuns.filter(r => r.status === 'passed').length,
          failed: batchRuns.filter(r => r.status === 'failed').length,
        }
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen des Test-Runs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/statistics
 * Gibt Statistiken zurück
 */
app.get('/api/statistics', (req, res) => {
  try {
    const stats = db.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen der Statistiken:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/run-tests
 * Startet Tests manuell und gibt die Run-ID zurück
 */
app.post('/api/run-tests', async (req, res) => {
  try {
    const { testPath, project, headed } = req.body;

    // Erstelle Test-Run sofort und gebe ID zurück
    const testName = testPath || 'All Tests';
    const runId = db.createTestRun({
      testName,
      testSuite: 'Manual',
      status: 'pending',
      startTime: new Date().toISOString(),
      triggeredBy: 'manual',
      progress: 0,
      totalTests: 1,
      completedTests: 0,
    });

    // Test-Run im Hintergrund starten (nicht blockierend)
    setImmediate(async () => {
      try {
        await runner.runTests({
          testPath: testPath || 'tests/login',
          project,
          headed: headed || false,
          triggeredBy: 'manual',
          existingRunId: runId, // Verwende die bereits erstellte Run-ID
        });
      } catch (error) {
        console.error('Fehler beim Test-Run:', error);
      }
    });

    res.json({
      success: true,
      message: 'Tests gestartet',
      testPath: testPath || 'tests/login',
      runId, // Gebe Run-ID zurück für Live-Logs
    });
  } catch (error: any) {
    console.error('Fehler beim Starten der Tests:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/test-logs/:runId/stream
 * Streamt Live-Logs für einen Test-Run (Server-Sent Events)
 */
app.get('/api/test-logs/:runId/stream', (req, res) => {
  const runId = parseInt(req.params.runId);
  
  // SSE Headers setzen
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Initiale Verbindungsnachricht
  res.write(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);

  // Log-Listener für diesen Run
  const logListener = (logData: any) => {
    if (logData.runId === runId) {
      res.write(`data: ${JSON.stringify(logData)}\n\n`);
    }
  };

  // Complete-Listener
  const completeListener = (data: any) => {
    if (data.runId === runId) {
      res.write(`data: ${JSON.stringify({ type: 'complete', runId })}\n\n`);
      cleanup();
    }
  };

  // Event-Listener registrieren
  testLogEmitter.on('log', logListener);
  testLogEmitter.on('complete', completeListener);

  // Cleanup-Funktion
  const cleanup = () => {
    testLogEmitter.off('log', logListener);
    testLogEmitter.off('complete', completeListener);
    res.end();
  };

  // Verbindung geschlossen
  req.on('close', cleanup);
});

/**
 * POST /api/test-slack
 * Testet die Slack-Verbindung
 */
app.post('/api/test-slack', async (req, res) => {
  try {
    const success = await slackNotifier.testConnection();

    res.json({
      success,
      message: success ? 'Slack-Verbindung erfolgreich' : 'Slack-Verbindung fehlgeschlagen',
    });
  } catch (error: any) {
    console.error('Fehler beim Testen der Slack-Verbindung:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/test-suites
 * Gibt verfügbare Test-Suites zurück
 */
app.get('/api/test-suites', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'login-happy',
        name: 'Login - Passwort Login inklusive Login Challenge',
        path: 'tests/login/password-happy-path.spec.ts',
        description: 'Vollständiger Passwort Login-Flow inklusive Testing vollständiger Login Challenge\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
      },
      {
        id: 'login-otp',
        name: 'Login - OTP (Einmalcode) Login',
        path: 'tests/login/otp-happy-path.spec.ts',
        description: 'Vollständiger OTP Login-Flow mit Einmalcode statt Passwort\n\n• Test 1: E-Mail only Account (TAN per E-Mail)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
      },
      {
        id: 'login-password-reset',
        name: 'Login - Passwort Reset',
        path: 'tests/login/password-reset.spec.ts',
        description: 'Vollständiger Passwort-Reset Flow mit TAN-Verifizierung\n\n• Test 1: E-Mail only Account (TAN per E-Mail + Phone Collector)\n\n• Test 2: Combined Account (TAN per E-Mail)\n\n• Test 3: Combined Account (TAN per SMS)',
      },
      {
        id: 'registration-email',
        name: 'Registrierung - E-Mail Registrierung',
        path: 'tests/registration/email-registrierung-happy-path.spec.ts',
        description: 'Vollständiger E-Mail-Registrierungs-Flow\n\n• E-Mail eingeben\n\n• Passwort wählen\n\n• TAN-Verifizierung per E-Mail\n\n• Registrierung abschließen',
      },
      {
        id: 'registration-phone',
        name: 'Registrierung - Telefon Registrierung',
        path: 'tests/registration/phone-registrierung-happy-path.spec.ts',
        description: 'Vollständiger Telefon-Registrierungs-Flow\n\n• Telefonnummer eingeben\n\n• Passwort wählen (optional)\n\n• TAN-Verifizierung per SMS\n\n• Registrierung abschließen',
      },
    ],
  });
});

/**
 * GET /api/scheduler/status
 * Gibt den aktuellen Status des Schedulers zurück
 */
app.get('/api/scheduler/status', (req, res) => {
  try {
    const isPaused = db.isSchedulerPaused();
    
    res.json({
      success: true,
      data: {
        available: true,
        isPaused: isPaused,
        isRunning: false, // Kann nur der Worker wissen
        cronExpression: process.env.TEST_INTERVAL_MINUTES || '15',
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen des Scheduler-Status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/scheduler/pause
 * Pausiert den automatischen Test-Scheduler
 */
app.post('/api/scheduler/pause', (req, res) => {
  try {
    const currentlyPaused = db.isSchedulerPaused();
    
    if (currentlyPaused) {
      return res.json({
        success: true,
        message: 'Scheduler war bereits pausiert',
        data: {
          isPaused: true,
        },
      });
    }

    db.setSchedulerPaused(true);
    
    res.json({
      success: true,
      message: 'Scheduler pausiert',
      data: {
        isPaused: true,
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Pausieren des Schedulers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/scheduler/resume
 * Setzt den automatischen Test-Scheduler fort
 */
app.post('/api/scheduler/resume', (req, res) => {
  try {
    const currentlyPaused = db.isSchedulerPaused();
    
    if (!currentlyPaused) {
      return res.json({
        success: true,
        message: 'Scheduler lief bereits',
        data: {
          isPaused: false,
        },
      });
    }

    db.setSchedulerPaused(false);
    
    res.json({
      success: true,
      message: 'Scheduler fortgesetzt',
      data: {
        isPaused: false,
      },
    });
  } catch (error: any) {
    console.error('Fehler beim Fortsetzen des Schedulers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Error Handler
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unbehandelter Fehler:', err);
  res.status(500).json({
    success: false,
    error: 'Interner Server-Fehler',
  });
});

/**
 * Server starten
 */
function startServer() {
  app.listen(PORT, () => {
    console.log(`✅ API-Server läuft auf http://localhost:${PORT}`);
    console.log(`📊 Verfügbare Endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/test-runs`);
    console.log(`   GET  /api/test-runs/:id`);
    console.log(`   GET  /api/statistics`);
    console.log(`   GET  /api/test-suites`);
    console.log(`   GET  /api/test-logs/:runId/stream (SSE)`);
    console.log(`   GET  /api/scheduler/status`);
    console.log(`   POST /api/run-tests`);
    console.log(`   POST /api/test-slack`);
    console.log(`   POST /api/scheduler/pause`);
    console.log(`   POST /api/scheduler/resume\n`);
  });
}

// Starte Server wenn direkt ausgeführt
if (require.main === module) {
  startServer();
}

export default app;
