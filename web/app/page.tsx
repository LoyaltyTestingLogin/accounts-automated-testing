'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface TestRun {
  id: number;
  testName: string;
  testSuite: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  startTime: string;
  endTime: string | null;
  duration: number | null;
  errorMessage: string | null;
  triggeredBy: 'manual' | 'scheduled';
  slackNotified: boolean;
}

interface Statistics {
  total: number;
  passed: number;
  failed: number;
  running: number;
  avgDuration: number;
}

interface TestSuite {
  id: string;
  name: string;
  path: string;
  description: string;
}

const PATH_PASSWORD_HAPPY = 'tests/login/password-happy-path.spec.ts';

type InfoDialogKind = 'passkey' | 'password-happy' | 'both';

/** Welche Hinweise vor dem Start nötig sind (unabhängig von TEST/PROD – gilt für beide). */
function getInfoDialogKindForPath(resolvedPath: string): InfoDialogKind | null {
  const isAll = resolvedPath === 'tests';
  const hasPasskey =
    isAll || resolvedPath.replace(/\\/g, '/').includes('passkey-happy-path');
  const hasPasswordHappy =
    isAll || resolvedPath.replace(/\\/g, '/').includes('password-happy-path');

  if (hasPasskey && hasPasswordHappy) return 'both';
  if (hasPasskey) return 'passkey';
  if (hasPasswordHappy) return 'password-happy';
  return null;
}

