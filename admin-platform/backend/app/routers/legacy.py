"""Legacy device endpoints - MySQL database integration."""

from fastapi import APIRouter, HTTPException, Request

from ..legacy_db import legacy_enabled, list_legacy_devices, get_legacy_device, update_legacy_device
from .deps import require_token
from .schemas import LegacyUpdateRequest

router = APIRouter(prefix="/legacy", tags=["legacy"])


@router.get("/devices")
def list_legacy(request: Request, limit: int = 500):
    """List all legacy devices from MySQL."""
    require_token(request)
    if not legacy_enabled():
        raise HTTPException(status_code=503, detail="Legacy DB not configured")
    try:
        return list_legacy_devices(limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Legacy DB error: {exc}")


@router.get("/devices/{identifier}")
def get_legacy(identifier: str, request: Request):
    """Get a single legacy device by ID or MAC."""
    require_token(request)
    if not legacy_enabled():
        raise HTTPException(status_code=503, detail="Legacy DB not configured")
    try:
        row = get_legacy_device(identifier)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Legacy DB error: {exc}")
    if not row:
        raise HTTPException(status_code=404, detail="Legacy device not found")
    return row


@router.post("/devices/{identifier}/update")
def update_legacy(identifier: str, body: LegacyUpdateRequest, request: Request):
    """Update a legacy device."""
    require_token(request)
    if not legacy_enabled():
        raise HTTPException(status_code=503, detail="Legacy DB not configured")
    updates = body.model_dump(exclude_none=True)
    try:
        row = update_legacy_device(identifier, updates)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Legacy DB error: {exc}")
    return row
