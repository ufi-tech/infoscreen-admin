# 📂 /home/pi Directory - Komplet Oversigt

## Alt Indhold i Raspberry Pi's Home Mappe

**Total størrelse:** ~2.3MB
**Ejer:** pi:pi (med nogle root-ejede filer)

---

## 📜 Shell Scripts (9 filer)

| Fil | Størrelse | Ejer | Status |
|-----|-----------|------|--------|
| checkwifi.sh | 83B | root | ✅ Aktiv (cron) |
| optimize.sh | 4.4KB | pi | ⚠️ Manuel |
| test-performance.sh | 5.3KB | pi | ⚠️ Manuel |
| StartApp.sh | 3.4KB | root | ❌ Ubrugt |
| StartApp.sh.save | 828B | root | ❌ Backup |
| findmypi.sh | 2.1KB | pi | ❌ Ubrugt |
| hostname.sh | 345B | root | ❌ Ubrugt |
| reloade.sh | 85B | root | 🐛 Syntaks fejl |
| baxkup.sh | 236B | pi | ⚠️ Usikker |
| test.sh | 66B | root | ❌ Ubrugt |
| startcam | 128B | pi | ❓ Ukendt |

**Status:**
✅ Alle scripts downloadet til repository
📍 scripts/ mappe

---

## 🎨 Billeder & Grafik (4 filer)

| Fil | Størrelse | Type | Formål |
|-----|-----------|------|--------|
| klikdata_1920x1080_animation.gif | 681KB | GIF animation | Klikdata logo animation |
| KLIKDATA_logo_neg_box_final.jpg | 850KB | JPEG | Klikdata logo |
| Ufi-Tech banner.jpg | 236KB | JPEG | Ufi-Tech banner |
| ufi-tech teams.jpg | 274KB | JPEG | Ufi-Tech teams billede |

**Total:** ~2.0MB billeder

**Vurdering:**
📸 Sandsynligvis brugt til branding/splash screens
❓ Ikke vist nogen steder i nuværende setup

---

## 🔑 SSH Nøgler (4 filer)

| Fil | Type | Beskrivelse |
|-----|------|-------------|
| DASDASDA | Private key (1.8KB) | SSH privat nøgle |
| DASDASDA.pub | Public key (406B) | SSH offentlig nøgle |
| SERVER | Private key (1.8KB) | SSH privat nøgle |
| SERVER.pub | Public key (406B) | SSH offentlig nøgle |

**Placering:** Root af /home/pi/
**Permissions:** 600 (kun pi bruger)

**Vurdering:**
🔐 SSH nøgler til remote adgang
⚠️ Burde ligge i ~/.ssh/ for bedre sikkerhed
❓ Uklart hvad de bruges til

---

## 🎨 CSS Fil

| Fil | Størrelse | Formål |
|-----|-----------|--------|
| hide-translate.css | 537B | Skjuler Google Translate widget |

**Status:** ✅ Aktiv - Bruges af Chromium
**Download:** ✅ I repository

---

## 📁 Vigtige Mapper

### .node-red/ (5 undermapper)
```
.node-red/
├── flows.json (49KB)          ← Node-RED flows (AKTIV)
├── flows.json.backup          ← Backup 1
├── flows.json.backup2         ← Backup 2
├── flows.json.backup3         ← Backup 3
├── settings.js (15KB)         ← Node-RED indstillinger
├── package.json               ← Dependencies
├── node_modules/              ← Node-RED modules
├── context/                   ← Context data
└── lib/                       ← Libraries
```
**Status:** ✅ Downloadet til repository

### .config/ (15 undermapper)
```
.config/
├── chromium/                  ← Chromium browser data & cache
├── lxsession/                 ← Desktop session config
├── autostart/                 ← (Ikke eksisterende - ingen autostart)
└── ...
```
**Størrelse:** Variabel (browser cache)

