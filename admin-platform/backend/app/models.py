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
