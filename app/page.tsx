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
  status: 'pending' | 'running' | 'passed' | 'failed' | 'timeout' | 'cancelled';
  startTime: string;
  endTime: string | null;
  duration: number | null;
  errorMessage: string | null;
  triggeredBy: 'manual' | 'scheduled';
  slackNotified: boolean;
  progress: number | null;
  totalTests: number | null;
  completedTests: number | null;
  environment: 'prod' | 'test';
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

/** Hinweise vor Start: Passkey-Test, Passwort Happy Path (Login Challenge), oder beides bei „Alle Tests“. */
function getInfoDialogKindForPath(resolvedPath: string): InfoDialogKind | null {
  const isAll = resolvedPath === 'tests';
  const norm = resolvedPath.replace(/\\/g, '/');
  const hasPasskey = isAll || norm.includes('passkey-happy-path');
  const hasPasswordHappy = isAll || norm.includes('password-happy-path');
  if (hasPasskey && hasPasswordHappy) return 'both';
  if (hasPasskey) return 'passkey';
  if (hasPasswordHappy) return 'password-happy';
  return null;
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
  const [schedulerPausedProd, setSchedulerPausedProd] = useState(false);
  const [schedulerPausedTest, setSchedulerPausedTest] = useState(false);
  const [schedulerAvailable, setSchedulerAvailable] = useState(true);
  const [togglingSchedulerProd, setTogglingSchedulerProd] = useState(false);
  const [togglingSchedulerTest, setTogglingSchedulerTest] = useState(false);
  const [estimatedTotalDuration, setEstimatedTotalDuration] = useState<number | null>(null);
  const [schedulerInterval, setSchedulerInterval] = useState(15);
  const [changingInterval, setChangingInterval] = useState(false);
  const [environment, setEnvironment] = useState<'prod' | 'test'>('prod');
  const [environmentLoaded, setEnvironmentLoaded] = useState(false);
  const [cleanupDays, setCleanupDays] = useState<number>(4);

  const [infoDialog, setInfoDialog] = useState<InfoDialogKind | null>(null);
  const [pendingTestPath, setPendingTestPath] = useState<string | null>(null);

  // Lade gespeicherte Umgebung aus localStorage beim ersten Render
  useEffect(() => {
    const savedEnv = localStorage.getItem('testEnvironment') as 'prod' | 'test' | null;
    if (savedEnv === 'prod' || savedEnv === 'test') {
      setEnvironment(savedEnv);
    }
    setEnvironmentLoaded(true);
  }, []);

  // Speichere Umgebung in localStorage bei Änderung
  useEffect(() => {
    if (environmentLoaded) {
      localStorage.setItem('testEnvironment', environment);
    }
  }, [environment, environmentLoaded]);

  useEffect(() => {
    if (environmentLoaded) {
      fetchData();
    }
    
    // Auto-Refresh alle 10 Sekunden
    const interval = setInterval(() => {
      if (environmentLoaded) {
        fetchData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [environment, environmentLoaded]);


  const formatEstimatedDuration = (ms: number): string => {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `~${minutes} Min ${seconds} Sek`;
    }
    return `~${seconds} Sek`;
  };

  const calculateEstimatedDuration = (runs: TestRun[]) => {
    // Filtere alle "All Tests" Runs die erfolgreich waren
    // Der testName ist "tests" wenn alle Tests ausgeführt werden
    const allTestsRuns = runs.filter(
      run => (run.testName === 'All Tests' || run.testName === 'tests') && 
             run.status === 'passed' && 
             run.duration !== null
    );
    
    if (allTestsRuns.length === 0) {
      // Keine Daten vorhanden - zeige nichts an
      setEstimatedTotalDuration(null);
      return;
    }
    
    // Berechne Durchschnitt aller erfolgreichen "All Tests" Runs
    const avgDuration = allTestsRuns.reduce((sum, run) => sum + (run.duration || 0), 0) / allTestsRuns.length;
    setEstimatedTotalDuration(avgDuration);
  };

  const fetchData = async () => {
    try {
      const [runsRes, statsRes, suitesRes, schedulerRes, intervalRes, cleanupRes] = await Promise.all([
        axios.get(`/api/test-runs?limit=20&environment=${environment}`),
        axios.get(`/api/statistics?environment=${environment}`),
        axios.get('/api/test-suites'),
        axios.get('/api/scheduler/status').catch(() => ({ data: { data: { available: false, isPaused: false } } })),
        axios.get('/api/scheduler/interval').catch(() => ({ data: { data: { intervalMinutes: 15 } } })),
        axios.get('/api/cleanup-config').catch(() => ({ data: { data: { cleanupDays: 4 } } })),
      ]);

      setTestRuns(runsRes.data.data || []);
      setStatistics(statsRes.data.data || null);
      setTestSuites(suitesRes.data.data || []);
      
      // Scheduler Status
      if (schedulerRes.data?.data) {
        setSchedulerAvailable(schedulerRes.data.data.available);
        setSchedulerPausedProd(schedulerRes.data.data.isPausedProd || false);
        setSchedulerPausedTest(schedulerRes.data.data.isPausedTest || false);
      }
      
      // Scheduler Intervall
      if (intervalRes.data?.data) {
        setSchedulerInterval(intervalRes.data.data.intervalMinutes || 15);
      }
      
      // Cleanup-Konfiguration
      if (cleanupRes.data?.data) {
        setCleanupDays(cleanupRes.data.data.cleanupDays || 4);
      }
      
      // Berechne geschätzte Gesamtdauer basierend auf "All Tests" Runs
      calculateEstimatedDuration(runsRes.data.data || []);
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const toggleScheduler = async () => {
    const env = environment; // Verwende das aktuell ausgewählte Environment
    const isToggling = env === 'prod' ? togglingSchedulerProd : togglingSchedulerTest;
    const isPaused = env === 'prod' ? schedulerPausedProd : schedulerPausedTest;
    
    if (isToggling || !schedulerAvailable) return;

    if (env === 'prod') {
      setTogglingSchedulerProd(true);
    } else {
      setTogglingSchedulerTest(true);
    }
    
    try {
      const endpoint = isPaused ? '/api/scheduler/resume' : '/api/scheduler/pause';
      const response = await axios.post(endpoint, { environment: env });
      
      if (response.data.success) {
        if (env === 'prod') {
          setSchedulerPausedProd(!isPaused);
        } else {
          setSchedulerPausedTest(!isPaused);
        }
        alert(`${env.toUpperCase()}: ${isPaused ? '▶️ Automatische Tests laufen wieder' : '⏸️ Automatische Tests pausiert'}`);
      }
    } catch (error) {
      console.error('Fehler beim Pausieren/Fortsetzen:', error);
      alert('Fehler beim Ändern des Scheduler-Status');
    } finally {
      if (env === 'prod') {
        setTogglingSchedulerProd(false);
      } else {
        setTogglingSchedulerTest(false);
      }
    }
  };

  const changeInterval = async (newInterval: number) => {
    if (changingInterval || !schedulerAvailable) return;

    setChangingInterval(true);
    
    try {
      const response = await axios.post('/api/scheduler/interval', {
        intervalMinutes: newInterval,
      });
      
      if (response.data.success) {
        setSchedulerInterval(newInterval);
        alert(`⏱️ Intervall geändert auf ${formatInterval(newInterval)}`);
      }
    } catch (error: any) {
      console.error('Fehler beim Ändern des Intervalls:', error);
      alert(error.response?.data?.error || 'Fehler beim Ändern des Intervalls');
    } finally {
      setChangingInterval(false);
    }
  };

  const formatInterval = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} Min`;
    } else if (minutes < 1440) {
      const hours = minutes / 60;
      return hours % 1 === 0 ? `${hours} Std` : `${hours} Std`;
    } else {
      return '24 Std';
    }
  };

  /** Start nach Bestätigung im Hinweis-Dialog (oder ohne Dialog). */
  const performRunTests = async (actualTestPath: string) => {
    if (runningTest) return;

    setRunningTest(true);

    try {
      const response = await axios.post('/api/run-tests', {
        testPath: actualTestPath,
        headed: true,
        environment,
      });

      if (response.data.runId) {
        const logUrl = `/test-runs/${response.data.runId}/live`;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const logWidth = Math.floor(screenWidth / 3);
        const logHeight = screenHeight;
        window.open(
          logUrl,
          'LiveTestLogs',
          `width=${logWidth},height=${logHeight},left=0,top=0,menubar=no,toolbar=no,location=no,status=no`
        );
      } else {
        alert('Tests gestartet! Die Ergebnisse erscheinen in Kürze.');
      }

      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Fehler beim Starten der Tests:', error);
      alert('Fehler beim Starten der Tests');
    } finally {
      setRunningTest(false);
    }
  };

  /**
   * Zeigt bei Passkey / Passwort Happy Path / „Alle Tests“ einen Hinweis-Dialog;
   * erst nach „Verstanden …“ wird gestartet.
   */
  const requestRunTests = (testPath?: string) => {
    if (runningTest) return;

    let actualTestPath = testPath;
    if (!actualTestPath) {
      const selectedSuiteObj = testSuites.find((s) => s.id === selectedSuite);
      actualTestPath = selectedSuiteObj?.path || PATH_PASSWORD_HAPPY;
    }

    const kind = getInfoDialogKindForPath(actualTestPath);
    if (kind) {
      setPendingTestPath(actualTestPath);
      setInfoDialog(kind);
      return;
    }

    void performRunTests(actualTestPath);
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
      case 'timeout':
        return <span className="badge-warning">⚠ Timeout</span>;
      case 'running':
        return <span className="badge-info">⟳ Läuft</span>;
      case 'pending':
        return <span className="badge-warning">⋯ Wartend</span>;
      case 'cancelled':
        return <span className="badge-warning" style={{ backgroundColor: '#6b7280', color: 'white' }}>🛑 Abgebrochen</span>;
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
      {/* Hinweis-Popup vor Passkey / Happy Path / Alle Tests */}
      {infoDialog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="test-hint-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 cursor-default"
            aria-label="Schließen"
            onClick={cancelInfoDialog}
          />
          <div className="relative z-[10000] bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-left">
            <h2 id="test-hint-dialog-title" className="text-lg font-bold text-gray-900 mb-2">
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
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-gray-900">
                Testimate
              </h1>
              <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm">
                by CHECK24
              </span>
            </div>
            <a
              href="/flows"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all hover:scale-105 font-semibold"
            >
              <span>📸</span>
              <span>Login & Registrierungs-Flows</span>
            </a>
          </div>
          <p className="text-gray-600">
            Automatisiertes E2E Testing mit 24/7 Monitoring
          </p>
        </div>

        {/* Environment Switch */}
        <div className="flex flex-col items-center gap-2">
          <label className="text-xs text-gray-600 font-medium">Umgebung</label>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setEnvironment('test')}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${
                environment === 'test'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              TEST
            </button>
            <button
              onClick={() => setEnvironment('prod')}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${
                environment === 'prod'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              PROD
            </button>
          </div>
        </div>
        
        {/* Scheduler Controls */}
        {schedulerAvailable && (
          <div className="flex items-center gap-3">
            {/* Intervall Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600 font-medium">Test-Intervall</label>
              <select
                value={schedulerInterval}
                onChange={(e) => changeInterval(parseInt(e.target.value))}
                disabled={changingInterval}
                className={`px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  changingInterval ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <option value={30}>Alle 30 Min</option>
                <option value={45}>Alle 45 Min</option>
                <option value={60}>Alle 60 Min</option>
                <option value={90}>Alle 90 Min</option>
                <option value={120}>Alle 2 Std</option>
                <option value={180}>Alle 3 Std</option>
                <option value={240}>Alle 4 Std</option>
                <option value={360}>Alle 6 Std</option>
                <option value={480}>Alle 8 Std</option>
                <option value={720}>Alle 12 Std</option>
                <option value={1440}>Alle 24 Std</option>
              </select>
            </div>

            {/* Pause/Resume Button (abhängig vom aktuellen Environment) */}
            <div className="relative group flex flex-col gap-1">
              <label className="text-xs text-gray-600 font-medium">Status ({environment.toUpperCase()})</label>
              <button
                onClick={toggleScheduler}
                disabled={environment === 'prod' ? togglingSchedulerProd : togglingSchedulerTest}
                className={`px-6 py-2.5 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-2 ${
                  (environment === 'prod' ? schedulerPausedProd : schedulerPausedTest)
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } ${(environment === 'prod' ? togglingSchedulerProd : togglingSchedulerTest) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
              >
                {(environment === 'prod' ? togglingSchedulerProd : togglingSchedulerTest) ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Ändern...</span>
                  </>
                ) : (environment === 'prod' ? schedulerPausedProd : schedulerPausedTest) ? (
                  <>
                    <span>▶️</span>
                    <span>Fortsetzen</span>
                  </>
                ) : (
                  <>
                    <span>⏸️</span>
                    <span>Pausieren</span>
                  </>
                )}
              </button>
              
              {/* Custom Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="font-bold mb-2">
                  {(environment === 'prod' ? schedulerPausedProd : schedulerPausedTest) ? '▶️ Tests fortsetzen' : '⏸️ Automatische Tests pausieren'} ({environment.toUpperCase()})
                </div>
                <div className="text-gray-300 space-y-1">
                  {(environment === 'prod' ? schedulerPausedProd : schedulerPausedTest) ? (
                    <>
                      <p>• Automatische Tests laufen wieder alle <strong>{formatInterval(schedulerInterval)}</strong></p>
                      <p>• 24/7 Monitoring wird fortgesetzt</p>
                      <p>• Manuelle Tests waren weiterhin möglich</p>
                    </>
                  ) : (
                    <>
                      <p>• Stoppt die automatischen Test-Durchläufe</p>
                      <p>• Läuft normalerweise alle <strong>{formatInterval(schedulerInterval)}</strong></p>
                      <p>• Manuelle Tests bleiben weiterhin möglich</p>
                    </>
                  )}
                </div>
                {/* Arrow */}
                <div className="absolute -top-2 right-8 w-4 h-4 bg-gray-900 transform rotate-45"></div>
              </div>
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
                <h3 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                  <span className="text-2xl">🎬</span>
                  Einzelner Test
                </h3>
                <p className="text-sm text-gray-600 mt-1 text-center">
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
                                  requestRunTests(suite.path);
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
                <h3 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Alle Tests
                </h3>
                <p className="text-sm text-gray-600 mt-1 text-center">
                  Führt alle {testSuites.length} Tests <strong>sequenziell nacheinander</strong> aus → <strong>Du kannst zusehen</strong>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Statistik */}
              <div className="text-center py-6">
                <div className="text-3xl font-bold text-purple-600">{testSuites.length}</div>
                <div className="text-sm text-gray-600">Tests verfügbar</div>
                {estimatedTotalDuration !== null && (
                  <div className="mt-3 text-sm text-gray-600">
                    <span className="font-medium">Geschätzte Dauer:</span> {formatEstimatedDuration(estimatedTotalDuration)}
                  </div>
                )}
              </div>

              {/* Button */}
              <button
                onClick={() => requestRunTests('tests')}
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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Letzte Test-Durchläufe
          </h2>
          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <span className="font-medium">🧹 Auto-Cleanup:</span> Test-Runs älter als {cleanupDays} Tage werden täglich um 3:00 Uhr automatisch gelöscht
          </div>
        </div>

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
                      {run.status === 'running' && run.totalTests !== null && run.totalTests > 1 && run.completedTests !== null && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-600 font-semibold mb-1">
                            {run.completedTests} / {run.totalTests} Test-Suites abgeschlossen
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(run.completedTests / run.totalTests) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 font-medium min-w-[50px] text-right">
                              {Math.round((run.completedTests / run.totalTests) * 100)}%
                            </span>
                          </div>
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
          Automatische Tests alle {formatInterval(schedulerInterval)}
        </p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <span className={schedulerPausedProd ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            PROD: {schedulerPausedProd ? '⏸️ Pausiert' : '▶️ Aktiv'}
          </span>
          <span className="text-gray-300">•</span>
          <span className={schedulerPausedTest ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            TEST: {schedulerPausedTest ? '⏸️ Pausiert' : '▶️ Aktiv'}
          </span>
        </p>
      </footer>
    </div>
  );
}
