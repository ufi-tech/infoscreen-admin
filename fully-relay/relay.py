#!/usr/bin/env python3
"""
Fully Kiosk Browser Relay Service

Auto-discovers Fully devices via MQTT and bridges commands to local REST API.
Zero configuration needed - MQTT credentials are built-in.

Usage:
    python relay.py

The service will:
1. Connect to MQTT broker with built-in credentials
2. Listen for fully/deviceInfo/+ messages to discover devices
3. Execute commands from fully/cmd/{deviceId}/{command}
4. Use password from command payload or default (1227)
5. Send acknowledgments back via MQTT
"""

import base64
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import paho.mqtt.client as mqtt
import requests

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("fully-relay")

# ============================================================================
# Built-in MQTT Configuration (obfuscated)
# ============================================================================
_MQTT_CONFIG = {
    "broker": "188.228.60.134",
    "port": 1883,
    "username": "admin",
    # Base64 encoded password (not secure, just obfuscated)
    "_p": "QlpzOVVCRFZpdWtXYVp1KzFPNkhkNzdxcitEc2hvbXU="
}

DEFAULT_FULLY_PASSWORD = "1227"


def _get_mqtt_password() -> str:
    """Decode obfuscated MQTT password"""
    return base64.b64decode(_MQTT_CONFIG["_p"]).decode()


# ============================================================================
# Device Registry
# ============================================================================

