# Infoscreen Admin

## Overview

| Key | Value |
|-----|-------|
| **Project** | IoT fleet management for Raspberry Pi infoscreens |
| **Tech Stack** | FastAPI + React + MQTT + SQLite |
| **Working Directory** | /Volumes/abiler/Projeckter/Skamstrup Recover |
| **Dev Server** | http://localhost:3000 (UI), http://localhost:8000 (API) |
| **GitHub** | https://github.com/ufi-tech/infoscreen-admin |
| **Ops-Center** | `ops project show infoscreen-admin` |

---

## Skills Reference

**Always available via ops-center:**
- `/ops-center` - Project lookup, server details, secrets
- `/infrastructure` - SSH access, Caddy, Docker management
- `/project-setup` - New project configuration

**Projekt-specifikke:**
- `/playwright-testing` - UI testing med Playwright

**Plugins (configured in settings.json):**
- `superpowers` - Brainstorming, TDD, debugging, planning
- `frontend-design` - Professional UI design
- `context7` - Library documentation lookup

---

## Infrastructure (via ops-center)

```bash
# Server detaljer
ops server show synology-tunnel-01   # SSH tunnel endpoint
ops server show mqtt-broker-01       # MQTT broker

# SSH til Pi via tunnel
ssh -p 22001 pi@tunnel.ufi-tech.dk
```

---

## Database Schema

```sql
-- SQLite (admin-platform/data/app.db)
devices: id, name, mac, approved, display_url, last_seen, ip
telemetry: id, device_id, timestamp, cpu_temp, cpu_load, memory_percent, disk_percent, uptime
events: id, device_id, timestamp, event_type, data
device_logs: id, device_id, timestamp, level, category, message, details
tunnel_configs: device_id, host, user, key_path, tunnel_port, ssh_port, nodered_port, web_ssh_port
customers: id, name, email, phone, address, notes
locations: id, name, address, zip_code, city, lat, lon
assignments: id, customer_id, device_id, legacy_device_id
```

---

## Key Features

1. **Device Management** - MQTT device discovery, approval, telemetry
2. **Remote Commands** - Reboot, screenshot, URL change, WiFi scan
3. **SSH Tunnels** - Reverse SSH via Synology for remote Pi access
4. **Legacy Integration** - MySQL database for existing infoscreens
5. **Customer/Location** - CRM for device assignments

---

## Quick Commands

```bash
# Start development
cd admin-platform && docker-compose up -d

# Test API
curl http://localhost:8000/devices

# MQTT subscribe (debug)
mosquitto_sub -h 188.228.60.134 -u admin -P <password> -t 'devices/#' -v

# SSH til Pi
ssh pi@192.168.40.157  # Password: 7200Grindsted!
```

---

## Deployment

**Development only** - kører lokalt på Mac via Docker Compose.

```bash
cd admin-platform
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose logs -f    # Logs
```

---

## Best Practices

### Code Standards
- Backend: FastAPI med type hints
- Frontend: React functional components med hooks
- Database: SQLAlchemy ORM
- MQTT: Paho client med auto-reconnect

### Workflow
- Use `/superpowers:brainstorming` before complex features
- Use `/superpowers:systematic-debugging` for bugs
- Test UI changes med Playwright (se docs/PLAYWRIGHT.md)

---

*For infrastructure details, use `/infrastructure` skill*
*For project lookup, use `ops project show infoscreen-admin`*
