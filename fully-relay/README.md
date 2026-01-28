# Fully Relay Service

MQTT-til-REST relay til Fully Kiosk Browser med **automatisk device discovery**.

## Hvorfor?

Fully Kiosk Browser **sender** data via MQTT, men kan **ikke modtage** kommandoer via MQTT. Den har kun en lokal REST API.

Denne relay service:
1. **Auto-opdager** Fully enheder fra MQTT deviceInfo beskeder
2. Lytter på MQTT kommandoer fra admin platformen
3. Kalder Fully REST API lokalt på LAN
4. Sender resultat tilbage via MQTT

```
Admin Platform (internet) → MQTT → Relay (LAN) → REST API → Fully
```

## Installation (macOS)

### 1. Installer dependencies

```bash
pip3 install paho-mqtt requests
```

### 2. Kør installeren

```bash
cd fully-relay
./install-service.sh
```

Installeren spørger efter:
- MQTT Broker (default: 188.228.60.134)
- MQTT Port (default: 1883)
- MQTT Username
- MQTT Password
- Default Fully Password (default: 1227)

Det er alt! Enheder opdages automatisk.

### 3. Tjek status

```bash
# Se logs
tail -f /usr/local/var/log/fully-relay.log

# Status
launchctl list | grep fully-relay
```

## Manuel kørsel

```bash
python3 relay.py --broker 188.228.60.134 --user admin --password SECRET
```

Enheder opdages automatisk fra MQTT og gemmes i:
- macOS: `~/Library/Application Support/fully-relay/devices.json`
- Linux: `~/.config/fully-relay/devices.json`
- Windows: `%APPDATA%/fully-relay/devices.json`

## Sådan virker auto-discovery

1. Fully sender `fully/deviceInfo/{deviceId}` hver 60 sek
2. Relay modtager beskeden og gemmer IP + navn
3. Når kommando modtages, bruges den gemte IP til REST kald

```
Fully Tablet                    Relay Service
     │                               │
     │──── deviceInfo ──────────────▶│ 📋 Gemmer: TPM191E = 192.168.40.154
     │                               │
     │                               │◀──── fully/cmd/{id}/loadUrl ────
     │                               │
     │◀── REST: loadUrl ─────────────│ ⚡ Kalder http://192.168.40.154:2323
     │                               │
     │                               │──── fully/cmd/{id}/loadUrl/ack ──▶
```

## MQTT Topics

| Topic | Retning | Beskrivelse |
|-------|---------|-------------|
| `fully/deviceInfo/{id}` | Fully → Relay | Auto-discovery |
| `fully/cmd/{id}/{cmd}` | Admin → Relay | Kommandoer |
| `fully/cmd/{id}/{cmd}/ack` | Relay → Admin | Resultat |
| `fully/relay/status` | Relay → Admin | Service status |

## Understøttede Kommandoer

| Kommando | Beskrivelse | Payload |
|----------|-------------|---------|
| `screenOn` | Tænd skærm | - |
| `screenOff` | Sluk skærm | - |
| `setBrightness` | Sæt lysstyrke | `{"brightness": 0-255}` |
| `loadUrl` | Skift URL | `{"url": "https://..."}` |
| `loadStartUrl` | Gå til start-URL | - |
| `startScreensaver` | Start pauseskærm | - |
| `stopScreensaver` | Stop pauseskærm | - |
| `restartApp` | Genstart Fully | - |
| `reboot` | Genstart enhed | - |
| `screenshot` | Tag screenshot | - |
| `deviceInfo` | Hent enhedsinfo | - |

## Service Management (macOS)

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/dk.iocast.fully-relay.plist

# Start
launchctl load ~/Library/LaunchAgents/dk.iocast.fully-relay.plist

# Genstart
launchctl unload ~/Library/LaunchAgents/dk.iocast.fully-relay.plist
launchctl load ~/Library/LaunchAgents/dk.iocast.fully-relay.plist

# Afinstaller
launchctl unload ~/Library/LaunchAgents/dk.iocast.fully-relay.plist
rm ~/Library/LaunchAgents/dk.iocast.fully-relay.plist
```

## Fejlfinding

### "Unknown device"
Vent på at enheden sender deviceInfo (op til 60 sek).

### "Cannot connect to device"
- Tjek at Fully Remote Admin er aktiveret
- Verificer at du er på samme LAN som enheden

### "Wrong password"
Rediger `~/Library/Application Support/fully-relay/devices.json` og ret password.

### Relay genstarter hele tiden
Tjek logs: `tail -f /usr/local/var/log/fully-relay.log`
