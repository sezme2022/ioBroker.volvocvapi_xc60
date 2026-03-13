# ioBroker.volvocvapi_xc60

Ein eigener ioBroker-Adapter für die **Volvo Connected Vehicle API**, **Energy API** und **Location API**.

Der Adapter ist für deinen **Volvo XC60 Plug-in-Hybrid, Baujahr 2024** vorbereitet, funktioniert aber grundsätzlich auch für andere kompatible Volvo-Modelle, sofern die entsprechenden Volvo-APIs und Scopes verfügbar sind.

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

## GitHub für Einsteiger: so arbeitest du damit

### 1. Repository lokal vorbereiten

Entpacke den Ordner lokal auf deinem Mac und öffne das Terminal **im Projektordner**.

### 2. Erstes Hochladen nach GitHub

Falls dein Repository schon existiert, verwende diese Befehle:

```bash
git init
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/sezme2022/ioBroker.volvocvapi_xc60.git
git add .
git commit -m "Version 0.3.0 - complete adapter structure"
git push -u origin main
```

### 3. Spätere Änderungen versionieren

Wenn du später einzelne Dateien änderst, reicht immer:

```bash
git add .
git commit -m "Kurze Beschreibung der Änderung"
git push
```

### 4. GitHub im Browser prüfen

Nach dem Push solltest du im Repository direkt alle Dateien sehen. Wichtig sind besonders:

- `package.json`
- `io-package.json`
- `main.js`
- `admin/jsonConfig.json`

## Installation in ioBroker aus GitHub

Wenn das Repository aktualisiert ist, kannst du den Adapter in ioBroker wieder direkt aus GitHub installieren bzw. aktualisieren:

```bash
iobroker url https://github.com/sezme2022/ioBroker.volvocvapi_xc60.git --host 7f8a445c808d
```

Wenn bereits eine ältere Version installiert ist, kannst du nach dem neuen Push einfach denselben Befehl erneut ausführen.

## Alternative: nur einzelne Dateien austauschen

Wenn du nicht sofort mit Git arbeiten willst, kannst du auch nur diese Dateien ersetzen:

- `main.js`
- `io-package.json`
- `package.json`
- `admin/jsonConfig.json`
- optional den ganzen `lib`-Ordner

Danach den Adapter erneut aus GitHub installieren oder lokal neu deployen.

## Wichtiger Hinweis zu Docker

In deinem Docker-Setup solltest du **nicht** `iobroker upload all` verwenden. Die Installation über GitHub oder eine saubere lokale Installation ist in deinem Fall der bessere Weg.

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

## Wenn du manuell Dateien austauschen willst

### Nur im GitHub-Repository im Browser

1. Repository öffnen
2. Datei anklicken
3. Stift-Symbol wählen
4. Inhalt ersetzen
5. unten `Commit changes`

Das geht auch ohne lokale Git-Kenntnisse. Für mehrere Dateien ist Upload per Browser ebenfalls möglich.

## Nächste sinnvolle Ausbaustufen

- Token-Persistenz robuster speichern
- bessere Scope-/Capability-Erkennung
- hübschere Rollen / Einheitentypen für einzelne States
- optionaler Button für geführten OAuth-Hinweis
- eventuell separate Channels für Hybrid-/EV-spezifische Daten
