#!/bin/bash
# Callback script for Comitup - køres når WiFi status ændres
# Argument: HOTSPOT, CONNECTING, eller CONNECTED

STATE=$1
DISPLAY=:0
export DISPLAY

logger "Comitup callback: State changed to $STATE"

case $STATE in
    CONNECTED)
        # WiFi er forbundet - genstart Node-RED for at hente URL fra database
        logger "Comitup: WiFi connected - restarting Node-RED"
        sudo systemctl restart nodered
        ;;
    HOTSPOT)
        # Hotspot mode - vis setup vejledning på skærmen
        logger "Comitup: Hotspot mode - showing setup.html"
        pkill chromium 2>/dev/null
        sleep 2
        /usr/lib/chromium/chromium --kiosk --start-fullscreen --window-position=0,0 --window-size=1920,1080 --no-sandbox --disable-infobars --disable-features=Translate --no-first-run file:///home/pi/setup.html &
        ;;
    CONNECTING)
        logger "Comitup: Connecting to WiFi..."
        ;;
esac
