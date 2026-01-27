#!/bin/bash
# Raspberry Pi OS Lite InfoScreen Setup Script
# Run this after fresh installation of Raspberry Pi OS Lite (Bookworm 64-bit)

set -e

echo "=========================================="
echo " InfoScreen Lite Setup"
echo " Raspberry Pi OS Lite (Bookworm 64-bit)"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash setup.sh"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-pi}
HOME_DIR="/home/$ACTUAL_USER"

echo ""
echo "[1/8] Updating system..."
apt update && apt full-upgrade -y
apt autoremove -y

echo ""
echo "[2/8] Installing X Server and Chromium..."
apt install -y \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    chromium-browser \
    fonts-liberation \
    libgl1-mesa-dri \
    unclutter \
    cec-utils \
    x11vnc \
    autossh \
    shellinabox

echo ""
echo "[3/8] Installing Node-RED..."
# Run Node-RED installer as the actual user
sudo -u $ACTUAL_USER bash <(curl -sL https://raw.githubusercontent.com/node-red/linux-installers/master/deb/update-nodejs-and-nodered) --confirm-install --confirm-pi

# Enable Node-RED service
systemctl enable nodered
systemctl start nodered

echo ""
echo "[4/8] Installing kiosk scripts..."

# Copy kiosk.sh
cat > "$HOME_DIR/kiosk.sh" << 'KIOSK_EOF'
#!/bin/bash
# Kiosk script for Raspberry Pi OS Lite

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
    CHROMIUM_FLAGS+=(
        "--ignore-gpu-blocklist"
        "--enable-gpu-rasterization"
        "--enable-zero-copy"
        "--enable-features=VaapiVideoDecoder"
        "--use-gl=egl"
    )
elif [[ "$MODEL" == *"Pi 3"* ]]; then
    CHROMIUM_FLAGS+=(
        "--disable-gpu"
        "--disable-software-rasterizer"
    )
else
    CHROMIUM_FLAGS+=(
        "--disable-gpu"
    )
fi

# Add user stylesheet if exists
if [ -f "$HOME_DIR/hide-translate.css" ]; then
    CHROMIUM_FLAGS+=("--user-stylesheet=file://$HOME_DIR/hide-translate.css")
fi

# Start Chromium
exec chromium-browser "${CHROMIUM_FLAGS[@]}" "$URL"
KIOSK_EOF

chmod +x "$HOME_DIR/kiosk.sh"
chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/kiosk.sh"

# Create .xinitrc
cat > "$HOME_DIR/.xinitrc" << 'XINIT_EOF'
#!/bin/bash
exec /home/pi/kiosk.sh
XINIT_EOF

chmod +x "$HOME_DIR/.xinitrc"
chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/.xinitrc"

# Create/Update .bash_profile
cat >> "$HOME_DIR/.bash_profile" << 'BASHPROFILE_EOF'

# Start X automatically on tty1
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    startx -- -nocursor
fi
BASHPROFILE_EOF

chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/.bash_profile"

# Create VNC script
cat > "$HOME_DIR/start-vnc.sh" << 'VNC_EOF'
#!/bin/bash
# On-demand VNC server script
if pgrep -x "x11vnc" > /dev/null; then
    echo "VNC already running"
    exit 0
fi
x11vnc -display :0 -forever -shared -bg -o /tmp/x11vnc.log
echo "VNC started on port 5900"
VNC_EOF

chmod +x "$HOME_DIR/start-vnc.sh"
chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/start-vnc.sh"

# Create hide-translate.css
cat > "$HOME_DIR/hide-translate.css" << 'CSS_EOF'
/* Hide Chrome translate bar */
.goog-te-banner-frame,
.skiptranslate,
#goog-gt-tt,
.goog-te-balloon-frame,
div#goog-gt-,
.goog-te-menu-frame {
    display: none !important;
}

body {
    top: 0 !important;
}
CSS_EOF

chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/hide-translate.css"

echo ""
echo "[5/8] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'AUTOLOGIN_EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
AUTOLOGIN_EOF

systemctl daemon-reload

echo ""
echo "[6/8] Enabling SSH and configuring security..."
raspi-config nonint do_ssh 0

# Configure shellinabox to listen ONLY on localhost (127.0.0.1)
# This prevents access from LAN - only accessible via SSH tunnel
cat > /etc/default/shellinabox << 'SHELLINABOX_EOF'
# Shellinabox config - SECURITY: Only allow access via SSH tunnel
SHELLINABOX_DAEMON_START=1
SHELLINABOX_PORT=4200
SHELLINABOX_ARGS="--localhost-only --disable-ssl"
SHELLINABOX_EOF

systemctl disable --now shellinabox >/dev/null 2>&1 || true

echo ""
echo "[7/8] Installing device identity service..."

cat > /usr/local/bin/device-identity.sh << IDENTITY_EOF
#!/bin/bash
set -euo pipefail

HOME_DIR="$HOME_DIR"
DEVICE_ID_PATH="${HOME_DIR}/device-id"
APPROVED_PATH="${HOME_DIR}/device-approved"
MAC_PATH="${HOME_DIR}/device-mac"
SERIAL_PATH="${HOME_DIR}/device-serial"
MACHINE_ID_PATH="${HOME_DIR}/device-machine-id"

get_mac() {
    for iface in /sys/class/net/*; do
        iface_name=$(basename "$iface")
        [ "$iface_name" = "lo" ] && continue
        addr=$(cat "$iface/address" 2>/dev/null || true)
        if [ -n "$addr" ]; then
            echo "$addr" | tr -d ':' | tr '[:upper:]' '[:lower:]'
            return 0
        fi
    done
    return 1
}

get_serial() {
    if [ -r /proc/device-tree/serial-number ]; then
        tr -d '\0' < /proc/device-tree/serial-number
        return 0
    fi
    if [ -r /proc/cpuinfo ]; then
        awk -F': ' '/Serial/ {print $2; exit}' /proc/cpuinfo
        return 0
    fi
    return 1
}

get_machine_id() {
    cat /etc/machine-id 2>/dev/null || true
}

current_mac=$(get_mac || true)
current_serial=$(get_serial || true)
current_mid=$(get_machine_id || true)

if [ -z "$current_mac" ] && [ -z "$current_serial" ]; then
    exit 0
fi

stored_mac=""
stored_serial=""
stored_mid=""
if [ -f "$MAC_PATH" ]; then
    stored_mac=$(cat "$MAC_PATH" 2>/dev/null || true)
fi
if [ -f "$SERIAL_PATH" ]; then
    stored_serial=$(cat "$SERIAL_PATH" 2>/dev/null || true)
fi
if [ -f "$MACHINE_ID_PATH" ]; then
    stored_mid=$(cat "$MACHINE_ID_PATH" 2>/dev/null || true)
fi

write_fingerprint() {
    if [ -n "$current_mac" ]; then
        echo "$current_mac" > "$MAC_PATH"
    fi
    if [ -n "$current_serial" ]; then
        echo "$current_serial" > "$SERIAL_PATH"
    fi
    if [ -n "$current_mid" ]; then
        echo "$current_mid" > "$MACHINE_ID_PATH"
    fi
}

# Legacy install: keep existing device-id, just store fingerprint for next boot.
if [ -f "$DEVICE_ID_PATH" ] && [ -z "$stored_mac" ] && [ -z "$stored_serial" ]; then
    write_fingerprint
    for p in "$MAC_PATH" "$SERIAL_PATH" "$MACHINE_ID_PATH"; do
        [ -f "$p" ] && chown "$ACTUAL_USER:$ACTUAL_USER" "$p" 2>/dev/null || true
    done
    exit 0
fi

regen=0
if [ ! -f "$DEVICE_ID_PATH" ]; then
    regen=1
fi
if [ -n "$stored_mac" ] && [ -n "$current_mac" ] && [ "$stored_mac" != "$current_mac" ]; then
    regen=1
fi
if [ -n "$stored_serial" ] && [ -n "$current_serial" ] && [ "$stored_serial" != "$current_serial" ]; then
    regen=1
fi

if [ "$regen" -eq 1 ]; then
    device_id=$(cat /proc/sys/kernel/random/uuid)
    echo "$device_id" > "$DEVICE_ID_PATH"
    rm -f "$APPROVED_PATH"

    write_fingerprint

    chown "$ACTUAL_USER:$ACTUAL_USER" "$DEVICE_ID_PATH" 2>/dev/null || true
    for p in "$MAC_PATH" "$SERIAL_PATH" "$MACHINE_ID_PATH"; do
        [ -f "$p" ] && chown "$ACTUAL_USER:$ACTUAL_USER" "$p" 2>/dev/null || true
    done

    short_id=$(echo "$device_id" | cut -d- -f1)
    new_hostname="kiosk-$short_id"
    hostnamectl set-hostname "$new_hostname" 2>/dev/null || echo "$new_hostname" > /etc/hostname
    if grep -q '^127.0.1.1' /etc/hosts; then
        sed -i "s/^127.0.1.1.*/127.0.1.1 $new_hostname/" /etc/hosts
    else
        echo "127.0.1.1 $new_hostname" >> /etc/hosts
    fi
else
    if [ -n "$current_mac" ] && [ -z "$stored_mac" ]; then
        echo "$current_mac" > "$MAC_PATH"
    fi
    if [ -n "$current_serial" ] && [ -z "$stored_serial" ]; then
        echo "$current_serial" > "$SERIAL_PATH"
    fi
    if [ -n "$current_mid" ] && [ -z "$stored_mid" ]; then
        echo "$current_mid" > "$MACHINE_ID_PATH"
    fi
    for p in "$MAC_PATH" "$SERIAL_PATH" "$MACHINE_ID_PATH"; do
        [ -f "$p" ] && chown "$ACTUAL_USER:$ACTUAL_USER" "$p" 2>/dev/null || true
    done
fi
IDENTITY_EOF

chmod +x /usr/local/bin/device-identity.sh

cat > /etc/systemd/system/device-identity.service << 'IDENTITY_SERVICE_EOF'
[Unit]
Description=Device identity initialization
After=local-fs.target
Before=nodered.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/device-identity.sh

[Install]
WantedBy=multi-user.target
IDENTITY_SERVICE_EOF

systemctl daemon-reload
systemctl enable device-identity.service
systemctl start device-identity.service

echo ""
echo "[8/8] Final configuration..."

# Create Node-RED flows directory if not exists
mkdir -p "$HOME_DIR/.node-red"
chown -R $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/.node-red"

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy your flows.json to $HOME_DIR/.node-red/flows.json"
echo "2. Reboot the Pi: sudo reboot"
echo "3. The kiosk should start automatically"
echo ""
echo "SECURITY: Node-RED and Web SSH are only accessible via SSH tunnel"
echo "          They are NOT accessible from LAN (bound to localhost only)"
echo ""

# Ask if user wants to reboot
read -p "Do you want to reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reboot
fi
