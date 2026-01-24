# 🚀 Raspberry Pi Startup Sequence & Scripts

## Komplet Oversigt over Opstart Processen

---

## 📋 Boot Sequence

### 1. Boot (Power On)
```
1. Raspberry Pi boot firmware
2. Læser /boot/config.txt (GPU memory, hardware acceleration)
3. Starter Linux kernel
4. Systemd init
```

### 2. Systemd Services Start
```
systemctl get-default → graphical.target

Kørende services:
- lightdm.service          (Display manager)
- nodered.service          (Node-RED)
- vncserver-x11-serviced   (VNC remote access)
```

### 3. LightDM Auto-Login
```
/etc/lightdm/lightdm.conf:
  autologin-user=pi    ← Logger automatisk ind som bruger 'pi'

Desktop Environment: LXDE/Openbox
X11 Display: :0
```

### 4. Desktop Autostart (LXDE)
```
/etc/xdg/autostart/
  - lxpolkit.desktop       (PolicyKit agent)
  - print-applet.desktop   (Print applet)
  - pulseaudio.desktop     (Audio)
  - xcompmgr.desktop       (Window compositor)

INGEN Chromium autostart her!
```

### 5. Node-RED Starter Chromium
```
Node-RED flow "Url Control" (flows.json):
  - Trigger: "Injeckt on start" node (once=true, delay=1s)
  - Funktion: "hent url offline"
  - Action: Starter Chromium via exec node

Chromium starter ~10-15 sekunder efter boot
```

---

## 🗂️ Alle Scripts på Raspberry Pi

### Scripts i /home/pi/

| Script | Beskrivelse | Bruges? | Hvornår |
|--------|-------------|---------|---------|
| **StartApp.sh** | Gammelt opstart script (3.4KB) | ❌ NEJ | Ikke brugt - alt er kommenteret ud |
| **checkwifi.sh** | WiFi overvågning (83 bytes) | ✅ JA | Hver 30. minut (root crontab) |
| **baxkup.sh** | SD kort backup (236 bytes) | ⚠️ Manuel | Kun når kaldt manuelt |
| **optimize.sh** | Optimerings script (4.4KB) | ⚠️ Manuel | Kun når kaldt manuelt |
| **test-performance.sh** | Performance test (5.3KB) | ⚠️ Manuel | Kun når kaldt manuelt |
| **findmypi.sh** | Find Pi på netværk? (2.1KB) | ❓ Ukendt | Ikke undersøgt |
| **hostname.sh** | Sæt hostname (345 bytes) | ❓ Ukendt | Ikke undersøgt |
| **reloade.sh** | Reload script (85 bytes) | ❓ Ukendt | Ikke undersøgt |
| **test.sh** | Test script (66 bytes) | ❓ Ukendt | Ikke undersøgt |

---

## ⏰ Cron Jobs

### Root Crontab
```bash
# Daglig reboot kl. 06:00
0 6 * * * sudo reboot

# WiFi check hver 30. minut (genstarter hvis offline)
*/30 * * * * /home/pi/checkwifi.sh
```

### Pi Bruger Crontab
```bash
# Tom - ingen cron jobs
# (vores cache clearing blev tilføjet men vises ikke endnu)
```

---

## 🎯 Hvordan Chromium Startes

### IKKE via StartApp.sh (gammelt, ubrugt)
```bash
# StartApp.sh er fyldt med kommenterede linjer (#)
# Ingen af Chromium kommandoerne kører
# Dette script bruges IKKE længere!
```

### VIA Node-RED Flow!
```javascript
// Node: "Injeckt on start" (inject node)
{
  repeat: "",
  once: true,      // ← Kører én gang ved opstart
  onceDelay: "1"   // ← Efter 1 sekund
}

// Node: "hent url offline" (function node)
if (global.get('urlstore') != "") {
  msg.payload = "DISPLAY=:0 chromium-browser --kiosk ... " +
                global.get('urlstore');
  node.send(msg);
}

// Node: "ba41aee8.91382" (exec node)
// Udfører kommandoen og starter Chromium
```

**URL hentes fra database:**
- Database: sql.ufi-tech.dk:42351
- Tabel: infoscreen
- Felt: Url
- Værdi: https://infotv.magion.dk/?TV=TV_Hovedingang

---

## 📊 Komplette Chromium Flags (Nuværende)

```bash
/usr/lib/chromium-browser/chromium-browser-v7 \
  --force-renderer-accessibility \
  --disable-quic \
  --enable-tcp-fast-open \
  --enable-pinch \
  --disable-features=AudioServiceOutOfProcess \
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
  --ignore-gpu-blocklist \           # ← Hardware accel
  --enable-gpu-rasterization \       # ← Hardware accel
  --enable-zero-copy \                # ← Hardware accel
  --enable-features=VaapiVideoDecoder \ # ← Video decoding
  --use-gl=egl \                      # ← Hardware rendering
  --disable-component-extensions-with-background-pages \
  --disable-component-update \
  --user-stylesheet=file:///home/pi/hide-translate.css \ # ← Skjul translate
  https://infotv.magion.dk/?TV=TV_Hovedingang
```

