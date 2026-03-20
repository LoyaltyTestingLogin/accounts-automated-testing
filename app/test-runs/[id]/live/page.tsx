'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

/** Fortschritt aus Playwright-Parsing (SSE type: progress) */
interface RunProgressState {
  currentSpecPath: string | null;
  currentSuiteLabel: string;
  currentTestTitle: string | null;
  suitePosition: number;
  suiteTotal: number;
  completedSuites: { path: string; name: string }[];
  upcomingSuites: { path: string; name: string }[];
}

export default function LiveLogPage() {
  const params = useParams();
  const runId = parseInt(params.id as string);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [runProgress, setRunProgress] = useState<RunProgressState | null>(null);

  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(`http://localhost:4000/api/test-logs/${runId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          setSseConnected(true);
          setLiveLogs(prev => [...prev, `🔗 Verbunden mit Test-Run #${data.runId}\n`]);
        } else if (data.type === 'complete') {
          setLiveLogs(prev => [...prev, `\n✅ Test abgeschlossen! Tab schließt sich in 3 Sekunden...\n`]);
          setIsComplete(true);
          eventSource.close();
          
          // Tab automatisch schließen nach 3 Sekunden
          setTimeout(() => {
            window.close();
          }, 3000);
        } else if (data.type === 'progress') {
          setRunProgress({
            currentSpecPath: data.currentSpecPath ?? null,
            currentSuiteLabel: data.currentSuiteLabel ?? '',
            currentTestTitle: data.currentTestTitle ?? null,
            suitePosition: typeof data.suitePosition === 'number' ? data.suitePosition : 0,
            suiteTotal: typeof data.suiteTotal === 'number' ? data.suiteTotal : 0,
            completedSuites: Array.isArray(data.completedSuites) ? data.completedSuites : [],
            upcomingSuites: Array.isArray(data.upcomingSuites) ? data.upcomingSuites : [],
          });
        } else if (data.message) {
          setLiveLogs(prev => [...prev, data.message]);
        }
      } catch (error) {
        console.error('Fehler beim Parsen der SSE-Nachricht:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Fehler:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

  // Auto-Scroll zum Ende
  useEffect(() => {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, [liveLogs]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className={`inline-block w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
              Live Test-Logs
            </h1>
            <p className="text-sm text-blue-100 mt-1">Test-Run #{runId}</p>
          </div>
          <button
            onClick={() => window.close()}
            className="text-white hover:text-blue-200 transition-colors px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Tab schließen
          </button>
        </div>
      </div>

      {/* Fortschritt: erledigt · aktuell (Suite + Playwright-Testname) · danach — immer sichtbar sobald SSE verbunden */}
      {sseConnected && !isComplete && (
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-600 text-slate-100 space-y-4">
          {!runProgress && (
            <div className="rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
              <p className="font-medium text-amber-200/90">Fortschritt wird geladen …</p>
              <p className="mt-1 text-slate-400">
                Sobald Playwright eine Statuszeile mit <code className="text-slate-300">.spec.ts</code> meldet,
                erscheinen hier aktuelle Suite, Testfall-Name und die Warteschlange.
              </p>
            </div>
          )}
          {runProgress && (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                Läuft gerade (aktueller Playwright-Test)
              </div>
              <div className="text-lg font-semibold text-white leading-snug break-words">
                {runProgress.currentSuiteLabel}
              </div>
              {runProgress.currentTestTitle && (
                <div className="text-sm text-slate-200 break-words border-l-2 border-amber-400/70 pl-3">
                  <span className="text-slate-500 text-xs uppercase mr-2">Testfall</span>
                  {runProgress.currentTestTitle}
                </div>
              )}
              {runProgress.currentSpecPath && (
                <div className="text-xs font-mono text-slate-500 truncate" title={runProgress.currentSpecPath}>
                  {runProgress.currentSpecPath}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              {runProgress.suiteTotal > 0 && (
                <div className="text-2xl font-bold text-white tabular-nums">
                  {runProgress.suitePosition > 0 ? (
                    <>
                      Suite {runProgress.suitePosition}
                      <span className="text-slate-500 font-normal"> / </span>
                      {runProgress.suiteTotal}
                    </>
                  ) : (
                    <span className="text-base text-slate-400 font-normal">… / {runProgress.suiteTotal}</span>
                  )}
                </div>
              )}
              <div className="text-xs text-slate-500 mt-1">Reihenfolge wie in „Alle Tests“</div>
            </div>
          </div>

          {runProgress.completedSuites.length > 0 && (
            <div className="pt-2 border-t border-slate-600/80">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90 mb-2">
                Bereits erledigt ({runProgress.completedSuites.length})
              </div>
              <ul className="space-y-1 text-sm text-slate-400 max-h-32 overflow-y-auto">
                {runProgress.completedSuites.map((s) => (
                  <li key={s.path} className="flex gap-2 break-words">
                    <span className="text-emerald-500 shrink-0" aria-hidden>
                      ✓
                    </span>
                    <span className="line-through decoration-slate-600">{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {runProgress.upcomingSuites.length > 0 && (
            <div className="pt-2 border-t border-slate-600/80">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Kommt danach ({runProgress.upcomingSuites.length})
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300 max-h-40 overflow-y-auto">
                {runProgress.upcomingSuites.map((s) => (
                  <li key={s.path} className="break-words">
                    <span className="text-slate-200">{s.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="px-6 py-3 bg-blue-900/50 border-b border-blue-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-blue-100">
            Live Logs
          </p>
          <div className="text-sm text-blue-200">
            {liveLogs.length > 0 ? (
              <span className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-green-500 animate-pulse'}`}></span>
                {liveLogs.length} Log-Einträge
              </span>
            ) : (
              <span className="text-blue-300">Keine Logs</span>
            )}
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div 
        id="log-container"
        className="flex-1 overflow-y-auto p-6 font-mono text-sm"
      >
        <div className="text-green-400 whitespace-pre-wrap">
          {liveLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
              <p className="text-lg">Warte auf Test-Output...</p>
              <p className="text-sm mt-2 text-gray-600">Browser-Fenster sollte sich gleich öffnen →</p>
            </div>
          ) : (
            liveLogs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <span className="font-semibold text-gray-300">Testimate</span> • CHECK24 Login Testing • Live-Monitoring
        </div>
        {isComplete && (
          <div className="text-sm text-green-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Test abgeschlossen
          </div>
        )}
      </div>
    </div>
  );
}
