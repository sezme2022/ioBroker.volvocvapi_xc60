# ioBroker.volvocvapi_xc60

ioBroker-Starteradapter für die **offizielle Volvo Connected Vehicle API**, die **Energy API** und die **Location API**.

Der Adapter ist auf einen **Volvo XC60 Plug-in-Hybrid ab Modelljahr 2022** ausgelegt und wurde insbesondere für den Anwendungsfall **XC60, Baujahr 2024** vorbereitet. Er liest sinnvolle Fahrzeugdaten in ioBroker ein und stellt optionale Befehle als States bereit.

## Status

Dies ist ein **entwicklernaher Starteradapter** und **kein fertiger ioBroker-Store-Release**.

Er ist dafür gedacht,
- im eigenen GitHub-Repository gepflegt zu werden,
- direkt per GitHub-Link in ioBroker installiert zu werden,
- und anschließend mit echten Volvo-API-Zugangsdaten produktiv getestet und weiter verfeinert zu werden.

## Unterstützte Volvo-APIs

- **Connected Vehicle API v2**
- **Energy API v2**
- **Location API v1**

## Funktionsumfang

Der Adapter kann – abhängig von Fahrzeug, API-Freigaben und Scopes – unter anderem folgende Daten abrufen:

- Kilometerstand / **Odometer**
- Tankfüllstand / Kraftstoffdaten
- Batterie-Ladestand bei PHEV/EV
- Reichweite / Distance to Empty
- Türstatus / Zentralverriegelung
- Fensterstatus
- Motorstatus
- Warnungen / Warnings
- Bremsflüssigkeitsstatus
- Reifendruck / Tyres
- Diagnoseinformationen
- Statistikdaten
- aktuelle Fahrzeugposition
- Energy State / Ladeinformationen
- verfügbare Fahrzeugbefehle über `/commands`

Zusätzlich werden Befehls-States angelegt, z. B. für:

- Verriegeln / Entriegeln
- Hupen
- Blinken
- Hupen + Blinken
- Klimatisierung Start / Stop
- Motor Start / Stop

## Polling-Strategie

Damit die Volvo-Rate-Limits nicht unnötig belastet werden, arbeitet der Adapter mit zwei Zyklen:

- **schnelle Endpunkte**: standardmäßig alle **300 Sekunden**
- **langsame Endpunkte**: standardmäßig nur jede **12. Runde**

Das entspricht ungefähr:
- Standard-Polling: **alle 5 Minuten**
- seltenere Endpunkte: ungefähr **stündlich**

Diese Werte können in der Adapter-Konfiguration geändert werden.

## Wichtige Datenpunkte

Beispielhafte State-Pfade:

- `connected.vehicle.odometer`
- `connected.vehicle.fuel.fuelAmount`
- `connected.vehicle.fuel.batteryChargeLevel`
- `connected.vehicle.doors.centralLock`
- `connected.vehicle.statistics.distanceToEmpty`
- `connected.vehicle.windows.*`
- `connected.vehicle.tyres.*`
- `connected.vehicle.diagnostics.*`
- `energy.vehicle.state.*`
- `location.vehicle.location.*`
- `availableCommands.*`
- `commands.lock`
- `commands.unlock`
- `commands.climatizationStart`

Je nach Fahrzeugkonfiguration, API-Freigaben und Scope können einzelne Pfade fehlen oder zusätzliche Pfade erscheinen.

## Voraussetzungen

Für den produktiven Betrieb brauchst du in der Regel:

- einen **Volvo Developer Account**
- einen **VCC API Key**
- **OAuth2-Zugangsdaten**
  - `clientId`
  - `clientSecret`
- mindestens einen gültigen Token-Stand
  - `accessToken` oder besser
  - `refreshToken`
- optional:
  - `redirectUri`
  - `authCode`
  - `codeVerifier` (für PKCE)

## Authentifizierungsmodi

Der Adapter unterstützt derzeit drei praktische Wege:

### 1. Access Token direkt eintragen
Schnell zum Testen, aber nicht dauerhaft praktikabel, da das Token abläuft.

### 2. Refresh Token + Client ID + Client Secret
Empfohlener Weg für den laufenden Betrieb. Der Adapter erneuert den Access Token während der Laufzeit automatisch.

### 3. Einmaliger Authorization-Code-Tausch
Wenn du den Volvo-OAuth-Flow bereits extern durchgeführt hast, kann der Code gegen Tokens eingetauscht werden.

## Wichtiger Hinweis zu Refresh Tokens

