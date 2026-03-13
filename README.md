# ioBroker.volvocvapi_xc60

Ein eigener ioBroker-Adapter für die **Volvo Connected Vehicle API**, **Energy API** und **Location API**.

Der Adapter ist für den **Volvo XC60 Plug-in-Hybrid, Baujahr 2024** vorbereitet, funktioniert aber grundsätzlich auch für andere kompatible Volvo-Modelle, sofern die entsprechenden Volvo-APIs und Scopes verfügbar sind.

## Enthaltene Funktionen

- Kilometerstand / Odometer
- Tankdaten und, falls verfügbar, Batterie-/Hybriddaten
- Türen, Fenster, Warnungen, Reifendruck, Bremsstatus, Diagnosedaten
- Energy State für PHEV/EV
- Standortdaten
- verfügbare Commands aus der API
- Command-Buttons für Lock, Unlock, Honk, Flash, Klimatisierung und mehr
- 5-Minuten-Polling als sinnvoller Standard
- langsame Endpunkte nur in größeren Abständen

## Konfiguration in ioBroker

### API / Auth

- **VCC API Key**: Pflichtfeld für API-Zugriffe
- **Client ID / Client Secret**: für OAuth und Refresh
- **Access Token**: nur für schnelle Tests
- **Refresh Token**: empfohlen für Dauerbetrieb
- **Authorization Code / Redirect URI / code_verifier**: optional für einmaligen Code-Tausch

### Fahrzeug / Polling

- **VIN**: optional, wird sonst automatisch aus `/vehicles` ermittelt
- **Polling-Intervall**: Standard 300 Sekunden
- **Langsame Endpunkte jede N-te Runde**: Standard 12
- **Energy API aktivieren**
- **Location API aktivieren**
- **Raw JSON speichern**
- **Debug-Logging aktivieren**

## Empfohlene Startwerte

- Polling: **300 Sekunden**
- Slow cycle: **12**
- Energy API: **aktiv**
- Location API: **aktiv**
- Raw JSON: **aus**, außer zum Testen
- Debug: **aus**, außer zur Fehlersuche

## Projektstruktur

```text
admin/
  jsonConfig.json
lib/
  endpoints.js
  helpers.js
io-package.json
main.js
package.json
README.md
LICENSE
.gitignore
volvo.png
```



## Installation in ioBroker aus GitHub

Wenn das Repository aktualisiert ist, kannst du den Adapter in ioBroker wieder direkt aus GitHub installieren bzw. aktualisieren:

```bash
iobroker url https://github.com/sezme2022/ioBroker.volvocvapi_xc60.git --host 7f8a445c808d
```

Wenn bereits eine ältere Version installiert ist, kannst du nach dem neuen Push einfach denselben Befehl erneut ausführen.



## Typischer Testablauf nach der Installation

1. Instanz anlegen
2. Zugangsdaten eintragen
3. speichern
4. Instanz starten
5. Log prüfen
6. States unter `volvocvapi_xc60.0.*` kontrollieren

## Typische State-Bereiche

- `volvocvapi_xc60.0.info.*`
- `volvocvapi_xc60.0.connected.*`
- `volvocvapi_xc60.0.energy.*`
- `volvocvapi_xc60.0.location.*`
- `volvocvapi_xc60.0.commands.*`
- `volvocvapi_xc60.0.availableCommands.*`
- `volvocvapi_xc60.0.commandsLastResult.*`


## Nächste sinnvolle Ausbaustufen

- Token-Persistenz robuster speichern
- bessere Scope-/Capability-Erkennung
- hübschere Rollen / Einheitentypen für einzelne States
- optionaler Button für geführten OAuth-Hinweis
- eventuell separate Channels für Hybrid-/EV-spezifische Daten
