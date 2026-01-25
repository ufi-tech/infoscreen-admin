#!/bin/bash
set -euo pipefail

MODE="${1:-base64}"
TS_MS="$(date +%s%3N 2>/dev/null || true)"
if [ -z "$TS_MS" ]; then
  TS_MS="$(date +%s)000"
fi

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/pi/.Xauthority}"

if [ "$MODE" = "file" ]; then
  DIR="/home/pi/snapshots"
  mkdir -p "$DIR"
  FILE="$DIR/screen-$(date +%Y%m%d%H%M%S).png"
  scrot "$FILE"
  BYTES=$(wc -c < "$FILE" | tr -d ' ')
  printf '{"type":"screenshot","file":"%s","bytes":%s,"ts":%s}\n' "$FILE" "$BYTES" "$TS_MS"
  exit 0
fi

TMP="/tmp/screen-$(date +%Y%m%d%H%M%S).png"
scrot "$TMP"
BYTES=$(wc -c < "$TMP" | tr -d ' ')
BASE64=$(base64 -w 0 "$TMP")
rm -f "$TMP"

printf '{"type":"screenshot","base64":"%s","bytes":%s,"ts":%s}\n' "$BASE64" "$BYTES" "$TS_MS"
