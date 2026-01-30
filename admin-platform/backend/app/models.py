from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Float
from sqlalchemy.sql import func
from .db import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, default="")
    status = Column(String, default="unknown")
    approved = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    ip = Column(String, default="")
    url = Column(String, default="")
    mac = Column(String, default="")
    # Fully Kiosk Browser specific
    fully_password = Column(String, default="")  # REST API password for Fully devices


class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    ts = Column(Integer)
    payload = Column(Text)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    ts = Column(Integer)
    type = Column(String, default="")
    payload = Column(Text)


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True, nullable=True)
    legacy_id = Column(Integer, index=True, nullable=True)
    label = Column(String, default="")
    address = Column(String, default="")
    zip_code = Column(String, default="")
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    notes = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="")
    contact_name = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Extended business information
    cvr = Column(String, nullable=True)  # Danish CVR number
    address = Column(String, nullable=True)  # Street address
    zip_code = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, default="Danmark")
    website = Column(String, nullable=True)
    invoice_email = Column(String, nullable=True)  # Separate email for invoices
    contact_name_2 = Column(String, nullable=True)  # Secondary contact
    contact_phone_2 = Column(String, nullable=True)
    contact_email_2 = Column(String, nullable=True)

    # CMS Configuration (for auto-provisioned CMS instances)
    cms_subdomain = Column(String, nullable=True, unique=True)  # "broerup" → broerup.screen.iocast.dk
    cms_status = Column(String, default="none")  # none, pending, provisioning, active, stopped, error
    cms_docker_port = Column(Integer, nullable=True)  # e.g., 45770
    cms_deploy_port = Column(Integer, nullable=True)  # e.g., 9007
    cms_api_key = Column(String, nullable=True)  # For calling CMS external API
    cms_admin_password = Column(String, nullable=True)  # Generated admin password (encrypted)
    cms_provisioned_at = Column(DateTime(timezone=True), nullable=True)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, index=True)
    device_id = Column(String, index=True, nullable=True)
    legacy_id = Column(Integer, index=True, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TunnelConfig(Base):
    __tablename__ = "tunnel_configs"

    device_id = Column(String, primary_key=True, index=True)
    host = Column(String, default="")
    user = Column(String, default="")
    key_path = Column(String, default="")
    tunnel_port = Column(Integer, nullable=True)
    ssh_port = Column(Integer, nullable=True)
    nodered_port = Column(Integer, nullable=True)
    web_ssh_port = Column(Integer, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DeviceLog(Base):
    """Log of device activities and events"""
    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    legacy_id = Column(Integer, index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    level = Column(String, default="info")  # info, warning, error, success
    category = Column(String, default="system")  # system, command, status, mqtt, user
    message = Column(String, default="")
    details = Column(Text, nullable=True)  # JSON for extra data


class CustomerCode(Base):
    """
    Provisioning codes for IOCast Android/TV devices.
    Each code maps to a customer and contains device configuration.
    """
    __tablename__ = "customer_codes"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, index=True)  # References customers.id
    code = Column(String, unique=True, index=True)  # e.g., "4821"
    auto_approve = Column(Boolean, default=True)  # Auto-approve or manual
    start_url = Column(String, default="https://iocast.dk")
    kiosk_mode = Column(Boolean, default=True)
    keep_screen_on = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PortalUser(Base):
    """
    Portal users for customer self-service at portal.iocast.dk.
    Each user belongs to a customer and can manage their devices/content.
    """
    __tablename__ = "portal_users"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, index=True)  # References customers.id
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="admin")  # admin, editor, viewer
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DeviceAssignment(Base):
    """
    Extended device-to-customer assignment with screen mapping.
    Tracks which CMS screen a device should display.
    """
    __tablename__ = "device_assignments"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True)  # MQTT device ID
    customer_id = Column(Integer, index=True)  # References customers.id
    screen_uuid = Column(String, nullable=True)  # UUID from customer's CMS
    display_url = Column(String, nullable=True)  # Full URL to CMS screen
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_by = Column(String, nullable=True)  # Admin username who made assignment
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
