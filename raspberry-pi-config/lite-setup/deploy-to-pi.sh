#!/bin/bash
# Deploy configuration files to Raspberry Pi over SSH
# Run this from your Mac after Pi is installed with Raspberry Pi OS Lite

set -e

# Configuration
PI_HOST="${1:-192.168.40.158}"
PI_USER="${2:-pi}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo " Deploy to Raspberry Pi"
echo " Host: $PI_HOST"
echo " User: $PI_USER"
echo "=========================================="
echo ""

# Check SSH connectivity
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "$PI_USER@$PI_HOST" "echo 'SSH OK'" 2>/dev/null; then
    echo "ERROR: Cannot connect to $PI_USER@$PI_HOST"
    echo "Usage: ./deploy-to-pi.sh <ip-address> [username]"
    exit 1
fi

echo ""
echo "[1/4] Copying setup script..."
scp "$SCRIPT_DIR/setup.sh" "$PI_USER@$PI_HOST:/tmp/setup.sh"

echo ""
echo "[2/4] Copying Node-RED flows..."
scp "$SCRIPT_DIR/../node-red/flows.json" "$PI_USER@$PI_HOST:/tmp/flows.json" 2>/dev/null || echo "No flows.json found, skipping..."

echo ""
echo "[3/4] Copying hide-translate.css..."
if [ -f "$SCRIPT_DIR/home-pi/hide-translate.css" ]; then
    scp "$SCRIPT_DIR/home-pi/hide-translate.css" "$PI_USER@$PI_HOST:/tmp/hide-translate.css"
elif [ -f "$SCRIPT_DIR/../hide-translate.css" ]; then
    scp "$SCRIPT_DIR/../hide-translate.css" "$PI_USER@$PI_HOST:/tmp/hide-translate.css"
else
    echo "No hide-translate.css found, skipping..."
fi

echo ""
echo "[4/4] Running setup on Pi..."
echo "This will take several minutes..."
echo ""

ssh -t "$PI_USER@$PI_HOST" << 'REMOTE_EOF'
    # Move files to correct locations
    sudo mv /tmp/setup.sh /home/pi/setup.sh
    sudo chmod +x /home/pi/setup.sh

    # Run setup
    sudo /home/pi/setup.sh

    # Copy flows if exists
    if [ -f /tmp/flows.json ]; then
        mkdir -p /home/pi/.node-red
        mv /tmp/flows.json /home/pi/.node-red/flows.json
        sudo chown -R pi:pi /home/pi/.node-red
        sudo systemctl restart nodered 2>/dev/null || true
    fi

    # Copy CSS if exists
    if [ -f /tmp/hide-translate.css ]; then
        mv /tmp/hide-translate.css /home/pi/hide-translate.css
        sudo chown pi:pi /home/pi/hide-translate.css
    fi
REMOTE_EOF

echo ""
echo "=========================================="
echo " Deployment Complete!"
echo "=========================================="
echo ""
echo "The Pi should reboot and start the kiosk automatically."
echo ""
