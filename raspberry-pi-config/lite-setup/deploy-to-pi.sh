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
echo "[3/7] Copying hide-translate.css..."
if [ -f "$SCRIPT_DIR/home-pi/hide-translate.css" ]; then
    scp "$SCRIPT_DIR/home-pi/hide-translate.css" "$PI_USER@$PI_HOST:/tmp/hide-translate.css"
elif [ -f "$SCRIPT_DIR/../hide-translate.css" ]; then
    scp "$SCRIPT_DIR/../hide-translate.css" "$PI_USER@$PI_HOST:/tmp/hide-translate.css"
else
    echo "No hide-translate.css found, skipping..."
fi

echo ""
echo ""
echo "[4/7] Copying MQTT scripts..."
if [ -f "$SCRIPT_DIR/home-pi/mqtt-telemetry.py" ]; then
    scp "$SCRIPT_DIR/home-pi/mqtt-telemetry.py" "$PI_USER@$PI_HOST:/tmp/mqtt-telemetry.py"
else
    echo "No mqtt-telemetry.py found, skipping..."
fi
if [ -f "$SCRIPT_DIR/home-pi/mqtt-info.sh" ]; then
    scp "$SCRIPT_DIR/home-pi/mqtt-info.sh" "$PI_USER@$PI_HOST:/tmp/mqtt-info.sh"
else
    echo "No mqtt-info.sh found, skipping..."
fi
if [ -f "$SCRIPT_DIR/home-pi/mqtt-log-tail.sh" ]; then
    scp "$SCRIPT_DIR/home-pi/mqtt-log-tail.sh" "$PI_USER@$PI_HOST:/tmp/mqtt-log-tail.sh"
else
    echo "No mqtt-log-tail.sh found, skipping..."
fi

echo ""
echo "[5/7] Copying SSH scripts..."
if [ -f "$SCRIPT_DIR/home-pi/ssh-tunnel.sh" ]; then
    scp "$SCRIPT_DIR/home-pi/ssh-tunnel.sh" "$PI_USER@$PI_HOST:/tmp/ssh-tunnel.sh"
else
    echo "No ssh-tunnel.sh found, skipping..."
fi
if [ -f "$SCRIPT_DIR/home-pi/web-ssh.sh" ]; then
    scp "$SCRIPT_DIR/home-pi/web-ssh.sh" "$PI_USER@$PI_HOST:/tmp/web-ssh.sh"
else
    echo "No web-ssh.sh found, skipping..."
fi

echo ""
echo "[6/7] Copying mqtt-screenshot.sh..."
if [ -f "$SCRIPT_DIR/home-pi/mqtt-screenshot.sh" ]; then
    scp "$SCRIPT_DIR/home-pi/mqtt-screenshot.sh" "$PI_USER@$PI_HOST:/tmp/mqtt-screenshot.sh"
else
    echo "No mqtt-screenshot.sh found, skipping..."
fi

echo ""
echo "[7/7] Running setup on Pi..."
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

    # Copy screenshot script if exists
    if [ -f /tmp/mqtt-screenshot.sh ]; then
        mv /tmp/mqtt-screenshot.sh /home/pi/mqtt-screenshot.sh
        sudo chown pi:pi /home/pi/mqtt-screenshot.sh
        sudo chmod +x /home/pi/mqtt-screenshot.sh
    fi

    # Copy MQTT helper scripts if exists
    if [ -f /tmp/mqtt-telemetry.py ]; then
        mv /tmp/mqtt-telemetry.py /home/pi/mqtt-telemetry.py
        sudo chown pi:pi /home/pi/mqtt-telemetry.py
        sudo chmod +x /home/pi/mqtt-telemetry.py
    fi
    if [ -f /tmp/mqtt-info.sh ]; then
        mv /tmp/mqtt-info.sh /home/pi/mqtt-info.sh
        sudo chown pi:pi /home/pi/mqtt-info.sh
        sudo chmod +x /home/pi/mqtt-info.sh
    fi
    if [ -f /tmp/mqtt-log-tail.sh ]; then
        mv /tmp/mqtt-log-tail.sh /home/pi/mqtt-log-tail.sh
        sudo chown pi:pi /home/pi/mqtt-log-tail.sh
        sudo chmod +x /home/pi/mqtt-log-tail.sh
    fi
    if [ -f /tmp/ssh-tunnel.sh ]; then
        mv /tmp/ssh-tunnel.sh /home/pi/ssh-tunnel.sh
        sudo chown pi:pi /home/pi/ssh-tunnel.sh
        sudo chmod +x /home/pi/ssh-tunnel.sh
    fi
    if [ -f /tmp/web-ssh.sh ]; then
        mv /tmp/web-ssh.sh /home/pi/web-ssh.sh
        sudo chown pi:pi /home/pi/web-ssh.sh
        sudo chmod +x /home/pi/web-ssh.sh
    fi
REMOTE_EOF

echo ""
echo "=========================================="
echo " Deployment Complete!"
echo "=========================================="
echo ""
echo "The Pi should reboot and start the kiosk automatically."
echo ""
