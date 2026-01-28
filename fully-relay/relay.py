#!/usr/bin/env python3
"""
Fully Kiosk Browser Relay Service

Auto-discovers Fully devices via MQTT and bridges commands to local REST API.
No manual configuration needed - just provide MQTT credentials.

Usage:
    python relay.py --broker 188.228.60.134 --user admin --password XXX

The service will:
1. Listen for fully/deviceInfo/+ messages to discover devices
2. Auto-register devices with their IP and default password
3. Execute commands from fully/cmd/{deviceId}/{command}
4. Send acknowledgments back via MQTT
"""

import argparse
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


@dataclass
class FullyDevice:
    """Known Fully device"""
    device_id: str
    ip: str
    password: str
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

    def __init__(self, config_path: Path, default_password: str = "1227"):
        self.config_path = config_path
        self.default_password = default_password
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

    def discover(self, device_id: str, ip: str, name: str = "", password: str = None) -> bool:
        """
        Auto-discover device from MQTT deviceInfo.
        Returns True if this is a new device.
        """
        is_new = device_id not in self._devices

        if is_new:
            self._devices[device_id] = FullyDevice(
                device_id=device_id,
                ip=ip,
                password=password or self.default_password,
                name=name,
                last_seen=time.time()
            )
            log.info(f"🆕 Discovered new device: {name or device_id} ({ip})")
            self._save()
        else:
            # Update existing device
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
        # Try exact match
        if device_id in self._devices:
            return self._devices[device_id]
        # Try with prefix stripped
        if device_id.startswith("fully-"):
            short_id = device_id[6:]
            if short_id in self._devices:
                return self._devices[short_id]
        return None

    def set_password(self, device_id: str, password: str):
        """Update password for a device"""
        device = self.get(device_id)
        if device:
            device.password = password
            self._save()
            log.info(f"🔑 Updated password for {device.name or device_id}")

    def list_devices(self) -> list[FullyDevice]:
        """List all known devices"""
        return list(self._devices.values())


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

    def __init__(self, device: FullyDevice):
        self.device = device
        self.base_url = f"http://{device.ip}:{device.port}"

    def execute(self, command: str, params: dict = None) -> dict:
        """Execute a command on the Fully device"""
        params = params or {}

        # Get command config
        cmd_config = self.COMMANDS.get(command, {"cmd": command})

        # Build request params
        req_params = {
            "cmd": cmd_config["cmd"],
            "type": "json",
            "password": self.device.password,
        }

        # Add key for settings commands
        if "key" in cmd_config:
            req_params["key"] = cmd_config["key"]

        # Add value/url from params
        if "value" in params:
            req_params["value"] = params["value"]
        if "url" in params:
            req_params["url"] = params["url"]
        if "brightness" in params:
            req_params["value"] = params["brightness"]

        try:
            log.info(f"⚡ {command} → {self.device.name or self.device.ip}")
            response = requests.get(self.base_url, params=req_params, timeout=10)

            # Handle screenshot (binary response)
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


class FullyRelay:
    """MQTT to REST relay for Fully Kiosk Browser with auto-discovery"""

    def __init__(self, broker: str, port: int, username: str, password: str,
                 config_dir: Path, default_password: str = "1227"):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password

        # Setup config directory
        config_dir.mkdir(parents=True, exist_ok=True)
        config_path = config_dir / "devices.json"

        self.registry = DeviceRegistry(config_path, default_password)
        self.client = mqtt.Client(
            client_id=f"fully-relay-{os.getpid()}",
            clean_session=True,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )

        if username:
            self.client.username_pw_set(username, password)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        # Reconnect settings
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)

    def start(self):
        """Start the relay service"""
        log.info(f"🚀 Connecting to MQTT broker: {self.broker}:{self.port}")

        try:
            self.client.connect(self.broker, self.port, keepalive=60)
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

        # Subscribe to topics
        client.subscribe("fully/cmd/+/+")        # Commands
        client.subscribe("fully/deviceInfo/+")   # Device discovery
        log.info("📡 Listening for commands and device discovery...")

        # Publish relay online status
        self._publish_status("online")

        # Log known devices
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
        # Find device
        device = self.registry.get(device_id)
        if not device:
            log.warning(f"❓ Unknown device: {device_id}")
            self._publish_ack(device_id, command, {
                "status": "Error",
                "statustext": f"Unknown device: {device_id}. Wait for device to send deviceInfo."
            })
            return

        # Execute command
        rest_client = FullyRestClient(device)
        result = rest_client.execute(command, params)

        # Publish acknowledgment
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


def get_config_dir() -> Path:
    """Get platform-appropriate config directory"""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "fully-relay"
    elif sys.platform == "win32":
        return Path(os.environ.get("APPDATA", "")) / "fully-relay"
    else:
        return Path.home() / ".config" / "fully-relay"


def main():
    parser = argparse.ArgumentParser(
        description="Fully Kiosk Browser Relay Service (Auto-Discovery)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This service automatically discovers Fully devices via MQTT.
No manual device configuration needed!

Examples:
  # Basic usage - devices are auto-discovered
  python relay.py --broker 188.228.60.134 --user admin --password secret

  # With custom default password for discovered devices
  python relay.py --broker mqtt.example.com --user admin --password secret \\
    --default-password mypassword

The service will:
  1. Listen for fully/deviceInfo/+ messages
  2. Auto-register discovered devices with their IP
  3. Execute commands from fully/cmd/{deviceId}/{command}
  4. Persist device list between restarts
        """
    )

    parser.add_argument("--broker", "-b", required=True, help="MQTT broker host")
    parser.add_argument("--port", "-p", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--user", "-u", help="MQTT username")
    parser.add_argument("--password", "-P", help="MQTT password")
    parser.add_argument("--default-password", default="1227",
                        help="Default Fully password for discovered devices")
    parser.add_argument("--config-dir", type=Path, default=None,
                        help="Config directory (default: platform-specific)")

    args = parser.parse_args()

    config_dir = args.config_dir or get_config_dir()

    # Create relay
    relay = FullyRelay(
        broker=args.broker,
        port=args.port,
        username=args.user,
        password=args.password,
        config_dir=config_dir,
        default_password=args.default_password
    )

    log.info("=" * 50)
    log.info("  Fully Relay Service (Auto-Discovery)")
    log.info("=" * 50)
    log.info(f"  Config: {config_dir}")
    log.info(f"  Default password: {args.default_password}")
    log.info("=" * 50)
    log.info("")

    relay.start()


if __name__ == "__main__":
    main()
