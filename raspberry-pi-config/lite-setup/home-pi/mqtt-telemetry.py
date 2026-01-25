#!/usr/bin/env python3
import json
import shutil
import subprocess
import time


def cmd(out):
    try:
        return subprocess.check_output(out, shell=True, text=True).strip()
    except Exception:
        return ""


def read_meminfo():
    mem = {}
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                parts = line.split(":", 1)
                if len(parts) != 2:
                    continue
                key = parts[0].strip()
                val = parts[1].strip().split()[0]
                mem[key] = int(val)
    except Exception:
        pass
    return mem


temp_c = None
raw = cmd("vcgencmd measure_temp")
if raw and "=" in raw:
    try:
        temp_c = float(raw.split("=")[1].replace("'C", ""))
    except Exception:
        temp_c = None

load = []
try:
    with open("/proc/loadavg", "r", encoding="utf-8") as f:
        load = f.read().split()[:3]
except Exception:
    load = []

mem = read_meminfo()
mem_total_kb = mem.get("MemTotal")
mem_available_kb = mem.get("MemAvailable")

uptime_seconds = None
try:
    with open("/proc/uptime", "r", encoding="utf-8") as f:
        uptime_seconds = float(f.read().split()[0])
except Exception:
    uptime_seconds = None

try:
    disk = shutil.disk_usage("/")
    disk_total = disk.total
    disk_used = disk.used
    disk_free = disk.free
except Exception:
    disk_total = disk_used = disk_free = None

ip = cmd("hostname -I")

payload = {
    "ts": int(time.time() * 1000),
    "temp_c": temp_c,
    "load": load,
    "mem_total_kb": mem_total_kb,
    "mem_available_kb": mem_available_kb,
    "uptime_seconds": uptime_seconds,
    "disk_total_bytes": disk_total,
    "disk_used_bytes": disk_used,
    "disk_free_bytes": disk_free,
    "ip": ip,
}

print(json.dumps(payload))
