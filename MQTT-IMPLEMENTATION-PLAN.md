# Plan: MQTT Live Kontrol til Raspberry Pi InfoScreen

## Opsummering

Implementer MQTT-baseret live kontrol af Raspberry Pi InfoScreen med:
- **Mosquitto broker** på sql.ufi-tech.dk
- **Authentication** med brugernavn/password
- **Web admin panel** til nem styring

---

## Arkitektur

```
┌─────────────────┐     MQTT (< 1 sek)      ┌─────────────────┐
│  Web Admin      │ ────────────────────────▶│  Raspberry Pi   │
│  Panel (HTML)   │◀────────────────────────│  (Node-RED)     │
└─────────────────┘     Status updates       └─────────────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│     Mosquitto Broker (sql.ufi-tech.dk:1883)                 │
│     + MySQL Database (backup/sync)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Fordele ved MQTT vs. nuværende MySQL polling

| Aspekt | Nuværende (MySQL) | Ny (MQTT) |
|--------|-------------------|-----------|
| Latency | 60 sekunder | < 1 sekund |
| Server load | Konstant polling | Event-driven |
| Offline support | Nej | Ja (retained messages) |
| Skalerbarhed | Begrænset | Mange Pi'er |

---

## Implementation Steps

### Step 1: Installer Mosquitto på sql.ufi-tech.dk

**SSH ind på serveren og kør:**
```bash
# Installer Mosquitto
sudo apt update
sudo apt install mosquitto mosquitto-clients -y

# Opret password fil
sudo mosquitto_passwd -c /etc/mosquitto/passwd ufitech
# (Indtast password når promptet)

# Konfigurer Mosquitto
sudo tee /etc/mosquitto/conf.d/ufitech.conf << 'EOF'
listener 1883
listener 9001
protocol websockets

allow_anonymous false
password_file /etc/mosquitto/passwd
EOF

# Genstart Mosquitto
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto

