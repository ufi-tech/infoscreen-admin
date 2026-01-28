#!/bin/bash
# Install Fully Relay as a macOS LaunchAgent

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="dk.iocast.fully-relay"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="/usr/local/var/log"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Check config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: config.json not found"
    echo "Copy config.example.json to config.json and edit it first"
    exit 1
fi

# Create log directory
sudo mkdir -p "$LOG_DIR"
sudo chown $(whoami) "$LOG_DIR"

# Read config
BROKER=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['mqtt']['broker'])")
PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['mqtt'].get('port', 1883))")
USER=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['mqtt']['username'])")
PASS=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['mqtt']['password'])")

# Build device args
DEVICE_ARGS=""
DEVICES=$(python3 -c "
import json
cfg = json.load(open('$CONFIG_FILE'))
for d in cfg.get('devices', []):
    print(f\"{d['id']}:{d['ip']}:{d['password']}:{d.get('port', 2323)}\")
")

for device in $DEVICES; do
    DEVICE_ARGS="$DEVICE_ARGS<string>--device</string><string>$device</string>"
done

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
        <string>$BROKER</string>
        <string>--port</string>
        <string>$PORT</string>
        <string>--user</string>
        <string>$USER</string>
        <string>--password</string>
        <string>$PASS</string>
        $DEVICE_ARGS
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
</dict>
</plist>
EOF

# Load service
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✓ Installed LaunchAgent: $PLIST_NAME"
echo "✓ Logs: tail -f $LOG_DIR/fully-relay.log"
echo ""
echo "Commands:"
echo "  Stop:    launchctl unload $PLIST_PATH"
echo "  Start:   launchctl load $PLIST_PATH"
echo "  Status:  launchctl list | grep fully-relay"
