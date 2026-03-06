'use client';

import { useState } from 'react';
import Image from 'next/image';

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
      },
      {
        id: '08',
        title: 'Kundenbereich (Cookie-Banner geschlossen)',
        description: 'Cookie-Banner wurde geschlossen für bessere Übersicht.',
        screenshot: '/flow-screenshots/email-registration/08-kundenbereich-clean.png'
      },
      {
        id: '09',
        title: 'Anmelden & Sicherheit',
        description: 'Benutzer navigiert zu den Sicherheitseinstellungen.',
        screenshot: '/flow-screenshots/email-registration/09-anmelden-sicherheit-page.png'
      },
      {
        id: '10',
        title: 'Kundenkonto löschen Dialog (leer)',
        description: 'Dialog zur Konto-Löschung erscheint. Benutzer muss Checkbox bestätigen.',
        screenshot: '/flow-screenshots/email-registration/10-delete-account-dialog-empty.png'
      },
      {
        id: '11',
        title: 'Löschung bestätigt',
        description: 'Checkbox wurde gesetzt, Benutzer klickt auf "entfernen".',
        screenshot: '/flow-screenshots/email-registration/11-delete-account-dialog-checked.png'
      },
      {
        id: '12',
        title: 'Nach Account-Löschung',
        description: 'Account wurde erfolgreich gelöscht.',
        screenshot: '/flow-screenshots/email-registration/12-after-account-deletion.png'
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
                  <div className="flex items-center text-gray-400 text-sm">
                    <span className="mr-2">📊</span>
                    <span>{flow.steps.length} Schritte</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Flow Detail View */}
        {selectedFlow && !selectedStep && (
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => setSelectedFlow(null)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 transition-colors"
            >
              ← Zurück zur Übersicht
            </button>

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
