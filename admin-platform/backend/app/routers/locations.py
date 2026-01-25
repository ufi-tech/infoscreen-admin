"""Location endpoints."""

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from ..db import SessionLocal
from ..models import Location
from .deps import require_token
from .schemas import LocationRequest

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("")
def list_locations(request: Request):
    """List all locations."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(select(Location)).scalars().all()
        return [
            {
                "id": r.id,
                "device_id": r.device_id,
                "legacy_id": r.legacy_id,
                "label": r.label,
                "address": r.address,
                "zip_code": r.zip_code,
                "lat": r.lat,
                "lon": r.lon,
                "notes": r.notes,
                "updated_at": r.updated_at,
            }
            for r in rows
        ]


@router.post("")
def upsert_location(body: LocationRequest, request: Request):
    """Create or update a location."""
    require_token(request)
    if not body.device_id and body.legacy_id is None:
        raise HTTPException(status_code=400, detail="device_id or legacy_id required")
    if body.device_id and body.legacy_id is not None:
        raise HTTPException(status_code=400, detail="Use only device_id or legacy_id")

    updates = body.model_dump(exclude_none=True)

    with SessionLocal() as session:
        if body.device_id:
            row = session.execute(
                select(Location).where(Location.device_id == body.device_id)
            ).scalars().first()
            if not row:
                row = Location(device_id=body.device_id)
        else:
            row = session.execute(
                select(Location).where(Location.legacy_id == body.legacy_id)
            ).scalars().first()
            if not row:
                row = Location(legacy_id=body.legacy_id)

        for key, value in updates.items():
            if key in ("device_id", "legacy_id"):
                continue
            setattr(row, key, value)

        session.add(row)
        session.commit()
        session.refresh(row)

        return {
            "id": row.id,
            "device_id": row.device_id,
            "legacy_id": row.legacy_id,
            "label": row.label,
            "address": row.address,
            "zip_code": row.zip_code,
            "lat": row.lat,
            "lon": row.lon,
            "notes": row.notes,
            "updated_at": row.updated_at,
        }
