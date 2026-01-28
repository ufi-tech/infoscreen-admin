#!/bin/bash
# Install Fully Relay as a macOS LaunchAgent with auto-discovery
# No configuration needed - just MQTT credentials!

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="dk.iocast.fully-relay"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="/usr/local/var/log"
CONFIG_DIR="$HOME/Library/Application Support/fully-relay"

# Prompt for MQTT credentials if not provided
if [ -z "$MQTT_BROKER" ]; then
    echo "Fully Relay Service Installer"
    echo "=============================="
    echo ""
    read -p "MQTT Broker [188.228.60.134]: " MQTT_BROKER
    MQTT_BROKER=${MQTT_BROKER:-188.228.60.134}
fi

if [ -z "$MQTT_PORT" ]; then
    read -p "MQTT Port [1883]: " MQTT_PORT
    MQTT_PORT=${MQTT_PORT:-1883}
fi

if [ -z "$MQTT_USER" ]; then
    read -p "MQTT Username: " MQTT_USER
fi

if [ -z "$MQTT_PASSWORD" ]; then
    read -s -p "MQTT Password: " MQTT_PASSWORD
    echo ""
fi

if [ -z "$DEFAULT_PASSWORD" ]; then
    read -p "Default Fully Password [1227]: " DEFAULT_PASSWORD
    DEFAULT_PASSWORD=${DEFAULT_PASSWORD:-1227}
fi

# Create directories
mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
mkdir -p "$CONFIG_DIR"

# Create plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$SCRIPT_DIR/relay.py</string>
        <string>--broker</string>
        <string>$MQTT_BROKER</string>
        <string>--port</string>
        <string>$MQTT_PORT</string>
        <string>--user</string>
        <string>$MQTT_USER</string>
        <string>--password</string>
        <string>$MQTT_PASSWORD</string>
        <string>--default-password</string>
        <string>$DEFAULT_PASSWORD</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/fully-relay.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/fully-relay.log</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

# Load service
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo ""
echo "✅ Installed LaunchAgent: $PLIST_NAME"
echo ""
echo "📋 Auto-discovery enabled!"
echo "   Devices will be discovered automatically from MQTT"
echo "   Device list saved to: $CONFIG_DIR/devices.json"
echo ""
echo "📄 Logs: tail -f $LOG_DIR/fully-relay.log"
echo ""
echo "Commands:"
echo "  Stop:    launchctl unload $PLIST_PATH"
echo "  Start:   launchctl load $PLIST_PATH"
echo "  Restart: launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH"
echo "  Status:  launchctl list | grep fully-relay"
