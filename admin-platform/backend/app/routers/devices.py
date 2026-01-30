"""Device endpoints - MQTT devices, commands, telemetry, events."""

import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, desc

from ..db import SessionLocal
from ..models import Device, Telemetry, Event
from ..mqtt_bridge import bridge
from .deps import require_token
from .schemas import CommandRequest, ApproveRequest, FullyPasswordRequest
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
                "has_fully_password": bool(d.fully_password),  # Don't expose actual password
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
            "has_fully_password": bool(d.fully_password),
        }


@router.delete("/{device_id}")
def delete_device(device_id: str, request: Request):
    """Delete a device and all its associated data.

    This removes the device, its telemetry, events, logs, and any assignments.
    Use this to clean up stale/duplicate devices.
    """
    require_token(request)
    with SessionLocal() as session:
        device = session.get(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Delete associated data
        from ..models import Telemetry, Event, DeviceLog, DeviceAssignment, TunnelConfig

        # Count what we're deleting
        telemetry_count = session.query(Telemetry).filter(Telemetry.device_id == device_id).count()
        event_count = session.query(Event).filter(Event.device_id == device_id).count()
        log_count = session.query(DeviceLog).filter(DeviceLog.device_id == device_id).count()

        # Delete in order (foreign key safe)
        session.query(DeviceAssignment).filter(DeviceAssignment.device_id == device_id).delete()
        session.query(TunnelConfig).filter(TunnelConfig.device_id == device_id).delete()
        session.query(Telemetry).filter(Telemetry.device_id == device_id).delete()
        session.query(Event).filter(Event.device_id == device_id).delete()
        session.query(DeviceLog).filter(DeviceLog.device_id == device_id).delete()

        # Delete the device itself
        session.delete(device)
        session.commit()

        return {
            "ok": True,
            "device_id": device_id,
            "deleted": {
                "telemetry": telemetry_count,
                "events": event_count,
                "logs": log_count
            }
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

        # Include Fully password in payload for relay service
        with SessionLocal() as session:
            device = session.get(Device, device_id)
            if device and device.fully_password:
                payload["_password"] = device.fully_password
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


@router.post("/{device_id}/fully-password")
def set_fully_password(device_id: str, body: FullyPasswordRequest, request: Request):
    """Set Fully Kiosk Browser REST API password for a device.

    This password is sent to the relay service when executing commands.
    Only applicable for Fully devices (id starts with 'fully-').
    """
    require_token(request)

    if not device_id.startswith("fully-"):
        raise HTTPException(status_code=400, detail="Only Fully devices support password setting")

    with SessionLocal() as session:
        device = session.get(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        device.fully_password = body.password
        session.commit()

        add_log(
            device_id=device_id,
            level="info",
            category="command",
            message="Fully password opdateret"
        )

        return {"ok": True, "device_id": device_id}


# ============================================================================
# Screen Assignment (Fase 3)
# ============================================================================

from ..models import DeviceAssignment, Customer
from .schemas import ScreenAssignmentRequest


@router.get("/{device_id}/screen")
def get_device_screen(device_id: str, request: Request):
    """Get currently assigned screen for a device."""
    require_token(request)
    with SessionLocal() as session:
        device = session.get(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Get assignment
        assignment = session.execute(
            select(DeviceAssignment).where(DeviceAssignment.device_id == device_id)
        ).scalar()

        if not assignment:
            return {
                "device_id": device_id,
                "assigned": False,
                "screen_uuid": None,
                "display_url": None,
                "customer_id": None
            }

        # Get customer info
        customer = session.get(Customer, assignment.customer_id)

        return {
            "device_id": device_id,
            "assigned": True,
            "screen_uuid": assignment.screen_uuid,
            "display_url": assignment.display_url,
            "customer_id": assignment.customer_id,
            "customer_name": customer.name if customer else None,
            "cms_subdomain": customer.cms_subdomain if customer else None,
            "assigned_at": assignment.assigned_at
        }


@router.post("/{device_id}/screen")
def set_device_screen(device_id: str, body: ScreenAssignmentRequest, request: Request):
    """
    Set the screen for a device.

    This updates the screen_uuid and display_url for an existing assignment,
    and sends an MQTT loadUrl command to navigate the device to the new screen.

    If no assignment exists yet, the device must first be assigned to a customer
    via POST /customers/{id}/devices.
    """
    require_token(request)
    with SessionLocal() as session:
        device = session.get(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Get assignment
        assignment = session.execute(
            select(DeviceAssignment).where(DeviceAssignment.device_id == device_id)
        ).scalar()

        if not assignment:
            raise HTTPException(
                status_code=400,
                detail="Device not assigned to a customer. Assign via /customers/{id}/devices first."
            )

        # Get customer for CMS subdomain
        customer = session.get(Customer, assignment.customer_id)
        if not customer:
            raise HTTPException(status_code=500, detail="Customer not found for assignment")

        if not customer.cms_subdomain:
            raise HTTPException(status_code=400, detail="Customer has no CMS configured")

        # Update assignment
        old_screen = assignment.screen_uuid
        assignment.screen_uuid = body.screen_uuid

        if body.screen_uuid:
            assignment.display_url = f"https://{customer.cms_subdomain}.screen.iocast.dk/screen/{body.screen_uuid}"
        else:
            assignment.display_url = None

        session.commit()
        session.refresh(assignment)

        # Send MQTT command to update device URL
        mqtt_sent = False
        if assignment.display_url:
            try:
                # Determine correct topic based on device type
                if device_id.startswith("fully-"):
                    fully_device_id = device_id[6:]
                    topic = f"fully/cmd/{fully_device_id}/loadUrl"
                    payload = {"url": assignment.display_url}
                    # Include password if available
                    if device.fully_password:
                        payload["_password"] = device.fully_password
                else:
                    topic = f"devices/{device_id}/cmd/loadUrl"
                    payload = {"url": assignment.display_url}

                bridge.publish(topic, payload)
                mqtt_sent = True

                add_log(
                    device_id=device_id,
                    level="info",
                    category="command",
                    message=f"Skærm skiftet: {old_screen or 'ingen'} -> {body.screen_uuid}",
                    details={"url": assignment.display_url, "screen_uuid": body.screen_uuid}
                )
            except Exception as e:
                add_log(
                    device_id=device_id,
                    level="error",
                    category="command",
                    message=f"Fejl ved skærmskift: {str(e)}"
                )

        return {
            "device_id": device_id,
            "screen_uuid": assignment.screen_uuid,
            "display_url": assignment.display_url,
            "customer_id": assignment.customer_id,
            "mqtt_command_sent": mqtt_sent,
            "previous_screen": old_screen
        }
