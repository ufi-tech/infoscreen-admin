import json
import threading
import time
from datetime import datetime
from typing import Optional

import paho.mqtt.client as mqtt

from .db import SessionLocal
from .models import Device, Telemetry, Event, Location, DeviceLog, CustomerCode, Customer, Assignment
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
        # Standard device topics
        client.subscribe("devices/+/status")
        client.subscribe("devices/pending/+/status")
        client.subscribe("devices/pending/+/telemetry")
        client.subscribe("devices/+/telemetry")
        client.subscribe("devices/+/events")
        client.subscribe("devices/+/wifi-scan")
        client.subscribe("devices/+/screenshot")
        client.subscribe("devices/+/geolocation")
        # Fully Kiosk Browser topics
        client.subscribe("fully/deviceInfo/+")
        client.subscribe("fully/event/+/+")
        client.subscribe("fully/cmd/+/+/ack")  # Command acknowledgments from relay
        client.subscribe("fully/relay/status")  # Relay service status
        # IOCast provisioning topics
        client.subscribe("provision/+/request")

    def _on_message(self, client, userdata, msg) -> None:
        topic = msg.topic
        payload_raw = msg.payload.decode("utf-8", errors="ignore")
        try:
            payload = json.loads(payload_raw) if payload_raw else {}
        except json.JSONDecodeError:
            payload = {"raw": payload_raw}

        now_ms = int(time.time() * 1000)

        # Handle Fully Kiosk Browser topics
        if topic.startswith("fully/"):
            self._handle_fully_message(topic, payload, now_ms)
            return

        # Handle IOCast provisioning requests
        if topic.startswith("provision/") and topic.endswith("/request"):
            self._handle_provision_request(topic, payload, now_ms)
            return

        device_id = self._extract_device_id(topic)
        if not device_id:
            return

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

    def _handle_fully_message(self, topic: str, payload: dict, now_ms: int) -> None:
        """Handle Fully Kiosk Browser MQTT messages"""
        parts = topic.split("/")

        # fully/deviceInfo/{deviceId}
        if len(parts) >= 3 and parts[1] == "deviceInfo":
            device_id = f"fully-{parts[2]}"
            self._process_fully_device_info(device_id, payload, now_ms)
            return

        # fully/event/{eventType}/{deviceId}
        if len(parts) >= 4 and parts[1] == "event":
            event_type = parts[2]
            device_id = f"fully-{parts[3]}"
            self._process_fully_event(device_id, event_type, payload, now_ms)
            return

        # fully/cmd/{deviceId}/{command}/ack - Command acknowledgment from relay
        if len(parts) >= 5 and parts[1] == "cmd" and parts[4] == "ack":
            device_id = f"fully-{parts[2]}"
            command = parts[3]
            self._process_fully_command_ack(device_id, command, payload, now_ms)
            return

        # fully/relay/status - Relay service status
        if len(parts) >= 3 and parts[1] == "relay" and parts[2] == "status":
            self._process_relay_status(payload, now_ms)
            return

    def _process_fully_device_info(self, device_id: str, payload: dict, now_ms: int) -> None:
        """Process Fully deviceInfo message - combines status + telemetry"""
        with SessionLocal() as session:
            # Update/create device
            device = session.get(Device, device_id) or Device(id=device_id)
            was_new = device.status == "unknown" or device.status is None

            device.name = payload.get("deviceName", device.name)
            device.status = "online"
            device.approved = True  # Auto-approve Fully devices
            device.ip = payload.get("ip4", device.ip)
            device.mac = payload.get("Mac", device.mac)
            device.url = payload.get("currentPageUrl", payload.get("startUrl", device.url))
            device.last_seen = datetime.utcnow()
            session.merge(device)

            # Log new device
            if was_new:
                _add_device_log(session, device_id, "success", "status",
                    f"Fully Kiosk enhed forbundet: {device.name}",
                    {"ip": device.ip, "mac": device.mac, "model": payload.get("model")})

            # Store as telemetry (map Fully fields to our format)
            telemetry_data = {
                "device_type": "fully",
                "fully_device_id": payload.get("deviceId"),
                "battery_level": payload.get("batteryLevel"),
                "battery_charging": payload.get("isPlugged"),
                "screen_on": payload.get("screenOn"),
                "screen_brightness": payload.get("screenBrightness"),
                "wifi_ssid": payload.get("SSID", "").strip('"'),
                "wifi_signal": payload.get("wifiSignalLevel"),
                "ram_free_mb": payload.get("ramFreeMemory", 0) // (1024 * 1024) if payload.get("ramFreeMemory") else None,
                "ram_total_mb": payload.get("ramTotalMemory", 0) // (1024 * 1024) if payload.get("ramTotalMemory") else None,
                "storage_free_mb": payload.get("internalStorageFreeSpace", 0) // (1024 * 1024) if payload.get("internalStorageFreeSpace") else None,
                "storage_total_mb": payload.get("internalStorageTotalSpace", 0) // (1024 * 1024) if payload.get("internalStorageTotalSpace") else None,
                "android_version": payload.get("androidVersion"),
                "app_version": payload.get("version"),
                "kiosk_mode": payload.get("kioskMode"),
                "maintenance_mode": payload.get("maintenanceMode"),
                "mqtt_connected": payload.get("mqttConnected"),
                "lat": payload.get("latitude"),
                "lon": payload.get("longitude"),
                "ts": now_ms,
            }
            telemetry = Telemetry(device_id=device_id, ts=now_ms, payload=json.dumps(telemetry_data))
            session.add(telemetry)

            # Update location if available
            lat = payload.get("latitude")
            lon = payload.get("longitude")
            if lat is not None and lon is not None:
                from sqlalchemy import select
                existing = session.execute(
                    select(Location).where(Location.device_id == device_id)
                ).scalars().first()
                if not existing:
                    existing = Location(device_id=device_id)
                existing.lat = float(lat)
                existing.lon = float(lon)
                session.add(existing)

            session.commit()

    def _process_fully_event(self, device_id: str, event_type: str, payload: dict, now_ms: int) -> None:
        """Process Fully event message"""
        with SessionLocal() as session:
            # Update device last_seen
            device = session.get(Device, device_id)
            if device:
                device.last_seen = datetime.utcnow()
                session.merge(device)

            # Store event
            event = Event(
                device_id=device_id,
                ts=now_ms,
                type=f"fully-{event_type}",
                payload=json.dumps(payload)
            )
            session.add(event)

            # Log significant events
            if event_type in ("screenOn", "screenOff", "onScreensaverStart", "onScreensaverStop"):
                _add_device_log(session, device_id, "info", "status",
                    f"Fully event: {event_type}")
            elif event_type == "unplugged":
                _add_device_log(session, device_id, "warning", "status",
                    "Fully: Strøm afbrudt")
            elif event_type == "pluggedAC":
                _add_device_log(session, device_id, "info", "status",
                    "Fully: Strøm tilsluttet")

            session.commit()

    def _process_fully_command_ack(self, device_id: str, command: str, payload: dict, now_ms: int) -> None:
        """Process command acknowledgment from relay service"""
        result = payload.get("result", {})
        status = result.get("status", "Unknown")
        statustext = result.get("statustext", "")

        with SessionLocal() as session:
            # Log command result
            level = "success" if status == "OK" else "error"
            _add_device_log(session, device_id, level, "command",
                f"Kommando resultat: {command} - {statustext}",
                {"command": command, "status": status})

            # Store as event
            event = Event(
                device_id=device_id,
                ts=now_ms,
                type=f"fully-cmd-{command}",
                payload=json.dumps(payload)
            )
            session.add(event)
            session.commit()

    def _process_relay_status(self, payload: dict, now_ms: int) -> None:
        """Process relay service status update"""
        status = payload.get("status", "unknown")
        # Could store relay status if needed for monitoring
        pass

    def _handle_provision_request(self, topic: str, payload: dict, now_ms: int) -> None:
        """
        Handle IOCast Android/TV device provisioning requests.
        Topic: provision/{customer_code}/request
        """
        from sqlalchemy import select

        # Extract customer code from topic: provision/{code}/request
        parts = topic.split("/")
        if len(parts) < 3:
            return
        customer_code = parts[1]
        device_id = payload.get("deviceId", "")

        if not device_id:
            return

        with SessionLocal() as session:
            # Lookup customer code
            code_record = session.execute(
                select(CustomerCode).where(CustomerCode.code == customer_code)
            ).scalars().first()

            if not code_record:
                # Unknown customer code - ignore silently
                # (don't respond to avoid information disclosure)
                return

            # Get customer info
            customer = session.get(Customer, code_record.customer_id)
            customer_name = customer.name if customer else "Ukendt"

            # Create or update device
            device = session.get(Device, device_id)
            was_new = device is None

            if not device:
                device = Device(id=device_id)

            device.name = payload.get("deviceName", f"IOCast {device_id[-8:]}")
            device.status = "online"
            device.ip = payload.get("ip", device.ip)
            device.mac = payload.get("mac", device.mac)
            device.url = code_record.start_url
            device.last_seen = datetime.utcnow()

            # Set approved based on auto_approve setting
            if code_record.auto_approve:
                device.approved = True
            # If not auto_approve, keep existing approval status (or False for new)

            session.merge(device)

            # Create/update assignment to link device to customer
            existing_assignment = session.execute(
                select(Assignment).where(Assignment.device_id == device_id)
            ).scalars().first()

            if not existing_assignment:
                assignment = Assignment(
                    customer_id=code_record.customer_id,
                    device_id=device_id
                )
                session.add(assignment)
            elif existing_assignment.customer_id != code_record.customer_id:
                # Update if customer changed
                existing_assignment.customer_id = code_record.customer_id

            # Log the provisioning
            log_msg = f"IOCast provisioning: {customer_name} (kode: {customer_code})"
            if was_new:
                _add_device_log(session, device_id, "success", "status",
                    f"Ny enhed registreret via {log_msg}",
                    {"ip": device.ip, "mac": device.mac, "model": payload.get("deviceName")})
            else:
                _add_device_log(session, device_id, "info", "status",
                    f"Enhed gen-provisioneret via {log_msg}",
                    {"ip": device.ip})

            session.commit()

            # Build response
            response_topic = f"provision/{customer_code}/response/{device_id}"

            if code_record.auto_approve or device.approved:
                # Send approved config
                response = {
                    "approved": True,
                    "startUrl": code_record.start_url,
                    "kioskMode": code_record.kiosk_mode,
                    "keepScreenOn": code_record.keep_screen_on,
                    "customerId": str(code_record.customer_id),
                    "customerName": customer_name
                }
            else:
                # Waiting for manual approval
                response = {
                    "approved": False,
                    "message": "Venter på godkendelse...",
                    "customerName": customer_name
                }

            # Publish response (retained so device can reconnect and get it)
            self._client.publish(response_topic, json.dumps(response), retain=True)

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
