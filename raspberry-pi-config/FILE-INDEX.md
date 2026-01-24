# 📚 File Index - Raspberry Pi Config Repository

## Komplet Oversigt over Alle Filer

---

## 📖 Dokumentation (START HER!)

| Fil | Beskrivelse | Hvornår bruges |
|-----|-------------|----------------|
| **FINAL-SUMMARY.md** | 🎯 **START HER!** Komplet oversigt over alle optimeringer | Læs først |
| **STARTUP-SEQUENCE.md** | 🚀 Komplet guide til opstart proces og scripts | Forstå hvordan systemet starter |
| **QUICK-START.md** | ⚡ Hurtig guide til optimering | Hvis du vil optimere igen |
| **README.md** | 📘 Teknisk dokumentation | Detaljeret reference |
| **CHANGELOG.md** | 📝 Historik over ændringer | Se hvad der er lavet |
| **FILE-INDEX.md** | 📚 Denne fil - oversigt over alle filer | Navigation |

---

## 🛠️ Scripts (Til Raspberry Pi)

| Fil | Størrelse | Beskrivelse | Upload til Pi? |
|-----|-----------|-------------|----------------|
| **optimize.sh** | 4.4KB | Automatisk optimerings script | ✅ Uploaded |
| **test-performance.sh** | 5.3KB | Performance test script | ✅ Uploaded |
| **hide-translate.css** | 537B | CSS til at skjule Google Translate | ✅ Uploaded |

---

## 🗂️ Scripts fra Raspberry Pi (Backup)

| Fil | Størrelse | Status | Beskrivelse |
|-----|-----------|--------|-------------|
| **scripts/StartApp.sh** | 3.5KB | ❌ Ubrugt | Gammelt script - alt kommenteret ud |
| **scripts/checkwifi.sh** | 83B | ✅ Aktiv | WiFi overvågning (kører hver 30 min) |
| **scripts/baxkup.sh** | 236B | ⚠️ Manuel | SD kort backup script |

---

## ⚙️ Boot Configuration

| Fil | Beskrivelse | Status |
|-----|-------------|--------|
| **boot/config.txt** | Raspberry Pi boot konfiguration | ✅ Optimeret med hardware accel |

**Vigtige indstillinger:**
```
dtoverlay=vc4-fkms-v3d    # Hardware acceleration
gpu_mem=384               # GPU memory (øget fra 256)
```

---

## 🔴 Node-RED Flows

| Fil | Version | Beskrivelse |
|-----|---------|-------------|
| **node-red/flows.json** | Original | Original flow FØR optimeringer |
| **node-red/flows.json.updated** | v2 | Efter hardware acceleration |
| **node-red/flows.json.final** | v3 FINAL | Med alt inkl. CSS injection |
| **node-red/settings.js** | - | Node-RED indstillinger |
| **node-red/package.json** | - | Node-RED dependencies |

**Aktiv fil på Pi:** `flows.json.final` ✅

---

## 📁 Mappestruktur

```
raspberry-pi-config/
│
├── 📖 Dokumentation
│   ├── FINAL-SUMMARY.md         ⭐ START HER!
│   ├── STARTUP-SEQUENCE.md      🚀 Opstart proces
│   ├── QUICK-START.md           ⚡ Hurtig guide
│   ├── README.md                📘 Teknisk docs
│   ├── CHANGELOG.md             📝 Historik
│   └── FILE-INDEX.md            📚 Denne fil
│
├── 🛠️ Scripts (Optimering)
│   ├── optimize.sh              (Auto-optimering)
│   ├── test-performance.sh      (Performance test)
│   └── hide-translate.css       (CSS til translate)
│
├── 🗂️ scripts/ (Backup fra Pi)
│   ├── StartApp.sh              (Ubrugt - gammelt)
│   ├── checkwifi.sh             (WiFi watchdog)
│   └── baxkup.sh                (SD backup)
│
├── ⚙️ boot/
│   └── config.txt               (Boot config)
│
└── 🔴 node-red/
    ├── flows.json               (Original)
    ├── flows.json.updated       (v2)
    ├── flows.json.final         (v3 FINAL) ⭐
    ├── settings.js              (Settings)
    └── package.json             (Dependencies)
```

---

## 🎯 Hvilken Fil Skal Jeg Bruge?

### Hvis du vil forstå systemet:
1. **FINAL-SUMMARY.md** - Komplet oversigt
2. **STARTUP-SEQUENCE.md** - Hvordan starter systemet?
3. **README.md** - Teknisk detaljer

### Hvis du vil optimere igen:
1. **QUICK-START.md** - Hurtig guide
2. **optimize.sh** - Upload og kør dette script

