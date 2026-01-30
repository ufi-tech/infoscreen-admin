"""Customer endpoints with device assignment and CMS management."""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel
import logging

from ..db import SessionLocal
from ..models import Customer, Device, DeviceAssignment, PortalUser
from ..mqtt_bridge import bridge as mqtt_bridge
from ..services.cms_provisioner import get_provisioner
from .deps import require_token
from .schemas import CustomerRequest, DeviceAssignmentRequest, PortalUserRequest

logger = logging.getLogger(__name__)


# Additional schemas for CMS provisioning
class CMSProvisionRequest(BaseModel):
    subdomain: str
    display_name: Optional[str] = None  # Uses customer name if not provided
router = APIRouter(prefix="/customers", tags=["customers"])


def _customer_to_dict(r: Customer, device_count: int = 0) -> dict:
    """Convert Customer model to dict response."""
    return {
        "id": r.id,
        "name": r.name,
        "contact_name": r.contact_name,
        "email": r.email,
        "phone": r.phone,
        "notes": r.notes,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        # Extended business information
        "cvr": r.cvr,
        "address": r.address,
        "zip_code": r.zip_code,
        "city": r.city,
        "country": r.country,
        "website": r.website,
        "invoice_email": r.invoice_email,
        "contact_name_2": r.contact_name_2,
        "contact_phone_2": r.contact_phone_2,
        "contact_email_2": r.contact_email_2,
        # CMS fields
        "cms_subdomain": r.cms_subdomain,
        "cms_status": r.cms_status,
        "cms_docker_port": r.cms_docker_port,
        "cms_deploy_port": r.cms_deploy_port,
        "cms_provisioned_at": r.cms_provisioned_at,
        # Computed
        "device_count": device_count,
        "cms_url": f"https://{r.cms_subdomain}.screen.iocast.dk" if r.cms_subdomain else None,
    }


@router.get("")
def list_customers(request: Request):
    """List all customers with device counts."""
    require_token(request)
    with SessionLocal() as session:
        # Get customers with device counts
        rows = session.execute(select(Customer)).scalars().all()
        result = []
        for r in rows:
            # Count assigned devices
            device_count = session.execute(
                select(func.count(DeviceAssignment.id)).where(DeviceAssignment.customer_id == r.id)
            ).scalar() or 0
            result.append(_customer_to_dict(r, device_count))
        return result


# Note: Static routes must come BEFORE parameterized routes like /{customer_id}
@router.get("/cms/next-ports")
def get_next_cms_ports(request: Request):
    """
    Get the next available ports for CMS provisioning.

    Useful for planning or manual provisioning.
    """
    require_token(request)

    provisioner = get_provisioner()
    ports = provisioner.get_next_available_ports()

    return {
        "next_web_port": ports["web_port"],
        "next_deploy_port": ports["deploy_port"]
    }


@router.get("/unassigned-devices", tags=["devices"])
def list_unassigned_devices_static(request: Request):
    """List all devices not assigned to any customer (static route)."""
    require_token(request)
    with SessionLocal() as session:
        # Get all assigned device IDs
        assigned_ids = session.execute(
            select(DeviceAssignment.device_id)
        ).scalars().all()

        # Get devices not in assigned list
        if assigned_ids:
            devices = session.execute(
                select(Device).where(~Device.id.in_(assigned_ids))
            ).scalars().all()
        else:
            devices = session.execute(select(Device)).scalars().all()

        return [
            {
                "id": d.id,
                "name": d.name,
                "status": d.status,
                "ip": d.ip,
                "last_seen": d.last_seen,
                "approved": d.approved,
            }
            for d in devices
        ]


