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
echo "[1/7] Updating system..."
apt update && apt full-upgrade -y
apt autoremove -y

echo ""
echo "[2/7] Installing X Server and Chromium..."
apt install -y \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    chromium-browser \
    fonts-liberation \
    libgl1-mesa-dri \
    unclutter \
    cec-utils \
    x11vnc

echo ""
echo "[3/7] Installing Node-RED..."
# Run Node-RED installer as the actual user
sudo -u $ACTUAL_USER bash <(curl -sL https://raw.githubusercontent.com/node-red/linux-installers/master/deb/update-nodejs-and-nodered) --confirm-install --confirm-pi

# Enable Node-RED service
systemctl enable nodered
systemctl start nodered

echo ""
echo "[4/7] Installing kiosk scripts..."

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
echo "[5/7] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'AUTOLOGIN_EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
AUTOLOGIN_EOF

systemctl daemon-reload

echo ""
echo "[6/7] Enabling SSH and VNC..."
raspi-config nonint do_ssh 0

echo ""
echo "[7/7] Final configuration..."

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
echo "Access Node-RED at: http://<pi-ip>:1880"
echo ""

# Ask if user wants to reboot
read -p "Do you want to reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reboot
fi
