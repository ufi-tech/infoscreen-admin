# Raspberry Pi InfoScreen Kiosk System

## Hurtig Adgang

```bash
# SSH til Pi
ssh pi@192.168.40.157
# Password: 7200Grindsted!
```

## System Oversigt

```
┌─────────────────────────────────────────────────────────────┐
│              Raspberry Pi OS Lite (Debian Trixie 64-bit)    │
├─────────────────────────────────────────────────────────────┤
│  Auto-login (getty) → X Server (xinit) → Chromium (kiosk)   │
├─────────────────────────────────────────────────────────────┤
│  Node-RED (port 1880)                                       │
│    ├── Henter URL fra MySQL database (sql.ufi-tech.dk)      │
│    ├── Starter Chromium med korrekt URL                     │
│    ├── TV kontrol via CEC (hvis understøttet)               │
│    └── VNC support on-demand                                │
├─────────────────────────────────────────────────────────────┤
│  Services: nodered, x11vnc (on-demand)                      │
└─────────────────────────────────────────────────────────────┘
```

## Vigtige Filer på Pi

| Fil | Placering | Beskrivelse |
|-----|-----------|-------------|
| flows.json | `/home/pi/.node-red/flows.json` | Node-RED flows |
| settings.js | `/home/pi/.node-red/settings.js` | Node-RED config |
| kiosk.sh | `/home/pi/kiosk.sh` | X environment setup |
| .xinitrc | `/home/pi/.xinitrc` | X startup script |
| start-vnc.sh | `/home/pi/start-vnc.sh` | VNC launcher |
| hide-translate.css | `/home/pi/hide-translate.css` | Skjuler Google Translate |
| config.txt | `/boot/firmware/config.txt` | Boot/display config |

## Chromium Kiosk Flags

Node-RED starter Chromium med disse flags:
```bash
chromium --kiosk \
  --start-fullscreen \
  --window-position=0,0 \
  --window-size=1920,1080 \
  --disable-translate \
  --disable-features=Translate \
  --no-first-run \
  --no-sandbox \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  --ignore-gpu-blocklist \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --use-gl=egl \
  --user-stylesheet=file:///home/pi/hide-translate.css \
  "URL_FRA_DATABASE"
```

## Almindelige Kommandoer

### Services
```bash
# Node-RED
sudo systemctl status nodered
sudo systemctl restart nodered
sudo systemctl stop nodered

# Se Node-RED logs
journalctl -u nodered -f
```

### Display/Chromium
```bash
# Tjek display
DISPLAY=:0 xrandr

# Genstart Chromium (Node-RED genstarter den automatisk)
pkill chromium

# Manuel Chromium start
DISPLAY=:0 chromium --kiosk "https://example.com"
```

### VNC (Remote Support)
```bash
# Start VNC server
/home/pi/start-vnc.sh

# Eller manuelt
x11vnc -display :0 -forever -shared -bg

# Forbind med VNC client til: 192.168.40.157:5900
```

### CEC TV Kontrol
```bash
# Tænd TV
echo "on 0" | cec-client -s -d 1

# Sluk TV (standby)
echo "standby 0" | cec-client -s -d 1

# Scan for enheder
echo "scan" | cec-client -s -d 1
```

### System Info
```bash
# CPU/Memory
top -bn1 | head -5
free -h

# Temperatur
vcgencmd measure_temp

# Disk
df -h /

# Uptime
uptime
```

## Fejlfinding

### Skærm viser kun halv bredde
Tilføj `--window-size=1920,1080` til Chromium kommandoen i Node-RED flows.

### Skærm er sort
```bash
# Tjek hvilken HDMI port der bruges
DISPLAY=:0 xrandr

# Hvis HDMI-2 er connected, sæt den som primary
DISPLAY=:0 xrandr --output HDMI-2 --primary --mode 1920x1080
```

### Google Translate popup vises
- Flag `--disable-features=Translate` skal være i Chromium kommandoen
- CSS filen `/home/pi/hide-translate.css` skal eksistere

### Node-RED kan ikke forbinde til database
- Tjek netværk: `ping sql.ufi-tech.dk`
- Tjek DNS: `nslookup sql.ufi-tech.dk`
- Database port: 42351

### Chromium starter ikke
```bash
# Tjek Node-RED logs
journalctl -u nodered -n 50

# Manuel test
DISPLAY=:0 chromium --kiosk "https://google.com"
```

## Database Forbindelse

Node-RED forbinder til:
- **Host:** sql.ufi-tech.dk
- **Port:** 42351
- **Database:** Ufi-Tech
- **Tabel:** infoscreen

Pi'en identificeres via MAC-adresse: `ufi_tech-XXXXXXXXXXXX`

## Backup/Restore

### Backup flows.json
```bash
scp pi@192.168.40.157:/home/pi/.node-red/flows.json ./backup/
```

### Restore flows.json
```bash
scp ./flows.json pi@192.168.40.157:/home/pi/.node-red/flows.json
ssh pi@192.168.40.157 'sudo systemctl restart nodered'
```

## Hardware

- **Model:** Raspberry Pi 4
- **OS:** Debian Trixie 64-bit (Lite)
- **RAM:** 2GB
- **Display:** 1920x1080 via HDMI
- **Netværk:** Ethernet (192.168.40.157)

## Boot Sekvens

1. Pi booter → Auto-login på tty1
2. `.bash_profile` starter X server (`startx`)
3. `.xinitrc` kører `kiosk.sh`
4. `kiosk.sh` sætter display op (ingen screensaver, skjul mus)
5. Node-RED starter som service
6. Node-RED henter URL fra database
7. Node-RED starter Chromium med URL
