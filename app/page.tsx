'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  progress: number | null;
  totalTests: number | null;
  completedTests: number | null;
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
  const router = useRouter();
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string>('login-happy');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTestInfo, setShowTestInfo] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
      // Wenn kein expliziter testPath übergeben wurde, nutze den path aus der ausgewählten Suite
      let actualTestPath = testPath;
      if (!actualTestPath) {
        const selectedSuiteObj = testSuites.find(s => s.id === selectedSuite);
        actualTestPath = selectedSuiteObj?.path || 'tests';
      }

      await axios.post('/api/run-tests', {
        testPath: actualTestPath,
        headed: true,
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
      case 'timeout':
        return <span className="badge-warning">⚠ Timeout</span>;
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
    ? (statistics.passed + statistics.failed) > 0 
      ? ((statistics.passed / (statistics.passed + statistics.failed)) * 100).toFixed(1) 
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

        {/* Einzelner Test (links) + Alle Tests (rechts) */}
        <div className="flex gap-4 items-start">
          {/* Einzelner Test - Dropdown */}
          <div className="flex-1 max-w-2xl">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Einzelner Test
              </label>
            <div className="relative">
              {/* Dropdown Button */}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={runningTest}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white flex items-center justify-between"
              >
                <span className="font-medium text-gray-900">
                  {testSuites.find(s => s.id === selectedSuite)?.name || 'Test auswählen...'}
                </span>
                <span className="text-gray-400">{isDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
                  {/* Suchfeld im Dropdown */}
                  <div className="p-3 border-b border-gray-200 bg-gray-50">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Test durchsuchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="absolute right-3 top-2 text-gray-400 text-sm">🔍</span>
                    </div>
                  </div>

                  {/* Test-Liste */}
                  <div className="max-h-80 overflow-y-auto">
                    {testSuites.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Lade Tests...
                      </div>
                    ) : (
                      (() => {
                        const filteredSuites = testSuites.filter(suite => 
                          suite.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          suite.description.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        // Gruppiere Tests nach Kategorie
                        const groupedTests = filteredSuites.reduce((acc, suite) => {
                          const category = suite.name.split(' - ')[0] || 'Andere';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(suite);
                          return acc;
                        }, {} as Record<string, typeof testSuites>);

                        if (filteredSuites.length === 0) {
                          return (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              Keine Tests gefunden für &ldquo;{searchQuery}&rdquo;
                            </div>
                          );
                        }

                        return Object.entries(groupedTests).map(([category, suites]) => (
                          <div key={category}>
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                              <span className="text-xs font-semibold text-gray-600 uppercase">
                                {category} ({suites.length})
                              </span>
                            </div>
                            {suites.map((suite) => (
                              <button
                                key={suite.id}
                                onClick={() => {
                                  setSelectedSuite(suite.id);
                                  runTests(suite.path);
                                  setIsDropdownOpen(false);
                                  setSearchQuery('');
                                }}
                                disabled={runningTest}
                                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed group"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                      {suite.name.split(' - ')[1] || suite.name}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTestInfo(showTestInfo === suite.id ? null : suite.id);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                    >
                                      {showTestInfo === suite.id ? '▼ Details ausblenden' : '▶ Details anzeigen'}
                                    </button>
                                    {showTestInfo === suite.id && (
                                      <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                                        {suite.description}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-blue-600 group-hover:text-blue-800 text-sm flex-shrink-0">▶</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              )}

              {/* Backdrop zum Schließen */}
              {isDropdownOpen && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setSearchQuery('');
                    setShowTestInfo(null);
                  }}
                />
              )}
            </div>
            </div>
          </div>

          {/* Alle Tests starten - rechts */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alle Tests
            </label>
            <button
              onClick={() => runTests('tests')}
              disabled={runningTest}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap h-[46px] px-6"
            >
              {runningTest ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Läuft...
                </>
              ) : (
                <>
                  🧪 Alle starten
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {testSuites.length} Tests verfügbar
            </p>
          </div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testRuns.map((run) => (
                  <tr 
                    key={run.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td 
                      className="px-4 py-4 whitespace-nowrap cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {getStatusBadge(run.status)}
                    </td>
                    <td 
                      className="px-4 py-4 cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {run.testName}
                      </div>
                      {run.status === 'running' && run.progress !== null && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${run.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 font-medium min-w-[50px] text-right">
                              {run.progress}%
                            </span>
                          </div>
                          {run.totalTests && run.completedTests !== null && (
                            <div className="text-xs text-gray-500">
                              {run.completedTests} / {run.totalTests} Tests abgeschlossen
                            </div>
                          )}
                        </div>
                      )}
                      {run.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 max-w-md truncate">
                          {run.errorMessage}
                        </div>
                      )}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {run.testSuite}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {run.triggeredBy === 'scheduled' ? (
                        <span className="text-blue-600">⏰ Auto</span>
                      ) : (
                        <span className="text-gray-600">👤 Manuell</span>
                      )}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {format(new Date(run.startTime), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {formatDuration(run.duration)}
                    </td>
                    <td 
                      className="px-4 py-4 whitespace-nowrap text-sm cursor-pointer"
                      onClick={() => router.push(`/test-runs/${run.id}`)}
                    >
                      {run.slackNotified ? '✓' : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {run.status === 'running' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Test im Browser ansehen?\n\nDer Test wird neu im headed Modus gestartet, damit du den Ablauf live verfolgen kannst.')) {
                              runTests(run.testName);
                            }
                          }}
                          className="btn-secondary text-xs px-3 py-1 whitespace-nowrap"
                          title="Achtung - Tests werden neugestartet!"
                        >
                          🎬 Browser
                        </button>
                      )}
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
