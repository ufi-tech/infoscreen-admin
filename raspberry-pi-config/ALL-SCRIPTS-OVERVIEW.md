# 📜 Komplet Script Oversigt - Raspberry Pi

## Alle Shell Scripts (.sh) Fundet på Raspberry Pi

---

## ✅ Aktivt Brugte Scripts

### 1. checkwifi.sh (83 bytes)
**Status:** ✅ **AKTIV** - Kører hver 30. minut via root crontab

**Funktion:**
- Pinger google.com (4 packets)
- Hvis ingen respons → Genstarter Pi med `sudo /sbin/shutdown -r now`

**Cron Job:**
```bash
*/30 * * * * /home/pi/checkwifi.sh
```

**Kode:**
```bash
ping -c4 google.com > /dev/null
if [ $? != 0 ]
then
sudo /sbin/shutdown -r now
fi
```

**Vurdering:**
- ✅ God idé - sikrer Pi genstarter ved netværksproblemer
- ⚠️ Kunne forbedres med logging

---

## 🛠️ Scripts Vi Har Uploadet (Manuel Brug)

### 2. optimize.sh (4.4KB)
**Status:** ⚠️ **MANUEL** - Køres kun når vi kalder den

**Funktion:**
- Aktiverer hardware acceleration
- Øger GPU memory til 384MB
- Opdaterer Chromium flags
- Opretter cache clearing cronjob

**Brug:**
```bash
sudo /home/pi/optimize.sh
```

**Vurdering:** ✅ Nyttigt optimerings værktøj

---

### 3. test-performance.sh (5.3KB)
**Status:** ⚠️ **MANUEL** - Performance test værktøj

**Funktion:**
- Tjekker GPU memory
- Verificerer hardware acceleration
- Måler Chromium CPU/RAM brug
- Giver performance score 0-6

**Brug:**
```bash
/home/pi/test-performance.sh
```

**Vurdering:** ✅ Nyttigt til diagnostik

---

## ❌ Ubrugte / Gamle Scripts

### 4. StartApp.sh (3.4KB)
**Status:** ❌ **UBRUGT** - Alt kode er kommenteret ud

**Original Funktion:**
- Skulle starte Chromium i kiosk mode
- Sætte hostname baseret på MAC
- Disable screensaver
- Clean Chromium crash flags

**Hvorfor ubrugt:**
- Alt kode er kommenteret ud med `#`
- Node-RED håndterer nu Chromium opstart
- Hostname sættes på anden måde

**Kode eksempel:**
```bash
# Alt er kommenteret:
#chromium-browser --kiosk ... http://google.dk &
#bash /home/pi/startcam &
```

**Vurdering:**
- ❌ Kan slettes - ingen funktion
- 📝 Historisk værdi som backup

---

### 5. findmypi.sh (2.1KB)
**Status:** ❌ **UBRUGT** - Ikke kaldt nogen steder

**Funktion:**
- Sender Pi'ens IP, MAC og hostname til jemi.dk/findmypi
- Tracking service til at finde Pi på netværket
- Tjekker alle netværksinterfaces

**Kode snippets:**
```bash
submitIP(){
    /usr/bin/wget -q --post-data "int=$1&ipadr=$2&macadr=$3&hostname=$HOSTNAME" \
        https://jemi.dk/findmypi/save.php -O /dev/null
}
```

**Vurdering:**
- ❓ Ukendt om det stadig er relevant
- ⚠️ Sender data til ekstern server (jemi.dk)
- ❌ Bruges ikke i nuværende setup

---

### 6. hostname.sh (345 bytes)
**Status:** ❌ **UBRUGT** - Ikke kaldt nogen steder

**Funktion:**
- Sætter hostname til "klikdata-[MAC]"
- Opdaterer /etc/hostname og /etc/hosts
- Låser filerne med `chattr +i`

**Kode:**
```bash
MAC="klikdata-"$(cat /sys/class/net/eth0/address | sed -e 's/://g')
CURRENT_HOSTNAME=$(cat /proc/sys/kernel/hostname)
chattr -i /etc/hostname
echo "$MAC" > "/etc/hostname"
chattr -i /etc/hosts
sed -i "s/127.0.1.1.*$CURRENT_HOSTNAME/127.0.1.1\t$MAC/g" /etc/hosts
hostname $MAC
chattr +i /etc/hostname
chattr +i /etc/hosts
```

**Vurdering:**
- ❌ Bruges ikke - hostname er "ufitech-e45f0185e767"
- 📝 Interessant at Node-RED kode i StartApp.sh gør det samme

---

### 7. reloade.sh (85 bytes)
**Status:** ❌ **UBRUGT** + 🐛 **SYNTAKS FEJL**

**Funktion:**
- Skulle refreshe browser med Ctrl+F5
- HAR SYNTAKS FEJL: `xdotools` skulle være `xdotool`

**Kode:**
```bash
# refresh time in seconds so 3600 = every 60 min

  xdotools key = "ctrl+F5" &
```

**Korrekt kode skulle være:**
```bash
xdotool key --clearmodifiers ctrl+F5
```

**Vurdering:**
- ❌ Virker ikke pga. syntaks fejl
- ❌ Bruges ikke nogen steder
- 💡 Kunne være nyttigt hvis rettet

---

### 8. test.sh (66 bytes)
**Status:** ❌ **UBRUGT** - Simpel test script

