#!/bin/bash
# MQTT Broker (Mosquitto) Setup Script
# Run this on sql.ufi-tech.dk server

set -e

echo "=========================================="
echo " Mosquitto MQTT Broker Setup"
echo " For sql.ufi-tech.dk"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash setup-mosquitto.sh"
    exit 1
fi

echo ""
echo "[1/5] Installing Mosquitto..."
apt update
apt install -y mosquitto mosquitto-clients

echo ""
echo "[2/5] Creating user 'ufitech'..."
echo "Please enter password for MQTT user 'ufitech':"
mosquitto_passwd -c /etc/mosquitto/passwd ufitech

echo ""
echo "[3/5] Creating configuration..."
cat > /etc/mosquitto/conf.d/ufitech.conf << 'MQTT_CONF_EOF'
# Mosquitto configuration for InfoScreen

# TCP listener for MQTT clients
listener 1883

# WebSocket listener for web clients
listener 9001
protocol websockets

# Authentication
allow_anonymous false
password_file /etc/mosquitto/passwd

# Logging
log_dest file /var/log/mosquitto/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information

# Persistence
persistence true
persistence_location /var/lib/mosquitto/
MQTT_CONF_EOF

echo ""
echo "[4/5] Starting Mosquitto service..."
systemctl enable mosquitto
systemctl restart mosquitto

echo ""
echo "[5/5] Configuring firewall..."
# Check if ufw is installed and active
if command -v ufw &> /dev/null; then
    ufw allow 1883/tcp comment 'MQTT'
    ufw allow 9001/tcp comment 'MQTT WebSocket'
    echo "Firewall rules added for ports 1883 and 9001"
else
    echo "UFW not found - please manually open ports 1883 and 9001"
fi

echo ""
echo "=========================================="
echo " Mosquitto Setup Complete!"
echo "=========================================="
echo ""
echo "MQTT Topics for InfoScreen:"
echo ""
echo "  Commands (subscribe):"
echo "    infoscreen/<mac>/cmd/url      - Change URL"
echo "    infoscreen/<mac>/cmd/reboot   - Reboot Pi"
echo "    infoscreen/<mac>/cmd/vnc      - Start VNC"
echo "    infoscreen/<mac>/cmd/tv       - TV on/off"
echo ""
echo "  Status (publish):"
echo "    infoscreen/<mac>/status       - Heartbeat/status"
echo ""
echo "Test connection:"
echo "  mosquitto_sub -h localhost -u ufitech -P <password> -t 'test'"
echo "  mosquitto_pub -h localhost -u ufitech -P <password> -t 'test' -m 'hello'"
echo ""
