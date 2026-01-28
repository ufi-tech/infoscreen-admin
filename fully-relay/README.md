# Fully Relay Service

MQTT-til-REST relay til Fully Kiosk Browser med **zero configuration**.

## Installation

```bash
# 1. Installer dependencies
pip3 install paho-mqtt requests

# 2. Kør installeren
cd fully-relay
./install-service.sh
```

**Det er alt!** Ingen konfiguration nødvendig.

## Hvad sker der automatisk?

1. **MQTT credentials** er built-in
2. **Enheder opdages** automatisk fra MQTT deviceInfo
3. **Default password** er 1227 (standard for vores opsætning)
4. **Custom passwords** kan sættes per enhed via Admin UI

## Passwords

| Scenarie | Løsning |
|----------|---------|
| Standard opsætning | Bruger default: 1227 |
| Enhed med andet password | Sæt det via Admin UI |

### Sæt password via Admin UI

```
POST /devices/{device_id}/fully-password
{"password": "dit_password"}
```

Password sendes automatisk med kommandoer til relay servicen.

## Manuel kørsel

```bash
python3 relay.py
```

## Logs

```bash
tail -f /usr/local/var/log/fully-relay.log
```

## Service Management (macOS)

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/dk.iocast.fully-relay.plist

# Start
launchctl load ~/Library/LaunchAgents/dk.iocast.fully-relay.plist

# Status
launchctl list | grep fully-relay
```

## Sådan virker det

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Platform (Synology)                                   │
│  - Sender: fully/cmd/{id}/{command} + {"_password": "xxx"}  │
└───────────────────────────┬─────────────────────────────────┘
                            │ MQTT
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Fully Relay (din Mac på kunde-LAN)                         │
│  - Modtager kommando + password                             │
│  - Kalder http://{ip}:2323/?cmd=X&password=Y                │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Fully Kiosk Browser                                         │
│  - Udfører kommando                                          │
└─────────────────────────────────────────────────────────────┘
```

## Understøttede Kommandoer

| Kommando | Beskrivelse |
|----------|-------------|
| `screenOn` | Tænd skærm |
| `screenOff` | Sluk skærm |
| `setBrightness` | Sæt lysstyrke (0-255) |
| `loadUrl` | Skift URL |
| `loadStartUrl` | Gå til start-URL |
| `startScreensaver` | Start pauseskærm |
| `stopScreensaver` | Stop pauseskærm |
| `restartApp` | Genstart Fully app |
| `reboot` | Genstart enhed |
