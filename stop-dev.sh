#!/usr/bin/env bash
# Beendet Prozesse auf Port 3000 (Frontend) und 4000 (API)
for port in 3000 4000; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [[ -n "$pid" ]]; then
    echo "Beende Prozess auf Port $port (PID $pid)..."
    kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
  else
    echo "Port $port ist frei."
  fi
done
echo "Fertig. Du kannst jetzt ./start-dev.sh erneut ausführen."
