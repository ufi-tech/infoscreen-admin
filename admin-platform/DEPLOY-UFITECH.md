# Deploy til ufitech-docker-01

## Oversigt

IOCast Admin Platform deployes til `ufitech-docker-01` med auto-deploy via GitHub webhooks.

| Komponent | URL | Port |
|-----------|-----|------|
| Frontend | https://admin.iocast.dk | 3000 |
| API | https://admin.iocast.dk/api | 8080 |
| Auto-deploy | https://admin.iocast.dk/deploy-webhook | 9006 |

## Første Gang Setup

### 1. SSH til server

```bash
ssh ufitech-docker-01
# eller: ssh ubuntu@172.17.0.101
```

### 2. Klon repository

```bash
cd /home/ubuntu
git clone git@github.com:ufi-tech/infoscreen-admin.git
cd infoscreen-admin/admin-platform
```

### 3. Opret .env fil

```bash
cp .env.ufitech.example .env
nano .env
```

Udfyld:
- `MQTT_PASSWORD` - fra ops-center secrets
- `WEBHOOK_SECRET` - generér med `openssl rand -hex 32`

### 4. Generér SSH deploy key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_deploy -N '' -C 'auto-deploy@ufitech-docker-01'
cat ~/.ssh/id_ed25519_deploy.pub
```

Tilføj public key til GitHub:
1. Gå til https://github.com/ufi-tech/infoscreen-admin/settings/keys
2. Klik "Add deploy key"
3. Titel: `Auto-Deploy (ufitech-docker-01)`
4. Key: Paste public key
5. ✅ Allow write access
6. Klik "Add key"

### 5. Konfigurer Git

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
git remote set-url origin git@github.com:ufi-tech/infoscreen-admin.git
```

### 6. Start containers

```bash
docker compose -f docker-compose.ufitech.yml up -d --build
```

### 7. Konfigurer Caddy (på ingress-01)

SSH til ingress-01 og tilføj til Caddyfile:

```caddyfile
admin.iocast.dk {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy ufitech-docker-01:8080
    }
    handle /deploy-webhook* {
        reverse_proxy ufitech-docker-01:9006
    }
    handle {
        reverse_proxy ufitech-docker-01:3000
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

### 8. Konfigurer GitHub Webhook

1. Gå til https://github.com/ufi-tech/infoscreen-admin/settings/hooks
2. Klik "Add webhook"
3. Payload URL: `https://admin.iocast.dk/deploy-webhook/webhook`
4. Content type: `application/json`
5. Secret: samme som `WEBHOOK_SECRET` i .env
6. Events: Just the push event
7. ✅ Active
8. Klik "Add webhook"

## Verificering

### Test health endpoints

```bash
# API
curl https://admin.iocast.dk/api/docs

# Auto-deploy status
curl https://admin.iocast.dk/deploy-webhook/status

# Frontend
curl -I https://admin.iocast.dk
```

### Test manuel deploy

```bash
curl -X POST https://admin.iocast.dk/deploy-webhook/deploy \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

### Logs

```bash
# Backend logs
docker logs iocast-admin-backend -f

# Frontend logs
docker logs iocast-admin-frontend -f

# Auto-deploy logs
docker logs iocast-admin-auto-deploy -f
```

## Opdatering

Efter opsætning vil alle pushes til `main` branch automatisk deploye.

Manuel deploy:
```bash
ssh ufitech-docker-01
cd /home/ubuntu/infoscreen-admin/admin-platform
git pull origin main
docker compose -f docker-compose.ufitech.yml up -d --build
```

## Fejlfinding

### Container starter ikke

```bash
docker compose -f docker-compose.ufitech.yml logs
```

### Webhook fejler

Tjek GitHub webhook deliveries:
https://github.com/ufi-tech/infoscreen-admin/settings/hooks

### MQTT forbindelse

```bash
docker exec iocast-admin-backend python -c "
import paho.mqtt.client as mqtt
client = mqtt.Client()
client.username_pw_set('admin', 'password')
client.connect('188.228.60.134', 1883)
print('Connected!')
"
```
