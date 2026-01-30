# IOCast Admin Platform - Claude Context

## Projekt Oversigt

| Key | Value |
|-----|-------|
| **Projekt** | IoT fleet management for digital signage |
| **Tech Stack** | FastAPI + React + MQTT + SQLite |
| **GitHub** | [ufi-tech/infoscreen-admin](https://github.com/ufi-tech/infoscreen-admin) |
| **Production** | https://admin.screen.iocast.dk |
| **Auto-deploy** | Push til `main` branch deployer automatisk |
| **Ops-Center** | `ops project show infoscreen-admin` |

## Udviklings-Workflow

### 1. Lokal Udvikling (anbefalet)

```bash
# Start lokal backend + frontend (forbinder til production MQTT)
cd admin-platform && docker-compose up -d

# Verificer
curl -s http://localhost:3000      # Frontend (Vite dev server)
curl -s http://localhost:8000/api  # Backend API
```

### 2. Deploy til Production

```bash
# Commit og push - auto-deploy håndterer resten!
git add . && git commit -m "Din ændring" && git push origin main

# Tjek deploy status
curl -s https://deploy-admin.screen.iocast.dk/status
```

### 3. Test Production med Playwright

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('https://admin.screen.iocast.dk')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='.playwright-mcp/production-test.png', full_page=True)
    browser.close()
```

## Arkitektur

### Production (ufitech-docker-01)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  CADDY (ingress-01) - Reverse Proxy + SSL                   │
│  admin.screen.iocast.dk → ufitech-docker-01:3010/8080       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  UFITECH-DOCKER-01                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Frontend (3010) │  │ Backend (8080)  │  │ Auto-deploy  │ │
│  │ Nginx + React   │  │ FastAPI + MQTT  │  │ Webhook(9010)│ │
│  │ Production build│  │ SQLite DB       │  │ GitHub hook  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  MQTT BROKER (188.228.60.134:1883)                          │
│  Synology NAS - Alle enheder forbinder hertil               │
└─────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   Raspberry Pi          Android TV             Fully Tablet
   (Node-RED)            (IOCast App)           (Fully Kiosk)
```

### Container Oversigt

| Container | Port | Formål |
|-----------|------|--------|
| `iocast-admin-frontend` | 3010 | Nginx med React production build |
| `iocast-admin-backend` | 8080 | FastAPI + MQTT bridge + SQLite |
| `iocast-admin-auto-deploy` | 9010 | GitHub webhook → git pull → docker rebuild |

### URLs

| Miljø | Frontend | API | Auto-deploy |
|-------|----------|-----|-------------|
| **Production** | https://admin.screen.iocast.dk | https://admin.screen.iocast.dk/api | https://deploy-admin.screen.iocast.dk |
| **Development** | http://localhost:3000 | http://localhost:8000 | N/A |

## Auto-Deploy System

Push til `main` branch trigger automatisk deployment:

1. GitHub sender webhook til `https://deploy-admin.screen.iocast.dk/webhook`
2. Auto-deploy container verificerer HMAC signature
3. `git pull origin main`
4. `docker compose build` + `docker compose up -d`
5. Health check på backend

**Manuel trigger:**
```bash
curl -X POST https://deploy-admin.screen.iocast.dk/deploy \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

**Check status:**
```bash
curl -s https://deploy-admin.screen.iocast.dk/status
```

## MQTT Broker

⚠️ **VIGTIGT: Brug KUN production MQTT broker - aldrig en lokal!**

| Key | Value |
|-----|-------|
| **Host** | 188.228.60.134 |
| **Port** | 1883 |
| **User** | admin |
| **Password** | Se `.env` på server |

Både development og production forbinder til **samme** broker.

## Vigtige Filer

### Backend (FastAPI)
| Fil | Formål |
|-----|--------|
| [backend/app/main.py](admin-platform/backend/app/main.py) | API endpoints + routers |
| [backend/app/models.py](admin-platform/backend/app/models.py) | SQLAlchemy models |
| [backend/app/mqtt_bridge.py](admin-platform/backend/app/mqtt_bridge.py) | MQTT client + message handling |

### Frontend (React)
| Fil | Formål |
|-----|--------|
| [frontend/src/App.jsx](admin-platform/frontend/src/App.jsx) | Main app component |
| [frontend/src/api.js](admin-platform/frontend/src/api.js) | API client (uses VITE_API_URL) |
| [frontend/src/styles.css](admin-platform/frontend/src/styles.css) | Dark theme styling |
| [frontend/src/components/](admin-platform/frontend/src/components/) | UI components |

### Deployment
| Fil | Formål |
|-----|--------|
| [docker-compose.yml](admin-platform/docker-compose.yml) | Lokal udvikling |
| [docker-compose.ufitech.yml](admin-platform/docker-compose.ufitech.yml) | Production på ufitech-docker-01 |
| [frontend/Dockerfile.prod](admin-platform/frontend/Dockerfile.prod) | Multi-stage nginx build |
| [deploy/auto-deploy/](admin-platform/deploy/auto-deploy/) | Webhook service |

## API Endpoints

### Devices (MQTT)
```
GET  /devices                    - List alle MQTT devices
GET  /devices/{id}               - Device detaljer + telemetri
POST /devices/{id}/command       - Send kommando (reboot, screenshot, etc.)
POST /devices/{id}/approve       - Godkend ny device
```

### Fully Kiosk Devices
```
POST /devices/{id}/fully/command - Send Fully-specifik kommando
POST /devices/{id}/fully/password - Gem Fully password
```

### Customers & Locations
```
GET/POST /customers              - Administrer kunder
GET/POST /locations              - Administrer lokationer
GET/POST /assignments            - Device-to-customer mappings
```

## MQTT Topics

```
# Device status
devices/{id}/status          - online/offline (LWT)
devices/{id}/telemetry       - CPU, memory, disk, battery

# Commands (backend → device)
devices/{id}/cmd/reboot
devices/{id}/cmd/set-url
devices/{id}/cmd/screenshot

# Fully Kiosk specific
fully/deviceInfo/{id}        - Device info response
fully/relay/command          - Commands via relay
```

## Fejlfinding

### Backend starter ikke
```bash
# Check logs
ssh ufitech-docker-01 "docker logs iocast-admin-backend --tail 50"

# MQTT connection issue? Check env vars
ssh ufitech-docker-01 "docker exec iocast-admin-backend env | grep MQTT"
```

### Auto-deploy fejler
```bash
# Check webhook logs
ssh ufitech-docker-01 "docker logs iocast-admin-auto-deploy --tail 50"

# Manuel rebuild
ssh ufitech-docker-01 "cd /home/ubuntu/infoscreen-admin/admin-platform && \
  git pull origin main && \
  docker compose -f docker-compose.ufitech.yml up -d --build"
```

### Database migration needed
```bash
# Add missing column
ssh ufitech-docker-01 "docker run --rm \
  -v /home/ubuntu/infoscreen-admin/admin-platform/data:/data \
  python:3.11-slim python3 -c \"
import sqlite3
conn = sqlite3.connect('/data/app.db')
conn.execute('ALTER TABLE devices ADD COLUMN new_column TEXT')
conn.commit()
\""
```

## Credentials

### Server Access
```bash
ssh ufitech-docker-01  # Ubuntu server med Docker
```

### Production .env (på server)
```
MQTT_USERNAME=admin
MQTT_PASSWORD=<secret>
WEBHOOK_SECRET=<github-webhook-secret>
```

## Known Issues / TODO

- [ ] API authentication (ingen auth på endpoints)
- [ ] Data retention policy (telemetri vokser ubegrænset)
- [ ] Node-RED flow backup automation