---

## 🔄 Genstart Flow

### Hvis Pi genstarter:
```
1. Boot → Systemd → LightDM → Desktop
2. Node-RED starter (systemd service)
3. Node-RED flow "Injeckt on start" triggers efter 1 sekund
4. Chromium starter med URL fra database
5. Total tid: ~30-45 sekunder fra boot til Chromium vises
```

### Hvis Chromium crasher:
```
Node-RED opdager IKKE automatisk crash!
Chromium genstarter IKKE automatisk!

Løsninger:
1. Manuel: pkill chromium (Node-RED vil IKKE genstarte)
2. Vent på daglig reboot (kl. 06:00)
3. Ændre URL i database (Node-RED flow vil genstarte Chromium)
```

---

## 🛠️ Vigtige Filer & Locations

### Boot Configuration
```
/boot/config.txt                    Boot konfiguration (GPU, hardware accel)
/boot/config.txt.backup             Backup af original config
```

### Node-RED
```
/home/pi/.node-red/flows.json       Node-RED flows (starter Chromium)
/home/pi/.node-red/settings.js      Node-RED indstillinger
/home/pi/.node-red/package.json     Node-RED dependencies
/home/pi/.node-red/flows.json.backup   Backup 1 (original)
/home/pi/.node-red/flows.json.backup2  Backup 2 (efter hardware accel)
/home/pi/.node-red/flows.json.backup3  Backup 3 (efter translate fix)
```

### Custom CSS
```
/home/pi/hide-translate.css         CSS til at skjule Google Translate
```

### Scripts
```
/home/pi/StartApp.sh                UBRUGT (gammelt script)
/home/pi/checkwifi.sh               WiFi overvågning (aktiv)
/home/pi/optimize.sh                Optimerings script (manuel)
/home/pi/test-performance.sh        Performance test (manuel)
```

### Systemd Services
```
/lib/systemd/system/nodered.service    Node-RED service
/etc/systemd/system/multi-user.target.wants/nodered.service
```

### Cron
```
/var/spool/cron/crontabs/root       Root crontab (reboot + wifi check)
/var/spool/cron/crontabs/pi         Pi crontab (tom)
```

---

## 🔍 Troubleshooting Commands

### Se Chromium proces:
```bash
ps aux | grep chromium-browser-v7 | grep kiosk
```

### Check Node-RED status:
```bash
sudo systemctl status nodered
```

### Se Node-RED logs:
```bash
sudo journalctl -u nodered -n 50
```

### Manuel Chromium restart:
```bash
pkill chromium
# Node-RED vil IKKE automatisk genstarte!
# Du skal ændre URL i database eller manuelt trigge flow
```

### Genstart Node-RED:
```bash
sudo systemctl restart nodered
# Dette vil også genstarte Chromium efter 1 sekund
```

### Se cron jobs:
```bash
crontab -l              # Pi bruger
sudo crontab -l         # Root
```

### Se boot logs:
```bash
dmesg | less
journalctl -b
```

---

## 💡 Forbedrings Muligheder

### 1. Automatisk Chromium Watchdog
Opret et script der overvåger Chromium og genstarter hvis crashed:

```bash
#!/bin/bash
# /home/pi/chromium-watchdog.sh

if ! pgrep -f "chromium.*kiosk" > /dev/null; then
    echo "Chromium not running, triggering Node-RED flow..."
    # Trigger Node-RED flow eller start direkte
fi
```

Tilføj til crontab:
```bash
*/5 * * * * /home/pi/chromium-watchdog.sh
```

### 2. Clean up StartApp.sh
Fjern eller opdater `/home/pi/StartApp.sh` da den ikke bruges.

### 3. Monitoring
Tilføj logging af Chromium crashes:
```bash
*/1 * * * * pgrep chromium > /dev/null || echo "$(date): Chromium crashed" >> /var/log/chromium-crashes.log
```

### 4. Graceful Shutdown
Tilføj en pre-shutdown hook for at lukke Chromium ordentligt.

---

## 📝 Opsummering

**Hvordan starter Chromium?**
1. ✅ Systemd starter Node-RED service
2. ✅ Node-RED flow "Injeckt on start" triggers efter 1 sekund
3. ✅ Node-RED henter URL fra database
4. ✅ Node-RED starter Chromium med alle optimerede flags
5. ✅ Chromium loader hjemmeside med skjult Google Translate

**IKKE via:**
- ❌ StartApp.sh (gammelt, ubrugt)
- ❌ Cron job
- ❌ Desktop autostart
- ❌ rc.local

**Node-RED er 100% ansvarlig for at starte Chromium!**

---

**Dokumenteret:** 2026-01-24
**System:** Raspberry Pi 4 Model B Rev 1.5 (ufitech-e45f0185e767)
