# Deploy til Synology NAS

## Forudsætninger

- Docker og Docker Compose installeret på Synology (via Package Center)
- SSH adgang til Synology
- MQTT broker kører allerede (port 1883)

## Hurtig Deploy

### 1. Kopier filer til Synology

```bash
# Fra din Mac
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude '.git' \
  admin-platform/ \
  <user>@<synology-ip>:/volume1/docker/infoscreen-admin/
```

### 2. SSH til Synology

```bash
ssh <user>@<synology-ip>
cd /volume1/docker/infoscreen-admin
```

### 3. Opret .env.prod

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Opdater:
- `MQTT_PASSWORD` - din MQTT password
- `VITE_API_URL` - Synology LAN IP (f.eks. `http://192.168.40.152:8080`)

**Note:** Backend bruger port 8080 (ikke 8000) da port 8000 er optaget af laser_app på Synology.

### 4. Opdater docker-compose.prod.yml

Ret `VITE_API_URL` i frontend build args til din Synology IP:

```yaml
frontend:
  build:
    args:
      - VITE_API_URL=http://192.168.40.152:8080  # Synology IP (port 8080!)
```

### 5. Start containers

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 6. Verificer

```bash
# Check containers kører
docker ps

# Check logs
docker logs infoscreen-backend
docker logs infoscreen-frontend
```

## Adgang

- **Frontend**: http://192.168.40.152:3000
- **API**: http://192.168.40.152:8080
- **API Docs**: http://192.168.40.152:8080/docs

## Opdatering

```bash
cd /volume1/docker/infoscreen-admin

# Pull nyeste kode
git pull origin main

# Rebuild og genstart
docker-compose -f docker-compose.prod.yml up -d --build
```

## Troubleshooting

### MQTT forbindelse fejler

```bash
# Test MQTT broker lokalt
mosquitto_sub -h localhost -p 1883 -u admin -P <password> -t '#' -v
```

### Backend crasher

```bash
docker logs infoscreen-backend --tail 50
```

### Frontend viser "Cannot connect to API"

- Tjek at `VITE_API_URL` matcher Synology IP i docker-compose.prod.yml
- Rebuild frontend: `docker-compose -f docker-compose.prod.yml up -d --build frontend`
