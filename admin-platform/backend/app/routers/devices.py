"""Device endpoints - MQTT devices, commands, telemetry, events."""

import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, desc

from ..db import SessionLocal
from ..models import Device, Telemetry, Event
from ..mqtt_bridge import bridge
from .deps import require_token
from .schemas import CommandRequest, ApproveRequest
from .logs import add_log

# Danish command names for logging
COMMAND_NAMES = {
    "reboot": "Genstart",
    "restart-nodered": "Genstart Node-RED",
    "restart-chromium": "Genstart Chromium",
    "screenshot": "Screenshot",
    "wifi-scan": "WiFi scan",
    "get-info": "Hent info",
    "log-tail": "Hent log",
    "get-location": "Hent lokation",
    "set-url": "Skift URL",
    "ssh-tunnel": "SSH tunnel",
    # Fully Kiosk commands
    "screenOn": "Tænd skærm",
    "screenOff": "Sluk skærm",
    "setBrightness": "Sæt lysstyrke",
    "loadUrl": "Skift URL",
    "loadStartUrl": "Gå til start-URL",
    "startScreensaver": "Start pauseskærm",
    "stopScreensaver": "Stop pauseskærm",
    "restartApp": "Genstart app",
}

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("")
def list_devices(request: Request):
    """List all MQTT devices."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(select(Device)).scalars().all()
        return [
            {
                "id": d.id,
                "name": d.name,
                "status": d.status,
                "approved": d.approved,
                "last_seen": d.last_seen,
                "ip": d.ip,
                "url": d.url,
                "mac": d.mac,
            }
            for d in rows
        ]


@router.get("/{device_id}")
def get_device(device_id: str, request: Request):
    """Get a single device by ID."""
    require_token(request)
    with SessionLocal() as session:
        d = session.get(Device, device_id)
        if not d:
            raise HTTPException(status_code=404, detail="Device not found")
        return {
            "id": d.id,
            "name": d.name,
            "status": d.status,
            "approved": d.approved,
            "last_seen": d.last_seen,
            "ip": d.ip,
            "url": d.url,
            "mac": d.mac,
        }


@router.post("/{device_id}/command")
def send_command(device_id: str, body: CommandRequest, request: Request):
    """Send a command to a device via MQTT.

    For Raspberry Pi devices: uses devices/{id}/cmd/{action}
    For Fully Kiosk devices: uses fully/cmd/{id}/{action} (requires relay service)
    """
    require_token(request)
    payload = body.payload or {}

    # Determine topic based on device type
    if device_id.startswith("fully-"):
        # Fully devices use different topic structure
        # Strip "fully-" prefix for the actual device ID
        fully_device_id = device_id[6:]
        topic = f"fully/cmd/{fully_device_id}/{body.action}"
    else:
        # Standard Raspberry Pi devices
        topic = f"devices/{device_id}/cmd/{body.action}"

    bridge.publish(topic, payload)

    # Log the command
    cmd_name = COMMAND_NAMES.get(body.action, body.action)
    details = {"action": body.action}
    if body.action in ("set-url", "loadUrl") and payload.get("url"):
        details["url"] = payload["url"]
    if body.action == "setBrightness" and payload.get("brightness"):
        details["brightness"] = payload["brightness"]
    add_log(
        device_id=device_id,
        level="info",
        category="command",
        message=f"Kommando sendt: {cmd_name}",
        details=details
    )

    return {"ok": True, "topic": topic}


@router.post("/{device_id}/approve")
def approve_device(device_id: str, body: ApproveRequest, request: Request):
    """Approve a pending device."""
    require_token(request)
    if not body.approved:
        return {"ok": True}
    topic = f"devices/pending/{device_id}/cmd/approve"
    bridge.publish(topic, {})

    # Log approval
    add_log(
        device_id=device_id,
        level="success",
        category="status",
        message="Enhed godkendt"
    )

    return {"ok": True, "topic": topic}


@router.get("/{device_id}/telemetry")
def get_telemetry(device_id: str, request: Request, limit: int = 50):
    """Get telemetry history for a device."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(
            select(Telemetry)
            .where(Telemetry.device_id == device_id)
            .order_by(desc(Telemetry.id))
            .limit(limit)
        ).scalars().all()
        return [
            {
                "id": r.id,
                "ts": r.ts,
                "payload": json.loads(r.payload) if r.payload else {},
            }
            for r in rows
        ]


@router.get("/{device_id}/events")
def get_events(device_id: str, request: Request, limit: int = 100):
    """Get events/logs for a device."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(
            select(Event)
            .where(Event.device_id == device_id)
            .order_by(desc(Event.id))
            .limit(limit)
        ).scalars().all()
        return [
            {
                "id": r.id,
                "ts": r.ts,
                "type": r.type,
                "payload": json.loads(r.payload) if r.payload else {},
            }
            for r in rows
        ]
