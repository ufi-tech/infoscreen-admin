"""Customer endpoints."""

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from ..db import SessionLocal
from ..models import Customer
from .deps import require_token
from .schemas import CustomerRequest

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
def list_customers(request: Request):
    """List all customers."""
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(select(Customer)).scalars().all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "contact_name": r.contact_name,
                "email": r.email,
                "phone": r.phone,
                "notes": r.notes,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in rows
        ]


@router.post("")
def create_customer(body: CustomerRequest, request: Request):
    """Create a new customer."""
    require_token(request)
    if not body.name:
        raise HTTPException(status_code=400, detail="name required")
    with SessionLocal() as session:
        row = Customer(
            name=body.name,
            contact_name=body.contact_name or "",
            email=body.email or "",
            phone=body.phone or "",
            notes=body.notes or "",
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return {
            "id": row.id,
            "name": row.name,
            "contact_name": row.contact_name,
            "email": row.email,
            "phone": row.phone,
            "notes": row.notes,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }


@router.post("/{customer_id}")
def update_customer(customer_id: int, body: CustomerRequest, request: Request):
    """Update an existing customer."""
    require_token(request)
    with SessionLocal() as session:
        row = session.get(Customer, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        updates = body.model_dump(exclude_none=True)
        for key, value in updates.items():
            setattr(row, key, value)
        session.add(row)
        session.commit()
        session.refresh(row)
        return {
            "id": row.id,
            "name": row.name,
            "contact_name": row.contact_name,
            "email": row.email,
            "phone": row.phone,
            "notes": row.notes,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
