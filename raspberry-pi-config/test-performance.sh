#!/bin/bash
#
# Performance Test Script for Raspberry Pi InfoScreen
# Dette script tester om hardware acceleration virker
#

echo "=========================================="
echo "Raspberry Pi Performance Test"
echo "=========================================="
echo ""

# Farver
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}$1${NC}"
    echo "----------------------------------------"
}

print_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Test 1: GPU Memory
print_header "Test 1: GPU Memory Allocation"
GPU_MEM=$(vcgencmd get_mem gpu | cut -d'=' -f2)
echo "GPU Memory: $GPU_MEM"

if [[ "$GPU_MEM" == "256M" ]] || [[ "$GPU_MEM" == "384M" ]] || [[ "$GPU_MEM" == "512M" ]]; then
    print_ok "GPU har nok memory allokeret"
else
    print_warn "GPU memory er lav: $GPU_MEM"
fi
echo ""

# Test 2: Hardware Acceleration i Boot Config
print_header "Test 2: Hardware Acceleration Config"
if grep -q "^dtoverlay=vc4-fkms-v3d" /boot/config.txt; then
    print_ok "vc4-fkms-v3d overlay er aktiveret"
else
    print_error "Hardware acceleration IKKE aktiveret i boot config!"
fi
echo ""

# Test 3: Chromium Processer
print_header "Test 3: Chromium Processer"
CHROMIUM_COUNT=$(pgrep -c chromium || echo "0")
echo "Antal Chromium processer: $CHROMIUM_COUNT"

if [ "$CHROMIUM_COUNT" -gt 0 ]; then
    print_ok "Chromium kører"

    # Tjek CPU og RAM brug
    echo ""
    echo "Top 3 Chromium processer (CPU og RAM):"
    ps aux | grep chromium | grep -v grep | sort -k3 -r | head -3 | awk '{printf "  PID: %-6s CPU: %-5s%% RAM: %-5s%% CMD: %s\n", $2, $3, $4, $11}'

    # Tjek samlet CPU brug
    TOTAL_CPU=$(ps aux | grep chromium | grep -v grep | awk '{sum+=$3} END {print sum}')
    echo ""
    echo "Total CPU brug af Chromium: ${TOTAL_CPU}%"

    if (( $(echo "$TOTAL_CPU < 40" | bc -l) )); then
        print_ok "CPU brug er god (< 40%)"
    elif (( $(echo "$TOTAL_CPU < 60" | bc -l) )); then
        print_warn "CPU brug er moderat (40-60%)"
    else
        print_error "CPU brug er høj (> 60%) - hardware acceleration virker måske ikke!"
    fi
else
    print_warn "Chromium kører ikke"
fi
echo ""

# Test 4: Chromium Flags
print_header "Test 4: Chromium Flags"
CHROMIUM_PID=$(pgrep chromium | head -1)
if [ -n "$CHROMIUM_PID" ]; then
    CHROMIUM_CMD=$(ps -p $CHROMIUM_PID -o args= | head -1)

    # Tjek for hardware acceleration flags
    if echo "$CHROMIUM_CMD" | grep -q "use-gl=egl"; then
        print_ok "Hardware rendering aktiveret (--use-gl=egl)"
    elif echo "$CHROMIUM_CMD" | grep -q "use-gl=swiftshader"; then
        print_error "Software rendering detekteret! (--use-gl=swiftshader)"
    else
        print_warn "Kunne ikke bestemme rendering type"
    fi

    if echo "$CHROMIUM_CMD" | grep -q "enable-gpu-rasterization"; then
        print_ok "GPU rasterization aktiveret"
    else
        print_warn "GPU rasterization IKKE aktiveret"
    fi

    if echo "$CHROMIUM_CMD" | grep -q "enable-features=VaapiVideoDecoder"; then
        print_ok "Hardware video decoding aktiveret"
    else
        print_warn "Hardware video decoding IKKE aktiveret"
    fi
else
    print_warn "Kunne ikke finde Chromium proces for flag check"
fi
echo ""

# Test 5: System Ressourcer
print_header "Test 5: System Ressourcer"
echo "Memory:"
free -h | grep -E "Mem:|Swap:"
echo ""
echo "Load Average:"
uptime | awk -F'load average:' '{print "  " $2}'
echo ""

# Test 6: Node-RED Status
print_header "Test 6: Node-RED Status"
if systemctl is-active --quiet nodered; then
    print_ok "Node-RED service kører"
else
    print_error "Node-RED service kører IKKE!"
fi
echo ""

# Test 7: Chromium URL
print_header "Test 7: Aktiv URL"
if [ -n "$CHROMIUM_PID" ]; then
    CHROMIUM_FULL_CMD=$(ps -p $CHROMIUM_PID -o args= --no-headers)
    URL=$(echo "$CHROMIUM_FULL_CMD" | grep -oP 'https?://[^\s]+' | head -1)
    echo "URL: $URL"

    if [ -n "$URL" ]; then
        print_ok "Chromium viser: $URL"
    else
        print_warn "Kunne ikke finde URL"
    fi
else
    print_warn "Chromium kører ikke"
fi
echo ""

# Sammenfatning
echo "=========================================="
echo "Sammenfatning"
echo "=========================================="
echo ""

# Beregn score
SCORE=0

# GPU memory check
if [[ "$GPU_MEM" == "256M" ]] || [[ "$GPU_MEM" == "384M" ]] || [[ "$GPU_MEM" == "512M" ]]; then
    ((SCORE++))
fi

# Hardware acceleration check
if grep -q "^dtoverlay=vc4-fkms-v3d" /boot/config.txt; then
    ((SCORE++))
fi

# Chromium running check
if [ "$CHROMIUM_COUNT" -gt 0 ]; then
    ((SCORE++))
fi

# CPU usage check
if [ -n "$TOTAL_CPU" ] && (( $(echo "$TOTAL_CPU < 40" | bc -l) )); then
    ((SCORE++))
fi

# Hardware rendering check
if [ -n "$CHROMIUM_PID" ] && echo "$CHROMIUM_CMD" | grep -q "use-gl=egl"; then
    ((SCORE++))
fi

# Node-RED check
if systemctl is-active --quiet nodered; then
    ((SCORE++))
fi

echo "Performance Score: $SCORE / 6"
echo ""

if [ "$SCORE" -ge 5 ]; then
    print_ok "Systemet kører optimalt!"
elif [ "$SCORE" -ge 3 ]; then
    print_warn "Systemet kører, men kan optimeres yderligere"
else
    print_error "Systemet har alvorlige problemer - tjek konfigurationen!"
fi

echo ""
echo "Tip: Kør 'sudo /home/pi/optimize.sh' for at optimere systemet"
echo ""
