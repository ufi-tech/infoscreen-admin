#!/bin/bash
#
# Raspberry Pi InfoScreen Optimerings Script
# Dette script optimerer Chromium til hardware acceleration
#

set -e

echo "========================================"
echo "Raspberry Pi InfoScreen Optimering"
echo "========================================"
echo ""

# Farver til output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktion til at printe med farve
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Tjek at vi kører som root
if [ "$EUID" -ne 0 ]; then
    print_error "Dette script skal køres som root (brug sudo)"
    exit 1
fi

print_status "Starter optimering..."
echo ""

# Backup af filer
echo "Trin 1: Backup af eksisterende konfiguration"
echo "--------------------------------------------"

if [ ! -f /boot/config.txt.backup ]; then
    cp /boot/config.txt /boot/config.txt.backup
    print_status "Backup af /boot/config.txt oprettet"
else
    print_warning "Backup eksisterer allerede: /boot/config.txt.backup"
fi

if [ ! -f /home/pi/.node-red/flows.json.backup ]; then
    cp /home/pi/.node-red/flows.json /home/pi/.node-red/flows.json.backup
    print_status "Backup af flows.json oprettet"
else
    print_warning "Backup eksisterer allerede: /home/pi/.node-red/flows.json.backup"
fi

echo ""

# Aktivér hardware acceleration i boot config
echo "Trin 2: Aktivering af Hardware Acceleration"
echo "--------------------------------------------"

# Tjek om vc4-fkms-v3d allerede er aktiveret
if grep -q "^dtoverlay=vc4-fkms-v3d" /boot/config.txt; then
    print_status "Hardware acceleration er allerede aktiveret"
else
    # Uncomment hvis kommenteret
    if grep -q "#dtoverlay=vc4-fkms-v3d" /boot/config.txt; then
        sed -i 's/#dtoverlay=vc4-fkms-v3d/dtoverlay=vc4-fkms-v3d/' /boot/config.txt
        print_status "Hardware acceleration aktiveret (uncommented)"
    else
        # Tilføj hvis ikke eksisterer
        echo "dtoverlay=vc4-fkms-v3d" >> /boot/config.txt
        print_status "Hardware acceleration aktiveret (tilføjet)"
    fi
fi

echo ""

# Opdater GPU memory (valgfrit)
echo "Trin 3: GPU Memory Optimering"
echo "------------------------------"

CURRENT_GPU_MEM=$(grep "^gpu_mem=" /boot/config.txt | cut -d'=' -f2)
print_status "Nuværende GPU memory: ${CURRENT_GPU_MEM}MB"

read -p "Vil du øge GPU memory til 384MB? (j/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[JjYy]$ ]]; then
    sed -i 's/^gpu_mem=.*/gpu_mem=384/' /boot/config.txt
    print_status "GPU memory opdateret til 384MB"
else
    print_warning "GPU memory ikke ændret"
fi

echo ""

# Opdater Chromium flags i Node-RED flow
echo "Trin 4: Opdatering af Chromium Flags"
echo "-------------------------------------"

# De gamle dårlige flags
OLD_FLAGS='--no-sandbox "'

# De nye optimerede flags
NEW_FLAGS='--no-sandbox --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --use-gl=egl "'

# Erstat i flows.json
if grep -q "$OLD_FLAGS" /home/pi/.node-red/flows.json; then
    sed -i "s|$OLD_FLAGS|$NEW_FLAGS|g" /home/pi/.node-red/flows.json
    print_status "Chromium flags opdateret med hardware acceleration"
else
    print_warning "Chromium flags ser allerede ud til at være optimeret"
fi

echo ""

# Opret cache clearing cronjob
echo "Trin 5: Cache Clearing Cronjob"
echo "-------------------------------"

CRON_CMD="0 3 * * 0 rm -rf /home/pi/.cache/chromium/* 2>/dev/null"

if crontab -l -u pi 2>/dev/null | grep -q "cache/chromium"; then
    print_warning "Chromium cache clearing cronjob eksisterer allerede"
else
    (crontab -l -u pi 2>/dev/null; echo "$CRON_CMD") | crontab -u pi -
    print_status "Chromium cache clearing cronjob oprettet (hver søndag kl. 03:00)"
fi

echo ""

# Vis resumé
echo "========================================"
echo "Optimering Fuldført!"
echo "========================================"
echo ""
print_status "Hardware acceleration aktiveret"
print_status "Chromium flags optimeret"
print_status "Cache clearing cronjob oprettet"
echo ""
print_warning "VIGTIGT: Raspberry Pi skal genstartes for at aktivere ændringerne!"
echo ""

read -p "Vil du genstarte nu? (j/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[JjYy]$ ]]; then
    print_status "Genstarter om 5 sekunder..."
    sleep 5
    reboot
else
    print_warning "Husk at genstarte senere med: sudo reboot"
fi

echo ""
print_status "Script fuldført!"
