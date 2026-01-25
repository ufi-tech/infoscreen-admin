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
│    ├── Failsafe: Internet monitor (hver 30 sek)             │
│    ├── Failsafe: Chromium watchdog (hver 60 sek)            │
│    └── TV kontrol via CEC (hvis understøttet)               │
├─────────────────────────────────────────────────────────────┤
│  Comitup (WiFi Provisioning)                                │
│    ├── Hotspot: InfoScreen-Setup                            │
│    ├── Captive portal på dansk                              │
│    └── Callback til wifi-connected.sh                       │
├─────────────────────────────────────────────────────────────┤
│  Services: nodered, comitup                                 │
└─────────────────────────────────────────────────────────────┘
```

## Hardware

- **Model:** Raspberry Pi 4
- **OS:** Debian Trixie 64-bit (Lite)
- **RAM:** 2GB
- **Display:** 1920x1080 via HDMI
- **Netværk:** Ethernet (192.168.40.157) eller WiFi

## Vigtige Filer på Pi

| Fil | Placering | Beskrivelse |
|-----|-----------|-------------|
| flows.json | `/home/pi/.node-red/flows.json` | Node-RED flows (inkl. failsafe) |
| settings.js | `/home/pi/.node-red/settings.js` | Node-RED config |
| kiosk.sh | `/home/pi/kiosk.sh` | X environment setup |
| .xinitrc | `/home/pi/.xinitrc` | X startup script |
| offline.html | `/home/pi/offline.html` | Fallback ved internet-tab |
| setup.html | `/home/pi/setup.html` | WiFi setup vejledning (vises på TV) |
| logo.png | `/home/pi/logo.png` | UFi-Tech logo |
| wifi-connected.sh | `/home/pi/wifi-connected.sh` | Comitup callback |
| hide-translate.css | `/home/pi/hide-translate.css` | Skjuler Google Translate |
| config.txt | `/boot/firmware/config.txt` | Boot/display config |
| comitup.conf | `/etc/comitup.conf` | WiFi provisioning config |

## Failsafe Funktioner

### Internet Monitor
- Checker internet hver 30 sekunder (ping 8.8.8.8)
- Hvis offline: Viser `/home/pi/offline.html` med ur og besked
- Når online igen: Genindlæser den rigtige URL

### Chromium Watchdog
- Checker om Chromium kører hver 60 sekunder
- Hvis crashet: Genstarter automatisk med cached URL

### WiFi Provisioning (Comitup)
- Når Pi starter uden WiFi: Opretter hotspot "InfoScreen-Setup"
- TV viser setup.html med QR-kode og vejledning
- Kunde forbinder til hotspot → captive portal åbner
- Dansk captive portal med WiFi valg og password input
- Når forbundet: Callback starter Node-RED → infoskærm vises

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
journalctl -u nodered -f

# Comitup
sudo systemctl status comitup
sudo systemctl restart comitup
journalctl -u comitup -f
```

### Display/Chromium
```bash
# Tjek display
DISPLAY=:0 xrandr

# Genstart Chromium (Node-RED genstarter den automatisk via watchdog)
pkill chromium

# Manuel Chromium start
DISPLAY=:0 chromium --kiosk "https://example.com"
```

### CEC TV Kontrol
```bash
# Tænd TV
echo "on 0" | cec-client -s -d 1

# Sluk TV (standby)
echo "standby 0" | cec-client -s -d 1
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

## Database Forbindelse

Node-RED forbinder til:
- **Host:** sql.ufi-tech.dk
- **Port:** 42351
- **Database:** Ufi-Tech
- **Tabel:** infoscreen

Pi'en identificeres via MAC-adresse.

## Fejlfinding

### Skærm viser "Ingen internetforbindelse"
- Normal failsafe - venter på internet
- Tjek netværk: `ping google.com`
- Når internet er tilbage, skifter den automatisk til infoskærmen

### WiFi hotspot virker ikke
```bash
# Tjek Comitup status
sudo systemctl status comitup

# Se Comitup logs
journalctl -u comitup -f

# Genstart Comitup
sudo systemctl restart comitup
```

### Captive portal viser engelsk tekst
- Templates skal opdateres i `/usr/share/comitup/web/templates/`
- Se `lite-setup/comitup-templates/` for danske versioner

### Chromium starter ikke
```bash
# Tjek Node-RED logs
journalctl -u nodered -n 50

# Manuel test
DISPLAY=:0 chromium --kiosk "https://google.com"
```

### Google Translate popup vises
- Flag `--disable-features=Translate` skal være i Chromium kommandoen
- CSS filen `/home/pi/hide-translate.css` skal eksistere

### Node-RED kan ikke forbinde til database
- Tjek netværk: `ping sql.ufi-tech.dk`
- Tjek DNS: `nslookup sql.ufi-tech.dk`
- Database port: 42351

## Mappestruktur (Lokalt Repository)

```
raspberry-pi-config/
├── CLAUDE.md              ← Denne fil (hoveddokumentation)
├── PLAN.md                ← Implementeringsplan
├── Ufi-Tech_v1.png        ← Logo
├── boot/
│   └── config.txt         ← Boot konfiguration
├── node-red/
│   ├── flows.json         ← Node-RED flows (med failsafe)
│   ├── settings.js        ← Node-RED indstillinger
│   └── package.json       ← Dependencies
└── lite-setup/
    ├── README.md          ← Setup guide
    ├── setup.sh           ← Installations script
    ├── deploy-to-pi.sh    ← Deploy script
    ├── offline.html       ← Fallback side (internet nede)
    ├── setup.html         ← WiFi setup vejledning
    ├── logo.png           ← UFi-Tech logo
    ├── wifi-connected.sh  ← Comitup callback
    ├── home-pi/           ← Filer til /home/pi/
    ├── systemd/           ← Systemd configs
    ├── comitup-templates/ ← Danske captive portal templates
    └── mqtt-server/       ← MQTT setup (valgfrit)
```

## Boot Sekvens

1. Pi booter → Auto-login på tty1
2. `.bash_profile` starter X server (`startx`)
3. `.xinitrc` kører `kiosk.sh`
4. `kiosk.sh` sætter display op (ingen screensaver, skjul mus)
5. Node-RED starter som service
6. Comitup checker WiFi status:
   - **Hvis WiFi/LAN forbundet:** Node-RED henter URL og starter Chromium
   - **Hvis ingen netværk:** Comitup starter hotspot, TV viser setup.html
7. Failsafe nodes overvåger internet og Chromium

## Backup/Restore

### Backup flows.json
```bash
scp pi@192.168.40.157:/home/pi/.node-red/flows.json ./backup/
```

### Restore flows.json
```bash
scp ./node-red/flows.json pi@192.168.40.157:/home/pi/.node-red/flows.json
ssh pi@192.168.40.157 'sudo systemctl restart nodered'
```
