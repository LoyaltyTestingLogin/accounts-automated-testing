'use client';

import { useState } from 'react';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface FlowStep {
  id: string;
  title: string;
  description: string;
  screenshot: string;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  category: 'registration' | 'login' | 'account-replace';
  steps: FlowStep[];
}

// PDF Export Funktion
async function exportFlowToPDF(flow: Flow) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (2 * margin);
  
  // Titel-Seite
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text(flow.name, pageWidth / 2, 40, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const descLines = pdf.splitTextToSize(flow.description, contentWidth);
  pdf.text(descLines, pageWidth / 2, 60, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generiert am: ${new Date().toLocaleDateString('de-DE')}`, pageWidth / 2, 80, { align: 'center' });
  pdf.text(`Anzahl Schritte: ${flow.steps.length}`, pageWidth / 2, 90, { align: 'center' });
  
  // Für jeden Schritt eine neue Seite mit großem Screenshot
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    
    pdf.addPage();
    
    // Schritt-Nummer und Titel
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0);
    pdf.text(`Schritt ${i + 1}: ${step.title}`, margin, 20);
    
    // Beschreibung
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60);
    const stepDescLines = pdf.splitTextToSize(step.description, contentWidth);
    pdf.text(stepDescLines, margin, 30);
    
    // Screenshot laden und einfügen (großes Bild)
    try {
      const response = await fetch(step.screenshot);
      const blob = await response.blob();
      const imageDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      // Berechne Bild-Dimensionen (möglichst groß, aber passend)
      const img = new window.Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = imageDataUrl;
      });
      
      const imgAspectRatio = img.width / img.height;
      const availableHeight = pageHeight - 60;
      
      let imgWidth = contentWidth;
      let imgHeight = imgWidth / imgAspectRatio;
      
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspectRatio;
      }
      
      const xPos = (pageWidth - imgWidth) / 2;
      pdf.addImage(imageDataUrl, 'PNG', xPos, 50, imgWidth, imgHeight);
      
    } catch (error) {
      console.error(`Fehler beim Laden von Screenshot ${i + 1}:`, error);
      pdf.setTextColor(255, 0, 0);
      pdf.text('Screenshot konnte nicht geladen werden', margin, 60);
    }
  }
  
  // PDF speichern
  const fileName = `${flow.name.replace(/[^a-z0-9]/gi, '_')}_Flow.pdf`;
  pdf.save(fileName);
}

const flows: Flow[] = [
  {
    id: 'email-registration-happy-path',
    name: 'E-Mail-Registrierung Happy Path',
    description: 'Standard-Registrierung mit E-Mail-Adresse - der komplette Flow von der ersten Eingabe bis zum eingeloggten Kundenbereich.',
    category: 'registration',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/email-registration/01-login-screen-empty.png'
      },
      {
        id: '02',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/email-registration/02-email-entered.png'
      },
      {
        id: '03',
        title: 'Registrierungsformular (leer)',
        description: 'Das Registrierungsformular erscheint mit Feldern für Vorname, Nachname und Passwort.',
        screenshot: '/flow-screenshots/email-registration/03-registration-form-empty.png'
      },
      {
        id: '04',
        title: 'Registrierungsformular ausgefüllt',
        description: 'Alle Felder sind ausgefüllt (Vorname: Loyalty, Nachname: Testing, Passwort), Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/email-registration/04-registration-form-filled.png'
      },
      {
        id: '05',
        title: 'TAN-Eingabe-Screen (leer)',
        description: 'Benutzer erhält eine E-Mail mit TAN-Code und muss diesen eingeben.',
        screenshot: '/flow-screenshots/email-registration/05-tan-input-screen-empty.png'
      },
      {
        id: '06',
        title: 'TAN eingegeben',
        description: 'TAN-Code wurde eingegeben und wird verifiziert. System leitet automatisch weiter.',
        screenshot: '/flow-screenshots/email-registration/06-tan-entered.png'
      },
      {
        id: '07',
        title: 'Kundenbereich nach Registrierung',
        description: 'Registrierung erfolgreich! Benutzer ist im Kundenbereich eingeloggt und sieht seine Übersichtsseite.',
        screenshot: '/flow-screenshots/email-registration/07-kundenbereich-after-registration.png'
      }
    ]
  },
  {
    id: 'phone-registration-happy-path',
    name: 'Telefon-Registrierung Happy Path',
    description: 'Standard-Registrierung mit Telefonnummer - kompletter Flow mit E-Mail- und SMS-TAN-Verifizierung bis zum Kundenbereich.',
    category: 'registration',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/phone-registration/01-login-screen-empty.png'
      },
      {
        id: '02',
        title: 'Telefonnummer eingegeben',
        description: 'Telefonnummer wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/phone-registration/02-phone-entered.png'
      },
      {
        id: '03',
        title: 'E-Mail-Eingabe-Screen (leer)',
        description: 'System fragt nach E-Mail-Adresse für die Verifizierung.',
        screenshot: '/flow-screenshots/phone-registration/03-email-input-screen-empty.png'
      },
      {
        id: '04',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/phone-registration/04-email-entered.png'
      },
      {
        id: '05',
        title: 'Registrierungsformular (leer)',
        description: 'Das Registrierungsformular erscheint mit Feldern für Vorname, Nachname und Passwort.',
        screenshot: '/flow-screenshots/phone-registration/05-registration-form-empty.png'
      },
      {
        id: '06',
        title: 'Registrierungsformular ausgefüllt',
        description: 'Alle Felder sind ausgefüllt (Vorname: Loyalty, Nachname: Testing, Passwort), Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/phone-registration/06-registration-form-filled.png'
      },
      {
        id: '07',
        title: 'E-Mail-TAN-Eingabe-Screen (leer)',
        description: 'Benutzer erhält eine E-Mail mit TAN-Code zur Verifizierung der E-Mail-Adresse.',
        screenshot: '/flow-screenshots/phone-registration/07-email-tan-input-screen-empty.png'
      },
      {
        id: '08',
        title: 'E-Mail-TAN eingegeben',
        description: 'E-Mail-TAN wurde eingegeben und wird verifiziert.',
        screenshot: '/flow-screenshots/phone-registration/08-email-tan-entered.png'
      },
      {
        id: '09',
        title: 'SMS-TAN-Eingabe-Screen (leer)',
        description: 'Benutzer erhält eine SMS mit TAN-Code zur Verifizierung der Telefonnummer.',
        screenshot: '/flow-screenshots/phone-registration/09-sms-tan-input-screen-empty.png'
      },
      {
        id: '10',
        title: 'SMS-TAN eingegeben',
        description: 'SMS-TAN wurde eingegeben und wird verifiziert. System leitet automatisch weiter.',
        screenshot: '/flow-screenshots/phone-registration/10-sms-tan-entered.png'
      },
      {
        id: '11',
        title: 'Kundenbereich nach Registrierung',
        description: 'Registrierung erfolgreich! Benutzer ist im Kundenbereich eingeloggt mit verifizierter Telefonnummer und E-Mail.',
        screenshot: '/flow-screenshots/phone-registration/11-kundenbereich-after-registration.png'
      }
    ]
  },
  {
    id: 'account-replace-email',
    name: 'Account Replace - E-Mail-Adresse wiederverwenden',
    description: 'Zeigt den kompletten Flow, wie ein Benutzer einen bestehenden Account mit derselben E-Mail-Adresse ersetzt.',
    category: 'account-replace',
    steps: [
      // TEIL 1: Erste Registrierung
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/account-replace-email/01-login-screen-initial.png'
      },
      {
        id: '02',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/account-replace-email/02-email-entered.png'
      },
      {
        id: '03',
        title: 'Registrierungsformular (leer)',
        description: 'Das Registrierungsformular erscheint mit Feldern für Vorname, Nachname und Passwort.',
        screenshot: '/flow-screenshots/account-replace-email/03-registration-form-empty.png'
      },
      {
        id: '04',
        title: 'Registrierungsformular ausgefüllt',
        description: 'Alle Felder sind ausgefüllt, Benutzer klickt auf "Weiter" zur TAN-Verifizierung.',
        screenshot: '/flow-screenshots/account-replace-email/04-registration-form-filled.png'
      },
      {
        id: '05',
        title: 'TAN-Eingabe-Screen (leer)',
        description: 'Benutzer erhält eine E-Mail mit TAN-Code und muss diesen eingeben.',
        screenshot: '/flow-screenshots/account-replace-email/05-tan-input-screen-empty.png'
      },
      {
        id: '06',
        title: 'TAN eingegeben',
        description: 'TAN-Code wurde eingegeben und wird verifiziert.',
        screenshot: '/flow-screenshots/account-replace-email/06-tan-entered.png'
      },
      {
        id: '07',
        title: 'Kundenbereich (erste Registrierung)',
        description: 'Erste Registrierung erfolgreich - Benutzer ist im Kundenbereich eingeloggt.',
        screenshot: '/flow-screenshots/account-replace-email/07-kundenbereich-after-registration.png'
      },
      // TEIL 2: Account Replace Flow
      {
        id: '08',
        title: 'Login-Screen (zweiter Versuch, leer)',
        description: 'Benutzer öffnet einen neuen Browser und startet erneut auf dem Login-Screen.',
        screenshot: '/flow-screenshots/account-replace-email/08-login-screen-second-attempt-empty.png'
      },
      {
        id: '09',
        title: 'Gleiche E-Mail erneut eingegeben',
        description: 'Benutzer gibt die GLEICHE E-Mail-Adresse ein wie bei der ersten Registrierung.',
        screenshot: '/flow-screenshots/account-replace-email/09-same-email-entered.png'
      },
      {
        id: '10',
        title: 'Account bereits vorhanden',
        description: 'System erkennt, dass mit dieser E-Mail bereits ein Account existiert. Benutzer kann auf Link "dieser E-Mail-Adresse" klicken.',
        screenshot: '/flow-screenshots/account-replace-email/10-account-replace-screen.png'
      },
      {
        id: '11',
        title: '"Trotzdem neues Konto erstellen"',
        description: 'Warnung, dass der alte Account gelöscht wird. Benutzer bestätigt mit "trotzdem neues Konto erstellen".',
        screenshot: '/flow-screenshots/account-replace-email/11-trotzdem-neues-konto-screen.png'
      },
      {
        id: '12',
        title: 'Zweite TAN-Eingabe (leer)',
        description: 'Benutzer erhält eine zweite TAN per E-Mail zur Verifizierung.',
        screenshot: '/flow-screenshots/account-replace-email/12-second-tan-input-empty.png'
      },
      {
        id: '13',
        title: 'Zweite TAN eingegeben',
        description: 'Zweite TAN wurde eingegeben und wird verifiziert.',
        screenshot: '/flow-screenshots/account-replace-email/13-second-tan-entered.png'
      },
      {
        id: '14',
        title: 'Renew-Formular (leer)',
        description: 'Benutzer muss seine Daten erneut eingeben (Vorname, Nachname, Passwort).',
        screenshot: '/flow-screenshots/account-replace-email/14-renew-form-empty.png'
      },
      {
        id: '15',
        title: 'Renew-Formular ausgefüllt',
        description: 'Alle Daten wurden erneut eingegeben. Benutzer klickt auf "speichern und weiter".',
        screenshot: '/flow-screenshots/account-replace-email/15-renew-form-filled.png'
      },
      {
        id: '16',
        title: 'Phone Collector',
        description: 'Optional: System fragt nach Telefonnummer. Benutzer kann mit "später erinnern" überspringen.',
        screenshot: '/flow-screenshots/account-replace-email/16-phone-collector.png'
      },
      {
        id: '17',
        title: 'Kundenbereich (nach Account Replace)',
        description: 'Account Replace erfolgreich! Benutzer ist mit dem neuen Account eingeloggt. Der alte Account wurde gelöscht.',
        screenshot: '/flow-screenshots/account-replace-email/17-kundenbereich-after-replace.png'
      }
    ]
  },
  {
    id: 'login-password',
    name: 'Passwort-Login mit Challenge',
    description: 'Standard-Login mit E-Mail und Passwort, inklusive Login-Challenge (TAN-Verifizierung bei unbekanntem Gerät).',
    category: 'login',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/login-password/01-login-screen-empty.png'
      },
      {
        id: '02',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/login-password/02-email-entered.png'
      },
      {
        id: '03',
        title: 'Passwort-Screen (leer)',
        description: 'Passwort-Eingabe-Screen erscheint.',
        screenshot: '/flow-screenshots/login-password/03-password-screen-empty.png'
      },
      {
        id: '04',
        title: 'Passwort eingegeben',
        description: 'Passwort wurde eingegeben, Benutzer drückt Enter zum Anmelden.',
        screenshot: '/flow-screenshots/login-password/04-password-entered.png'
      },
      {
        id: '05',
        title: 'Login-Challenge (leer)',
        description: 'Sicherheitsprüfung bei unbekanntem Gerät - System fragt nach TAN-Code per E-Mail.',
        screenshot: '/flow-screenshots/login-password/05-login-challenge-screen-empty.png'
      },
      {
        id: '06',
        title: 'Challenge bestanden',
        description: 'TAN-Code wurde eingegeben und verifiziert. System leitet zum Kundenbereich weiter.',
        screenshot: '/flow-screenshots/login-password/06-challenge-completed.png'
      },
      {
        id: '07',
        title: 'Kundenbereich nach Login',
        description: 'Login erfolgreich! Benutzer ist im Kundenbereich eingeloggt.',
        screenshot: '/flow-screenshots/login-password/07-kundenbereich-after-login.png'
      }
    ]
  },
  {
    id: 'login-otp',
    name: 'OTP-Login (Einmalcode)',
    description: 'Login mit Einmalcode ohne Passwort - TAN-Code wird per E-Mail versendet.',
    category: 'login',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/login-otp/01-login-screen-empty.png'
      },
      {
        id: '02',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/login-otp/02-email-entered.png'
      },
      {
        id: '03',
        title: 'Passwort-Screen mit OTP-Option',
        description: 'Passwort-Screen erscheint mit Option "mit Einmalcode anmelden".',
        screenshot: '/flow-screenshots/login-otp/03-password-screen-with-otp-option.png'
      },
      {
        id: '04',
        title: 'OTP-Selection-Screen',
        description: 'Nach Klick auf "mit Einmalcode anmelden" erscheint die Auswahl für den Versand.',
        screenshot: '/flow-screenshots/login-otp/04-otp-selection-screen.png'
      },
      {
        id: '05',
        title: 'OTP-Code-Eingabe (leer)',
        description: 'Nach Klick auf "Code senden" wird der Einmalcode per E-Mail versendet.',
        screenshot: '/flow-screenshots/login-otp/05-otp-code-input-screen-empty.png'
      },
      {
        id: '06',
        title: 'OTP-Code eingegeben',
        description: 'Einmalcode wurde eingegeben. System leitet automatisch weiter.',
        screenshot: '/flow-screenshots/login-otp/06-otp-code-entered.png'
      },
      {
        id: '07',
        title: 'Kundenbereich nach OTP-Login',
        description: 'OTP-Login erfolgreich! Benutzer ist im Kundenbereich eingeloggt.',
        screenshot: '/flow-screenshots/login-otp/07-kundenbereich-after-otp-login.png'
      }
    ]
  },
  {
    id: 'login-password-reset',
    name: 'Passwort zurücksetzen',
    description: 'Kompletter Flow zum Zurücksetzen eines vergessenen Passworts mit TAN-Verifizierung.',
    category: 'login',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/login-password-reset/01-login-screen-empty.png'
      },
      {
        id: '02',
        title: 'E-Mail eingegeben',
        description: 'E-Mail-Adresse wurde eingegeben, Benutzer klickt auf "Weiter".',
        screenshot: '/flow-screenshots/login-password-reset/02-email-entered.png'
      },
      {
        id: '03',
        title: 'Passwort-Screen mit "Passwort vergessen?"',
        description: 'Passwort-Screen erscheint mit Link "Passwort vergessen?".',
        screenshot: '/flow-screenshots/login-password-reset/03-password-screen-with-forgot-link.png'
      },
      {
        id: '04',
        title: 'Password-Reset-Screen',
        description: 'Nach Klick auf "Passwort vergessen?" erscheint der Reset-Screen.',
        screenshot: '/flow-screenshots/login-password-reset/04-password-reset-screen.png'
      },
      {
        id: '05',
        title: 'Reset-TAN-Eingabe (leer)',
        description: 'Nach Klick auf "Code senden" wird ein Reset-TAN per E-Mail versendet.',
        screenshot: '/flow-screenshots/login-password-reset/05-reset-tan-input-screen-empty.png'
      },
      {
        id: '06',
        title: 'Reset-TAN eingegeben',
        description: 'Reset-TAN wurde eingegeben und verifiziert.',
        screenshot: '/flow-screenshots/login-password-reset/06-reset-tan-entered.png'
      },
      {
        id: '07',
        title: 'Erfolgsmeldung mit "Passwort ändern"',
        description: 'TAN-Verifizierung erfolgreich. Link zum Ändern des Passworts wird angezeigt.',
        screenshot: '/flow-screenshots/login-password-reset/07-success-screen-with-change-link.png'
      },
      {
        id: '08',
        title: 'Neues Passwort Formular (leer)',
        description: 'Formular zum Eingeben des neuen Passworts (zweimal).',
        screenshot: '/flow-screenshots/login-password-reset/08-new-password-form-empty.png'
      },
      {
        id: '09',
        title: 'Neues Passwort eingegeben',
        description: 'Neues Passwort wurde in beide Felder eingegeben.',
        screenshot: '/flow-screenshots/login-password-reset/09-new-password-form-filled.png'
      },
      {
        id: '10',
        title: 'Passwort erfolgreich geändert',
        description: 'Passwort wurde erfolgreich zurückgesetzt und geändert.',
        screenshot: '/flow-screenshots/login-password-reset/10-password-changed-success.png'
      }
    ]
  },
  {
    id: 'login-plz-birthday-challenge',
    name: 'Password-Reset mit PLZ/Geburtstag-Challenge',
    description: 'Passwort-Reset-Flow mit zusätzlicher Sicherheitsabfrage für Geburtsdatum - wird bei Phone-Accounts ohne E-Mail verwendet.',
    category: 'login',
    steps: [
      {
        id: '01',
        title: 'Login-Screen (leer)',
        description: 'Der Benutzer startet auf dem Login-Screen.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/01-login-screen-leer.png'
      },
      {
        id: '02',
        title: 'Telefonnummer eingegeben',
        description: 'Telefonnummer wurde eingegeben.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/02-phone-eingegeben.png'
      },
      {
        id: '03',
        title: 'Password-Reset Selection Screen',
        description: 'Nach Klick auf "Passwort vergessen?" erscheint Auswahlbildschirm für Reset-Methode.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/03-password-reset-selection-screen.png'
      },
      {
        id: '04',
        title: 'SMS-Option ausgewählt',
        description: 'SMS/Telefon als Challenge-Methode wurde ausgewählt.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/04-sms-option-ausgewaehlt.png'
      },
      {
        id: '05',
        title: 'PLZ/Geburtstag-Challenge (leer)',
        description: 'Nach SMS-TAN-Eingabe erscheint die Geburtsdatum-Challenge als zusätzliche Sicherheitsabfrage.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/05-plz-birthday-challenge-screen-leer.png'
      },
      {
        id: '06',
        title: 'Geburtsdatum eingegeben',
        description: 'Geburtsdatum wurde zur Verifizierung eingegeben.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/06-geburtsdatum-eingegeben.png'
      },
      {
        id: '07',
        title: 'Nach erstem "Weiter"',
        description: 'Erster Schritt der Challenge abgeschlossen, zweiter Bestätigungsscreen.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/07-nach-erstem-weiter.png'
      },
      {
        id: '08',
        title: 'Kundenbereich erfolgreich',
        description: 'Nach erfolgreicher PLZ/Geburtstag-Verifizierung wird der Benutzer in den Kundenbereich eingeloggt.',
        screenshot: '/flow-screenshots/login-plz-birthday-challenge/08-kundenbereich-erfolgreich.png'
      }
    ]
  }
];

export default function FlowsPage() {
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [selectedStep, setSelectedStep] = useState<FlowStep | null>(null);

  const categories = {
    'account-replace': { name: 'Account Replace', color: 'blue', icon: '🔄' },
    'registration': { name: 'Registrierung', color: 'green', icon: '✍️' },
    'login': { name: 'Login', color: 'purple', icon: '🔐' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            📸 CHECK24 Login & Registrierung Flows
          </h1>
          <p className="text-gray-300 text-lg">
            Visualisierung aller Login- und Registrierungsprozesse mit Screenshots vom Live-System
          </p>
        </div>

        {/* Flow Selection */}
        {!selectedFlow && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flows.map((flow) => {
              const category = categories[flow.category];
              return (
                <div
                  key={flow.id}
                  onClick={() => setSelectedFlow(flow)}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 cursor-pointer transition-all hover:bg-white/20 hover:scale-105 border border-white/20"
                >
                  <div className="flex items-start mb-4">
                    <span className="text-4xl mr-3">{category.icon}</span>
                    <div className="flex-1">
                      <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 bg-${category.color}-500/20 text-${category.color}-300 border border-${category.color}-500/30`}>
                        {category.name}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {flow.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mb-4">
                    {flow.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-400 text-sm">
                      <span className="mr-2">📊</span>
                      <span>{flow.steps.length} Schritte</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportFlowToPDF(flow);
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      📄 PDF Export
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Flow Detail View */}
        {selectedFlow && !selectedStep && (
          <div className="space-y-6">
            {/* Back Button and PDF Export */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedFlow(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                ← Zurück zur Übersicht
              </button>
              <button
                onClick={() => exportFlowToPDF(selectedFlow)}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-lg text-white flex items-center gap-2 transition-all hover:scale-105 font-semibold shadow-lg"
              >
                📄 Flow als PDF exportieren
              </button>
            </div>

            {/* Flow Header */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-start mb-4">
                <span className="text-5xl mr-4">{categories[selectedFlow.category].icon}</span>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {selectedFlow.name}
                  </h2>
                  <p className="text-gray-300">
                    {selectedFlow.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Flow Steps */}
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500"></div>

              {/* Steps */}
              <div className="space-y-6">
                {selectedFlow.steps.map((step, index) => (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStep(step)}
                    className="flex gap-6 cursor-pointer group"
                  >
                    {/* Step Number */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl z-10 relative group-hover:scale-110 transition-transform shadow-lg">
                        {index + 1}
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 group-hover:bg-white/20 transition-all">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Text */}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-2">
                            {step.title}
                          </h3>
                          <p className="text-gray-300 mb-4">
                            {step.description}
                          </p>
                          <button className="text-blue-400 hover:text-blue-300 flex items-center gap-2 text-sm font-semibold">
                            Screenshot ansehen →
                          </button>
                        </div>

                        {/* Screenshot Preview */}
                        <div className="relative w-full lg:w-96 h-56 rounded-lg overflow-hidden border-2 border-white/30 shadow-xl group-hover:border-blue-400 transition-colors">
                          <Image
                            src={step.screenshot}
                            alt={step.title}
                            fill
                            className="object-cover object-top"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Detail View */}
        {selectedStep && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="max-w-7xl w-full max-h-full overflow-auto">
              {/* Close Button */}
              <button
                onClick={() => setSelectedStep(null)}
                className="mb-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 transition-colors text-lg font-semibold"
              >
                ← Zurück zum Flow
              </button>

              {/* Screenshot */}
              <div className="bg-white rounded-lg p-4">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedStep.title}
                  </h3>
                  <p className="text-gray-600">
                    {selectedStep.description}
                  </p>
                </div>
                <div className="relative w-full" style={{ minHeight: '600px' }}>
                  <Image
                    src={selectedStep.screenshot}
                    alt={selectedStep.title}
                    width={1920}
                    height={1080}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
