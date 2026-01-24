# Quick Start Guide - Raspberry Pi Optimering

## Hurtig Opsummering

**Problem:** Hjemmesiden med video og billeder kører langsomt på Raspberry Pi
**Årsag:** Hardware acceleration er deaktiveret - Chromium bruger software rendering
**Løsning:** Aktivér hardware acceleration og optimér Chromium flags

## System Info
```
IP:       192.168.40.158
User:     pi
Password: 7200Grindsted!
Hostname: ufitech-e45f0185e767
```

## Downloadede Filer

```
raspberry-pi-config/
├── README.md              (Fuld dokumentation)
├── QUICK-START.md         (Denne fil)
├── optimize.sh            (Automatisk optimerings script)
├── test-performance.sh    (Performance test script)
├── boot/
│   └── config.txt         (Boot konfiguration)
└── node-red/
    ├── flows.json         (Node-RED flows - 48KB)
    ├── settings.js        (Node-RED indstillinger)
    └── package.json       (Dependencies)
```

## Upload Scripts til Raspberry Pi

```bash
# Fra din Mac
cd "/Volumes/abiler/Projeckter/Skamstrup Recover/raspberry-pi-config"

# Upload optimize script
scp optimize.sh pi@192.168.40.158:/home/pi/
scp test-performance.sh pi@192.168.40.158:/home/pi/

# Gør dem executable
ssh pi@192.168.40.158 "chmod +x /home/pi/*.sh"
```

## Kør Optimering (Metode 1: Automatisk)

```bash
# SSH ind på Raspberry Pi
ssh pi@192.168.40.158

# Kør optimerings scriptet
sudo ./optimize.sh

# Genstart når prompted
```

## Kør Optimering (Metode 2: Manuel)

### 1. Aktivér Hardware Acceleration
```bash
ssh pi@192.168.40.158

# Backup boot config
sudo cp /boot/config.txt /boot/config.txt.backup

# Aktivér hardware acceleration
sudo sed -i 's/#dtoverlay=vc4-fkms-v3d/dtoverlay=vc4-fkms-v3d/' /boot/config.txt

# (Valgfrit) Øg GPU memory
sudo sed -i 's/gpu_mem=256/gpu_mem=384/' /boot/config.txt
```

### 2. Opdatér Chromium Flags i Node-RED
```bash
# Backup Node-RED flows
sudo cp /home/pi/.node-red/flows.json /home/pi/.node-red/flows.json.backup

# Opdater Chromium flags
sudo sed -i 's/--no-sandbox "/--no-sandbox --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --use-gl=egl "/g' /home/pi/.node-red/flows.json

# Genstart Node-RED
sudo systemctl restart nodered
```

### 3. Genstart Raspberry Pi
```bash
sudo reboot
```

## Test Performance Efter Genstart

```bash
ssh pi@192.168.40.158

# Kør performance test
./test-performance.sh
```

**Forventet resultat:**
- ✓ GPU har nok memory allokeret
- ✓ vc4-fkms-v3d overlay er aktiveret
- ✓ CPU brug er god (< 40%)
- ✓ Hardware rendering aktiveret (--use-gl=egl)
- ✓ GPU rasterization aktiveret
- ✓ Hardware video decoding aktiveret

## Før og Efter

### FØR Optimering:
```
CPU Usage:  65% (Chromium renderer)
RAM Usage:  805MB (Chromium)
Rendering:  Software (swiftshader)
Performance: ❌ Langsom/hakkende video
```

### EFTER Optimering:
```
CPU Usage:  20-30% (Chromium renderer)
RAM Usage:  300-400MB (Chromium)
Rendering:  Hardware (EGL + GPU)
Performance: ✅ Flydende video og billeder
```

## Troubleshooting

### Video stadig langsom efter optimering?

1. **Tjek at hardware acceleration virker:**
```bash
ps aux | grep chromium | grep "use-gl"
# Skal vise: --use-gl=egl (IKKE swiftshader)
```

2. **Tjek GPU memory:**
```bash
vcgencmd get_mem gpu
# Skal være 256M eller højere
```

3. **Tjek boot config:**
```bash
grep "vc4-fkms-v3d" /boot/config.txt
# Skal vise: dtoverlay=vc4-fkms-v3d (uden #)
```

4. **Se Chromium fejl:**
```bash
journalctl -u nodered -n 100
```

### Node-RED virker ikke?

```bash
# Tjek status
sudo systemctl status nodered

# Genstart service
sudo systemctl restart nodered

# Se logs
sudo journalctl -u nodered -f
```

### Gendanne backup hvis noget går galt:

```bash
# Gendan boot config
sudo cp /boot/config.txt.backup /boot/config.txt

# Gendan Node-RED flows
sudo cp /home/pi/.node-red/flows.json.backup /home/pi/.node-red/flows.json

# Genstart
sudo reboot
```

## Nyttige Kommandoer

```bash
# Se CPU/RAM brug
top
htop

# Se Chromium processer
ps aux | grep chromium

# Genstart Chromium (via Node-RED)
# Gå til Node-RED dashboard og skift URL eller genstart

# Tjek system temperatur
vcgencmd measure_temp

# Se alle kørende services
systemctl list-units --type=service --state=running

# Ryd Chromium cache manuelt
rm -rf /home/pi/.cache/chromium/*
```

## Remote Access (VNC)

Node-RED kan aktivere VNC support via databasen:
```sql
UPDATE infoscreen SET Support=1 WHERE MAC='ufi_tech-e45f0185e767';
```

Dette vil tillade remote desktop adgang via VNC.

## Node-RED Dashboard

Hvis Node-RED UI er aktiveret:
```
http://192.168.40.158:1880/ui
```

Node-RED Editor:
```
http://192.168.40.158:1880
```

## Support

Hvis du har problemer:
1. Kør `./test-performance.sh` og noter resultatet
2. Tag et screenshot af hjemmesiden
3. Check system logs: `sudo journalctl -n 200`

## Næste Trin Efter Optimering

1. ✅ Genstart Raspberry Pi
2. ✅ Kør performance test
3. ✅ Verificer at video kører flydende
4. ⚙️ Overvej at opdatere Raspbian OS hvis meget gammel
5. ⚙️ Opdater Chromium hvis muligt: `sudo apt update && sudo apt upgrade chromium-browser`

---

**TIP:** Gem dette dokument! Det indeholder alle kommandoer du skal bruge.
