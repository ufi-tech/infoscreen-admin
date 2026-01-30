# IOCast Admin Platform - Claude Context

## Projekt Oversigt

| Key | Value |
|-----|-------|
| **Projekt** | IoT fleet management for digital signage |
| **Tech Stack** | FastAPI + React + MQTT + SQLite |
| **GitHub** | [ufi-tech/infoscreen-admin](https://github.com/ufi-tech/infoscreen-admin) |
| **Production** | https://admin.screen.iocast.dk |
| **Auto-deploy** | https://deploy-admin.screen.iocast.dk |

## Infrastruktur

### Production Server: ufitech-docker-01

| Komponent | Container | Port | Status |
|-----------|-----------|------|--------|
| Frontend | `iocast-admin-frontend` | 3010 | Nginx + React build |
| Backend | `iocast-admin-backend` | 8080 | FastAPI + MQTT |
| Auto-deploy | `iocast-admin-auto-deploy` | 9010 | GitHub webhook |

**Server path:** `/home/ubuntu/infoscreen-admin/`

### Reverse Proxy: ingress-01

Caddy config: `/etc/caddy/conf.d/admin-iocast.conf`
- `admin.screen.iocast.dk` → frontend:3010 + `/api/*` → backend:8080
- `deploy-admin.screen.iocast.dk` → auto-deploy:9010

### MQTT Broker: Synology NAS

| Key | Value |
|-----|-------|
| **Host** | 188.228.60.134 |
| **Port** | 1883 |
| **User** | admin |

Både dev og production bruger samme broker.

## Udviklings-Workflow


### Deploy til Production

```bash
# Auto-deploy via git push
git add . && git commit -m "Ændring" && git push origin main

# Manuel deploy (hvis auto-deploy er nede)
ssh ufitech-docker-01 "cd /home/ubuntu/infoscreen-admin/admin-platform && \
  git pull origin main && \
  docker compose -f docker-compose.ufitech.yml up -d --build"
```

## API Endpoints

### Devices
```
GET  /devices                     - List MQTT devices
GET  /devices/{id}                - Device detaljer
POST /devices/{id}/command        - Send kommando
POST /devices/{id}/approve        - Godkend device
```

### Customers & Provisioning
```
GET/POST /customers               - Administrer kunder
GET/POST /customer-codes          - Provisioning koder (4-cifret)
GET      /customer-codes/by-code/{code}
```

### CMS Integration
```
GET  /customers/{id}/screens      - Hent skærme fra CMS
POST /devices/{id}/screen         - Tildel skærm til device
```

## MQTT Topics

```
# Device → Backend
devices/{id}/status              - online/offline (LWT)
devices/{id}/telemetry           - CPU, memory, battery, IP

# Backend → Device
devices/{id}/cmd/loadUrl         - Skift URL
devices/{id}/cmd/reboot          - Genstart
devices/{id}/cmd/screenshot      - Tag screenshot

# Provisioning (Android app)
provision/{code}/request         - Device anmoder om config
provision/{code}/response/{id}   - Backend sender config
```

## Fejlfinding

### Check container status
```bash
ssh ufitech-docker-01 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep iocast"
```

### Backend logs
```bash
ssh ufitech-docker-01 "docker logs iocast-admin-backend --tail 100"
```

### Auto-deploy logs
```bash
ssh ufitech-docker-01 "docker logs iocast-admin-auto-deploy --tail 50"
```

### Restart containers
```bash
ssh ufitech-docker-01 "cd /home/ubuntu/infoscreen-admin/admin-platform && \
  docker compose -f docker-compose.ufitech.yml restart"
```

### Start stopped auto-deploy
```bash
ssh ufitech-docker-01 "docker start iocast-admin-auto-deploy"
```

## Vigtige Filer

| Fil | Formål |
|-----|--------|
| `admin-platform/docker-compose.yml` | Lokal udvikling |
| `admin-platform/docker-compose.ufitech.yml` | Production compose |
| `admin-platform/backend/app/main.py` | API routers |
| `admin-platform/backend/app/mqtt_bridge.py` | MQTT handler |
| `admin-platform/backend/app/routers/customer_codes.py` | Provisioning API |
| `admin-platform/frontend/src/components/Customers.jsx` | Kunde UI |
| `admin-platform/deploy/auto-deploy/server.js` | Webhook handler |

## Database (SQLite)

Path: `/home/ubuntu/infoscreen-admin/admin-platform/data/app.db`

Tabeller: `devices`, `telemetry`, `events`, `customers`, `customer_codes`, `device_assignments`
