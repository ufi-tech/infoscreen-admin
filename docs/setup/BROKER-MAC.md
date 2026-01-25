# MQTT Broker on Mac (Docker)

Location:
- mqtt-broker/docker-compose.yml
- mqtt-broker/config/mosquitto.conf

Start:

```
docker compose -f mqtt-broker/docker-compose.yml up -d
```

Verify:

```
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Ports:
- 1883 (MQTT TCP)
- 9001 (WebSocket)

Notes:
- Auth is enabled with a password file and ACLs.
- Credentials are stored locally in mqtt-broker/.secrets (do not commit).
- ACL file: mqtt-broker/config/acl
- Password file: mqtt-broker/config/passwords
