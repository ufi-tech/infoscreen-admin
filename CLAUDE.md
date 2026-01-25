# Infoscreen Admin - Claude Context

## Projekt Oversigt

IoT fleet management system til Raspberry Pi infoskærme (digital signage) via MQTT.

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
Mac (Docker)                      Raspberry Pi'er
├── React UI (port 3000)          ├── Node-RED (MQTT client)
├── FastAPI (port 8000)    ←MQTT→ ├── Chromium kiosk
└── Mosquitto (port 1883)         └── Telemetri scripts
                                       ↓
                                  Legacy MySQL DB
                                  (sql.ufi-tech.dk:42351)
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
- [admin-platform/backend/app/main.py](admin-platform/backend/app/main.py) - API endpoints
- [admin-platform/backend/app/models.py](admin-platform/backend/app/models.py) - SQLAlchemy models
- [admin-platform/backend/app/mqtt_bridge.py](admin-platform/backend/app/mqtt_bridge.py) - MQTT client
- [admin-platform/backend/app/legacy_db.py](admin-platform/backend/app/legacy_db.py) - MySQL integration

### Frontend (React)
- [admin-platform/frontend/src/App.jsx](admin-platform/frontend/src/App.jsx) - Main UI component
- [admin-platform/frontend/src/api.js](admin-platform/frontend/src/api.js) - API client
- [admin-platform/frontend/src/styles.css](admin-platform/frontend/src/styles.css) - Styling

### Raspberry Pi
- [raspberry-pi-config/CLAUDE.md](raspberry-pi-config/CLAUDE.md) - Pi dokumentation
- [raspberry-pi-config/node-red/flows.json](raspberry-pi-config/node-red/flows.json) - Node-RED flows
- [raspberry-pi-config/lite-setup/](raspberry-pi-config/lite-setup/) - Setup scripts

### Dokumentation
- [docs/PLAN.md](docs/PLAN.md) - Master plan
- [docs/PLAYWRIGHT.md](docs/PLAYWRIGHT.md) - Playwright testing guide
- [docs/mqtt/README.md](docs/mqtt/README.md) - MQTT topic schema

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

## MQTT Topics

```
devices/<id>/status      - Device status (online/offline)
devices/<id>/telemetry   - CPU, memory, disk, uptime
devices/<id>/events      - Logs og fejl
devices/<id>/cmd/reboot  - Genstart device
devices/<id>/cmd/set-url - Skift display URL
devices/<id>/cmd/screenshot - Tag screenshot
devices/<id>/cmd/wifi-scan  - Scan WiFi netværk
```

## Credentials

### MQTT Broker
- Host: localhost:1883
- Se `.env` for username/password

### Legacy MySQL
- Host: sql.ufi-tech.dk:42351
- Database: Ufi-Tech
- Se `.env` for credentials

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
