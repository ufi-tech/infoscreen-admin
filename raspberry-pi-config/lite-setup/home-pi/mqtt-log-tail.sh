#!/bin/bash
set -e

OUTPUT=$(sudo -n journalctl -u nodered -n 100 --no-pager 2>/dev/null || true)
if [ -z "$OUTPUT" ]; then
    OUTPUT="(no logs)"
fi

python3 - <<PY
import json
lines = """${OUTPUT}""".splitlines()
print(json.dumps({"lines": lines}))
PY
