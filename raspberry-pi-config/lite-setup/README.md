# Raspberry Pi OS Lite InfoScreen Setup

Frisk installation af Raspberry Pi OS Lite (Bookworm 64-bit) optimeret til InfoScreen kiosk.

## Systemkrav

- Raspberry Pi 3, 4 eller 5
- SD-kort (minimum 8GB)
- HDMI-forbindelse til TV/skærm
- Netværksforbindelse (Ethernet anbefales)

## Installation

### Step 1: Flash SD-kort

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Vælg "Raspberry Pi OS Lite (64-bit)" under "Raspberry Pi OS (other)"
3. Konfigurer i Settings (tandhjul):
   - Hostname: `ufitech-e45f0185e767` (eller dit MAC-baserede navn)
   - Enable SSH med password authentication
   - Username: `pi`
   - Password: (dit password)
   - Locale: Europe/Copenhagen, da

### Step 2: Boot og SSH

```bash
ssh pi@<pi-ip-address>
```

### Step 3: Kør setup

Der er to muligheder:

**Option A: Deploy fra Mac (anbefalet)**
```bash
cd "/Volumes/abiler/Projeckter/Skamstrup Recover/raspberry-pi-config/lite-setup"
./deploy-to-pi.sh 192.168.40.158 pi
```

**Option B: Manuel setup på Pi**
```bash
# Kopier filer til Pi
scp setup.sh pi@<pi-ip>:/home/pi/
scp ../node-red/flows.json pi@<pi-ip>:/home/pi/.node-red/

# SSH ind og kør
ssh pi@<pi-ip>
sudo bash setup.sh
```

## Filstruktur

```
lite-setup/
├── setup.sh              # Hoved setup script
├── deploy-to-pi.sh       # Deploy script (kør fra Mac)
├── home-pi/
│   ├── kiosk.sh          # Chromium kiosk launcher
│   ├── .xinitrc          # X startup script
│   ├── .bash_profile     # Auto-start X
│   └── start-vnc.sh      # VNC on-demand
├── systemd/
│   └── autologin.conf    # Auto-login på tty1
└── mqtt-server/
    └── setup-mosquitto.sh # MQTT broker setup (server)
```

## MQTT Setup (på sql.ufi-tech.dk)

```bash
scp mqtt-server/setup-mosquitto.sh user@sql.ufi-tech.dk:/tmp/
ssh user@sql.ufi-tech.dk
sudo bash /tmp/setup-mosquitto.sh
```

### MQTT Topics

| Topic | Retning | Funktion |
|-------|---------|----------|
| `infoscreen/<mac>/cmd/url` | ind | Skift URL |
| `infoscreen/<mac>/cmd/reboot` | ind | Genstart Pi |
| `infoscreen/<mac>/cmd/vnc` | ind | Start VNC |
| `infoscreen/<mac>/cmd/tv` | ind | TV on/off |
| `infoscreen/<mac>/status` | ud | Heartbeat |

## Test

### Verificer installation

```bash
# Verificer Lite (ingen desktop)
cat /etc/os-release | grep PRETTY_NAME
dpkg -l | grep -E "lxde|lxpanel|pcmanfm" | wc -l  # Skal være 0

# Verificer X
DISPLAY=:0 xset q

# Verificer Chromium
pgrep chromium

# Verificer Node-RED
systemctl is-active nodered
curl -s http://localhost:1880 | head -1
```

### Test CEC TV kontrol

```bash
# Tænd TV
echo 'on 0' | cec-client -s -d 1

# Sluk TV
echo 'standby 0' | cec-client -s -d 1
```

## Fejlfinding

### Chromium starter ikke
```bash
# Check X logs
cat ~/.local/share/xorg/Xorg.0.log | tail -50

# Prøv manuel start
startx -- -nocursor
```

### Node-RED problemer
```bash
# Check status
sudo systemctl status nodered

# Check logs
journalctl -u nodered -f
```

### Skærm forbliver sort
```bash
# Check om X kører
ps aux | grep Xorg

# Check kiosk script
/home/pi/kiosk.sh
```

## Fordele vs Desktop Version

| Aspekt | Desktop | Lite |
|--------|---------|------|
| RAM brug | ~400MB idle | ~150MB idle |
| Boot tid | ~45 sek | ~20 sek |
| SD-kort | ~4GB | ~1.5GB |
| Video performance | God | Optimal |
