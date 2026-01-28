'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

interface TestRun {
  id: number;
  testName: string;
  testSuite: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  startTime: string;
  endTime: string | null;
  duration: number | null;
  errorMessage: string | null;
  screenshotPath: string | null;
  videoPath: string | null;
  tracePath: string | null;
  triggeredBy: 'manual' | 'scheduled';
  slackNotified: boolean;
}

interface TestRunDetails {
  mainRun: TestRun;
  batchRuns: TestRun[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export default function TestRunDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [details, setDetails] = useState<TestRunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDetails();
  }, [params.id]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/test-runs/${params.id}`);
      setDetails(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Lade Test-Details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">❌ Fehler</h1>
          <p className="text-gray-700 mb-4">{error || 'Test-Run nicht gefunden'}</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            ← Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const { mainRun, batchRuns, summary } = details;
  const failedTests = batchRuns.filter(r => r.status === 'failed');
  const passedTests = batchRuns.filter(r => r.status === 'passed');
  
  // Falls nur der Main-Run existiert (keine einzelnen Tests), zeige diesen an
  const hasIndividualTests = batchRuns.length > 1 || (batchRuns.length === 1 && batchRuns[0].id !== mainRun.id);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Zurück zur Übersicht
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Test-Run Details
          </h1>
          <p className="text-gray-600 mt-2">
            {new Date(mainRun.startTime).toLocaleString('de-DE')}
            {' · '}
            {mainRun.triggeredBy === 'manual' ? '👤 Manuell' : '⏰ Automatisch'}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Gesamt</div>
            <div className="text-3xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Erfolgreich</div>
            <div className="text-3xl font-bold text-green-600">{summary.passed}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Fehlgeschlagen</div>
            <div className="text-3xl font-bold text-red-600">{summary.failed}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Dauer</div>
            <div className="text-3xl font-bold text-gray-900">
              {mainRun.duration ? `${(mainRun.duration / 1000).toFixed(1)}s` : '-'}
            </div>
          </div>
        </div>

        {/* Command Error (wenn kein individueller Test) */}
        {!hasIndividualTests && mainRun.status === 'failed' && mainRun.errorMessage && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
              ❌ Test-Ausführung fehlgeschlagen
            </h2>
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="font-semibold text-gray-900 mb-3">
                Test-Suite: {mainRun.testName}
              </h3>
              <div className="text-sm font-medium text-gray-700 mb-2">Fehlerdetails:</div>
              <pre className="bg-gray-900 text-red-400 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                {mainRun.errorMessage}
              </pre>
              <div className="mt-3 text-sm text-gray-600">
                💡 <strong>Hinweis:</strong> Der Playwright-Command konnte nicht erfolgreich ausgeführt werden. 
                Möglicherweise wurde ein ungültiger Test-Pfad angegeben oder es gibt Syntax-Fehler im Test-Code.
              </div>
            </div>
          </div>
        )}

        {/* Failed Tests */}
        {hasIndividualTests && failedTests.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
              ❌ Fehlgeschlagene Tests ({failedTests.length})
            </h2>
            <div className="space-y-4">
              {failedTests.map((test) => (
                <div key={test.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{test.testName}</h3>
                      <p className="text-sm text-gray-600">{test.testSuite}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      Failed
                    </span>
                  </div>
                  
                  {test.errorMessage && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Fehlerdetails:</div>
                      <pre className="bg-gray-900 text-red-400 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                        {test.errorMessage}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2 text-sm">
                    {test.duration && (
                      <span className="text-gray-600">
                        ⏱ {(test.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                    {test.screenshotPath && (
                      <span className="text-blue-600">📷 Screenshot verfügbar</span>
                    )}
                    {test.videoPath && (
                      <span className="text-blue-600">🎥 Video verfügbar</span>
                    )}
                    {test.tracePath && (
                      <span className="text-blue-600">🔍 Trace verfügbar</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passed Tests */}
        {hasIndividualTests && passedTests.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold text-green-600 mb-4 flex items-center gap-2">
              ✅ Erfolgreiche Tests ({passedTests.length})
            </h2>
            <div className="space-y-2">
              {passedTests.map((test) => (
                <div key={test.id} className="border border-green-200 rounded-lg p-3 bg-green-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{test.testName}</h3>
                    <p className="text-sm text-gray-600">{test.testSuite}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {test.duration && (
                      <span className="text-sm text-gray-600">
                        ⏱ {(test.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Passed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success message for non-individual tests */}
        {!hasIndividualTests && mainRun.status === 'passed' && (
          <div className="card">
            <h2 className="text-xl font-bold text-green-600 mb-4 flex items-center gap-2">
              ✅ Test erfolgreich
            </h2>
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold text-gray-900 mb-2">
                Test-Suite: {mainRun.testName}
              </h3>
              <p className="text-gray-600">
                Alle Tests wurden erfolgreich ausgeführt.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push('/')}
            className="btn-secondary"
          >
            ← Zurück zur Übersicht
          </button>
          <a
            href="/test-results/html-report/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            📊 Vollständiger HTML-Report
          </a>
        </div>
      </div>
    </div>
  );
}