# Åbn firewall porte
sudo ufw allow 1883/tcp  # MQTT
sudo ufw allow 9001/tcp  # WebSocket
```

**Fil der oprettes:** `/etc/mosquitto/conf.d/ufitech.conf`

---

### Step 2: Opdater Node-RED flows på Pi

**Fil:** `/home/pi/.node-red/flows.json`

Der tilføjes følgende nye nodes til det eksisterende Control flow:

#### 2.1 MQTT Broker Config Node
```json
{
    "id": "mqtt-ufitech",
    "type": "mqtt-broker",
    "name": "UFI-Tech MQTT",
    "broker": "sql.ufi-tech.dk",
    "port": "1883",
    "clientid": "pi-e45f0185e767",
    "autoConnect": true,
    "usetls": false,
    "credentials": {
        "user": "ufitech",
        "password": "<PASSWORD>"
    }
}
```

#### 2.2 MQTT Subscribe Node (modtag kommandoer)
```json
{
    "type": "mqtt in",
    "topic": "infoscreen/e45f0185e767/cmd/#",
    "qos": 1,
    "broker": "mqtt-ufitech"
}
```

#### 2.3 MQTT Publish Node (send status)
```json
{
    "type": "mqtt out",
    "topic": "infoscreen/e45f0185e767/status",
    "qos": 1,
    "retain": true,
    "broker": "mqtt-ufitech"
}
```

---

### Step 3: Node-RED Flow Logik

**Ny flow struktur der tilføjes:**

```
[MQTT In: cmd/#]
      │
      ▼
[Switch: msg.topic]
      │
      ├── cmd/url    → [Function: Gem URL] → [Exec: pkill chromium && start med ny URL]
      │                                    → [MQTT Out: Bekræft URL ændring]
      │
      ├── cmd/reboot → [Exec: sudo reboot]
      │
      ├── cmd/vnc    → [Exec: vncserver-x11 -service -connect sql.ufi-tech.dk::36666]
      │
      └── cmd/tv     → [Switch: payload 0/1] → [Exec: cec-client on/standby]


[Inject: hver 30s] → [Function: Saml status] → [MQTT Out: status]
```

**Bemærk:** Den eksisterende MySQL-baserede kontrol bibeholdes som fallback.

---

### Step 4: MQTT Topics

| Topic | Retning | Payload | Beskrivelse |
|-------|---------|---------|-------------|
| `infoscreen/{MAC}/cmd/url` | → Pi | URL string | Skift URL |
| `infoscreen/{MAC}/cmd/reboot` | → Pi | `1` | Genstart Pi |
| `infoscreen/{MAC}/cmd/vnc` | → Pi | `1` | Start VNC |
| `infoscreen/{MAC}/cmd/tv` | → Pi | `0` eller `1` | Sluk/Tænd TV |
| `infoscreen/{MAC}/status` | ← Pi | JSON | Online status |

**MAC:** `e45f0185e767` (udtrukket fra eksisterende flow)

**Status JSON format:**
```json
{
    "online": true,
    "ip": "192.168.1.100",
    "wan": "80.62.xxx.xxx",
    "url": "https://infotv.magion.dk/?TV=TV_Hovedingang",
    "timestamp": "2024-01-24T12:00:00Z"
}
```

---

### Step 5: Web Admin Panel

**Fil:** `mqtt-admin.html` (placeres i projektmappen)

Et standalone HTML-fil der:
- Forbinder til Mosquitto via WebSocket (port 9001)
- Viser real-time status fra Pi
- Giver knapper til alle kommandoer
- Kræver password ved opstart

**Features:**
- Skift URL med tekstfelt
- Tænd/Sluk TV knapper
- Start VNC knap
- Genstart knap (med bekræftelse)
- Live status indikator (online/offline)
- Kommando log

---

## Filer der skal ændres/oprettes

| Fil | Lokation | Handling | Ansvarlig |
|-----|----------|----------|-----------|
| `ufitech.conf` | `/etc/mosquitto/conf.d/` (server) | Opret | Server admin |
| `flows.json` | `/home/pi/.node-red/flows.json` | Tilføj MQTT nodes | Lokal kopi i repo |
| `mqtt-admin.html` | Projektmappe | Opret | Dette repo |

---

## Verifikation

### Test 1: Mosquitto kører
```bash
# På serveren
mosquitto_pub -h localhost -u ufitech -P <password> -t "test" -m "hello"
```

### Test 2: Pi kan forbinde
```bash
# På Pi
mosquitto_sub -h sql.ufi-tech.dk -u ufitech -P <password> -t "infoscreen/#"
```

### Test 3: Admin panel
- Åbn mqtt-admin.html i browser
- Indtast password
- Klik "Tænd TV" og verificer respons < 1 sekund

### Test 4: URL skift
- Indtast ny URL i admin panel
- Klik "Skift URL"
- Verificer at browser skifter inden for 2 sekunder

---

## Sikkerhed

| Check | Status | Bemærkning |
|-------|--------|------------|
| Password authentication | ✅ | Konfigureret i Mosquitto |
| WebSocket på separat port | ✅ | Port 9001 |
| TLS/SSL | ⚠️ | Overvej til produktion (port 8883/9002) |
| Firewall | ✅ | Kun port 1883 og 9001 åbne |

---

## Rollback Plan

Hvis MQTT ikke virker:
1. Den eksisterende MySQL-polling fortsætter med at virke
2. Fjern MQTT nodes fra Node-RED
3. Slet Mosquitto config

---

## Spørgsmål til validering

1. **Er sql.ufi-tech.dk den rigtige server?** (Den bruges allerede til MySQL)
2. **Skal password gemmes i flows.json?** (Alternativ: environment variable)
3. **Ønskes TLS/SSL kryptering?** (Kræver certifikat)
4. **Skal admin panel hostes på serveren eller bruges lokalt?**
5. **Er der andre Pi'er der skal tilføjes senere?** (Påvirker topic struktur)