**Funktion:**
- Printer bare MAC adressen

**Kode:**
```bash
#!/bin/bash

MAC=$(cat /sys/class/net/eth0/address)

echo $MAC;
```

**Vurdering:**
- ❌ Meget simpel, ingen reel funktion
- 📝 Sandsynligvis test/debug script

---

### 9. baxkup.sh (236 bytes)
**Status:** ⚠️ **MANUEL** - Kun når kaldt manuelt

**Funktion:**
- Laver SD kort backup til netværks-share
- Mounter CIFS share på 192.168.1.8
- Bruger `dd` til at lave raw image

**Kode:**
```bash
rm /tmp/BackupDestination
mkdir /tmp/BackupDestination
mount -t cifs -o username=admin,password=15mmledning //192.168.1.8/Server /tmp/BackupDestination
dd bs=4M if=/dev/mmcblk0 | gzip -c >/tmp/BackupDestination/viewer.img.gz
```

**Vurdering:**
- ⚠️ Indeholder password i plain text! (15mmledning)
- ⚠️ Kræver netværks-share 192.168.1.8
- 💡 Kunne være nyttig til backup, men farlig med plain text password

---

## 📊 Opsummering

### Scripts Status:

| Script | Status | Bruges? | Funktion |
|--------|--------|---------|----------|
| checkwifi.sh | ✅ Aktiv | Cron (hver 30 min) | WiFi watchdog |
| optimize.sh | ⚠️ Manuel | Når kaldt | Optimering |
| test-performance.sh | ⚠️ Manuel | Når kaldt | Performance test |
| StartApp.sh | ❌ Ubrugt | Aldrig | Alt kommenteret ud |
| findmypi.sh | ❌ Ubrugt | Aldrig | Send info til jemi.dk |
| hostname.sh | ❌ Ubrugt | Aldrig | Sæt hostname |
| reloade.sh | ❌ Fejl | Aldrig | Browser refresh (syntaks fejl) |
| test.sh | ❌ Ubrugt | Aldrig | Print MAC |
| baxkup.sh | ⚠️ Manuel | Når kaldt | SD backup (usikker!) |

### Tæller:
- ✅ Aktive scripts: **1** (checkwifi.sh)
- ⚠️ Manuelle scripts: **3** (optimize.sh, test-performance.sh, baxkup.sh)
- ❌ Ubrugte scripts: **5** (StartApp.sh, findmypi.sh, hostname.sh, reloade.sh, test.sh)

---

## 🔍 Anbefalinger

### Scripts der SKAL bevares:
1. ✅ **checkwifi.sh** - Kritisk for stabilitet
2. ✅ **optimize.sh** - Nyttigt værktøj
3. ✅ **test-performance.sh** - Nyttigt værktøj

### Scripts der KAN slettes:
4. ❌ **StartApp.sh** - Ingen funktion, alt kommenteret
5. ❌ **findmypi.sh** - Bruges ikke, sender data til ekstern server
6. ❌ **hostname.sh** - Bruges ikke
7. ❌ **test.sh** - Ingen reel funktion

### Scripts der er PROBLEMATISKE:
8. 🐛 **reloade.sh** - Syntaks fejl, virker ikke
9. ⚠️ **baxkup.sh** - Password i plain text! Sikkerhedsrisiko!

### Forbedringer:

#### 1. Ret reloade.sh (hvis den skal bruges):
```bash
#!/bin/bash
# Refresh browser every 3600 seconds (1 hour)
sleep 3600
export DISPLAY=:0
xdotool key --clearmodifiers ctrl+F5
```

#### 2. Sikr baxkup.sh:
```bash
# Flyt password til separat fil med korrekte permissions
# /home/pi/.backup-credentials (chmod 600)
```

#### 3. Tilføj logging til checkwifi.sh:
```bash
ping -c4 google.com > /dev/null
if [ $? != 0 ]
then
    echo "$(date): WiFi down, rebooting..." >> /var/log/wifi-check.log
    sudo /sbin/shutdown -r now
fi
```

---

## 📁 Alle Scripts i Repository

Alle 9 scripts er nu gemt i:
```
raspberry-pi-config/scripts/
├── baxkup.sh             (⚠️ Usikker - har password)
├── checkwifi.sh          (✅ Aktiv)
├── findmypi.sh           (❌ Ubrugt)
├── hostname.sh           (❌ Ubrugt)
├── reloade.sh            (🐛 Syntaks fejl)
├── StartApp.sh           (❌ Ubrugt)
├── test-performance.sh   (✅ Nyttigt)
└── test.sh               (❌ Ubrugt)
```

Plus optimerings scriptet:
```
raspberry-pi-config/
└── optimize.sh           (✅ Nyttigt)
```

---

## 🚨 Sikkerhedsnoter

### ⚠️ Plain Text Passwords:
- **baxkup.sh** indeholder: `password=15mmledning`
- Dette er en sikkerhedsrisiko!
- Bør flyttes til credential file med `chmod 600`

### 📡 Ekstern Data:
- **findmypi.sh** sender data til `jemi.dk`
- IP, MAC og hostname sendes
- Ikke brugt, men stadig på systemet

---

**Dokumenteret:** 2026-01-24
**Antal scripts:** 9 total
**System:** Raspberry Pi 4 Model B Rev 1.5 (ufitech-e45f0185e767)