### .ssh/ (SSH konfiguration)
```
.ssh/
├── known_hosts               ← Kendte SSH hosts
├── authorized_keys           ← (hvis findes) Authorized public keys
└── config                    ← (hvis findes) SSH client config
```

### .cache/ (9 undermapper)
```
.cache/
└── chromium/                 ← Chromium cache (kan blive stor!)
```

### Standard Mapper (Tomme/Ubrugte)
```
Desktop/      ← Tom
Documents/    ← Sandsynligvis tom eller minimal brug
Downloads/    ← Tom
Music/        ← Tom
Pictures/     ← Tom
Public/       ← Tom
Templates/    ← Tom
Videos/       ← Tom
Bookshelf/    ← Tom
```

---

## 📝 Config Filer

| Fil | Beskrivelse |
|-----|-------------|
| .bashrc | Bash shell konfiguration |
| .bash_logout | Bash logout kommandoer |
| .profile | Shell profil |
| .bash_history (27KB) | Bash kommando historik |
| .selected_editor (66B) | Standard editor valg |
| .npmrc | NPM konfiguration |

---

## 🔒 Sikkerhedsmæssige Filer

| Fil | Type | Beskrivelse |
|-----|------|-------------|
| .gnupg/ | Mappe | GPG/PGP nøgler og config |
| .ssh/ | Mappe | SSH konfiguration |
| .cups/ | Mappe | Print system credentials |
| .pki/ | Mappe | Public Key Infrastructure |
| .vnc/ | Mappe | VNC server konfiguration |

---

## 🗑️ Diverse/Test Filer

| Fil | Størrelse | Formål |
|-----|-----------|--------|
| displaycameras | 2.1KB | Sandsynligvis kamera display script |
| test.txt | 8B | Test fil |
| .Xauthority | 723B | X11 authentication |
| .xsession-errors | 2.4KB | X session fejl log |
| .xsession-errors.old | 2.4KB | Gammel X session log |

---

## 📊 Størrelse Fordeling

```
Total: ~2.3MB

Billeder:           ~2.0MB (87%)
Node-RED:           ~78KB  (3%)
Scripts:            ~15KB  (<1%)
Bash history:       ~27KB  (1%)
Logs:               ~5KB   (<1%)
Config:             ~5KB   (<1%)
SSH keys:           ~4KB   (<1%)
CSS:                537B   (<1%)
Andet:              ~170KB (7%)
```

---

## ⚠️ Sikkerhedsnotater

### 🔴 KRITISK:
1. **baxkup.sh** - Indeholder password i plain text: `password=15mmledning`
2. **SSH nøgler** - Ligger i root af /home/pi/ i stedet for ~/.ssh/

### 🟡 ADVARSEL:
3. **Chromium cache** - Kan blive meget stor over tid
4. **Bash history** - 27KB historik, kan indeholde sensitive kommandoer

### 🟢 OK:
5. SSH keys har korrekte permissions (600)
6. VNC konfiguration eksisterer (remote adgang mulig)

---

## 🧹 Oprydnings Anbefalinger

### Kan Slettes:
```bash
# Ubrugte scripts
rm /home/pi/StartApp.sh
rm /home/pi/StartApp.sh.save
rm /home/pi/findmypi.sh
rm /home/pi/hostname.sh
rm /home/pi/test.sh
rm /home/pi/reloade.sh

# Test filer
rm /home/pi/test.txt
rm /home/pi/displaycameras
```

### Bør Flyttes:
```bash
# SSH nøgler til korrekt placering
mv /home/pi/DASDASDA* ~/.ssh/
mv /home/pi/SERVER* ~/.ssh/
chmod 600 ~/.ssh/DASDASDA
chmod 600 ~/.ssh/SERVER
```

### Bør Sikres:
```bash
# Fjern password fra baxkup.sh
# Lav en credential fil i stedet:
echo "username=admin" > ~/.backup-creds
echo "password=15mmledning" >> ~/.backup-creds
chmod 600 ~/.backup-creds

# Opdater baxkup.sh til at læse fra credential fil
```

