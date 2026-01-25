import json
import threading
import time
from datetime import datetime
from typing import Optional

import paho.mqtt.client as mqtt

from .db import SessionLocal
from .models import Device, Telemetry, Event, Location, DeviceLog
from .settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    MQTT_CLIENT_ID,
)


def _add_device_log(session, device_id: str, level: str, category: str, message: str, details: dict = None):
    """Add a log entry within an existing session"""
    log = DeviceLog(
        device_id=device_id,
        level=level,
        category=category,
        message=message,
        details=json.dumps(details) if details else None
    )
    session.add(log)


class MQTTBridge:
    # Cache for avoiding duplicate warning logs (device_id -> {warning_type: timestamp})
    _warning_cache = {}
    WARNING_COOLDOWN = 300  # 5 minutes between same warnings
    TELEMETRY_LOG_INTERVAL = 3600  # Log telemetry summary every hour

    def __init__(self) -> None:
        self._client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
        if MQTT_USERNAME:
            self._client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._lock = threading.Lock()

    def _should_log_warning(self, device_id: str, warning_type: str, cooldown: int = None) -> bool:
        """Check if we should log this warning (cooldown period)"""
        now = time.time()
        key = f"{device_id}:{warning_type}"
        last_logged = self._warning_cache.get(key, 0)
        cd = cooldown if cooldown is not None else self.WARNING_COOLDOWN
        if now - last_logged > cd:
            self._warning_cache[key] = now
            return True
        return False

    def start(self) -> None:
        self._client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
        thread = threading.Thread(target=self._client.loop_forever, daemon=True)
        thread.start()

    def publish(self, topic: str, payload: dict) -> None:
        with self._lock:
            self._client.publish(topic, json.dumps(payload))

    def _on_connect(self, client, userdata, flags, rc) -> None:
        if rc != 0:
            return
        client.subscribe("devices/+/status")
        client.subscribe("devices/pending/+/status")
        client.subscribe("devices/+/telemetry")
        client.subscribe("devices/+/events")
        client.subscribe("devices/+/wifi-scan")
        client.subscribe("devices/+/screenshot")
        client.subscribe("devices/+/geolocation")

    def _on_message(self, client, userdata, msg) -> None:
        topic = msg.topic
        payload_raw = msg.payload.decode("utf-8", errors="ignore")
        try:
            payload = json.loads(payload_raw) if payload_raw else {}
        except json.JSONDecodeError:
            payload = {"raw": payload_raw}

        device_id = self._extract_device_id(topic)
        if not device_id:
            return

        now_ms = int(time.time() * 1000)
        is_pending = topic.startswith("devices/pending/")

        with SessionLocal() as session:
            if topic.endswith("/status"):
                device = session.get(Device, device_id) or Device(id=device_id)
                if is_pending and device.approved:
                    return

                old_status = device.status
                new_status = payload.get("status", device.status)
                was_new = device.id is None or device.status == "unknown"

                device.status = new_status
                if is_pending:
                    device.approved = False
                else:
                    device.approved = bool(payload.get("approved", device.approved))
                device.ip = payload.get("ip", device.ip)
                device.url = payload.get("url", device.url)
                device.mac = payload.get("mac", device.mac)
                device.last_seen = datetime.utcnow()
                session.merge(device)

                # Log status changes
                if is_pending:
                    _add_device_log(session, device_id, "info", "status",
                        f"Ny enhed afventer godkendelse",
                        {"ip": device.ip, "mac": device.mac})
                elif was_new:
                    _add_device_log(session, device_id, "success", "status",
                        f"Enhed forbundet: {new_status}",
                        {"ip": device.ip, "mac": device.mac})
                elif old_status != new_status:
                    level = "success" if new_status == "online" else "warning"
                    _add_device_log(session, device_id, level, "status",
                        f"Status ændret: {old_status} → {new_status}",
                        {"ip": device.ip})

                session.commit()
                return

            if topic.endswith("/telemetry"):
                event = Telemetry(device_id=device_id, ts=payload.get("ts", now_ms), payload=json.dumps(payload))
                session.add(event)

                # Log significant telemetry events (not every update)
                temp = payload.get("temp_c") or payload.get("temp")
                load = payload.get("load")

                # Calculate memory percentage
                mem_total = payload.get("mem_total_kb")
                mem_avail = payload.get("mem_available_kb")
                mem_pct = None
                if mem_total and mem_avail:
                    try:
                        mem_pct = ((mem_total - mem_avail) / mem_total) * 100
                    except (ValueError, TypeError, ZeroDivisionError):
                        pass

                # Temperature warnings (with cooldown to avoid spam)
                if temp is not None:
                    try:
                        temp_val = float(temp)
                        if temp_val >= 80 and self._should_log_warning(device_id, "temp_critical"):
                            _add_device_log(session, device_id, "error", "status",
                                f"Kritisk temperatur: {temp_val:.1f}°C",
                                {"temp_c": temp_val})
                        elif temp_val >= 70 and self._should_log_warning(device_id, "temp_high"):
                            _add_device_log(session, device_id, "warning", "status",
                                f"Høj temperatur: {temp_val:.1f}°C",
                                {"temp_c": temp_val})
                    except (ValueError, TypeError):
                        pass

                # Memory warnings (with cooldown to avoid spam)
                if mem_pct is not None:
                    try:
                        mem_val = float(mem_pct)
                        if mem_val >= 95 and self._should_log_warning(device_id, "mem_critical"):
                            _add_device_log(session, device_id, "error", "status",
                                f"Kritisk hukommelse: {mem_val:.0f}%",
                                {"mem_pct": mem_val})
                        elif mem_val >= 90 and self._should_log_warning(device_id, "mem_high"):
                            _add_device_log(session, device_id, "warning", "status",
                                f"Høj hukommelsesforbrug: {mem_val:.0f}%",
                                {"mem_pct": mem_val})
                    except (ValueError, TypeError):
                        pass

                # Periodic telemetry summary (hourly)
                if self._should_log_warning(device_id, "telemetry_summary", self.TELEMETRY_LOG_INTERVAL):
                    temp_str = f"{temp:.1f}°C" if temp else "-"
                    mem_str = f"{mem_pct:.0f}%" if mem_pct else "-"
                    uptime_h = payload.get("uptime_seconds", 0) / 3600
                    _add_device_log(session, device_id, "info", "status",
                        f"Telemetri: {temp_str}, mem {mem_str}, uptime {uptime_h:.1f}t",
                        {"temp_c": temp, "mem_pct": mem_pct, "uptime_h": uptime_h})

                session.commit()
                return

            if topic.endswith("/events"):
                event = Event(device_id=device_id, ts=payload.get("ts", now_ms), type=payload.get("type", ""), payload=json.dumps(payload))
                session.add(event)
                session.commit()
                return

            if topic.endswith("/wifi-scan"):
                event = Event(device_id=device_id, ts=payload.get("ts", now_ms), type="wifi-scan", payload=json.dumps(payload))
                session.add(event)
                networks = payload.get("networks", [])
                _add_device_log(session, device_id, "info", "command",
                    f"WiFi scan udført - {len(networks)} netværk fundet",
                    {"network_count": len(networks)})
                session.commit()
                return

            if topic.endswith("/screenshot"):
                event = Event(device_id=device_id, ts=payload.get("ts", now_ms), type="screenshot", payload=json.dumps(payload))
                session.add(event)
                _add_device_log(session, device_id, "info", "command",
                    "Screenshot taget")
                session.commit()
                return

            if topic.endswith("/geolocation"):
                # Store geolocation in Location table
                lat = payload.get("lat")
                lon = payload.get("lon")
                if lat is not None and lon is not None:
                    from sqlalchemy import select
                    existing = session.execute(
                        select(Location).where(Location.device_id == device_id)
                    ).scalars().first()
                    if not existing:
                        existing = Location(device_id=device_id)
                    existing.lat = float(lat)
                    existing.lon = float(lon)
                    # Auto-fill address from geolocation data
                    city = payload.get("city", "")
                    region = payload.get("region", "")
                    country = payload.get("country", "")
                    if city or region or country:
                        addr_parts = [p for p in [city, region, country] if p]
                        existing.address = ", ".join(addr_parts)
                    session.add(existing)
                    session.commit()
                # Log geolocation update
                addr = existing.address or f"{lat}, {lon}"
                _add_device_log(session, device_id, "info", "command",
                    f"Lokation opdateret: {addr}",
                    {"lat": lat, "lon": lon, "city": city, "country": country})

                # Also store as event for history
                event = Event(device_id=device_id, ts=payload.get("ts", now_ms), type="geolocation", payload=json.dumps(payload))
                session.add(event)
                session.commit()
                return

    @staticmethod
    def _extract_device_id(topic: str) -> Optional[str]:
        parts = topic.split("/")
        if len(parts) < 3:
            return None
        if parts[0] != "devices":
            return None
        if parts[1] == "pending":
            return parts[2] if len(parts) > 3 else None
        return parts[1]


bridge = MQTTBridge()
