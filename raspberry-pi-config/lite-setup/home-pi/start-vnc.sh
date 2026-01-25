#!/bin/bash
# On-demand VNC server script
# Called via Node-RED MQTT command

# Check if already running
if pgrep -x "x11vnc" > /dev/null; then
    echo "VNC already running"
    exit 0
fi

# Start x11vnc
x11vnc -display :0 -forever -shared -bg -o /tmp/x11vnc.log

echo "VNC started on port 5900"
