#!/bin/bash
# Install Fully Relay as a macOS LaunchAgent
# Zero configuration - MQTT credentials are built into the script

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="dk.iocast.fully-relay"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="/usr/local/var/log"
CONFIG_DIR="$HOME/Library/Application Support/fully-relay"

echo "Fully Relay Service Installer"
echo "=============================="
echo ""
echo "Installing auto-discovery relay service..."
echo ""

# Create directories
mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
mkdir -p "$CONFIG_DIR"

# Create plist - no arguments needed, credentials are built-in
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

echo "✅ Installed LaunchAgent: $PLIST_NAME"
echo ""
echo "📋 Features:"
echo "   • Auto-discovery of Fully devices via MQTT"
echo "   • MQTT credentials built-in (no configuration needed)"
echo "   • Default Fully password: 1227"
echo "   • Custom passwords can be set via Admin UI"
echo ""
echo "📁 Device list: $CONFIG_DIR/devices.json"
echo "📄 Logs: tail -f $LOG_DIR/fully-relay.log"
echo ""
echo "Commands:"
echo "  Stop:    launchctl unload $PLIST_PATH"
echo "  Start:   launchctl load $PLIST_PATH"
echo "  Restart: launchctl unload $PLIST_PATH && launchctl load $PLIST_PATH"
echo "  Status:  launchctl list | grep fully-relay"
