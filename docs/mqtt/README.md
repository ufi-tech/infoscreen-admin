# MQTT Control and Telemetry

This guide documents the MQTT interface used by the Pi (Node-RED) for control,
telemetry, and status.

## Broker

- Host: your Mac LAN IP (example: 192.168.40.94)
- Port: 1883 (TCP)
- WebSocket: 9001 (optional)
- Auth: required (see mqtt-broker/.secrets on the Mac)

## Device ID

The device ID is stored on the device:

- File: /home/pi/device-id
- Format: UUID (example below)
- Example: 04d1c535-1b70-4a19-b31f-7cda18dcc8c6

To discover IDs:

```
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/+/status' -v
```

## Topics (summary)

Status (retained):
- devices/<id>/status

Telemetry (periodic):
- devices/<id>/telemetry

Events (one-off responses):
- devices/<id>/events

WiFi scan results:
- devices/<id>/wifi-scan

Screenshot results:
- devices/<id>/screenshot

Commands (incoming):
- devices/<id>/cmd/set-url
- devices/<id>/cmd/reboot
- devices/<id>/cmd/restart-nodered
- devices/<id>/cmd/restart-chromium
- devices/<id>/cmd/tv
- devices/<id>/cmd/support
- devices/<id>/cmd/ssh-tunnel
- devices/<id>/cmd/screenshot
- devices/<id>/cmd/wifi-scan
- devices/<id>/cmd/get-info
- devices/<id>/cmd/log-tail
- devices/<id>/cmd/ssh-web
- devices/pending/<id>/cmd/approve

See docs/mqtt/EXAMPLES.md for payload details.
