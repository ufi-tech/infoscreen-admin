"""Tunnel configuration endpoints."""

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from ..db import SessionLocal
from ..models import Device, TunnelConfig
from ..settings import (
    TUNNEL_PORT_MIN,
    TUNNEL_PORT_MAX,
    TUNNEL_DEFAULT_PORT,
    TUNNEL_DEFAULT_HOST,
    TUNNEL_DEFAULT_USER,
    TUNNEL_DEFAULT_KEY_PATH,
)
from .deps import require_token
from .schemas import TunnelConfigRequest, TunnelPortRequest

router = APIRouter(tags=["tunnels"])


def serialize_tunnel_config(cfg: TunnelConfig) -> dict:
    """Convert TunnelConfig model to dict."""
    return {
        "device_id": cfg.device_id,
        "host": cfg.host or "",
        "user": cfg.user or "",
        "key_path": cfg.key_path or "",
        "tunnel_port": cfg.tunnel_port,
        "ssh_port": cfg.ssh_port,
        "nodered_port": cfg.nodered_port,
        "web_ssh_port": cfg.web_ssh_port,
        "updated_at": cfg.updated_at,
    }


def apply_tunnel_defaults(cfg: TunnelConfig) -> bool:
    """Apply default tunnel settings if not set. Returns True if updated."""
    updated = False
    if not cfg.tunnel_port:
        cfg.tunnel_port = TUNNEL_DEFAULT_PORT
        updated = True
    if not cfg.host and TUNNEL_DEFAULT_HOST:
        cfg.host = TUNNEL_DEFAULT_HOST
        updated = True
    if not cfg.user and TUNNEL_DEFAULT_USER:
        cfg.user = TUNNEL_DEFAULT_USER
        updated = True
    if not cfg.key_path and TUNNEL_DEFAULT_KEY_PATH:
        cfg.key_path = TUNNEL_DEFAULT_KEY_PATH
        updated = True
    return updated


@router.get("/tunnel-configs")
def list_tunnel_configs(request: Request):
    """List all tunnel configurations."""
    require_token(request)
    with SessionLocal() as session:
        device_ids = session.execute(select(Device.id)).scalars().all()
        existing = {cfg.device_id: cfg for cfg in session.execute(select(TunnelConfig)).scalars().all()}
        changed = False
        for device_id in device_ids:
            cfg = existing.get(device_id)
            if not cfg:
                cfg = TunnelConfig(device_id=device_id)
                session.add(cfg)
                existing[device_id] = cfg
                changed = True
            if apply_tunnel_defaults(cfg):
                session.add(cfg)
                changed = True
        if changed:
            session.commit()
        rows = session.execute(select(TunnelConfig)).scalars().all()
        return [serialize_tunnel_config(r) for r in rows]


@router.get("/devices/{device_id}/tunnel-config")
def get_tunnel_config(device_id: str, request: Request):
    """Get tunnel configuration for a device."""
    require_token(request)
    with SessionLocal() as session:
        row = session.get(TunnelConfig, device_id)
        if not row:
            row = TunnelConfig(device_id=device_id)
            session.add(row)
        if apply_tunnel_defaults(row):
            session.add(row)
            session.commit()
            session.refresh(row)
        return serialize_tunnel_config(row)


@router.post("/devices/{device_id}/tunnel-config")
def save_tunnel_config(device_id: str, body: TunnelConfigRequest, request: Request):
    """Save tunnel configuration for a device."""
    require_token(request)
    updates = body.model_dump(exclude_none=True)
    with SessionLocal() as session:
        row = session.get(TunnelConfig, device_id)
        if not row:
            row = TunnelConfig(device_id=device_id)
        for key, value in updates.items():
            setattr(row, key, value)
        if apply_tunnel_defaults(row):
            session.add(row)
        session.add(row)
        session.commit()
        session.refresh(row)
        return serialize_tunnel_config(row)


@router.post("/devices/{device_id}/tunnel-ports")
def allocate_tunnel_ports(device_id: str, body: TunnelPortRequest, request: Request):
    """Allocate tunnel ports for a device."""
    require_token(request)
    force = bool(body.force)
    with SessionLocal() as session:
        row = session.get(TunnelConfig, device_id)
        if not row:
            row = TunnelConfig(device_id=device_id)

        rows = session.execute(select(TunnelConfig)).scalars().all()
        used = set()
        for cfg in rows:
            for port in (cfg.ssh_port, cfg.nodered_port, cfg.web_ssh_port):
                if port:
                    used.add(port)

        existing_ports = {row.ssh_port, row.nodered_port, row.web_ssh_port}
        if force:
            used -= {p for p in existing_ports if p}
            row.ssh_port = None
            row.nodered_port = None
            row.web_ssh_port = None

        def next_free():
            for port in range(TUNNEL_PORT_MIN, TUNNEL_PORT_MAX + 1):
                if port not in used:
                    used.add(port)
                    return port
            return None

        if not row.ssh_port:
            port = next_free()
            if port is None:
                raise HTTPException(status_code=409, detail="No free ports available")
            row.ssh_port = port
        if not row.nodered_port:
            port = next_free()
            if port is None:
                raise HTTPException(status_code=409, detail="No free ports available")
            row.nodered_port = port
        if not row.web_ssh_port:
            port = next_free()
            if port is None:
                raise HTTPException(status_code=409, detail="No free ports available")
            row.web_ssh_port = port

        apply_tunnel_defaults(row)

        session.add(row)
        session.commit()
        session.refresh(row)
        return serialize_tunnel_config(row)
