# Synology SSH Tunnel Host (Docker)

This sets up a public SSH endpoint on a Synology NAS so devices can create
reverse SSH tunnels for remote access.

## Prereqs

- Synology NAS with Docker package enabled.
- Public DNS or static IP (example: tunnel.example.com).
- Router port forward from WAN to Synology (TCP).
- SSH key on each Pi (no password auth).

## Docker (recommended)

1) Create folders on Synology:

```
/volume1/docker/ssh-tunnel/config
```

2) Run container (example values):

```
docker run -d \
  --name ssh-tunnel \
  -p 2222:2222 \
  -e PUID=1026 \
  -e PGID=100 \
  -e TZ=Europe/Copenhagen \
  -e USER_NAME=tunnel \
  -e PASSWORD_ACCESS=false \
  -e PUBLIC_KEY="ssh-ed25519 AAAA... pi@device" \
  -v /volume1/docker/ssh-tunnel/config:/config \
  --restart unless-stopped \
  ghcr.io/linuxserver/openssh-server
```

Notes:
- Change PUID/PGID to your Synology user ids.
- Use one public key per device or a dedicated key.
- If you prefer a different external port, change `-p 2222:2222`.

3) Enable reverse port forwarding:

Edit `/volume1/docker/ssh-tunnel/config/sshd/sshd_config` and set:

```
AllowTcpForwarding yes
GatewayPorts clientspecified
ClientAliveInterval 30
ClientAliveCountMax 3
```

Restart the container after changes.

4) Router port forward:

- WAN TCP 2222 -> Synology LAN IP :2222

## Pi test (manual)

```
ssh -i /home/pi/.ssh/id_tunnel -p 2222 tunnel@tunnel.example.com
```

## Reverse tunnel example

Expose the Pi SSH port (22) on the Synology host:

```
ssh -i /home/pi/.ssh/id_tunnel -N \
  -R 0.0.0.0:22001:localhost:22 \
  -p 2222 tunnel@tunnel.example.com
```

Then connect from the internet:

```
ssh -p 22001 pi@tunnel.example.com
```

## Admin platform usage

Use these fields in the Reverse SSH section:

- host: `tunnel.example.com`
- user: `tunnel`
- remote port: `22001`
- local port: `22`
- key path: `/home/pi/.ssh/id_tunnel`
