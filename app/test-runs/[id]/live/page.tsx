'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function LiveLogPage() {
  const params = useParams();
  const runId = parseInt(params.id as string);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(`http://localhost:4000/api/test-logs/${runId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          setLiveLogs(prev => [...prev, `🔗 Verbunden mit Test-Run #${data.runId}\n`]);
        } else if (data.type === 'complete') {
          setLiveLogs(prev => [...prev, `\n✅ Test abgeschlossen! Tab schließt sich in 3 Sekunden...\n`]);
          setIsComplete(true);
          eventSource.close();

          setTimeout(() => {
            window.close();
          }, 3000);
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

  useEffect(() => {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, [liveLogs]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
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

      <div className="px-6 py-3 bg-blue-900/50 border-b border-blue-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-blue-100">Live Logs</p>
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
