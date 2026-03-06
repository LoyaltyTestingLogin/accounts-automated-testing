#!/bin/bash

# Script um Auto-Screenshots in die restlichen Tests zu integrieren
# Dieses Script ist nur zur Dokumentation - die eigentliche Integration muss manuell erfolgen

echo "❌ Dieses Script ist nur eine Dokumentation"
echo "Die Integration muss manuell in den Tests erfolgen:"
echo ""
echo "Tests die noch Auto-Screenshots brauchen:"
echo "  - tests/registration/phone-registrierung-happy-path.spec.ts"
echo "  - tests/login/password-happy-path.spec.ts"
echo "  - tests/login/otp-happy-path.spec.ts"
echo "  - tests/login/password-reset.spec.ts"
echo ""
echo "Für jeden Test:"
echo "  1. Import hinzufügen: import { enableAutoScreenshots, takeAutoScreenshot, disableAutoScreenshots } from '../helpers/screenshots';"
echo "  2. Am Anfang des Tests: enableAutoScreenshots('flow-name');"
echo "  3. An wichtigen Stellen: await takeAutoScreenshot(page, 'description');"
echo "  4. Im finally-Block: disableAutoScreenshots();"

exit 1