---

## 📥 Hvad Er Downloadet til Repository?

### ✅ Downloadet:
- Alle .sh scripts (9 filer)
- hide-translate.css
- Node-RED flows.json (3 versioner)
- Node-RED settings.js
- Node-RED package.json
- Boot config.txt

### ❌ IKKE Downloadet:
- Billeder (2MB - for store)
- SSH nøgler (sikkerhedsrisiko at downloade)
- Chromium cache
- Bash history
- Config mapper

**Begrundelse:**
Kun relevante konfig filer og scripts er downloadet.
Billeder, cache og sikkerhedsfølsomme filer forbliver på Pi.

---

## 🔍 Interessante Fund

### 1. displaycameras (2.1KB)
```bash
# Muligvis relateret til VIdeo flow i Node-RED
# Burde undersøges hvis kamera funktionalitet ønskes
```

### 2. startcam (128B)
```bash
# Sandsynligvis starter kamera streams
# Muligvis brugt i VIdeo tab (disabled)
```

### 3. Gamle billeder
```
klikdata_1920x1080_animation.gif
KLIKDATA_logo_neg_box_final.jpg
```
**Vurdering:** Gamle branding filer, ikke i brug

---

## 📋 Kommandoer til At Undersøge Mapper

### Se størrelse af alle mapper:
```bash
du -h --max-depth=1 /home/pi/ | sort -h
```

### Find store filer:
```bash
find /home/pi -type f -size +1M -exec ls -lh {} \;
```

### Se Chromium cache størrelse:
```bash
du -sh /home/pi/.cache/chromium/
```

### Se Node-RED data:
```bash
du -sh /home/pi/.node-red/
```

---

## 📁 Komplet Fil Struktur (Vigtigt)

```
/home/pi/
│
├── 📜 Scripts (11 filer)
│   ├── checkwifi.sh           ✅ Aktiv
│   ├── optimize.sh            ⚠️ Manuel
│   ├── test-performance.sh    ⚠️ Manuel
│   ├── baxkup.sh              ⚠️ Usikker
│   ├── StartApp.sh            ❌ Ubrugt
│   ├── StartApp.sh.save       ❌ Backup
│   ├── findmypi.sh            ❌ Ubrugt
│   ├── hostname.sh            ❌ Ubrugt
│   ├── reloade.sh             🐛 Fejl
│   ├── test.sh                ❌ Ubrugt
│   └── startcam               ❓ Ukendt
│
├── 🎨 Grafik (4 filer - 2MB)
│   ├── klikdata_1920x1080_animation.gif
│   ├── KLIKDATA_logo_neg_box_final.jpg
│   ├── Ufi-Tech banner.jpg
│   └── ufi-tech teams.jpg
│
├── 🔑 SSH Keys (4 filer)
│   ├── DASDASDA (private)
│   ├── DASDASDA.pub
│   ├── SERVER (private)
│   └── SERVER.pub
│
├── 🎨 CSS
│   └── hide-translate.css     ✅ Aktiv
│
├── 🗑️ Diverse
│   ├── displaycameras
│   └── test.txt
│
├── 📁 Vigtige Mapper
│   ├── .node-red/             ✅ Node-RED data
│   ├── .config/               Config filer
│   ├── .cache/                Browser cache
│   ├── .ssh/                  SSH config
│   ├── .vnc/                  VNC config
│   └── .gnupg/                GPG keys
│
└── 📁 Standard Mapper (Tomme)
    ├── Desktop/
    ├── Documents/
    ├── Downloads/
    ├── Music/
    ├── Pictures/
    ├── Public/
    ├── Templates/
    ├── Videos/
    └── Bookshelf/
```

---

**Dokumenteret:** 2026-01-24
**Total filer:** ~50+ filer og mapper
**System:** Raspberry Pi 4 Model B Rev 1.5 (ufitech-e45f0185e767)
