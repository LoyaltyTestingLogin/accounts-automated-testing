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

export default function Dashboard() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string>('login');

  useEffect(() => {
    fetchData();
    
    // Auto-Refresh alle 10 Sekunden
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

  const runTests = async (testPath?: string) => {
    if (runningTest) return;

    setRunningTest(true);
    
    try {
      await axios.post('/api/run-tests', {
        testPath: testPath || `tests/${selectedSuite}`,
        headed: false,
      });

      alert('Tests gestartet! Die Ergebnisse erscheinen in Kürze.');
      
      // Sofort neu laden
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Fehler beim Starten der Tests:', error);
      alert('Fehler beim Starten der Tests');
    } finally {
      setRunningTest(false);
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
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          CHECK24 Login Testing
        </h1>
        <p className="text-gray-600">
          Automatisiertes E2E Testing mit 24/7 Monitoring
        </p>
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Tests manuell ausführen
        </h2>
        
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
            onClick={() => runTests()}
            disabled={runningTest}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {runningTest ? (
              <>
                <span className="animate-spin">⟳</span>
                Läuft...
              </>
            ) : (
              <>
                ▶ Tests starten
              </>
            )}
          </button>

          <button
            onClick={() => runTests('tests/login/password-happy-path.spec.ts')}
            disabled={runningTest}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Nur Happy Path
          </button>

          <button
            onClick={fetchData}
            className="btn-secondary ml-auto"
          >
            🔄 Aktualisieren
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Hinweis:</strong> Tests laufen im Hintergrund. 
            Die Ergebnisse erscheinen automatisch in der Liste unten.
          </p>
        </div>
      </div>

      {/* Test-Runs Liste */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Letzte Test-Durchläufe
        </h2>

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
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {run.testName}
                      </div>
                      {run.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 max-w-md truncate">
                          {run.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {run.testSuite}
                    </td>
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {run.slackNotified ? '✓' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>
          CHECK24 Login Testing System • 
          Automatische Tests alle {process.env.TEST_INTERVAL_MINUTES || '15'} Minuten
        </p>
      </footer>
    </div>
  );
}
