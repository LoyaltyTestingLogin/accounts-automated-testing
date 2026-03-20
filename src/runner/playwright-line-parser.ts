/**
 * Parst Zeilen aus Playwright line/list Reportern.
 * Typische Formate:
 *   [chromium] › tests/login/foo.spec.ts:17:7 › Describe › Testname
 *   ✓  3 [chromium] › tests/login/foo.spec.ts:17:7 › … (1.2m)
 * Mit PW_TEST_DEBUG_REPORTERS=1:  #12 :   ✓  3 [chromium] › …
 * Playwright nutzt oft U+203A (›) statt ASCII.
 */

export interface ParsedPlaywrightTestLine {
  specPath: string;
  testTitle: string;
}

/** Enthält Playwright-Titel-Trenner (› oder U+203A)? */
function hasTitleSeparator(s: string): boolean {
  return /[›\u203A]/.test(s);
}

/** Entfernt ANSI-Farbcodes (Playwright-Reporter mit Farben). */
function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}

function normalizeSpecPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function stripTrailingDuration(rest: string): string {
  return rest.replace(/\s*\([\d.]+\s*[smh]\)\s*$/, '').trim();
}

export function parsePlaywrightTestLine(line: string): ParsedPlaywrightTestLine | null {
  let trimmed = stripAnsi(line).replace(/\r/g, '').trim();
  // Debug-Modus: Zeilen beginnen mit "#row : "
  trimmed = trimmed.replace(/^#\d+\s*:\s*/, '');

  if (!trimmed.includes('.spec.ts')) {
    return null;
  }

  // Mindestens ein Titel-Trenner (› oder U+203A)
  if (!hasTitleSeparator(trimmed)) {
    return null;
  }

  // Variante A: [project] › rest
  const bracketIdx = trimmed.indexOf('[');
  if (bracketIdx !== -1) {
    const afterBracket = trimmed.slice(bracketIdx);
    const match = afterBracket.match(/^\[([^\]]+)\]\s*(?:›|\u203A)\s*(.+)$/);
    if (match) {
      let rest = stripTrailingDuration(match[2].trim());
      const specMatch = rest.match(/^(.+?\.spec\.ts)(?::\d+:\d+)?(?:\s*(?:›|\u203A)\s*(.*))?$/s);
      if (specMatch) {
        const specPath = normalizeSpecPath(specMatch[1].trim());
        const testTitle = (specMatch[2] || '').trim();
        return {
          specPath,
          testTitle: testTitle || '(Test wird ausgeführt …)',
        };
      }
    }
  }

  // Variante B: irgendwo im String … file.spec.ts[:line:col] › Titel (ohne Pflicht [chromium])
  const loose = trimmed.match(/([\w./-]+\.spec\.ts)(?::\d+:\d+)?\s*(?:›|\u203A)\s*(.+)$/);
  if (loose) {
    let title = stripTrailingDuration(loose[2].trim());
    return {
      specPath: normalizeSpecPath(loose[1]),
      testTitle: title || '(Test wird ausgeführt …)',
    };
  }

  return null;
}