export default function Dashboard() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  /** Entspricht `TestSuiteConfig.id` aus API (z. B. login-happy) */
  const [selectedSuite, setSelectedSuite] = useState<string>('login-happy');

  const [infoDialog, setInfoDialog] = useState<InfoDialogKind | null>(null);
  const [pendingTestPath, setPendingTestPath] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [runsRes, statsRes, suitesRes] = await Promise.all([
        axios.get('/api/test-runs?limit=20'),
        axios.get('/api/statistics'),
        axios.get('/api/test-suites'),
      ]);

      setTestRuns(runsRes.data.data || []);
      setStatistics(statsRes.data.data || null);
      setTestSuites(suitesRes.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const resolveTestPath = (testPath?: string): string =>
    testPath ??
    testSuites.find((s) => s.id === selectedSuite)?.path ??
    PATH_PASSWORD_HAPPY;

  /** Startet den Lauf ohne Hinweis-Dialog (nach Bestätigung oder wenn kein Hinweis nötig). */
  const performRunTests = async (resolvedPath: string) => {
    if (runningTest) return;

    setRunningTest(true);
    try {
      await axios.post('/api/run-tests', {
        testPath: resolvedPath,
        headed: false,
      });
      alert('Tests gestartet! Die Ergebnisse erscheinen in Kürze.');
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Fehler beim Starten der Tests:', error);
      alert('Fehler beim Starten der Tests');
    } finally {
      setRunningTest(false);
    }
  };

  /**
   * Öffert ggf. den Hinweis-Dialog, sonst direkter Start.
   * @param testPath z. B. `tests`, konkrete Datei oder undefined (= gewählte Suite)
   */
  const requestRunTests = (testPath?: string) => {
    if (runningTest) return;

    const resolvedPath = resolveTestPath(testPath);
    const kind = getInfoDialogKindForPath(resolvedPath);

    if (kind) {
      setPendingTestPath(resolvedPath);
      setInfoDialog(kind);
      return;
    }

    void performRunTests(resolvedPath);
  };

  const cancelInfoDialog = () => {
    setInfoDialog(null);
    setPendingTestPath(null);
  };

  const confirmInfoDialog = () => {
    if (pendingTestPath) {
      const path = pendingTestPath;
      cancelInfoDialog();
      void performRunTests(path);
    }
  };

  const getStatusBadge = (status: TestRun['status']) => {
    switch (status) {
      case 'passed':
        return <span className="badge-success">✓ Erfolgreich</span>;
      case 'failed':
        return <span className="badge-error">✗ Fehlgeschlagen</span>;
      case 'running':
        return <span className="badge-info">⟳ Läuft</span>;
      case 'pending':
        return <span className="badge-warning">⋯ Wartend</span>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const successRate = statistics
    ? statistics.total > 0
      ? ((statistics.passed / statistics.total) * 100).toFixed(1)
      : '0'
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hinweis-Dialoge vor Teststart */}
      {infoDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 cursor-default"
            aria-label="Dialog schließen"
            onClick={cancelInfoDialog}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-left">
            <h2 id="info-dialog-title" className="text-lg font-bold text-gray-900 mb-2">
              Hinweis vor dem Start
            </h2>

            {(infoDialog === 'passkey' || infoDialog === 'both') && (
              <section className={infoDialog === 'both' ? 'mb-6 pb-6 border-b border-gray-100' : ''}>
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Passkey-Test</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Dieser Lauf ist in der Praxis nur auf dem <strong>vorgesehenen Test-Laptop</strong> zuverlässig
                  grün: Dort entfällt eine zusätzliche <strong>biometrische Abfrage</strong>, und der genutzte{' '}
                  <strong>Passkey ist auf diesem Gerät registriert</strong>. Auf anderen Rechnern kann der Test
                  fehlschlagen oder hängen bleiben – das gilt für <strong>TEST- und PROD-Umgebung</strong> gleichermaßen.
                </p>
              </section>
            )}

            {(infoDialog === 'password-happy' || infoDialog === 'both') && (
              <section>
                <h3 className="text-sm font-semibold text-blue-800 mb-2">
                  Passwort Happy Path & Login Challenge
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Der Test enthält die <strong>Login Challenge</strong> (zusätzliche Prüfung nach dem Passwort).
                  <br />
                  <strong className="text-gray-800">TEST:</strong> Die Challenge ist dort oft <strong>standardmäßig
                  aus</strong>. Soll der Lauf auf der Test-Umgebung erfolgreich sein, muss die Login Challenge für{' '}
                  <strong>check24_sso</strong> (API-Produkt) auf <strong>Test</strong> aktiviert werden.
                  <br />
                  <strong className="text-gray-800">PROD:</strong> Die Challenge ist dort in der Regel bereits aktiv –{' '}
                  <strong>kein zusätzlicher Schritt nötig</strong>.
                </p>
              </section>
            )}

            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button type="button" onClick={cancelInfoDialog} className="btn-secondary">
                Abbrechen
              </button>
              <button type="button" onClick={confirmInfoDialog} className="btn-primary">
                Verstanden, Test(e) starten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">CHECK24 Login Testing</h1>
        <p className="text-gray-600">Automatisiertes E2E Testing mit 24/7 Monitoring</p>
      </header>

      {/* Statistiken */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Gesamt Tests (7d)</div>
            <div className="text-3xl font-bold text-gray-900">{statistics.total}</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Erfolgsquote</div>
            <div className="text-3xl font-bold text-green-600">{successRate}%</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Fehlgeschlagen</div>
            <div className="text-3xl font-bold text-red-600">{statistics.failed}</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Ø Dauer</div>
            <div className="text-3xl font-bold text-blue-600">
              {formatDuration(statistics.avgDuration)}
            </div>
          </div>
        </div>
      )}

      {/* Test-Steuerung */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tests manuell ausführen</h2>

        <div className="flex flex-wrap gap-4">
          <select
            value={selectedSuite}
            onChange={(e) => setSelectedSuite(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={runningTest}
          >
            {testSuites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => requestRunTests()}
            disabled={runningTest}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {runningTest ? (
              <>
                <span className="animate-spin">⟳</span>
                Läuft...
              </>
            ) : (
              <>▶ Tests starten (gewählte Suite)</>
            )}
          </button>

          <button
            onClick={() => requestRunTests('tests')}
            disabled={runningTest}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Alle Tests starten
          </button>

          <button
            onClick={() => requestRunTests(PATH_PASSWORD_HAPPY)}
            disabled={runningTest}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Nur Happy Path
          </button>

          <button onClick={fetchData} className="btn-secondary ml-auto">
            🔄 Aktualisieren
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Hinweis:</strong> Tests laufen im Hintergrund. Die Ergebnisse erscheinen automatisch in der Liste
            unten.
          </p>
        </div>
      </div>

      {/* Test-Runs Liste */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Letzte Test-Durchläufe</h2>

        {testRuns.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Noch keine Tests durchgeführt</p>
            <p className="text-sm">Starte einen Test um Ergebnisse zu sehen</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suite
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zeitpunkt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dauer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slack
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">{getStatusBadge(run.status)}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{run.testName}</div>
                      {run.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 max-w-md truncate">{run.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{run.testSuite}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {run.triggeredBy === 'scheduled' ? (
                        <span className="text-blue-600">⏰ Auto</span>
                      ) : (
                        <span className="text-gray-600">👤 Manuell</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(run.startTime), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDuration(run.duration)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{run.slackNotified ? '✓' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>
          CHECK24 Login Testing System • Automatische Tests alle{' '}
          {process.env.TEST_INTERVAL_MINUTES || '15'} Minuten
        </p>
      </footer>
    </div>
  );
}
