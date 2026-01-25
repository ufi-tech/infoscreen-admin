# Master Plan

This is the complete plan for the MQTT-based admin platform and device control.

## Goals

- Use MQTT for all device control and telemetry.
- Replace database-driven control with MQTT commands.
- Provide a web admin UI to manage devices, view status, send commands,
  and retrieve screenshots.
- Support secure remote access via SSH tunnels (not VNC).
- Make devices stable, recoverable, and easy to deploy.

## Scope

In-scope:
- MQTT broker, topic schema, device agent (Node-RED + scripts).
- FastAPI backend (device registry, command queue, telemetry storage).
- React admin UI (status, actions, logs, screenshots).
- SSH tunnel orchestration via MQTT.
- Health checks, offline detection, and basic audit logging.
- Device identity and approval (anti-clone, allowlist).

Out-of-scope (for now):
- Fleet-wide OTA updates.
- Full device provisioning UI.
- Video streaming in the UI.

## Current State

- MQTT broker running on Mac via Docker.
- Node-RED on Pi publishes status and telemetry and accepts commands.
- Screenshot and WiFi scan actions are supported via MQTT.
- SSH tunnel script exists on Pi.

## Architecture

- Broker: Mosquitto (Docker).
- Device agent: Node-RED + small helper scripts.
- Backend: FastAPI + Postgres (or SQLite for MVP).
- UI: React + Vite.

## Topic Model (baseline)

- devices/<id>/status (retained)
- devices/<id>/telemetry
- devices/<id>/events
- devices/<id>/wifi-scan
- devices/<id>/screenshot
- devices/<id>/cmd/<action>

## Device Identity and Approval

Goal: each device has a unique, non-clonable identity and must be approved
before it can receive commands.

Baseline approach:
- Device generates a UUID on first boot and stores it in /home/pi/device-id.
- Device connects with per-device MQTT credentials (not shared).
- Backend keeps an allowlist of approved device IDs.
- Unapproved devices can only publish to devices/pending/<id>/hello.
- After approval, backend issues credentials and enables full topics.
  (Local approval flag stored in /home/pi/device-approved.)

## LWT and Heartbeat

- Use MQTT LWT to publish offline on unexpected disconnects.
- Publish heartbeat/status regularly (e.g., every 60s).
- Backend marks offline only after a timeout window (e.g., 90s).

## Phases

### Phase 1 - Harden MQTT and Device Agent

1. Add MQTT auth (user/pass) and ACLs.
2. Update Node-RED broker config to use auth.
3. Add device identity (/etc/device-id) and approval workflow.
4. Add device heartbeat watchdog (in backend and UI).
5. Decide retention policies for telemetry and screenshots.

Deliverables:
- Broker secured.
- Device connects with credentials.
- Heartbeat detection (online/offline).
- Device approval gate enforced.

### Phase 2 - Backend (FastAPI) MVP

1. API endpoints:
   - GET /devices
   - GET /devices/<id>
   - POST /devices/<id>/command
   - GET /devices/<id>/telemetry
   - GET /devices/<id>/events
2. MQTT bridge service in backend:
   - Subscribes to devices/+/status, telemetry, events.
   - Stores latest status in DB.
3. Basic auth for admin API.

Deliverables:
- Backend can list devices and push commands.
- Telemetry stored and queryable.

### Phase 3 - Admin UI (React)

1. Device list with live status.
2. Device detail page:
   - Latest telemetry (CPU temp, load, IP, URL).
   - Actions (set URL, reboot, TV on/off, screenshot, wifi scan).
3. Screenshot viewer.

Deliverables:
- Admin UI functional for core tasks.

### Phase 4 - SSH Tunnel Orchestration

1. Add backend endpoint to request tunnel:
   - POST /devices/<id>/tunnel
2. Backend publishes MQTT command and waits for event ack.
3. UI shows tunnel status and target port.

Deliverables:
- On-demand SSH access without VNC.

### Phase 5 - Reliability and Ops

1. Add device logs to backend (last 100 events).
2. Add scheduler for periodic telemetry cleanup.
3. Add backup strategy for Node-RED flows.

Deliverables:
- Stable operations for multiple devices.

## Device Actions (MQTT Commands)

- set-url
- reboot
- tv
- support (legacy)
- ssh-tunnel
- screenshot
- wifi-scan
- get-info
- restart-service
- get-config
- set-config
- set-name
- set-tags
- log-tail
- rotate-keys

## Security Model

- MQTT auth required for publish and subscribe.
- Broker ACLs limit topics by device ID.
- Admin API protected by login.
- SSH tunnels use per-device keys.
- Device approval list required before commands.

## Data Model (backend)

- Device:
  - id, name, last_seen, status, ip, url
- Telemetry:
  - device_id, ts, temp_c, load, mem, disk, ip
- Events:
  - device_id, ts, type, payload
- Commands:
  - device_id, ts, action, payload, status

## Risks and Mitigations

- Broker on Mac is single point of failure -> move to server later.
- Large screenshots -> prefer file references or size limit.
- Node-RED flow changes -> keep backups and export versions.

## Next Steps

1. Decide MQTT auth and broker location.
2. Implement device identity and approval workflow.
3. Build FastAPI MVP with MQTT bridge.
4. Build React UI skeleton.
