# Fully Relay Service

MQTT-til-REST relay til Fully Kiosk Browser enheder. Kører på en lokal Mac/PC med adgang til Fully-enheder på LAN.

## Hvorfor?

Fully Kiosk Browser **sender** data via MQTT, men kan **ikke modtage** kommandoer via MQTT. Den har kun en lokal REST API.

Denne relay service:
1. Lytter på MQTT kommandoer fra admin platformen
2. Kalder Fully REST API lokalt på LAN
3. Sender resultat tilbage via MQTT

```
Admin Platform (internet) → MQTT → Relay (LAN) → REST API → Fully
```

## Installation

### macOS

```bash
# Installer dependencies
pip3 install paho-mqtt requests

# Opret config
cp config.example.json config.json
# Rediger config.json med dine indstillinger
```

### Kør manuelt

```bash
python3 relay.py --broker 188.228.60.134 --user admin --password SECRET \
  --device 'DEVICE_ID:IP:PASSWORD'
```

### Kør som baggrunds-service (macOS)

```bash
# Installer launchd service
./install-service.sh

# Status
launchctl list | grep fully-relay

# Logs
tail -f /usr/local/var/log/fully-relay.log

# Stop service
launchctl unload ~/Library/LaunchAgents/dk.iocast.fully-relay.plist
```

## Konfiguration

### Via kommandolinje

```bash
python3 relay.py \
  --broker 188.228.60.134 \
  --port 1883 \
  --user admin \
  --password SECRET \
  --device 'device1:192.168.1.100:1227' \
  --device 'device2:192.168.1.101:mypass'
```

### Via config.json

```json
{
  "mqtt": {
    "broker": "188.228.60.134",
    "port": 1883,
    "username": "admin",
    "password": "SECRET"
  },
  "devices": [
    {
      "id": "8c2c6a0f-2d65236b",
      "ip": "192.168.40.154",
      "password": "1227"
    }
  ]
}
```

## MQTT Topics

### Kommandoer (ind)

```
fully/cmd/{deviceId}/{command}
```

Eksempel:
```
fully/cmd/8c2c6a0f-2d65236b/loadStartUrl
fully/cmd/8c2c6a0f-2d65236b/screenOn
fully/cmd/8c2c6a0f-2d65236b/setBrightness  {"brightness": 150}
```

### Acknowledgment (ud)

```
fully/cmd/{deviceId}/{command}/ack
```

Payload:
```json
{
  "device_id": "8c2c6a0f-2d65236b",
  "command": "loadStartUrl",
  "result": {"status": "OK", "statustext": "Loading URL..."},
  "timestamp": 1706480000
}
```

### Relay Status

```
fully/relay/status  {"status": "online", "timestamp": 1706480000}
```

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
| `setStartUrl` | Sæt ny start-URL | `{"url": "https://..."}` |
| `setKioskMode` | Aktiver kiosk mode | `{"value": true}` |

## Auto-Discovery

Relay servicen lytter også på `fully/deviceInfo/+` og opdager automatisk nye enheder. Dog kræver kommandoer et password, så pre-konfigurer enheder med `--device` eller i `config.json`.

## Fejlfinding

### "Cannot connect to device"
- Tjek at Fully Remote Admin er aktiveret
- Verificer IP og port (default 2323)
- Tjek password

### "Missing admin rights"
- Nogle kommandoer (fx screenOff) kræver Device Admin rettigheder i Android

### Relay reconnect loop
- Tjek MQTT credentials
- Verificer broker er tilgængelig
