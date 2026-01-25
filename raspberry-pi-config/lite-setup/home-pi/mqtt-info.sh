#!/bin/bash
set -e

OS=$(awk -F= '/^PRETTY_NAME/{print $2}' /etc/os-release | tr -d '"')
KERNEL=$(uname -r)
HOSTNAME=$(hostname)
NODE_RED=$(node-red --version 2>/dev/null | tail -1 || true)
CHROMIUM=$(chromium --version 2>/dev/null || /usr/lib/chromium/chromium --version 2>/dev/null || true)
TEMP=$(vcgencmd measure_temp 2>/dev/null | awk -F= '{print $2}' | tr -d "'C")
UPTIME=$(cut -d' ' -f1 /proc/uptime)
IP=$(hostname -I)

python3 - <<PY
import json
payload = {
    "os": "${OS}",
    "kernel": "${KERNEL}",
    "hostname": "${HOSTNAME}",
    "node_red": "${NODE_RED}",
    "chromium": "${CHROMIUM}",
    "temp_c": ${TEMP:-0},
    "uptime_seconds": float("${UPTIME}"),
    "ip": "${IP}",
}
print(json.dumps(payload))
PY
