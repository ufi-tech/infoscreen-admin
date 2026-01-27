# Infoscreen Kiosk - Android App

Android kiosk-app til infoskærme. Kompatibel med det eksisterende MQTT-baserede admin system.

## Features

- **Kiosk Mode**: Fullscreen WebView med URL fra admin
- **MQTT Integration**: Samme topics som Raspberry Pi
- **Telemetri**: Battery, memory, disk, WiFi, uptime
- **Kommandoer**: set-url, screenshot, wifi-scan, get-info, reboot
- **Lock Task Mode**: Forhindrer brugere i at forlade appen

## Krav

- Android 10+ (API 29)
- Android Studio Hedgehog (2023.1.1) eller nyere
- JDK 17

## Build

```bash
# Debug build
./gradlew assembleDebug

# Release build (kræver signing config)
./gradlew assembleRelease
```

## Installation

```bash
# Installer APK via ADB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Device Owner Setup (Valgfrit - til fuld kiosk lock)

For at aktivere Lock Task Mode skal appen sættes som Device Owner.
Dette kræver en factory reset eller ADB kommando:

```bash
# Factory reset enheden først, derefter:
adb shell dpm set-device-owner dk.ufitech.infoscreenkiosk/.receiver.DeviceAdminReceiver
```

**OBS:** Device Owner kan kun sættes på en enhed uden eksisterende konti.

## Konfiguration

Ved første start:

1. Indtast MQTT broker URL (f.eks. `192.168.40.94:1883`)
2. Indtast brugernavn og adgangskode
3. Tryk "Forbind"
4. Enheden viser "Afventer godkendelse"
5. Godkend enheden i web-admin
6. Sæt URL fra admin

## MQTT Topics

Appen bruger samme topic-struktur som Raspberry Pi:

```
# Status (retained)
devices/{device-id}/status

# Telemetri (hvert 30 sek)
devices/{device-id}/telemetry

# Kommandoer
devices/{device-id}/cmd/set-url      {"url":"https://..."}
devices/{device-id}/cmd/screenshot   {}
devices/{device-id}/cmd/wifi-scan    {}
devices/{device-id}/cmd/get-info     {}
devices/{device-id}/cmd/reboot       {}

# Responses
devices/{device-id}/screenshot       {base64, bytes, width, height}
devices/{device-id}/wifi-scan        {networks: [...]}
devices/{device-id}/events           {type, message}
```

## Telemetri Felter

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `battery_pct` | int | Batteri procent (0-100) |
| `battery_charging` | bool | Er der strøm tilsluttet |
| `battery_temp` | float | Batteri temperatur (°C) |
| `mem_total_kb` | long | Total RAM (KB) |
| `mem_available_kb` | long | Tilgængelig RAM (KB) |
| `disk_total_mb` | long | Total storage (MB) |
| `disk_free_mb` | long | Fri storage (MB) |
| `uptime_seconds` | long | Oppetid (sekunder) |
| `wifi_ssid` | string | Tilsluttet WiFi netværk |
| `wifi_rssi` | int | WiFi signalstyrke (dBm) |
| `screen_on` | bool | Er skærmen tændt |
| `current_url` | string | Nuværende WebView URL |
| `ip` | string | Lokal IP adresse |

## Projekt Struktur

```
app/src/main/java/dk/ufitech/infoscreenkiosk/
├── InfoscreenApp.kt          # Application class
├── di/
│   └── AppModule.kt          # Hilt DI
├── data/
│   ├── SecureStorage.kt      # Encrypted credentials
│   ├── DeviceIdentity.kt     # UUID + MAC
│   ├── MqttClientManager.kt  # MQTT client
│   ├── NetworkUtils.kt       # Network helpers
│   └── model/
│       └── MqttModels.kt     # Data classes
├── ui/
│   ├── KioskActivity.kt      # Main WebView
│   ├── SetupActivity.kt      # MQTT config
│   ├── PendingActivity.kt    # Awaiting approval
│   └── theme/
│       ├── Theme.kt
│       └── Typography.kt
├── service/
│   └── TelemetryService.kt   # Background telemetry
└── receiver/
    ├── DeviceAdminReceiver.kt # Kiosk lock
    └── BootReceiver.kt        # Auto-start
```

## Forskelle fra Raspberry Pi

| Feature | Pi | Android |
|---------|-----|---------|
| Reboot | ✅ | ⚠️ Kun med Device Owner |
| SSH Tunnel | ✅ | ❌ |
| TV CEC | ✅ | ❌ |
| CPU temp | ✅ | ❌ (batteri temp i stedet) |
| Batteri | ❌ | ✅ |
| GPS | Via IP | ✅ Native |

## License

Proprietary - UFi-Tech ApS
