#!/usr/bin/env python3
"""
Fully Kiosk Browser Relay Service

Bridges MQTT commands from admin platform to local Fully REST API.
Run this on a Mac/PC that has LAN access to Fully devices.

Usage:
    python relay.py --broker 188.228.60.134 --user admin --password XXX

MQTT Topics:
    Subscribe: fully/cmd/{deviceId}/{command}
    Publish:   fully/cmd/{deviceId}/{command}/ack
"""

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass
from typing import Optional

import paho.mqtt.client as mqtt
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("fully-relay")


@dataclass
class FullyDevice:
    """Known Fully device with IP and password"""
    device_id: str
    ip: str
    password: str
    port: int = 2323


class DeviceRegistry:
    """Registry of known Fully devices"""

    def __init__(self):
        self._devices: dict[str, FullyDevice] = {}

    def register(self, device_id: str, ip: str, password: str, port: int = 2323):
        """Register a device"""
        self._devices[device_id] = FullyDevice(device_id, ip, password, port)
        log.info(f"Registered device: {device_id} -> {ip}:{port}")

    def get(self, device_id: str) -> Optional[FullyDevice]:
        """Get device by ID"""
        # Try exact match first
        if device_id in self._devices:
            return self._devices[device_id]
        # Try with fully- prefix stripped
        if device_id.startswith("fully-"):
            short_id = device_id[6:]
            if short_id in self._devices:
                return self._devices[short_id]
        # Try adding fully- prefix
        prefixed = f"fully-{device_id}"
        if prefixed in self._devices:
            return self._devices[prefixed]
        return None

    def discover_from_mqtt(self, device_id: str, payload: dict):
        """Auto-discover device from MQTT deviceInfo"""
        ip = payload.get("ip4")
        if ip and device_id not in self._devices:
            # Use default password - can be overridden via config
            self.register(device_id, ip, "1227")


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
            log.info(f"Executing {command} on {self.device.ip}")
            response = requests.get(self.base_url, params=req_params, timeout=10)

            # Handle screenshot (binary response)
            if command == "screenshot" and response.status_code == 200:
                if response.headers.get("content-type", "").startswith("image/"):
                    return {
                        "status": "OK",
                        "screenshot": response.content.hex()[:100] + "...",
                        "size": len(response.content)
                    }

            return response.json()
        except requests.Timeout:
            return {"status": "Error", "statustext": "Request timeout"}
        except requests.ConnectionError:
            return {"status": "Error", "statustext": f"Cannot connect to {self.device.ip}"}
        except Exception as e:
            return {"status": "Error", "statustext": str(e)}


class FullyRelay:
    """MQTT to REST relay for Fully Kiosk Browser"""

    def __init__(self, broker: str, port: int, username: str, password: str):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password

        self.registry = DeviceRegistry()
        self.client = mqtt.Client(client_id="fully-relay", clean_session=True)

        if username:
            self.client.username_pw_set(username, password)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    def add_device(self, device_id: str, ip: str, password: str, port: int = 2323):
        """Add a known device"""
        self.registry.register(device_id, ip, password, port)

    def start(self):
        """Start the relay service"""
        log.info(f"Connecting to MQTT broker: {self.broker}:{self.port}")
        self.client.connect(self.broker, self.port, keepalive=60)
        self.client.loop_forever()

    def _on_connect(self, client, userdata, flags, rc):
        if rc != 0:
            log.error(f"MQTT connection failed: {rc}")
            return

        log.info("Connected to MQTT broker")

        # Subscribe to command topics
        client.subscribe("fully/cmd/+/+")
        log.info("Subscribed to: fully/cmd/+/+")

        # Subscribe to deviceInfo for auto-discovery
        client.subscribe("fully/deviceInfo/+")
        log.info("Subscribed to: fully/deviceInfo/+ (auto-discovery)")

        # Publish relay online status
        client.publish("fully/relay/status", json.dumps({
            "status": "online",
            "timestamp": int(time.time())
        }), retain=True)

    def _on_message(self, client, userdata, msg):
        topic = msg.topic

        try:
            payload = json.loads(msg.payload.decode()) if msg.payload else {}
        except json.JSONDecodeError:
            payload = {}

        # Handle deviceInfo for auto-discovery
        if topic.startswith("fully/deviceInfo/"):
            device_id = topic.split("/")[2]
            self.registry.discover_from_mqtt(device_id, payload)
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
        log.info(f"Command received: {device_id} -> {command}")

        # Find device
        device = self.registry.get(device_id)
        if not device:
            log.warning(f"Unknown device: {device_id}")
            self._publish_ack(device_id, command, {
                "status": "Error",
                "statustext": f"Unknown device: {device_id}"
            })
            return

        # Execute command
        client = FullyRestClient(device)
        result = client.execute(command, params)

        log.info(f"Result: {result.get('status')} - {result.get('statustext', '')}")

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


def main():
    parser = argparse.ArgumentParser(
        description="Fully Kiosk Browser Relay Service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python relay.py --broker 188.228.60.134 --user admin --password secret

  # With pre-configured devices
  python relay.py --broker 188.228.60.134 --user admin --password secret \\
    --device 8c2c6a0f-2d65236b:192.168.40.154:1227

  # Multiple devices
  python relay.py --broker mqtt.example.com --user admin --password secret \\
    --device device1:192.168.1.100:pass1 \\
    --device device2:192.168.1.101:pass2
        """
    )

    parser.add_argument("--broker", "-b", required=True, help="MQTT broker host")
    parser.add_argument("--port", "-p", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--user", "-u", help="MQTT username")
    parser.add_argument("--password", "-P", help="MQTT password")
    parser.add_argument(
        "--device", "-d", action="append",
        metavar="ID:IP:PASSWORD",
        help="Pre-configure device (format: deviceId:ip:password)"
    )
    parser.add_argument("--default-password", default="1227", help="Default Fully password for auto-discovered devices")

    args = parser.parse_args()

    # Create relay
    relay = FullyRelay(
        broker=args.broker,
        port=args.port,
        username=args.user,
        password=args.password
    )

    # Add pre-configured devices
    if args.device:
        for device_spec in args.device:
            parts = device_spec.split(":")
            if len(parts) >= 3:
                device_id, ip, password = parts[0], parts[1], parts[2]
                port = int(parts[3]) if len(parts) > 3 else 2323
                relay.add_device(device_id, ip, password, port)
            else:
                log.error(f"Invalid device spec: {device_spec} (expected id:ip:password)")

    # Start relay
    log.info("Starting Fully Relay Service...")
    log.info("Press Ctrl+C to stop")

    try:
        relay.start()
    except KeyboardInterrupt:
        log.info("Shutting down...")


if __name__ == "__main__":
    main()
