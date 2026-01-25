# Task Tracker

## Done

- [x] Set up Mosquitto broker on Mac (Docker).
- [x] Connect Pi Node-RED to MQTT broker.
- [x] Add MQTT status/telemetry topics.
- [x] Add MQTT commands: set-url, reboot, tv, support, ssh-tunnel, screenshot, wifi-scan.
- [x] Add telemetry and screenshot helper scripts on Pi.
- [x] Make LAN primary and WiFi fallback via NetworkManager metrics.
- [x] Fix Node-RED flow errors for missing DB payloads.
- [x] Create documentation library (docs/).
- [x] Add device identity + approval gate in Node-RED.
- [x] Secure MQTT broker with auth + ACLs.
- [x] Scaffold admin platform (FastAPI + React + Docker).
- [x] Build FastAPI MQTT bridge MVP.
- [x] Build React admin UI MVP.
- [x] Add commands: restart-nodered, restart-chromium, get-info, log-tail, ssh-web.
- [x] Add web SSH via shellinabox (port 4200).

## In Progress

- [ ] Define device approval workflow in backend.

## Next

- [ ] Add SSH tunnel orchestration to backend/UI.
- [ ] Add command set: get-config, set-config.
- [ ] Add key rotation and device rename/tagging.
