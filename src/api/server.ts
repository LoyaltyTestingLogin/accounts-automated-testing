import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabase } from '../database/schema';
import { getPlaywrightRunner } from '../runner/playwright-runner';
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
 * Startet Tests manuell
 */
app.post('/api/run-tests', async (req, res) => {
  try {
    const { testPath, project, headed } = req.body;

    // Test-Run im Hintergrund starten (nicht blockierend)
    setImmediate(async () => {
      try {
        await runner.runTests({
          testPath: testPath || 'tests/login',
          project,
          headed: headed || false,
          triggeredBy: 'manual',
        });
      } catch (error) {
        console.error('Fehler beim Test-Run:', error);
      }
    });

    res.json({
      success: true,
      message: 'Tests gestartet',
      testPath: testPath || 'tests/login',
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
        name: 'Login - Erfolgreicher Login',
        path: 'tests/login/password-happy-path.spec.ts',
        description: 'Testet den erfolgreichen Login-Flow mit gültigen Zugangsdaten. Prüft die korrekte Navigation zum Kundenbereich und alle Login-Schritte (E-Mail → Weiter → Passwort → Anmelden).',
      },
    ],
  });
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
    console.log(`   POST /api/run-tests`);
    console.log(`   POST /api/test-slack\n`);
  });
}

// Starte Server wenn direkt ausgeführt
if (require.main === module) {
  startServer();
}

export default app;
