"""Customer provisioning codes API endpoints.

Manages 4-digit provisioning codes that IOCast Android/TV devices use
to receive their configuration (URL, MQTT credentials, etc.)
"""

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
import logging
import random
import string

from ..db import SessionLocal
from ..models import CustomerCode, Customer
from .deps import require_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customer-codes", tags=["customer-codes"])


class CustomerCodeRequest(BaseModel):
    """Request body for creating/updating a customer code."""
    code: Optional[str] = None  # Auto-generated if not provided
    customer_id: int
    start_url: str
    auto_approve: bool = True
    kiosk_mode: bool = True
    keep_screen_on: bool = True


class CustomerCodeResponse(BaseModel):
    """Response for customer code operations."""
    id: int
    code: str
    customer_id: int
    customer_name: Optional[str] = None
    start_url: str
    auto_approve: bool
    kiosk_mode: bool
    keep_screen_on: bool
    created_at: str
    updated_at: str


def _generate_unique_code(session) -> str:
    """Generate a unique 4-digit code."""
    for _ in range(100):  # Max attempts
        code = "".join(random.choices(string.digits, k=4))
        existing = session.execute(
            select(CustomerCode).where(CustomerCode.code == code)
        ).scalar()
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique code")


def _code_to_dict(code: CustomerCode, customer_name: Optional[str] = None) -> dict:
    """Convert CustomerCode model to dict response."""
    return {
        "id": code.id,
        "code": code.code,
        "customer_id": code.customer_id,
        "customer_name": customer_name,
        "start_url": code.start_url,
        "auto_approve": code.auto_approve,
        "kiosk_mode": code.kiosk_mode,
        "keep_screen_on": code.keep_screen_on,
        "created_at": code.created_at.isoformat() if code.created_at else None,
        "updated_at": code.updated_at.isoformat() if code.updated_at else None,
    }


@router.get("")
def list_customer_codes(request: Request, customer_id: Optional[int] = None):
    """
    List all customer codes, optionally filtered by customer_id.

    Query params:
        customer_id: Optional filter by customer
    """
    require_token(request)
    with SessionLocal() as session:
        query = select(CustomerCode)
        if customer_id is not None:
            query = query.where(CustomerCode.customer_id == customer_id)

        codes = session.execute(query).scalars().all()

        result = []
        for code in codes:
            # Get customer name
            customer = session.get(Customer, code.customer_id)
            customer_name = customer.name if customer else None
            result.append(_code_to_dict(code, customer_name))

        return result


@router.get("/{code_id}")
def get_customer_code(code_id: int, request: Request):
    """Get a specific customer code by ID."""
    require_token(request)
    with SessionLocal() as session:
        code = session.get(CustomerCode, code_id)
        if not code:
            raise HTTPException(status_code=404, detail="Customer code not found")

        customer = session.get(Customer, code.customer_id)
        customer_name = customer.name if customer else None

        return _code_to_dict(code, customer_name)


@router.get("/by-code/{code}")
def get_customer_code_by_code(code: str, request: Request):
    """
    Get a customer code by the 4-digit code itself.

    Useful for looking up a code without knowing its database ID.
    """
    require_token(request)
    with SessionLocal() as session:
        code_record = session.execute(
            select(CustomerCode).where(CustomerCode.code == code)
        ).scalar()

        if not code_record:
            raise HTTPException(status_code=404, detail="Customer code not found")

        customer = session.get(Customer, code_record.customer_id)
        customer_name = customer.name if customer else None

        return _code_to_dict(code_record, customer_name)


@router.post("")
def create_customer_code(body: CustomerCodeRequest, request: Request):
    """
    Create a new provisioning code for a customer.

    If `code` is not provided, a unique 4-digit code will be auto-generated.

    The code is used by IOCast Android/TV devices during provisioning:
    1. User enters the 4-digit code on device
    2. Device sends MQTT message to provision/{code}/request
    3. Backend looks up this code and responds with config
    4. Device receives URL, MQTT credentials, and settings
    """
    require_token(request)

    with SessionLocal() as session:
        # Verify customer exists
        customer = session.get(Customer, body.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Generate or validate code
        if body.code:
            # Check if code is exactly 4 digits
            if not body.code.isdigit() or len(body.code) != 4:
                raise HTTPException(
                    status_code=400,
                    detail="Code must be exactly 4 digits"
                )
            # Check if code already exists
            existing = session.execute(
                select(CustomerCode).where(CustomerCode.code == body.code)
            ).scalar()
            if existing:
                raise HTTPException(status_code=400, detail="Code already exists")
            code_value = body.code
        else:
            code_value = _generate_unique_code(session)

        # Create the code record
        code_record = CustomerCode(
            code=code_value,
            customer_id=body.customer_id,
            start_url=body.start_url,
            auto_approve=body.auto_approve,
            kiosk_mode=body.kiosk_mode,
            keep_screen_on=body.keep_screen_on,
        )
        session.add(code_record)
        session.commit()
        session.refresh(code_record)

        logger.info(f"Created customer code {code_value} for customer {body.customer_id}")

        return _code_to_dict(code_record, customer.name)


@router.put("/{code_id}")
def update_customer_code(code_id: int, body: CustomerCodeRequest, request: Request):
    """
    Update an existing customer code.

    Note: The code itself (4-digit number) cannot be changed.
    To change the code, delete and create a new one.
    """
    require_token(request)

    with SessionLocal() as session:
        code_record = session.get(CustomerCode, code_id)
        if not code_record:
            raise HTTPException(status_code=404, detail="Customer code not found")

        # Verify new customer exists if changing customer
        if body.customer_id != code_record.customer_id:
            customer = session.get(Customer, body.customer_id)
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")

        # Update fields (except code itself)
        code_record.customer_id = body.customer_id
        code_record.start_url = body.start_url
        code_record.auto_approve = body.auto_approve
        code_record.kiosk_mode = body.kiosk_mode
        code_record.keep_screen_on = body.keep_screen_on

        session.commit()
        session.refresh(code_record)

        customer = session.get(Customer, code_record.customer_id)
        customer_name = customer.name if customer else None

        logger.info(f"Updated customer code {code_record.code}")

        return _code_to_dict(code_record, customer_name)


@router.delete("/{code_id}")
def delete_customer_code(code_id: int, request: Request):
    """Delete a customer code."""
    require_token(request)

    with SessionLocal() as session:
        code_record = session.get(CustomerCode, code_id)
        if not code_record:
            raise HTTPException(status_code=404, detail="Customer code not found")

        code_value = code_record.code
        session.delete(code_record)
        session.commit()

        logger.info(f"Deleted customer code {code_value}")

        return {"status": "deleted", "code": code_value}