Volvo verwendet **Refresh-Token-Rotation**. Der Adapter kann aktualisierte Tokens zur Laufzeit weiterverwenden, speichert diese aber in dieser Starterversion noch nicht vollständig robust für alle Neustart-Szenarien weg.

Für produktiven 24/7-Betrieb sollte die Token-Persistenz noch weiter abgesichert werden.

## Adapter-Konfiguration

Die wichtigsten Konfigurationsfelder in `native`:

- `apiKey`
- `clientId`
- `clientSecret`
- `accessToken`
- `refreshToken`
- `authCode`
- `redirectUri`
- `codeVerifier`
- `vin`
- `pollIntervalSec`
- `slowCycleCount`
- `engineStartRuntimeMinutes`
- `includeRawJson`
- `enableEnergy`
- `enableLocation`

Empfohlene Startwerte:

- `pollIntervalSec = 300`
- `slowCycleCount = 12`
- `enableEnergy = true`
- `enableLocation = true`

## GitHub-Repository anlegen

Empfohlener Repository-Name:

```text
sezme2022/iobroker.volvocvapi_xc60
```

Natürlich kannst du auch einen anderen Namen verwenden, solltest dann aber Paketnamen und Doku konsistent halten.

## Dateien ins Repository hochladen

Lade **den entpackten Projektinhalt** hoch, nicht die ZIP-Datei selbst.

Erwartete Struktur:

```text
admin/
  jsonConfig.json
io-package.json
main.js
package.json
README.md
```

## Git-Befehle für den ersten Upload

Im Projektordner lokal ausführen:

```bash
git init
git branch -M main
git remote add origin https://github.com/sezme2022/iobroker.volvocvapi_xc60.git
git add .
git commit -m "Initial commit for Volvo XC60 Connected Vehicle adapter"
git push -u origin main
```

## Installation direkt aus GitHub in ioBroker

Auf dem ioBroker-Host:

```bash
iobroker url "https://github.com/sezme2022/iobroker.volvocvapi_xc60.git"
```

Falls nötig alternativ ohne `.git`:

```bash
iobroker url "https://github.com/sezme2022/iobroker.volvocvapi_xc60"
```

## Alternative Installation per npm

```bash
cd /opt/iobroker
npm install https://github.com/sezme2022/iobroker.volvocvapi_xc60.git --omit=dev
iobroker upload all
iobroker restart
```

## Adapterinstanz anlegen

Nach der Installation in der ioBroker-Admin-Oberfläche:

1. Adapter suchen
2. Instanz anlegen
3. Volvo-Zugangsdaten eintragen
4. Polling-Intervall auf 300 Sekunden belassen
5. Logs prüfen

## Empfohlene erste Tests

Nach dem ersten Start prüfen:

- wird die VIN erkannt oder korrekt verwendet?
- werden Grunddaten wie Kilometerstand und Türen gelesen?
- kommen Energy-Daten beim XC60 PHEV an?
- ist die Position verfügbar?
- werden verfügbare Commands sauber erkannt?
- funktionieren einzelne Commands nur dann, wenn sie im Fahrzeug wirklich freigegeben sind?

## Troubleshooting

### Adapter startet, aber keine Daten
Prüfen:
- `apiKey` korrekt?
- `clientId` / `clientSecret` korrekt?
- Token gültig?
- ausreichende Scopes erteilt?
- VIN korrekt?

### Login oder Token Refresh schlägt fehl
Prüfen:
- OAuth-Client korrekt angelegt?
- Redirect URI korrekt?
- Refresh Token noch gültig?
- PKCE / `codeVerifier` korrekt, falls verwendet?

### Einzelne Datenpunkte fehlen
Das ist nicht ungewöhnlich. Nicht jedes Fahrzeug liefert alle Endpunkte oder Felder. Manche Werte hängen von:
- Modell
- Baujahr
- Region
- Softwarestand
- API-Freigabe
- gewählten Scopes
ab.

### Commands erscheinen, funktionieren aber nicht
Mögliche Ursachen:
- Fahrzeugzustand erlaubt den Command gerade nicht
- Volvo gibt den Command für das Fahrzeug nicht frei
- fehlende Berechtigung / Scope
- temporäre API-Einschränkung

## Weiterentwicklung

Sinnvolle nächste Ausbaustufen:

- dauerhafte sichere Speicherung rotierender Refresh Tokens
- sauberere Capability-Erkennung je Endpoint
- differenziertere State-Typisierung
- bessere Fehlerbehandlung und Retry-Logik
- optionales manuelles Refresh / Reconnect-State
- VIS-/Lovelace-freundliche zusammengefasste Status-States

## Lizenz

MIT

## Hinweis