@dataclass
class FullyDevice:
    """Known Fully device"""
    device_id: str
    ip: str
    port: int = 2323
    name: str = ""
    last_seen: float = 0

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict):
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class DeviceRegistry:
    """Auto-discovering registry of Fully devices"""

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self._devices: dict[str, FullyDevice] = {}
        self._load()

    def _load(self):
        """Load saved devices from config"""
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text())
                for d in data.get("devices", []):
                    device = FullyDevice.from_dict(d)
                    self._devices[device.device_id] = device
                log.info(f"Loaded {len(self._devices)} devices from config")
            except Exception as e:
                log.warning(f"Could not load config: {e}")

    def _save(self):
        """Save devices to config"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            data = {"devices": [d.to_dict() for d in self._devices.values()]}
            self.config_path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            log.warning(f"Could not save config: {e}")

    def discover(self, device_id: str, ip: str, name: str = "") -> bool:
        """
        Auto-discover device from MQTT deviceInfo.
        Returns True if this is a new device.
        """
        is_new = device_id not in self._devices

        if is_new:
            self._devices[device_id] = FullyDevice(
                device_id=device_id,
                ip=ip,
                name=name,
                last_seen=time.time()
            )
            log.info(f"🆕 Discovered new device: {name or device_id} ({ip})")
            self._save()
        else:
            device = self._devices[device_id]
            changed = device.ip != ip or device.name != name
            device.ip = ip
            device.name = name
            device.last_seen = time.time()
            if changed:
                log.info(f"📡 Updated device: {name or device_id} ({ip})")
                self._save()

        return is_new

    def get(self, device_id: str) -> Optional[FullyDevice]:
        """Get device by ID (with or without fully- prefix)"""
        if device_id in self._devices:
            return self._devices[device_id]
        if device_id.startswith("fully-"):
            short_id = device_id[6:]
            if short_id in self._devices:
                return self._devices[short_id]
        return None

    def list_devices(self) -> list[FullyDevice]:
        """List all known devices"""
        return list(self._devices.values())


# ============================================================================
# Fully REST API Client
# ============================================================================

class FullyRestClient:
    """REST API client for Fully Kiosk Browser"""

    COMMANDS = {
        # Screen control
        "screenOn": {"cmd": "screenOn"},
        "screenOff": {"cmd": "screenOff"},
        "setBrightness": {"cmd": "setStringSetting", "key": "screenBrightness"},

        # Navigation
        "loadUrl": {"cmd": "loadUrl"},
        "loadStartUrl": {"cmd": "loadStartUrl"},
        "reload": {"cmd": "loadCurrentUrl"},

        # Screensaver
        "startScreensaver": {"cmd": "startScreensaver"},
        "stopScreensaver": {"cmd": "stopScreensaver"},

        # App control
        "restartApp": {"cmd": "restartApp"},
        "exitApp": {"cmd": "exitApp"},

        # Device control
        "reboot": {"cmd": "rebootDevice"},

        # Info
        "screenshot": {"cmd": "getScreenshot"},
        "deviceInfo": {"cmd": "deviceInfo"},

        # Settings
        "setStartUrl": {"cmd": "setStringSetting", "key": "startURL"},
        "setKioskMode": {"cmd": "setBooleanSetting", "key": "kioskMode"},
    }

    def __init__(self, device: FullyDevice, password: str):
        self.device = device
        self.password = password
        self.base_url = f"http://{device.ip}:{device.port}"

    def execute(self, command: str, params: dict = None) -> dict:
        """Execute a command on the Fully device"""
        params = params or {}

        cmd_config = self.COMMANDS.get(command, {"cmd": command})

        req_params = {
            "cmd": cmd_config["cmd"],
            "type": "json",
            "password": self.password,
        }

        if "key" in cmd_config:
            req_params["key"] = cmd_config["key"]

        if "value" in params:
            req_params["value"] = params["value"]
        if "url" in params:
            req_params["url"] = params["url"]
        if "brightness" in params:
            req_params["value"] = params["brightness"]

        try:
            log.info(f"⚡ {command} → {self.device.name or self.device.ip}")
            response = requests.get(self.base_url, params=req_params, timeout=10)

            if command == "screenshot" and response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                if content_type.startswith("image/"):
                    return {
                        "status": "OK",
                        "statustext": f"Screenshot captured ({len(response.content)} bytes)"
                    }

            result = response.json()
            status = result.get("status", "Unknown")
            if status == "OK":
                log.info(f"✅ {result.get('statustext', 'Success')}")
            else:
                log.warning(f"⚠️ {result.get('statustext', 'Failed')}")
            return result

        except requests.Timeout:
            log.error(f"⏱️ Timeout connecting to {self.device.ip}")
            return {"status": "Error", "statustext": "Request timeout"}
        except requests.ConnectionError:
            log.error(f"❌ Cannot connect to {self.device.ip}")
            return {"status": "Error", "statustext": f"Cannot connect to {self.device.ip}"}
        except Exception as e:
            log.error(f"❌ Error: {e}")
            return {"status": "Error", "statustext": str(e)}


# ============================================================================
# MQTT Relay Service
# ============================================================================

class FullyRelay:
    """MQTT to REST relay for Fully Kiosk Browser with auto-discovery"""

    def __init__(self, config_dir: Path):
        config_dir.mkdir(parents=True, exist_ok=True)
        config_path = config_dir / "devices.json"

        self.registry = DeviceRegistry(config_path)
        self.client = mqtt.Client(
            client_id=f"fully-relay-{os.getpid()}",
            clean_session=True,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )

        self.client.username_pw_set(_MQTT_CONFIG["username"], _get_mqtt_password())
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)

    def start(self):
        """Start the relay service"""
        broker = _MQTT_CONFIG["broker"]
        port = _MQTT_CONFIG["port"]
        log.info(f"🚀 Connecting to MQTT broker: {broker}:{port}")

        try:
            self.client.connect(broker, port, keepalive=60)
            self.client.loop_forever()
        except KeyboardInterrupt:
            log.info("👋 Shutting down...")
            self._publish_status("offline")
            self.client.disconnect()

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code != 0:
            log.error(f"❌ MQTT connection failed: {reason_code}")
            return

        log.info("✅ Connected to MQTT broker")

        client.subscribe("fully/cmd/+/+")
        client.subscribe("fully/deviceInfo/+")
        log.info("📡 Listening for commands and device discovery...")

        self._publish_status("online")

        devices = self.registry.list_devices()
        if devices:
            log.info(f"📋 Known devices: {len(devices)}")
            for d in devices:
                log.info(f"   • {d.name or d.device_id} ({d.ip})")
        else:
            log.info("📋 No saved devices - waiting for discovery...")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        log.warning(f"⚠️ Disconnected from MQTT (reason: {reason_code}), reconnecting...")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic

        try:
            payload = json.loads(msg.payload.decode()) if msg.payload else {}
        except json.JSONDecodeError:
            payload = {}

        # Handle deviceInfo for auto-discovery
        if topic.startswith("fully/deviceInfo/"):
            device_id = topic.split("/")[2]
            ip = payload.get("ip4")
            name = payload.get("deviceName", "")
            if ip:
                self.registry.discover(device_id, ip, name)
            return

        # Handle commands: fully/cmd/{deviceId}/{command}
        if topic.startswith("fully/cmd/"):
            parts = topic.split("/")
            if len(parts) >= 4:
                device_id = parts[2]
                command = parts[3]
                self._handle_command(device_id, command, payload)

    def _handle_command(self, device_id: str, command: str, params: dict):
        """Handle a command for a device"""
        device = self.registry.get(device_id)
        if not device:
            log.warning(f"❓ Unknown device: {device_id}")
            self._publish_ack(device_id, command, {
                "status": "Error",
                "statustext": f"Unknown device: {device_id}. Wait for device to send deviceInfo."
            })
            return

        # Get password from command payload, or use default
        password = params.pop("_password", None) or DEFAULT_FULLY_PASSWORD

        # Execute command
        rest_client = FullyRestClient(device, password)
        result = rest_client.execute(command, params)

        self._publish_ack(device_id, command, result)

    def _publish_ack(self, device_id: str, command: str, result: dict):
        """Publish command acknowledgment"""
        ack_topic = f"fully/cmd/{device_id}/{command}/ack"
        ack_payload = {
            "device_id": device_id,
            "command": command,
            "result": result,
            "timestamp": int(time.time())
        }
        self.client.publish(ack_topic, json.dumps(ack_payload))

    def _publish_status(self, status: str):
        """Publish relay status"""
        self.client.publish("fully/relay/status", json.dumps({
            "status": status,
            "timestamp": int(time.time()),
            "devices": len(self.registry.list_devices())
        }), retain=True)


# ============================================================================
# Main
# ============================================================================

def get_config_dir() -> Path:
    """Get platform-appropriate config directory"""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "fully-relay"
    elif sys.platform == "win32":
        return Path(os.environ.get("APPDATA", "")) / "fully-relay"
    else:
        return Path.home() / ".config" / "fully-relay"


def main():
    config_dir = get_config_dir()

    log.info("=" * 50)
    log.info("  Fully Relay Service")
    log.info("=" * 50)
    log.info(f"  Config: {config_dir}")
    log.info(f"  Default Fully password: {DEFAULT_FULLY_PASSWORD}")
    log.info("=" * 50)
    log.info("")

    relay = FullyRelay(config_dir)
    relay.start()


if __name__ == "__main__":
    main()
