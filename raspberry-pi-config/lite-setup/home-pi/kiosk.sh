#!/bin/bash
# Kiosk script for Raspberry Pi OS Lite
# This script starts Chromium in kiosk mode with optimal GPU settings

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor
unclutter -idle 0.1 -root &

# Wait for Node-RED to start
sleep 10

# Default fallback URL
URL="${1:-https://infotv.magion.dk/?TV=TV_Hovedingang}"

# Detect Pi model for optimal GPU flags
MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "unknown")

# Base Chromium flags
CHROMIUM_FLAGS=(
    "--kiosk"
    "--autoplay-policy=no-user-gesture-required"
    "--disable-infobars"
    "--disable-session-crashed-bubble"
    "--disable-restore-session-state"
    "--noerrdialogs"
    "--disable-translate"
    "--disable-features=TranslateUI"
    "--no-first-run"
    "--start-fullscreen"
    "--window-position=0,0"
    "--no-sandbox"
    "--disable-dev-shm-usage"
)

# Add GPU flags based on Pi model
if [[ "$MODEL" == *"Pi 4"* ]] || [[ "$MODEL" == *"Pi 5"* ]]; then
    # Pi 4/5: Full GPU acceleration
    CHROMIUM_FLAGS+=(
        "--ignore-gpu-blocklist"
        "--enable-gpu-rasterization"
        "--enable-zero-copy"
        "--enable-features=VaapiVideoDecoder"
        "--use-gl=egl"
    )
elif [[ "$MODEL" == *"Pi 3"* ]]; then
    # Pi 3: Limited GPU, use software rendering for stability
    CHROMIUM_FLAGS+=(
        "--disable-gpu"
        "--disable-software-rasterizer"
    )
else
    # Pi Zero/2/Unknown: Minimal flags
    CHROMIUM_FLAGS+=(
        "--disable-gpu"
    )
fi

# Add user stylesheet if exists
if [ -f "/home/pi/hide-translate.css" ]; then
    CHROMIUM_FLAGS+=("--user-stylesheet=file:///home/pi/hide-translate.css")
fi

# Start Chromium
exec chromium-browser "${CHROMIUM_FLAGS[@]}" "$URL"
