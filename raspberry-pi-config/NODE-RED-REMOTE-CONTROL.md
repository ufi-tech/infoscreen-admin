# 🎮 Node-RED Remote Kontrol - Komplet Guide

## Hvad Kan Styres Remote via Database

Node-RED poller **sql.ufi-tech.dk** database hver 60. sekund og giver jer fuld remote kontrol!

---

## 📊 Database Konfiguration

**Server:** sql.ufi-tech.dk:42351
**Database:** Ufi-Tech
**Tabel:** infoscreen
**MAC ID:** ufi_tech-e45f0185e767

---

## 🎛️ Remote Kontrolmuligheder

### 1. 📺 Skift URL (Hovedfunktion)
**Database felt:** `Url`
**Default værdi:** `https://infotv.magion.dk/?TV=TV_Hovedingang`

**Hvordan:**
```sql
UPDATE infoscreen
SET Url='https://ny-hjemmeside.dk'
WHERE MAC='ufi_tech-e45f0185e767';
```

**Hvad sker:**
- Node-RED detekterer ændring inden for 60 sekunder
- Chromium genstarter automatisk med ny URL
- Total tid: ~70 sekunder (60s poll + 10s browser start)

**Use cases:**
- Skift mellem forskellige InfoTV sider
- Vis test-side midlertidigt
- Nødopdatering af indhold

---

### 2. 🔧 Remote Support (VNC)
**Database felt:** `Support`
**Værdier:**
- `0` = Normal drift
- `1` = Aktivér VNC support
- `2` = Reboot Raspberry Pi

**VNC Support:**
```sql
UPDATE infoscreen
SET Support=1
WHERE MAC='ufi_tech-e45f0185e767';
```

**Hvad sker:**
- VNC server starter: `vncserver-x11 -service -connect sql.ufi-tech.dk::36666`
- I kan nu remote desktop ind på Pi'en
- Support feltet nulstilles automatisk til `0` efter aktivering

**Reboot:**
```sql
UPDATE infoscreen
SET Support=2
WHERE MAC='ufi_tech-e45f0185e767';
```

**Hvad sker:**
- Pi genstarter med `sudo reboot /f`
- Support feltet nulstilles automatisk til `0`

---

### 3. 📺 TV Tænd/Sluk (HDMI-CEC)
**Database felt:** `TVON`
**Værdier:**
- `1` = Tænd TV via HDMI-CEC
- `0` = Sluk TV (standby) via HDMI-CEC

**Tænd TV:**
```sql
UPDATE infoscreen
SET TVON=1
WHERE MAC='ufi_tech-e45f0185e767';
```

**Kommando:** `echo 'on 0.0.0.0' | cec-client -s -d 1`

**Sluk TV:**
```sql
UPDATE infoscreen
SET TVON=0
WHERE MAC='ufi_tech-e45f0185e767';
```

**Kommando:** `echo 'standby 0.0.0.0' | cec-client -s -d 1`

**Note:** Kræver at TV understøtter HDMI-CEC

---

### 4. 📹 Kamera Stream (Disabled)
**Database felt:** `camera` og `Kirke`
**Status:** ❌ Disabled i current flow

**Original funktion:**
- Kunne vise video stream fra kamera
- Brugte omxplayer til RTSP streams
- Kontrolleret via database

**Eksempel:**
```sql
UPDATE infoscreen
SET camera='rtsp://admin:password@ip:554/stream',
    Kirke=1
WHERE MAC='ufi_tech-e45f0185e767';
```

**Note:** Denne funktion er deaktiveret men kan aktiveres igen

---

## 📡 Status Rapportering

Node-RED rapporterer også **tilbage** til databasen:

### Online Status
**Felt:** `Online`
- `1` = Pi er online og kører
- `0` = Pi er offline

**Opdateres:** Hver 60. sekund

### IP Adresser
**Felter:**
- `IP` = Lokal IP (192.168.40.158)
- `wan` = Offentlig IP (fra icanhazip.com)

**Opdateres:** Hver 60. sekund

### MAC Adresse
**Felt:** `MAC`
**Værdi:** `ufi_tech-e45f0185e767`

---

## ⚙️ Node-RED Performance

**Aktuel brug:**
- CPU: ~1.0%
- RAM: ~46MB
- Netværk: Minimal (SQL queries hver 60s)

**Vurdering:**
✅ Meget effektivt for den funktionalitet det giver!

---

## 🔄 Polling Interval

**Nuværende:** Hver 60 sekunder

**Flow:**
```javascript
// Inject node: repeat="60"
// Checker database hver minut
```

**Kan optimeres:**
Hvis I sjældent ændrer indstillinger, kan polling øges til:
- 120 sekunder (2 min)
- 300 sekunder (5 min)
- 600 sekunder (10 min)

**Trade-off:**
- Mindre CPU/netværk brug
- Langsommere respons på ændringer

---

## 💡 Alternativ Løsning: Letvægts Service

Hvis Node-RED er for tungt, kan vi lave en Python service:

