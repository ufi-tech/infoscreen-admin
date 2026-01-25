# MQTT Examples

Replace <ID> with the real device ID from /home/pi/device-id.
All commands require MQTT auth (use the admin user).

## Status and telemetry

Subscribe:

```
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/status' -v
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/telemetry' -v
```

## Set URL

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/set-url' -m '"https://example.com"'
```

or JSON:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/set-url' -m '{"url":"https://example.com"}'
```

## Reboot

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/reboot' -m '{}'
```

## Restart services

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/restart-nodered' -m '{}'
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/restart-chromium' -m '{}'
```

## TV on/off

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/tv' -m '{"state":"on"}'
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/tv' -m '{"state":"off"}'
```

## Support/VNC

Local start:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/support' -m '{}'
```

Reverse mode:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/support' -m '{"mode":"reverse","connect":"sql.ufi-tech.dk::36666"}'
```

## SSH tunnel

Start:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/ssh-tunnel' -m '{"action":"start","name":"admin","host":"your.host","user":"tunnel","remote_port":2222,"local_port":22,"key":"/home/pi/.ssh/id_rsa"}'
```

Stop:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/ssh-tunnel' -m '{"action":"stop","name":"admin"}'
```

## Screenshot

File on device (returns file path):

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/screenshot' -m '{"mode":"file"}'
```

Base64 payload (bigger message):

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/screenshot' -m '{"mode":"base64"}'
```

Subscribe:

```
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/screenshot' -v
```

## WiFi scan

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/wifi-scan' -m '{}'
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/wifi-scan' -v
```

## Get info / log tail

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/get-info' -m '{}'
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/log-tail' -m '{}'
mosquitto_sub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/events' -v
```

## Web SSH (shellinabox)

Start/stop the web terminal:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/ssh-web' -m '{"action":"start"}'
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/<ID>/cmd/ssh-web' -m '{"action":"stop"}'
```

Access (LAN):

```
http://<device-ip>:4200
```

## Approve device

If a device is pending, approve it with:

```
mosquitto_pub -h 192.168.40.94 -u admin -P '<ADMIN_PASS>' -t 'devices/pending/<ID>/cmd/approve' -m '{}'
```
