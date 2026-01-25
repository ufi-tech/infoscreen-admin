from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
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
