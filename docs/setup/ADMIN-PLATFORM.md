# Admin Platform (FastAPI + React)

Location:
- admin-platform/

Services:
- backend (FastAPI on port 8000)
- frontend (React dev server on port 3000)

Environment:
- admin-platform/.env (ignored)
- admin-platform/.env.example (template)

Start:

```
docker compose -f admin-platform/docker-compose.yml up -d --build
```

Stop:

```
docker compose -f admin-platform/docker-compose.yml down
```

Notes:
- Backend uses MQTT admin credentials from .env.
- Frontend reads VITE_API_URL from environment.