@router.post("")
def create_customer(body: CustomerRequest, request: Request):
    """Create a new customer. Optionally auto-provision CMS."""
    require_token(request)
    if not body.name:
        raise HTTPException(status_code=400, detail="name required")

    with SessionLocal() as session:
        # Check if subdomain is already taken
        if body.cms_subdomain:
            existing = session.execute(
                select(Customer).where(Customer.cms_subdomain == body.cms_subdomain)
            ).scalar()
            if existing:
                raise HTTPException(status_code=400, detail="CMS subdomain already in use")

        row = Customer(
            name=body.name,
            contact_name=body.contact_name or "",
            email=body.email or "",
            phone=body.phone or "",
            notes=body.notes or "",
            # Extended business information
            cvr=body.cvr,
            address=body.address,
            zip_code=body.zip_code,
            city=body.city,
            country=body.country or "Danmark",
            website=body.website,
            invoice_email=body.invoice_email,
            contact_name_2=body.contact_name_2,
            contact_phone_2=body.contact_phone_2,
            contact_email_2=body.contact_email_2,
            # CMS
            cms_subdomain=body.cms_subdomain,
            cms_status="pending" if body.cms_subdomain else "none",
        )
        session.add(row)
        session.commit()
        session.refresh(row)

        # TODO: If auto_provision is True and cms_subdomain is set,
        # trigger CMS provisioning via cms_provisioner service
        if body.auto_provision and body.cms_subdomain:
            logger.info(f"Auto-provision requested for customer {row.id} with subdomain {body.cms_subdomain}")
            # This will be implemented in Fase 5
            # from ..services.cms_provisioner import provision_customer_cms
            # provision_customer_cms(row.id, body.cms_subdomain, body.name)

        return _customer_to_dict(row, device_count=0)


