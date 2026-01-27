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
- Legacy database control exists via MySQL (infoscreen table).
- Device identity and approval exist, but MQTT broker config and command/approve
  topics are hardcoded to a single device id (not clone-safe).

## Architecture

- Broker: Mosquitto (Docker).
- Device agent: Node-RED + small helper scripts.
- Backend: FastAPI + Postgres (or SQLite for MVP).
- UI: React + Vite.
- Legacy control: MySQL `Ufi-Tech` database (read/write selected fields).

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
- Device clears /home/pi/device-approved on first boot/clone to force approval.
- Node-RED uses device-id for MQTT clientid, LWT topics, and cmd subscriptions.
- Device connects with per-device MQTT credentials (not shared).
- Backend keeps an allowlist of approved device IDs.
- Unapproved devices publish status/telemetry to devices/pending/<id>/...
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
3. Replace hardcoded MQTT clientid/birth/will/cmd/approve topics with device-id.
4. Add first-boot device-id generation + hostname update + approval reset.
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
4. Keep reverse SSH payload schema stable; add validation to avoid command injection.

Deliverables:
- On-demand SSH access without VNC.

### Phase 5 - Reliability and Ops

1. Add device logs to backend (last 100 events).
2. Add scheduler for periodic telemetry cleanup.
3. Add backup strategy for Node-RED flows.

Deliverables:
- Stable operations for multiple devices.

### Phase 6 - Legacy DB Integration

Goal: manage existing "old system" devices in a dedicated admin tab without
mixing MQTT-native devices.

Findings (current legacy model):
- Database: `Ufi-Tech` on `sql.ufi-tech.dk:42351`.
- Table: `infoscreen` (primary key `ID`, device key `MAC` with prefix `ufi_tech-`).
- Fields used by Node-RED flow: `Url`, `Support`, `Online`, `IP`, `wan`, `Kirke`, `camera`.
- Support control values in flow:
  - `Support = 1` triggers VNC reverse connect.
  - `Support = 2` triggers reboot.
  - Flow resets `Support = 0`.
- Other useful fields: `CompanyName`, `description`, `ZipCode`, `TVON`,
  `hdmistart`, `hdmistop`, `DelayDmi`, `width`, `height`, `mail`, `sms`.

Plan:
1. Backend adds MySQL connector (read-only first).
2. Add legacy endpoints:
   - `GET /legacy/devices` (lists `infoscreen` rows).
   - `GET /legacy/devices/{id}` (detail by `ID` or `MAC`).
   - `POST /legacy/devices/{id}/update` (whitelisted fields only).
3. Admin UI adds a "Legacy" tab:
   - List old devices, show URL, online, IP/wan, company, description.
   - Edit URL, Support action (reboot/support), TV on/off, HDMI schedule.
4. Add mapping table to link legacy `MAC` -> new `device_id`
   so we can show a single "device" view when available.
5. Add admin-owned tables for customers and locations:
   - `admin_customers`, `admin_locations`, `admin_device_links`.
   - Locations store `lat`, `lon` for map view.
6. Add auto-registration flow:
   - MQTT devices appear as pending, admin assigns customer/location.
   - Legacy devices can be linked by MAC and migrated gradually.

Deliverables:
- Legacy tab in UI for existing DB-controlled devices.
- Safe updates to legacy fields from admin.
- Customer/location model with device assignments and position data.

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
- Web SSH (shellinabox) only exposed via reverse tunnel (localhost on device).

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

1. Make Node-RED MQTT topics and clientid device-specific (clone-safe).
2. Add first-boot device-id/hostname reset for cloned SD images.
3. Update approval flow to wildcard subscribe + pending telemetry support.
4. Harden ssh-tunnel command building without breaking reverse proxy.
5. Decide MQTT auth and broker location.
2. Implement device identity and approval workflow.
3. Build FastAPI MVP with MQTT bridge.
4. Build React UI skeleton.