```python
#!/usr/bin/env python3
import mysql.connector
import subprocess
import time

DB_CONFIG = {
    'host': 'sql.ufi-tech.dk',
    'port': 42351,
    'database': 'Ufi-Tech',
    'user': 'username',
    'password': 'password'
}

current_url = None

while True:
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM infoscreen WHERE MAC='ufi_tech-e45f0185e767'"
        )
        data = cursor.fetchone()

        # Check URL change
        if data['Url'] != current_url:
            current_url = data['Url']
            subprocess.run(['pkill', 'chromium'])
            # Chromium vil starte igen via systemd

        # Check support requests
        if data['Support'] == '1':
            subprocess.run(['vncserver-x11', '-service', ...])
        elif data['Support'] == '2':
            subprocess.run(['sudo', 'reboot'])

        # Update online status
        cursor.execute(
            "UPDATE infoscreen SET Online=1 WHERE MAC='ufi_tech-e45f0185e767'"
        )
        conn.commit()

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

    time.sleep(60)  # Poll every 60 seconds
```

**Fordele:**
- Kun ~5-10MB RAM (vs 46MB for Node-RED)
- ~0.1% CPU (vs 1% for Node-RED)
- Ingen Node.js runtime nødvendig

**Ulemper:**
- Skal kodes manuelt
- Mindre fleksibel end Node-RED flows
- Sværere at ændre logik

---

## 🎯 Anbefaling

**BEHOLD Node-RED!**

**Hvorfor:**
1. ✅ Kun 1% CPU og 46MB RAM - meget effektivt!
2. ✅ Giver fuld remote kontrol via database
3. ✅ Nemt at ændre logik i flow editor
4. ✅ Visuel programmering - let at forstå
5. ✅ Allerede installeret og virker perfekt

**Optimeringsmuligheder:**
1. Øg polling interval fra 60s til 120s (halverer database calls)
2. Tilføj bedre error handling
3. Tilføj logging af ændringer

---

## 📝 Database Schema (Forventet)

```sql
CREATE TABLE infoscreen (
    MAC VARCHAR(50) PRIMARY KEY,
    Url TEXT,
    Support INT DEFAULT 0,
    TVON INT DEFAULT 1,
    Online INT DEFAULT 0,
    IP VARCHAR(50),
    wan VARCHAR(50),
    camera TEXT,
    Kirke INT DEFAULT 0
);
```

---

## 🔐 Database Adgang

For at få adgang til databasen og ændre indstillinger:

```bash
# Via SSH på Pi
mysql -h sql.ufi-tech.dk -P 42351 -u username -p Ufi-Tech

# Eller fra din computer
mysql -h sql.ufi-tech.dk -P 42351 -u username -p Ufi-Tech
```

**Eksempel queries:**

```sql
-- Se nuværende indstillinger
SELECT * FROM infoscreen WHERE MAC='ufi_tech-e45f0185e767';

-- Skift URL
UPDATE infoscreen
SET Url='https://ny-side.dk'
WHERE MAC='ufi_tech-e45f0185e767';

-- Aktivér VNC support
UPDATE infoscreen
SET Support=1
WHERE MAC='ufi_tech-e45f0185e767';

-- Genstart Pi
UPDATE infoscreen
SET Support=2
WHERE MAC='ufi_tech-e45f0185e767';

-- Tænd TV
UPDATE infoscreen
SET TVON=1
WHERE MAC='ufi_tech-e45f0185e767';
```

---

## 🎨 Web Interface (Bonus Idé)

I kunne lave et simpelt web interface til at styre Pi'en:

```html
<!-- admin-panel.html -->
<form method="POST" action="update.php">
    <select name="url">
        <option value="https://infotv.magion.dk/?TV=TV_Hovedingang">Hovedindgang</option>
        <option value="https://infotv.magion.dk/?TV=TV_Kantine">Kantine</option>
        <option value="https://test.dk">Test Side</option>
    </select>

    <button name="action" value="vnc">Start VNC Support</button>
    <button name="action" value="reboot">Genstart Pi</button>
    <button name="action" value="tv_on">Tænd TV</button>
    <button name="action" value="tv_off">Sluk TV</button>
</form>
```

---

## 📊 Sammenligning: Node-RED vs. Custom Service

| Feature | Node-RED | Python Service | Systemd Only |
|---------|----------|----------------|--------------|
| CPU | ~1% | ~0.1% | 0% |
| RAM | 46MB | ~10MB | 0MB |
| Remote URL | ✅ | ✅ | ❌ |
| Remote Reboot | ✅ | ✅ | ❌ |
| Remote VNC | ✅ | ✅ | ❌ |
| Status Reporting | ✅ | ✅ | ❌ |
| Visual Programming | ✅ | ❌ | ❌ |
| Easy to Modify | ✅ | ⚠️ | ❌ |
| Dependency | Node.js | Python3 + MySQL | Ingen |

**Konklusion:** Node-RED giver mest value for minimal overhead!

---

## 🎯 Min Anbefaling

**1. BEHOLD Node-RED** - det er effektivt og giver fantastisk remote kontrol

**2. OPTIMER (valgfrit):**
- Øg poll interval til 120 sekunder hvis CPU er et problem
- Tilføj logging af URL ændringer

**3. WEB PANEL (fremtidig forbedring):**
- Lav et simpelt admin panel til at styre Pi'en
- Meget nemmere end at køre SQL queries manuelt

---

**Dokumenteret:** 2026-01-24
**System:** Raspberry Pi 4 Model B Rev 1.5 (ufitech-e45f0185e767)
**Database:** sql.ufi-tech.dk:42351