@router.get("/{customer_id}")
def get_customer(customer_id: int, request: Request):
    """Get customer details including assigned devices."""
    require_token(request)
    with SessionLocal() as session:
        row = session.get(Customer, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Count devices
        device_count = session.execute(
            select(func.count(DeviceAssignment.id)).where(DeviceAssignment.customer_id == customer_id)
        ).scalar() or 0

        return _customer_to_dict(row, device_count)


@router.put("/{customer_id}")
def update_customer(customer_id: int, body: CustomerRequest, request: Request):
    """Update an existing customer."""
    require_token(request)
    with SessionLocal() as session:
        row = session.get(Customer, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Exclude auto_provision from updates (it's only for create)
        updates = body.model_dump(exclude_none=True, exclude={"auto_provision"})
        for key, value in updates.items():
            if hasattr(row, key):
                setattr(row, key, value)

        session.add(row)
        session.commit()
        session.refresh(row)

        device_count = session.execute(
            select(func.count(DeviceAssignment.id)).where(DeviceAssignment.customer_id == customer_id)
        ).scalar() or 0

        return _customer_to_dict(row, device_count)


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, request: Request):
    """Delete a customer (also removes device assignments)."""
    require_token(request)
    with SessionLocal() as session:
        row = session.get(Customer, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Remove device assignments first
        session.execute(
            select(DeviceAssignment).where(DeviceAssignment.customer_id == customer_id)
        )
        for assignment in session.execute(
            select(DeviceAssignment).where(DeviceAssignment.customer_id == customer_id)
        ).scalars().all():
            session.delete(assignment)

        # Remove portal users
        for user in session.execute(
            select(PortalUser).where(PortalUser.customer_id == customer_id)
        ).scalars().all():
            session.delete(user)

        session.delete(row)
        session.commit()

        return {"status": "deleted", "id": customer_id}


# ============================================================================
# Device Assignment Endpoints
# ============================================================================

@router.get("/{customer_id}/devices")
def list_customer_devices(customer_id: int, request: Request):
    """List all devices assigned to a customer."""
    require_token(request)
    with SessionLocal() as session:
        # Verify customer exists
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Get assignments with device info
        assignments = session.execute(
            select(DeviceAssignment).where(DeviceAssignment.customer_id == customer_id)
        ).scalars().all()

        result = []
        for a in assignments:
            # Get device info
            device = session.execute(
                select(Device).where(Device.id == a.device_id)
            ).scalar()

            result.append({
                "assignment_id": a.id,
                "device_id": a.device_id,
                "screen_uuid": a.screen_uuid,
                "display_url": a.display_url,
                "assigned_at": a.assigned_at,
                "assigned_by": a.assigned_by,
                # Device info (if exists in MQTT devices)
                "device": {
                    "id": device.id,
                    "name": device.name,
                    "status": device.status,
                    "ip": device.ip,
                    "last_seen": device.last_seen,
                } if device else None,
            })

        return result


@router.post("/{customer_id}/devices")
def assign_device_to_customer(
    customer_id: int,
    body: DeviceAssignmentRequest,
    request: Request
):
    """Assign a device to a customer."""
    require_token(request)
    with SessionLocal() as session:
        # Verify customer exists
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Check if device is already assigned
        existing = session.execute(
            select(DeviceAssignment).where(DeviceAssignment.device_id == body.device_id)
        ).scalar()

        if existing:
            if existing.customer_id == customer_id:
                raise HTTPException(status_code=400, detail="Device already assigned to this customer")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Device already assigned to customer ID {existing.customer_id}"
                )

        # Compute display URL if customer has CMS and screen_uuid provided
        display_url = None
        if body.screen_uuid and customer.cms_subdomain:
            display_url = f"https://{customer.cms_subdomain}.screen.iocast.dk/screen/{body.screen_uuid}"

        # Create assignment
        assignment = DeviceAssignment(
            device_id=body.device_id,
            customer_id=customer_id,
            screen_uuid=body.screen_uuid,
            display_url=display_url,
            assigned_by="admin",  # TODO: Get from auth
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)

        logger.info(f"Device {body.device_id} assigned to customer {customer_id}")

        # Send MQTT loadUrl command if display_url is set
        if display_url:
            try:
                mqtt_bridge.publish(
                    f"devices/{body.device_id}/cmd/loadUrl",
                    {"url": display_url}
                )
                logger.info(f"MQTT loadUrl sent to {body.device_id}: {display_url}")
            except Exception as e:
                logger.error(f"Failed to send MQTT loadUrl: {e}")
                # Don't fail the request - assignment is already saved

        # Get device info
        device = session.execute(
            select(Device).where(Device.id == body.device_id)
        ).scalar()

        return {
            "assignment_id": assignment.id,
            "device_id": assignment.device_id,
            "customer_id": assignment.customer_id,
            "screen_uuid": assignment.screen_uuid,
            "display_url": assignment.display_url,
            "assigned_at": assignment.assigned_at,
            "mqtt_command_sent": bool(display_url),
            "device": {
                "id": device.id,
                "name": device.name,
                "status": device.status,
            } if device else None,
        }


@router.put("/{customer_id}/devices/{device_id}")
def update_device_assignment(
    customer_id: int,
    device_id: str,
    body: DeviceAssignmentRequest,
    request: Request
):
    """Update a device assignment (change screen_uuid)."""
    require_token(request)
    with SessionLocal() as session:
        # Get existing assignment
        assignment = session.execute(
            select(DeviceAssignment).where(
                DeviceAssignment.customer_id == customer_id,
                DeviceAssignment.device_id == device_id
            )
        ).scalar()

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        # Get customer for CMS subdomain
        customer = session.get(Customer, customer_id)

        # Update screen_uuid and compute new display_url
        old_screen_uuid = assignment.screen_uuid
        assignment.screen_uuid = body.screen_uuid

        if body.screen_uuid and customer and customer.cms_subdomain:
            assignment.display_url = f"https://{customer.cms_subdomain}.screen.iocast.dk/screen/{body.screen_uuid}"
        elif not body.screen_uuid:
            assignment.display_url = None

        session.commit()
        session.refresh(assignment)

        logger.info(f"Device {device_id} screen updated: {old_screen_uuid} -> {body.screen_uuid}")

        # Send MQTT loadUrl command if display_url is set
        mqtt_sent = False
        if assignment.display_url:
            try:
                mqtt_bridge.publish(
                    f"devices/{device_id}/cmd/loadUrl",
                    {"url": assignment.display_url}
                )
                mqtt_sent = True
                logger.info(f"MQTT loadUrl sent to {device_id}: {assignment.display_url}")
            except Exception as e:
                logger.error(f"Failed to send MQTT loadUrl: {e}")

        return {
            "assignment_id": assignment.id,
            "device_id": assignment.device_id,
            "customer_id": assignment.customer_id,
            "screen_uuid": assignment.screen_uuid,
            "display_url": assignment.display_url,
            "updated_at": assignment.updated_at,
            "mqtt_command_sent": mqtt_sent,
        }


@router.delete("/{customer_id}/devices/{device_id}")
def remove_device_from_customer(customer_id: int, device_id: str, request: Request):
    """Remove a device assignment from a customer."""
    require_token(request)
    with SessionLocal() as session:
        assignment = session.execute(
            select(DeviceAssignment).where(
                DeviceAssignment.customer_id == customer_id,
                DeviceAssignment.device_id == device_id
            )
        ).scalar()

        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        session.delete(assignment)
        session.commit()

        logger.info(f"Device {device_id} removed from customer {customer_id}")

        return {"status": "removed", "device_id": device_id, "customer_id": customer_id}


# ============================================================================
# CMS Screen Endpoints (for Fase 3: Screen Assignment)
# ============================================================================

@router.get("/{customer_id}/screens")
async def list_customer_screens(customer_id: int, request: Request):
    """
    List available screens from customer's CMS.

    This calls the customer's CMS external API to get available screens.
    Requires customer to have CMS configured (cms_subdomain and cms_api_key).
    """
    require_token(request)
    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not customer.cms_subdomain:
            raise HTTPException(status_code=400, detail="Customer has no CMS configured")

        if not customer.cms_api_key:
            raise HTTPException(status_code=400, detail="Customer CMS API key not configured")

    # Use CMS client to fetch screens
    from ..services.cms_client import get_cms_client

    client = get_cms_client(customer)
    if not client:
        raise HTTPException(status_code=400, detail="Could not create CMS client")

    result = await client.list_screens()

    if not result.get('success'):
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch screens from CMS: {result.get('error', 'Unknown error')}"
        )

    return {
        "customer_id": customer_id,
        "cms_subdomain": customer.cms_subdomain,
        "screens": result.get('screens', []),
        "count": result.get('count', 0)
    }


@router.get("/{customer_id}/screens/{screen_uuid}")
async def get_customer_screen(customer_id: int, screen_uuid: str, request: Request):
    """
    Get details for a specific screen from customer's CMS.
    """
    require_token(request)
    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not customer.cms_subdomain or not customer.cms_api_key:
            raise HTTPException(status_code=400, detail="Customer CMS not configured")

    from ..services.cms_client import get_cms_client

    client = get_cms_client(customer)
    result = await client.get_screen(screen_uuid)

    if not result.get('success'):
        error = result.get('error', 'Unknown error')
        if error == 'Screen not found':
            raise HTTPException(status_code=404, detail="Screen not found")
        raise HTTPException(status_code=502, detail=f"Failed to fetch screen: {error}")

    return {
        "customer_id": customer_id,
        "screen": result.get('screen'),
        "media": result.get('media', [])
    }


@router.get("/{customer_id}/cms/info")
async def get_customer_cms_info(customer_id: int, request: Request):
    """
    Get CMS information for a customer (health, statistics).
    """
    require_token(request)
    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not customer.cms_subdomain:
            return {
                "customer_id": customer_id,
                "cms_configured": False,
                "cms_status": customer.cms_status or "none"
            }

    from ..services.cms_client import get_cms_client

    client = get_cms_client(customer)
    if not client:
        return {
            "customer_id": customer_id,
            "cms_configured": True,
            "cms_status": customer.cms_status,
            "cms_subdomain": customer.cms_subdomain,
            "api_key_configured": False
        }

    # Check health (no API key needed)
    health = await client.health_check()

    # Get info (needs API key)
    info = await client.get_info()

    return {
        "customer_id": customer_id,
        "cms_configured": True,
        "cms_status": customer.cms_status,
        "cms_subdomain": customer.cms_subdomain,
        "cms_url": f"https://{customer.cms_subdomain}.screen.iocast.dk",
        "api_key_configured": bool(customer.cms_api_key),
        "health": health if health.get('success') else None,
        "info": info if info.get('success') else None
    }


# ============================================================================
# CMS Provisioning Endpoints
# ============================================================================

@router.post("/{customer_id}/cms/provision")
async def provision_customer_cms(
    customer_id: int,
    body: CMSProvisionRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Provision a new CMS instance for a customer.

    This creates:
    - GitHub repository: ufi-tech/{subdomain}-infoskaerm
    - Docker containers on ufitech-docker-01
    - Caddy reverse proxy configuration
    - Auto-deploy webhook

    The provisioning runs in the background. Check status with GET /customers/{id}/cms/status
    """
    require_token(request)

    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer.cms_status == "active":
            raise HTTPException(status_code=400, detail="CMS already provisioned")

        if customer.cms_status == "provisioning":
            raise HTTPException(status_code=400, detail="CMS provisioning already in progress")

    provisioner = get_provisioner()

    # Validate subdomain
    if not provisioner.validate_subdomain(body.subdomain):
        raise HTTPException(
            status_code=400,
            detail="Invalid subdomain. Use lowercase letters, numbers, and hyphens only (3-63 chars)."
        )

    display_name = body.display_name or customer.name

    logger.info(f"Starting CMS provisioning for customer {customer_id}: {body.subdomain}")

    # Run provisioning (can be long-running)
    result = await provisioner.provision(
        customer_id=customer_id,
        subdomain=body.subdomain,
        display_name=display_name
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Provisioning failed"))

    return {
        "status": "success",
        "customer_id": customer_id,
        "cms_subdomain": body.subdomain,
        "cms_url": result.get("cms_url"),
        "login_url": result.get("login_url"),
        "admin_username": "admin",
        "admin_password": result.get("admin_password"),
        "api_key": result.get("api_key"),
        "simulated": result.get("simulated", False)
    }


@router.get("/{customer_id}/cms/status")
def get_cms_status(customer_id: int, request: Request):
    """Get CMS provisioning status for a customer."""
    require_token(request)

    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        return {
            "customer_id": customer_id,
            "cms_subdomain": customer.cms_subdomain,
            "cms_status": customer.cms_status,
            "cms_docker_port": customer.cms_docker_port,
            "cms_deploy_port": customer.cms_deploy_port,
            "cms_provisioned_at": customer.cms_provisioned_at,
            "cms_url": f"https://{customer.cms_subdomain}.screen.iocast.dk" if customer.cms_subdomain else None,
            "login_url": f"https://{customer.cms_subdomain}.screen.iocast.dk/login" if customer.cms_subdomain else None
        }


@router.get("/{customer_id}/cms/credentials")
def get_cms_credentials(customer_id: int, request: Request):
    """
    Get CMS credentials for a customer.

    Returns admin username/password and API key.
    Only available after successful provisioning.
    """
    require_token(request)

    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer.cms_status != "active":
            raise HTTPException(status_code=400, detail="CMS not provisioned")

        return {
            "customer_id": customer_id,
            "cms_subdomain": customer.cms_subdomain,
            "cms_url": f"https://{customer.cms_subdomain}.screen.iocast.dk",
            "login_url": f"https://{customer.cms_subdomain}.screen.iocast.dk/login",
            "admin_username": "admin",
            "admin_password": customer.cms_admin_password,
            "api_key": customer.cms_api_key
        }


@router.post("/{customer_id}/cms/stop")
async def stop_customer_cms(customer_id: int, request: Request):
    """Stop a customer's CMS containers."""
    require_token(request)

    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer.cms_status not in ["active", "error"]:
            raise HTTPException(status_code=400, detail="CMS not running")

    provisioner = get_provisioner()
    result = await provisioner.stop_cms(customer_id)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to stop CMS"))

    return {"status": "stopped", "customer_id": customer_id}


@router.post("/{customer_id}/cms/start")
async def start_customer_cms(customer_id: int, request: Request):
    """Start a customer's CMS containers."""
    require_token(request)

    with SessionLocal() as session:
        customer = session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer.cms_status != "stopped":
            raise HTTPException(status_code=400, detail="CMS not in stopped state")

    provisioner = get_provisioner()
    result = await provisioner.start_cms(customer_id)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to start CMS"))

    return {"status": "started", "customer_id": customer_id}
