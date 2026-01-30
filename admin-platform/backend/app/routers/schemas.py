"""Pydantic schemas for API requests."""

from typing import Optional
from pydantic import BaseModel


class CommandRequest(BaseModel):
    action: str
    payload: Optional[dict] = None


class ApproveRequest(BaseModel):
    approved: bool = True


class LegacyUpdateRequest(BaseModel):
    url: Optional[str] = None
    support: Optional[int] = None
    tv_on: Optional[int] = None
    hdmistart: Optional[str] = None
    hdmistop: Optional[str] = None
    delay_dmi: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    description: Optional[str] = None
    company_name: Optional[str] = None
    zip_code: Optional[str] = None
    mail: Optional[str] = None
    sms: Optional[int] = None
    kirke: Optional[int] = None
    camera: Optional[str] = None


class LocationRequest(BaseModel):
    device_id: Optional[str] = None
    legacy_id: Optional[int] = None
    label: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    notes: Optional[str] = None


class CustomerRequest(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    # Extended business information
    cvr: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    invoice_email: Optional[str] = None
    contact_name_2: Optional[str] = None
    contact_phone_2: Optional[str] = None
    contact_email_2: Optional[str] = None
    # CMS provisioning fields
    cms_subdomain: Optional[str] = None
    auto_provision: Optional[bool] = False  # If true, auto-provision CMS on create


class AssignmentRequest(BaseModel):
    customer_id: Optional[int] = None
    device_id: Optional[str] = None
    legacy_id: Optional[int] = None


class DeviceAssignmentRequest(BaseModel):
    device_id: str
    screen_uuid: Optional[str] = None  # Optional: also set screen


class PortalUserRequest(BaseModel):
    email: str
    password: Optional[str] = None  # Only required for create
    role: Optional[str] = "admin"  # admin, editor, viewer
    is_active: Optional[bool] = True


class TunnelConfigRequest(BaseModel):
    host: Optional[str] = None
    user: Optional[str] = None
    key_path: Optional[str] = None
    tunnel_port: Optional[int] = None
    ssh_port: Optional[int] = None
    nodered_port: Optional[int] = None
    web_ssh_port: Optional[int] = None


class TunnelPortRequest(BaseModel):
    force: Optional[bool] = False


class FullyPasswordRequest(BaseModel):
    password: str


class ScreenAssignmentRequest(BaseModel):
    screen_uuid: Optional[str] = None  # UUID of the CMS screen to display
