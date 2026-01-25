# Node-RED MQTT on the Pi

This documents the scripts and flows added for MQTT control.

## Files on Pi

- /home/pi/mqtt-telemetry.py
- /home/pi/mqtt-screenshot.sh
- /home/pi/ssh-tunnel.sh
- /home/pi/mqtt-info.sh
- /home/pi/mqtt-log-tail.sh
- /home/pi/web-ssh.sh
- /home/pi/device-id
- /home/pi/device-approved
- /home/pi/.node-red/flows.json (MQTT nodes in Control tab)

## MQTT Broker

Broker name in flows: mac-broker
Host: 192.168.40.94
Port: 1883
Auth: uses device-id as username and a per-device password

## Device Identity

Device ID is stored in:

```
/home/pi/device-id
```

Approval flag is stored in:

```
/home/pi/device-approved
```

## Telemetry

Node-RED execs:

```
python3 /home/pi/mqtt-telemetry.py
```

Publishes to:

```
devices/<ID>/telemetry
```

## Screenshot

Node-RED execs:

```
/home/pi/mqtt-screenshot.sh file
/home/pi/mqtt-screenshot.sh base64
```

Recommended for remote admin:

- Use `base64` mode so screenshots are sent over MQTT and not stored locally.
- The script writes to `/tmp` and removes the file after encoding.

Publishes to:

```
devices/<ID>/screenshot
```

## SSH tunnel

Node-RED execs:

```
/home/pi/ssh-tunnel.sh start <name> <host> <user> <remote_port> [local_port] [key]
/home/pi/ssh-tunnel.sh stop <name>
```

Notes:
- Default SSH port is 2222. Override with `host:port` or by passing the port as the last argument.
- Reverse tunnels bind `0.0.0.0` on the tunnel host so remote access works.

Publishes result to:

```
devices/<ID>/events
```

## Web SSH (shellinabox)

Shellinabox is installed on the Pi and runs on port 4200.
It is started and stopped on-demand.

Config file:

```
/etc/default/shellinabox
```

Command:

```
/home/pi/web-ssh.sh start
/home/pi/web-ssh.sh stop
```

Access (LAN):

```
http://<device-ip>:4200
```
