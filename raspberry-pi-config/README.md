# Raspberry Pi InfoScreen Konfiguration

## System Information
- **Hostname:** ufitech-e45f0185e767
- **Model:** Raspberry Pi 4 Model B Rev 1.5
- **OS:** Raspbian GNU/Linux 10 (buster)
- **IP:** 192.168.40.158
- **Bruger:** pi
- **Password:** 7200Grindsted!

## Hardware Specifikationer
- **RAM:** 1.7GB total (350MB used, 628MB available)
- **GPU Memory:** 256MB
- **CPU:** BCM2711

## Kørende Services

### Node-RED
- **Port:** 1880 (sandsynligvis)
- **Location:** /home/pi/.node-red/
- **Flow fil:** flows.json (48KB)
- **Status:** Aktiv

### Chromium Browser (Kiosk Mode)
- **URL:** https://infotv.magion.dk/?TV=TV_Hovedingang
- **Mode:** Kiosk (fuld skærm)
- **PID:** 975
- **CPU Usage:** 65.3% (høj!)
- **RAM Usage:** 805MB (høj!)

**Problem:** Chromium bruger software rendering i stedet for hardware acceleration!

## Identificerede Problemer

### 1. Hardware Acceleration Deaktiveret
**Problem:**
```
--use-gl=swiftshader-webgl --disable-gpu-compositing
```

**Årsag:**
- `dtoverlay=vc4-fkms-v3d` var kommenteret ud i /boot/config.txt
- Chromium flags er ikke optimeret

**Symptomer:**
- Høj CPU brug (65%)
- Høj RAM brug (805MB)
- Langsom video/billedafspilning

### 2. Nuværende Chromium Flags (Dårlige)
```bash
--force-renderer-accessibility
--disable-quic
--enable-tcp-fast-open
--enable-pinch
--disable-features=AudioServiceOutOfProcess
--kiosk
--autoplay-policy=no-user-gesture-required
--disable-restore-session-state
--disable-session-crashed-bubble
--noerrordialogs
--disable-infobars
--disable-features=TranslateUI
--disable-translate
--no-first-run
--fast
--fast-start
--no-sandbox
```

## Optimeringsplan

### Trin 1: Aktivér Hardware Acceleration i Boot Config
**Fil:** `/boot/config.txt`

**Tilføj/Uncomment:**
```
dtoverlay=vc4-fkms-v3d
```

**Status:** ✅ Allerede gjort - kræver genstart

### Trin 2: Opdatér Chromium Flags
**Anbefalede flags:**
```bash
DISPLAY=:0 chromium-browser \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --disable-restore-session-state \
  --disable-session-crashed-bubble \
  --noerrordialogs \
  --disable-infobars \
  --disable-features=TranslateUI \
  --disable-translate \
  --no-first-run \
  --fast \
  --fast-start \
  --no-sandbox \
  --ignore-gpu-blocklist \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --enable-features=VaapiVideoDecoder \
  --use-gl=egl
```

**Nye optimerede flags:**
- `--ignore-gpu-blocklist` - Tillad GPU selv om blocklisted
- `--enable-gpu-rasterization` - Brug GPU til rendering
- `--enable-zero-copy` - Reducer memory copying
- `--enable-features=VaapiVideoDecoder` - Hardware video decoding
- `--use-gl=egl` - Brug EGL i stedet for software rendering

### Trin 3: Øg GPU Memory (Valgfrit)
**Fil:** `/boot/config.txt`

**Ændring:**
```
gpu_mem=384  # Fra 256MB til 384MB
```

### Trin 4: Cache Clearing Script
Opret et cronjob til at rydde Chromium cache ugentligt:
```bash
0 3 * * 0 rm -rf /home/pi/.cache/chromium/*
```

## Node-RED Flow Struktur

### Tabs (Flows):
1. **Control** - Hoved kontrol flow (aktiv)
2. **WIFI Management** - WiFi konfiguration (deaktiveret)
3. **Video** - Video/kamera håndtering (aktiv)
4. **Internet monitor** - Internet overvågning (deaktiveret)
5. **Kirke** - Kirke specifik flow (deaktiveret)

### Funktioner i Control Flow:
- MAC adresse registrering
- Online status opdatering til database (sql.ufi-tech.dk:42351)
- URL kontrol og Chromium genstart ved URL ændring
- VNC remote support aktivering
- TV on/off kontrol via HDMI-CEC
- Reboot funktion

### Database Integration:
- **Host:** sql.ufi-tech.dk
- **Port:** 42351
- **Database:** Ufi-Tech
- **Tabel:** infoscreen
- **MAC ID:** ufi_tech-e45f0185e767

### Video Flow:
- Understøtter 2x2 grid af video streams
- Bruger omxplayer til RTSP streams
- Kamera URLs fra remote database

## Næste Trin

1. **Genstart Raspberry Pi** for at aktivere hardware acceleration
2. **Test video performance** efter genstart
3. **Overvåg CPU/RAM brug** - forventet: 20-30% CPU, 300-400MB RAM
4. **Opdater Node-RED flow** med optimerede Chromium flags

## Backup Filer
Alle backup filer er gemt på Raspberry Pi:
- `/home/pi/.node-red/flows.json.backup`
- `/boot/config.txt.backup`

## Filer i Dette Repository
```
raspberry-pi-config/
├── README.md (denne fil)
├── boot/
│   └── config.txt (boot konfiguration)
└── node-red/
    ├── flows.json (Node-RED flows)
    ├── settings.js (Node-RED indstillinger)
    └── package.json (Node-RED dependencies)
```

## SSH Adgang
```bash
ssh pi@192.168.40.158
# Password: 7200Grindsted!
```

## Useful Commands

### Tjek Chromium processer:
```bash
ps aux | grep chromium
```

### Restart Node-RED:
```bash
sudo systemctl restart nodered
```

### Tjek GPU memory:
```bash
vcgencmd get_mem gpu
```

### Tjek system ressourcer:
```bash
free -h
top
```

### Kill Chromium:
```bash
pkill chromium
```

### Genstart Raspberry Pi:
```bash
sudo reboot
```

## Performance Forventninger

### Før Optimering:
- CPU: 65% (renderer proces)
- RAM: 805MB (renderer proces)
- GPU: Software rendering

### Efter Optimering:
- CPU: 20-30%
- RAM: 300-400MB
- GPU: Hardware acceleration aktiv
- Flydende video/billeder

## Troubleshooting

### Hvis video stadig er langsom:
1. Tjek at hardware acceleration er aktiveret:
   ```bash
   chromium-browser --enable-logging=stderr --v=1 2>&1 | grep -i "gpu\|hardware"
   ```

2. Tjek GPU status:
   ```bash
   vcgencmd get_mem gpu
   ```

3. Se Chromium log for fejl:
   ```bash
   cat ~/.config/chromium/chrome_debug.log
   ```

### Hvis Node-RED ikke starter:
```bash
sudo systemctl status nodered
sudo journalctl -u nodered -n 50
```
