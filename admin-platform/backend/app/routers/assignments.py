"""Assignment endpoints - device-to-customer mappings."""

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from ..db import SessionLocal
from ..models import Assignment, Customer
from .deps import require_token
from .schemas import AssignmentRequest

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("")
def list_assignments(request: Request):
    """List all device-to-customer assignments."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(select(Assignment)).scalars().all()
        return [
            {
                "id": r.id,
                "customer_id": r.customer_id,
                "device_id": r.device_id,
                "legacy_id": r.legacy_id,
                "updated_at": r.updated_at,
            }
            for r in rows
        ]


@router.post("")
def upsert_assignment(body: AssignmentRequest, request: Request):
    """Create or update a device-to-customer assignment."""
    require_token(request)
    if not body.device_id and body.legacy_id is None:
        raise HTTPException(status_code=400, detail="device_id or legacy_id required")
    if body.device_id and body.legacy_id is not None:
        raise HTTPException(status_code=400, detail="Use only device_id or legacy_id")

    with SessionLocal() as session:
        if body.device_id:
            existing = session.execute(
                select(Assignment).where(Assignment.device_id == body.device_id)
            ).scalars().first()
        else:
            existing = session.execute(
                select(Assignment).where(Assignment.legacy_id == body.legacy_id)
            ).scalars().first()

        if body.customer_id is None:
            if existing:
                session.delete(existing)
                session.commit()
            return {"ok": True}

        customer = session.get(Customer, body.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not existing:
            existing = Assignment(
                customer_id=body.customer_id,
                device_id=body.device_id,
                legacy_id=body.legacy_id,
            )
        else:
            existing.customer_id = body.customer_id

        session.add(existing)
        session.commit()
        session.refresh(existing)
        return {
            "id": existing.id,
            "customer_id": existing.customer_id,
            "device_id": existing.device_id,
            "legacy_id": existing.legacy_id,
            "updated_at": existing.updated_at,
        }
