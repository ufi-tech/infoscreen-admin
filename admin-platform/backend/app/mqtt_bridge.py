import json
import threading
import time
from datetime import datetime
from typing import Optional

import paho.mqtt.client as mqtt

from .db import SessionLocal
from .models import Device, Telemetry, Event
from .settings import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    MQTT_CLIENT_ID,
)


class MQTTBridge:
    def __init__(self) -> None:
        self._client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
        if MQTT_USERNAME:
            self._client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._lock = threading.Lock()

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
                device.status = payload.get("status", device.status)
                if is_pending:
                    device.approved = False
                else:
                    device.approved = bool(payload.get("approved", device.approved))
                device.ip = payload.get("ip", device.ip)
                device.url = payload.get("url", device.url)
                device.mac = payload.get("mac", device.mac)
                device.last_seen = datetime.utcnow()
                session.merge(device)
                session.commit()
                return

            if topic.endswith("/telemetry"):
                event = Telemetry(device_id=device_id, ts=payload.get("ts", now_ms), payload=json.dumps(payload))
                session.add(event)
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
                session.commit()
                return

            if topic.endswith("/screenshot"):
                event = Event(device_id=device_id, ts=payload.get("ts", now_ms), type="screenshot", payload=json.dumps(payload))
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
