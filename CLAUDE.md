# Infoscreen Admin - Claude Context

## Projekt Oversigt

| Key | Value |
|-----|-------|
| **Projekt** | IoT fleet management for Raspberry Pi infoskærme |
| **Tech Stack** | FastAPI + React + MQTT + SQLite |
| **GitHub** | [ufi-tech/infoscreen-admin](https://github.com/ufi-tech/infoscreen-admin) |
| **Dev Server** | http://localhost:3000 (frontend), http://localhost:8000 (API) |
| **Ops-Center** | `ops project show infoscreen-admin` |

## Quick Start

```bash
# Start services (skal køre for at bruge UI)
cd admin-platform && docker-compose up -d

# Verificer services
curl -s http://localhost:3000  # Frontend
curl -s http://localhost:8000/devices  # Backend API
```

## Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│            ADMIN PLATFORM (Docker på Mac)                    │
├─────────────────────────────────────────────────────────────┤
│  React Frontend (3000)       FastAPI Backend (8000)          │
│  ├─ MQTT Devices tab         ├─ 7 API routers               │
│  ├─ Legacy DB tab            ├─ MQTT Bridge (Paho)          │
│  └─ Tunnel UI                ├─ SQLite DB                   │
│                              └─ MySQL connector (legacy)     │
├─────────────────────────────────────────────────────────────┤
│              Mosquitto MQTT Broker (1883)                    │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
    Raspberry Pi'er              Legacy MySQL DB
    (Node-RED + Chromium)        (sql.ufi-tech.dk:42351)
         │
         ▼ (reverse SSH)
    tunnel.ufi-tech.dk:2222
    (Synology SSH endpoint)
```

## Ops-Center Integration

Projektet er dokumenteret i ops-center. Brug disse kommandoer:

```bash
# Projekt info
ops project show infoscreen-admin

# Server detaljer
ops server show synology-tunnel-01   # SSH tunnel endpoint
ops server show mqtt-broker-01       # MQTT broker

# Fuld context
ops context generate infoscreen-admin
```

## SSH Tunnel System

### Oversigt
Raspberry Pi'er bruger **reverse SSH tunnels** til at blive tilgængelige fra internet via Synology NAS.

### Infrastruktur
| Komponent | Host | Port | Formål |
|-----------|------|------|--------|
| **Synology SSH** | tunnel.ufi-tech.dk | 2222 | Tunnel endpoint |
| **Tunnel ports** | tunnel.ufi-tech.dk | 22000-22100 | Allokeret per device |
| **MQTT Broker** | 188.228.60.134 | 1883 | Device kommunikation |

### Forbindelse via Tunnel
```bash
# SSH til Pi (port varierer per device)
ssh -p 22001 pi@tunnel.ufi-tech.dk

# Node-RED (via tunnel)
http://tunnel.ufi-tech.dk:22010

# Web SSH terminal
http://tunnel.ufi-tech.dk:22020
```

### Direkte LAN Adgang
```bash
ssh pi@192.168.40.157
# Password: 7200Grindsted!
```

## Playwright UI Testing

Claude kan interagere med admin UI via Playwright. Se [docs/PLAYWRIGHT.md](docs/PLAYWRIGHT.md) for fuld dokumentation.

### Hurtig Test Template

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Tag screenshot
    page.screenshot(path='/tmp/screenshot.png', full_page=True)

    # Klik på knapper
    page.click('button:has-text("Screenshot")')
    page.click('button:has-text("WiFi Scan")')
    page.click('button:has-text("Reboot")')

    # Skift tab
    page.click('button:has-text("Legacy DB")')

    # Udfyld formularer
    page.fill('input[placeholder="https://example.com"]', 'https://ny-url.dk')
    page.click('button:has-text("Set URL")')

    browser.close()
```

### Vigtige Selectors

| Element | Selector |
|---------|----------|
| MQTT Devices tab | `button:has-text("MQTT Devices")` |
| Legacy DB tab | `button:has-text("Legacy DB")` |
| Reboot | `button:has-text("Reboot")` |
| Screenshot | `button:has-text("Screenshot")` |
| WiFi Scan | `button:has-text("WiFi Scan")` |
| Get Info | `button:has-text("Get Info")` |
| Log Tail | `button:has-text("Log Tail")` |
| Set URL | `button:has-text("Set URL")` |
| Refresh | `button:has-text("Refresh")` |
| Start Tunnel | `button:has-text("Start Tunnel")` |
| Open Node-RED | `button:has-text("Open Node-RED (Tunnel)")` |
| Open Web SSH | `button:has-text("Open Web SSH (Tunnel)")` |

## Vigtige Filer

### Backend (FastAPI)
| Fil | Formål |
|-----|--------|
| [admin-platform/backend/app/main.py](admin-platform/backend/app/main.py) | API endpoints |
| [admin-platform/backend/app/models.py](admin-platform/backend/app/models.py) | SQLAlchemy models |
| [admin-platform/backend/app/mqtt_bridge.py](admin-platform/backend/app/mqtt_bridge.py) | MQTT client |
| [admin-platform/backend/app/legacy_db.py](admin-platform/backend/app/legacy_db.py) | MySQL integration |

### Frontend (React)
| Fil | Formål |
|-----|--------|
| [admin-platform/frontend/src/App.jsx](admin-platform/frontend/src/App.jsx) | Main UI component |
| [admin-platform/frontend/src/api.js](admin-platform/frontend/src/api.js) | API client |
| [admin-platform/frontend/src/styles.css](admin-platform/frontend/src/styles.css) | Styling |

### Raspberry Pi
| Fil | Formål |
|-----|--------|
| [raspberry-pi-config/CLAUDE.md](raspberry-pi-config/CLAUDE.md) | Pi dokumentation |
| [raspberry-pi-config/node-red/flows.json](raspberry-pi-config/node-red/flows.json) | Node-RED flows |
| [raspberry-pi-config/lite-setup/setup.sh](raspberry-pi-config/lite-setup/setup.sh) | Setup script |
| [raspberry-pi-config/lite-setup/home-pi/ssh-tunnel.sh](raspberry-pi-config/lite-setup/home-pi/ssh-tunnel.sh) | Tunnel script |

### Dokumentation
| Fil | Formål |
|-----|--------|
| [docs/PLAN.md](docs/PLAN.md) | Master plan |
| [docs/PLAYWRIGHT.md](docs/PLAYWRIGHT.md) | Playwright testing guide |
| [docs/mqtt/README.md](docs/mqtt/README.md) | MQTT topic schema |
| [docs/setup/SYNOLOGY-SSH-TUNNEL.md](docs/setup/SYNOLOGY-SSH-TUNNEL.md) | Synology tunnel setup |

## API Endpoints

### Devices
```
GET  /devices                    - List alle MQTT devices
GET  /devices/{id}               - Hent device detaljer
POST /devices/{id}/command       - Send kommando (reboot, screenshot, etc.)
POST /devices/{id}/approve       - Godkend device
GET  /devices/{id}/telemetry     - Hent telemetri historik
GET  /devices/{id}/events        - Hent events/logs
```

### Legacy Devices
```
GET  /legacy/devices             - List legacy devices fra MySQL
GET  /legacy/devices/{id}        - Hent legacy device
POST /legacy/devices/{id}/update - Opdater legacy device
```

### Locations & Customers
```
GET/POST /locations              - Administrer lokationer
GET/POST /customers              - Administrer kunder
GET/POST /assignments            - Device-to-customer mappings
```

### Tunnels
```
GET  /tunnel-configs             - List alle tunnel konfigurationer
GET  /devices/{id}/tunnel-config - Hent tunnel config for device
POST /devices/{id}/tunnel-config - Gem tunnel config
POST /devices/{id}/tunnel-ports  - Auto-allokér porte (22000-22100)
```

## MQTT Topics

```
devices/<id>/status        - Device status (online/offline)
devices/<id>/telemetry     - CPU, memory, disk, uptime
devices/<id>/events        - Logs og fejl
devices/<id>/cmd/reboot    - Genstart device
devices/<id>/cmd/set-url   - Skift display URL
devices/<id>/cmd/screenshot   - Tag screenshot
devices/<id>/cmd/wifi-scan    - Scan WiFi netværk
devices/<id>/cmd/ssh-tunnel   - Start/stop SSH tunnel
devices/<id>/cmd/get-info     - Hent system info
devices/<id>/cmd/log-tail     - Hent seneste logs
```

## Credentials

### MQTT Broker (Production)
- Host: 188.228.60.134:1883
- Se `admin-platform/.env` for username/password

### SSH Tunnel (Synology)
- Host: tunnel.ufi-tech.dk:2222
- User: tunnel
- Auth: SSH key (`/home/pi/.ssh/id_tunnel`)

### Legacy MySQL
- Host: sql.ufi-tech.dk:42351
- Database: Ufi-Tech
- Se `admin-platform/.env` for credentials

### Raspberry Pi SSH
- IP: 192.168.40.157 (eller via MQTT device IP)
- User: pi
- Password: 7200Grindsted!

## Development Tips

1. **Playwright screenshots gemmes i `/tmp/`** - læs dem med Read tool
2. **UI auto-refresher hver 8 sekunder** - vent på `networkidle` efter actions
3. **Device actions tager tid** - vent 3-5 sek efter Screenshot/WiFi Scan
4. **Legacy DB er read-write** - vær forsigtig med opdateringer
5. **Brug `full_page=True`** for at fange scrollbart indhold
6. **Brug ops-center** for server detaljer: `ops server show synology-tunnel-01`

## Known Issues / TODO

- [ ] API authentication er valgfrit (bør være påkrævet)
- [ ] Ingen data retention policy (telemetri vokser ubegrænset)
- [ ] Mangler TLS/HTTPS i production
- [ ] Ingen automatisk Node-RED flow backup
