# Failsafe Funktioner + WiFi Setup i Node-RED

## Mål
1. **Failsafe:** Håndter tab af internet, browser crash, automatisk recovery
2. **WiFi Provisioning:** Kunder kan nemt forbinde Pi til deres WiFi ved første opstart

## Valgte indstillinger
- **Fallback:** Lokal offline-side (viser ur + besked)
- **Check interval:** Hver 30 sekunder

## Filer der modificeres/oprettes
| Fil | Placering | Beskrivelse |
|-----|-----------|-------------|
| flows.json | `/home/pi/.node-red/flows.json` | Tilføj failsafe nodes + setup-logik |
| offline.html | `/home/pi/offline.html` | Lokal fallback-side (internet nede) |
| setup.html | `/home/pi/setup.html` | Setup-vejledning med UFi-Tech logo + QR-kode |
| logo.png | `/home/pi/logo.png` | UFi-Tech logo |
| Comitup | System | WiFi provisioning software |

---

## DEL 1: WiFi Provisioning (Kunde-setup)

### Anbefalet løsning: Comitup

**Hvordan det virker for kunden:**
```
┌─────────────────────────────────────────────────────────────┐
│  1. Kunde tænder Pi'en                                       │
│       ↓                                                      │
│  2. TV viser setup-vejledning med QR-kode                   │
│       ↓                                                      │
│  3. Pi opretter WiFi hotspot: "InfoScreen-Setup"            │
│       ↓                                                      │
│  4. Kunde scanner QR-kode eller forbinder manuelt           │
│       ↓                                                      │
│  5. Captive portal åbner automatisk på telefon              │
│       ↓                                                      │
│  6. Kunde vælger sit WiFi og indtaster password             │
│       ↓                                                      │
│  7. Pi forbinder → TV skifter til infoskærm                 │
└─────────────────────────────────────────────────────────────┘
```

### Setup-skærm på TV

Når Pi'en starter uden WiFi-forbindelse, vises denne skærm på TV'et:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    [UFi-Tech Logo]                          │
│                                                              │
│              Velkommen til InfoScreen                        │
│                                                              │
│              ┌─────────────────────┐                        │
│              │  InfoScreen-Setup   │                        │
│              └─────────────────────┘                        │
│                                                              │
│  ① Forbind til WiFi: InfoScreen-Setup                       │
│  ② En side åbner automatisk på din telefon                  │
│  ③ Vælg dit WiFi og indtast password                        │
│                                                              │
│                    ┌─────────┐                              │
│                    │ QR-kode │                              │
│                    └─────────┘                              │
│                                                              │
│         Scan QR-koden for at forbinde automatisk            │
└─────────────────────────────────────────────────────────────┘
```

### Installation af Comitup på Pi (Bookworm)

```bash
# 1. Tilføj Comitup repository
echo "deb http://davesteele.github.io/comitup/repo comitup main" | sudo tee /etc/apt/sources.list.d/comitup.list
curl https://davesteele.github.io/key-366150CE.pub.txt | gpg --dearmor | sudo tee /usr/share/keyrings/comitup-archive-keyring.gpg

# 2. Installer Comitup
sudo apt-get update
sudo apt-get install comitup comitup-watch

# 3. Konfigurer
sudo nano /etc/comitup.conf
```

### Comitup config (/etc/comitup.conf)
```ini
ap_name: InfoScreen-Setup
ap_password:
web_service: comitup-web
enable_appliance_mode: false
external_callback: /home/pi/wifi-connected.sh
```

### Callback script (/home/pi/wifi-connected.sh)
```bash
#!/bin/bash
# Køres når WiFi forbindelse er etableret
sudo systemctl restart nodered
```

Gør scriptet eksekverbart:
```bash
chmod +x /home/pi/wifi-connected.sh
```

---

## DEL 2: Failsafe Funktioner i Node-RED

### 1. Internet Connectivity Monitor

**Flow diagram:**
```
[Inject: hver 30 sek] → [Exec: ping] → [Function: Check] → [Switch]
                                                              ↓
                                              ┌───────────────┴───────────────┐
                                              ↓                               ↓
                                          [Online]                       [Offline]
                                              ↓                               ↓
                                     [Gem status=true]              [Start fallback]
                                              ↓                               ↓
                                     [Genindlæs URL]                [Vis offline.html]
```

**Logik:**
- Ping 8.8.8.8 hver 30 sekunder
- Hvis offline: Vis `file:///home/pi/offline.html`
- Hvis online igen: Genindlæs URL fra `global.get('urlstore')`
- Status gemmes i `flow.set('internetOnline', true/false)`

### 2. Chromium Watchdog

**Flow diagram:**
```
[Inject: hver 60 sek] → [Exec: pgrep chromium] → [Function: Check]
                                                          ↓
                                              ┌───────────┴───────────┐
                                              ↓                       ↓
                                          [Kører]              [Ikke kører]
                                              ↓                       ↓
                                           [OK]              [Genstart Chromium]
```

**Logik:**
- Tjek om Chromium kører hver 60 sekunder
- Hvis ikke kører + internet online → Genstart med cached URL
- Hvis ikke kører + internet offline → Start med offline.html

### 3. Offline Fallback Side

**Fil:** `/home/pi/offline.html`

Viser:
- Stort digitalt ur
- "Ingen internetforbindelse - prøver igen..."
- Animeret spinner

---

## Verifikation

### Test internet failover
```bash
# SSH til Pi
ssh pi@192.168.40.157

# Blokér internet
sudo iptables -A OUTPUT -d 8.8.8.8 -j DROP

# Vent 30-60 sek - skærm skal skifte til offline.html

# Gendan internet
sudo iptables -D OUTPUT -d 8.8.8.8 -j DROP

# Skærm skal vende tilbage til normal URL
```

### Test Chromium watchdog
```bash
pkill chromium
# Vent 60 sek - Chromium skal genstarte automatisk
```

### Test WiFi provisioning
```bash
# Fjern ethernet og genstart
sudo reboot

# Pi skal oprette "InfoScreen-Setup" hotspot
# TV skal vise setup-side
```

### Tjek logs
```bash
journalctl -u nodered -f
```

---

## Implementerings-rækkefølge

### A. Failsafe (Node-RED)
1. ✅ Opdater `flows.json` med nye failsafe nodes
2. Deploy til Pi: `scp flows.json pi@192.168.40.157:/home/pi/.node-red/`
3. Opret offline.html på Pi
4. Genstart Node-RED: `sudo systemctl restart nodered`
5. Test failover-funktionerne

### B. WiFi Provisioning (Comitup)
1. SSH til Pi og installer Comitup
2. Konfigurer `/etc/comitup.conf` med hotspot-navn
3. Opret callback script
4. Test: Reboot uden ethernet, forbind via hotspot

### C. Setup-skærm filer
1. Kopier logo: `scp Ufi-Tech_v1.png pi@192.168.40.157:/home/pi/logo.png`
2. Opret setup.html med logo og QR-kode
3. Test ved at starte Chromium med setup.html

---

## Kilder
- [Comitup Official](http://davesteele.github.io/comitup/)
- [Comitup GitHub](https://github.com/davesteele/comitup)
