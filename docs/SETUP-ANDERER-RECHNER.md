# Setup auf einem anderen Rechner (nach `git clone` / `git pull`)

Wenn Tests auf deinem Rechner laufen, auf einem anderen aber **gar nicht**, liegt es fast immer an der **lokalen Umgebung** – nicht am Git-Stand. Das Repository enthält **keine** `node_modules`, keine Playwright-Browser und oft **keine** `.env` (die liegt bei dir nur lokal).

## Checkliste (Reihenfolge beachten)

### 1. Node.js

- Version **≥ 18** (`node -v`)
- Am besten dieselbe Major-Version wie auf dem funktionierenden Rechner

### 2. Abhängigkeiten **immer** neu ziehen nach Pull

`start-dev.sh` installiert früher nur bei **fehlendem** `node_modules`. Nach `git pull` kann `package-lock.json` / `package.json` geändert sein – dann reicht das nicht.

```bash
npm install
```

### 3. Playwright-Browser installieren (häufigste Ursache für „kein Test läuft“)

Ohne Chromium schlägt **jeder** Playwright-Lauf fehl (Fehler wie „Executable doesn’t exist“ / Browser not found).

```bash
npm run install:playwright
# oder
npx playwright install chromium
```

### 4. `.env` anlegen

Ohne gültige Werte (z. B. **Azure / Microsoft Graph** für E-Mail-Codes) schlagen viele Login-Tests fehl – das wirkt dann wie „alles kaputt“.

```bash
cp .env.example .env
```

`.env` **von Hand ausfüllen** (wie auf dem Rechner, wo es läuft): mindestlich alles, was eure Tests brauchen (siehe `.env.example` und eure interne Doku). **Keine** `.env` ins Git committen.

### 5. Native Modul `better-sqlite3`

Wird pro Betriebssystem/CPU gebaut. Nach `npm install` auf dem **Zielrechner** sollte es passen.

Falls die API mit SQLite-Fehlern startet:

```bash
npm rebuild better-sqlite3
```

**Niemals** den Ordner `node_modules` von einem Mac auf Windows kopieren (oder umgekehrt).

### 6. Datenbank-Verzeichnis

Standard: `DATABASE_PATH=./data/testresults.db` – Ordner `data/` wird bei Bedarf angelegt. Schreibrechte im Projektverzeichnis prüfen.

### 7. Windows

- `./start-dev.sh` braucht **Git Bash**, **WSL** oder vergleichbar.
- Alternativ: `npm install`, `npx playwright install chromium`, dann `npm run dev`.

### 8. Ports

Frontend **3000**, API **4000** – dürfen nicht von anderen Programmen belegt sein.

---

## Kurz: Minimal-Befehle nach Klonen / Pull

```bash
git pull
npm install
npx playwright install chromium
cp .env.example .env   # und ausfüllen wie auf dem funktionierenden Rechner
./start-dev.sh
```

`./start-dev.sh` führt ab jetzt bei jedem Start `npm install` und die Playwright-Browser-Installation aus (siehe Skript im Repo).
