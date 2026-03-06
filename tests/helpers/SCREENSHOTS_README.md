# Auto-Screenshot System

## Übersicht

Das Auto-Screenshot-System erstellt automatisch Screenshots während der Testausführung. **Wichtig**: Screenshots werden nur dann übernommen, wenn der Test erfolgreich durchläuft!

## Wie es funktioniert

1. **Temporäre Speicherung**: Screenshots werden zunächst in `.screenshots-temp/[flow-name]/` gespeichert
2. **Bei Erfolg**: `commitScreenshots()` kopiert alle Screenshots nach `public/flow-screenshots/[flow-name]/`
3. **Bei Fehler**: Temp-Ordner wird gelöscht, alte Screenshots bleiben unverändert

## Verwendung in Tests

```typescript
import { enableAutoScreenshots, takeAutoScreenshot, commitScreenshots, disableAutoScreenshots } from '../helpers/screenshots';

test('Mein Test', async ({ page }) => {
  enableAutoScreenshots('my-flow-name');
  
  try {
    // Test-Schritte...
    await page.goto('...');
    await takeAutoScreenshot(page, 'beschreibung');
    
    // Mehr Test-Schritte...
    
    // Test erfolgreich - Screenshots übernehmen
    commitScreenshots();
    
    // Optional: Cleanup-Schritte (z.B. Account löschen)
    
  } finally {
    disableAutoScreenshots(); // Räumt temp-Ordner auf
  }
});
```

## Wichtige Funktionen

### `enableAutoScreenshots(flowName: string)`
- Aktiviert Auto-Screenshots für einen Flow
- Erstellt temp-Ordner `.screenshots-temp/[flowName]/`
- **Aufruf**: Am Anfang des Tests

### `takeAutoScreenshot(page: Page, description: string)`
- Erstellt einen Screenshot im temp-Ordner
- Filename: `01-beschreibung.png`, `02-beschreibung.png`, etc.
- **Aufruf**: An wichtigen Stellen im Test

### `commitScreenshots()`
- Kopiert Screenshots vom temp-Ordner ins finale Verzeichnis
- **Aufruf**: Nur wenn Test erfolgreich war! (nach allen Assertions, vor Cleanup)

### `disableAutoScreenshots()`
- Löscht temp-Ordner
- **Aufruf**: Im `finally`-Block

## Beispiele

### Test mit Cleanup
```typescript
test('Registration', async ({ page }) => {
  enableAutoScreenshots('email-registration');
  
  try {
    // Registrierung durchführen...
    await takeAutoScreenshot(page, 'login-screen');
    // ... mehr Schritte ...
    
    // Erfolg verifizieren
    await expectLoginSuccess(page);
    
    // ✅ Test erfolgreich - Screenshots übernehmen
    commitScreenshots();
    
    // Cleanup (nicht in Screenshots)
    await deleteAccount(page);
    
  } finally {
    disableAutoScreenshots();
  }
});
```

### Test ohne Cleanup
```typescript
test('Login', async ({ page }) => {
  enableAutoScreenshots('login-password');
  
  try {
    // Login durchführen...
    await takeAutoScreenshot(page, 'before-login');
    // ... mehr Schritte ...
    
    await expectLoginSuccess(page);
    
    // ✅ Test erfolgreich - Screenshots übernehmen
    commitScreenshots();
    
  } finally {
    disableAutoScreenshots();
  }
});
```

## Fehlerbehandlung

**Bei Test-Fehler:**
- `commitScreenshots()` wird NICHT aufgerufen
- `disableAutoScreenshots()` löscht den temp-Ordner
- Alte Screenshots in `public/flow-screenshots/` bleiben unverändert ✅

**Bei Test-Abbruch:**
- Temp-Ordner bleibt erstmal bestehen
- Bei nächstem Test-Start wird temp-Ordner gelöscht und neu erstellt

## Ordnerstruktur

```
.screenshots-temp/           # Temporär (in .gitignore)
  ├── email-registration/
  ├── phone-registration/
  └── login-password/

public/flow-screenshots/     # Final (in Git)
  ├── email-registration/
  ├── phone-registration/
  └── login-password/
```