### Hvis du vil gendanne backup:
1. **node-red/flows.json** - Original flow
2. **boot/config.txt** - Se original indstillinger

### Hvis du vil se ændringer:
1. **CHANGELOG.md** - Komplet historik

---

## 🔄 Version Kontrol

### Chromium Flags Versioner:

**Original (flows.json):**
```bash
--kiosk --autoplay-policy=no-user-gesture-required
--disable-restore-session-state --disable-session-crashed-bubble
--noerrordialogs --disable-infobars --disable-features=TranslateUI
--disable-translate --no-first-run --fast --fast-start --no-sandbox
```

**v2 - Hardware Accel (flows.json.updated):**
```bash
+ --ignore-gpu-blocklist
+ --enable-gpu-rasterization
+ --enable-zero-copy
+ --enable-features=VaapiVideoDecoder
+ --use-gl=egl
+ --disable-component-extensions-with-background-pages
+ --disable-component-update
```

**v3 - CSS Injection (flows.json.final):**
```bash
+ --user-stylesheet=file:///home/pi/hide-translate.css
```

---

## 💾 Backup Filer på Raspberry Pi

Disse filer ligger KUN på Raspberry Pi (ikke i repository):

```
/boot/config.txt.backup                      (Original boot config)
/home/pi/.node-red/flows.json.backup         (Original flow)
/home/pi/.node-red/flows.json.backup2        (Efter hardware accel)
/home/pi/.node-red/flows.json.backup3        (Efter component-update)
```

**Gendan backup:**
```bash
ssh pi@192.168.40.158
sudo cp /boot/config.txt.backup /boot/config.txt
sudo cp /home/pi/.node-red/flows.json.backup /home/pi/.node-red/flows.json
sudo reboot
```

---

## 📊 File Størrelse Oversigt

```
Total størrelse: ~80KB

Dokumentation:  ~30KB
  - FINAL-SUMMARY.md:      7.1KB  ⭐
  - STARTUP-SEQUENCE.md:   ~8KB
  - README.md:             5.5KB
  - QUICK-START.md:        5.1KB
  - CHANGELOG.md:          4.0KB

Scripts:        ~10KB
  - optimize.sh:           4.4KB
  - test-performance.sh:   5.3KB
  - hide-translate.css:    537B

Node-RED:       ~78KB
  - flows.json:            48KB
  - flows.json.final:      49KB
  - settings.js:           15KB
  - package.json:          560B

Boot Config:    1.8KB
  - config.txt:            1.8KB

Scripts (backup): ~4KB
  - StartApp.sh:           3.5KB
  - baxkup.sh:             236B
  - checkwifi.sh:          83B
```

---

## 🔍 Søg Efter Specifikke Ting

### Find Chromium flags:
```bash
grep -r "chromium-browser" node-red/
```

### Find hardware acceleration settings:
```bash
grep "vc4-fkms-v3d" boot/config.txt
grep "gpu_mem" boot/config.txt
```

### Find Google Translate CSS:
```bash
cat hide-translate.css
```

### Sammenlign flow versioner:
```bash
diff node-red/flows.json node-red/flows.json.final
```

---

## ✅ Hvilke Filer Er På Raspberry Pi?

### ✅ Uploaded (Findes på Pi):
- optimize.sh → `/home/pi/optimize.sh`
- test-performance.sh → `/home/pi/test-performance.sh`
- hide-translate.css → `/home/pi/hide-translate.css`
- node-red/flows.json.final → `/home/pi/.node-red/flows.json`
- boot/config.txt → `/boot/config.txt`

### 📥 Kun i Repository (Backup):
- node-red/flows.json (original)
- node-red/flows.json.updated (v2)
- scripts/StartApp.sh
- scripts/checkwifi.sh
- scripts/baxkup.sh

### 📖 Kun Dokumentation (Ikke på Pi):
- FINAL-SUMMARY.md
- STARTUP-SEQUENCE.md
- QUICK-START.md
- README.md
- CHANGELOG.md
- FILE-INDEX.md

---

## 🚀 Quick Commands

### Upload et script til Pi:
```bash
scp <filename> pi@192.168.40.158:/home/pi/
```

### Download fra Pi:
```bash
scp pi@192.168.40.158:/home/pi/<filename> ./
```

### SSH ind:
```bash
ssh pi@192.168.40.158
# Password: 7200Grindsted!
```

### Kør performance test:
```bash
ssh pi@192.168.40.158 "./test-performance.sh"
```

---

**Repository Status:** ✅ Komplet og opdateret
**Sidste opdatering:** 2026-01-24
**System:** Raspberry Pi 4 Model B Rev 1.5 (ufitech-e45f0185e767)
