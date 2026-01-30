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
  const [selectedSuite, setSelectedSuite] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTestInfo, setShowTestInfo] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [schedulerPaused, setSchedulerPaused] = useState(false);
  const [schedulerAvailable, setSchedulerAvailable] = useState(true);
  const [togglingScheduler, setTogglingScheduler] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Auto-Refresh alle 10 Sekunden
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);


  const fetchData = async () => {
    try {
      const [runsRes, statsRes, suitesRes, schedulerRes] = await Promise.all([
        axios.get('/api/test-runs?limit=20'),
        axios.get('/api/statistics'),
        axios.get('/api/test-suites'),
        axios.get('/api/scheduler/status').catch(() => ({ data: { data: { available: false, isPaused: false } } })),
      ]);

      setTestRuns(runsRes.data.data || []);
      setStatistics(statsRes.data.data || null);
      setTestSuites(suitesRes.data.data || []);
      
      // Scheduler Status
      if (schedulerRes.data?.data) {
        setSchedulerAvailable(schedulerRes.data.data.available);
        setSchedulerPaused(schedulerRes.data.data.isPaused || false);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const toggleScheduler = async () => {
    if (togglingScheduler || !schedulerAvailable) return;

    setTogglingScheduler(true);
    
    try {
      const endpoint = schedulerPaused ? '/api/scheduler/resume' : '/api/scheduler/pause';
      const response = await axios.post(endpoint);
      
      if (response.data.success) {
        setSchedulerPaused(!schedulerPaused);
        alert(schedulerPaused ? '▶️ Automatische Tests laufen wieder' : '⏸️ Automatische Tests pausiert');
      }
    } catch (error) {
      console.error('Fehler beim Pausieren/Fortsetzen:', error);
      alert('Fehler beim Ändern des Scheduler-Status');
    } finally {
      setTogglingScheduler(false);
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

      const response = await axios.post('/api/run-tests', {
        testPath: actualTestPath,
        headed: true,
      });

      // Öffne Live-Log in neuem Fenster (links positioniert, 1/3 Breite)
      if (response.data.runId) {
        const logUrl = `/test-runs/${response.data.runId}/live`;
        
        // Ermittle Bildschirmbreite und -höhe
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        // Log-Fenster nimmt linkes Drittel
        const logWidth = Math.floor(screenWidth / 3);
        const logHeight = screenHeight;
        
        // Öffne neues Fenster mit spezifischen Koordinaten (linkes Drittel)
        window.open(
          logUrl,
          'LiveTestLogs',
          `width=${logWidth},height=${logHeight},left=0,top=0,menubar=no,toolbar=no,location=no,status=no`
        );
      } else {
        alert('Tests gestartet! Die Ergebnisse erscheinen in Kürze.');
      }
      
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
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Testimate
            </h1>
            <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm">
              by CHECK24
            </span>
          </div>
          <p className="text-gray-600">
            Automatisiertes E2E Testing mit 24/7 Monitoring
          </p>
        </div>
        
        {/* Scheduler Pause/Resume Button */}
        {schedulerAvailable && (
          <div className="relative group">
            <button
              onClick={toggleScheduler}
              disabled={togglingScheduler}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-2 ${
                schedulerPaused 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              } ${togglingScheduler ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
            >
              {togglingScheduler ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Wird geändert...</span>
                </>
              ) : schedulerPaused ? (
                <>
                  <span>▶️</span>
                  <span>Tests fortsetzen</span>
                </>
              ) : (
                <>
                  <span>⏸️</span>
                  <span>Tests pausieren</span>
                </>
              )}
            </button>
            
            {/* Custom Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
              <div className="font-bold mb-2">
                {schedulerPaused ? '▶️ Tests fortsetzen' : '⏸️ Automatische Tests pausieren'}
              </div>
              <div className="text-gray-300 space-y-1">
                {schedulerPaused ? (
                  <>
                    <p>• Automatische Tests laufen wieder alle <strong>15 Minuten</strong></p>
                    <p>• 24/7 Monitoring wird fortgesetzt</p>
                    <p>• Manuelle Tests waren weiterhin möglich</p>
                  </>
                ) : (
                  <>
                    <p>• Stoppt die automatischen Test-Durchläufe</p>
                    <p>• Läuft normalerweise alle <strong>15 Minuten</strong></p>
                    <p>• Manuelle Tests bleiben weiterhin möglich</p>
                  </>
                )}
              </div>
              {/* Arrow */}
              <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
            </div>
          </div>
        )}
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
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🧪 Tests manuell ausführen
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LINKE KARTE: Einzelner Test mit Browser-Ansicht */}
          <div className="card border-2 border-blue-200 bg-blue-50/30">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🎬</span>
                  Einzelner Test (mit Browser)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Führt einen ausgewählten Test im Browser aus → <strong>Du kannst zusehen</strong>
                </p>
              </div>
            </div>

            {/* Spacer oben */}
            <div className="py-3"></div>

            <div>
            <div className="relative">
              {/* Kombiniertes Such-/Dropdown-Feld */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Test suchen oder auswählen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                  disabled={runningTest}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  {isDropdownOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
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
                                  runTests(suite.path);
                                  setIsDropdownOpen(false);
                                  setSearchQuery('');
                                  setSelectedSuite(''); // Dropdown zurücksetzen
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
                                      <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded whitespace-pre-line">
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

          {/* RECHTE KARTE: Alle Tests im Hintergrund */}
          <div className="card border-2 border-purple-200 bg-purple-50/30">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Alle Tests (ohne Browser)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Führt alle Tests im Hintergrund aus → <strong>Läuft ohne Browser-Fenster</strong>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Statistik */}
              <div className="text-center py-6">
                <div className="text-3xl font-bold text-purple-600">{testSuites.length}</div>
                <div className="text-sm text-gray-600">Tests verfügbar</div>
              </div>

              {/* Button */}
              <button
                onClick={() => runTests('tests')}
                disabled={runningTest}
                className="w-full btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {runningTest ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>Tests laufen...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Alle Tests starten</span>
                  </>
                )}
              </button>
            </div>
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
          <span className="font-semibold text-gray-700">Testimate</span> • CHECK24 Login Testing System • 
          Automatische Tests alle {process.env.TEST_INTERVAL_MINUTES || '15'} Minuten
        </p>
      </footer>
    </div>
  );
}
