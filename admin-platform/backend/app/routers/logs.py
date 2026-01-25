"""Device logs router"""
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, or_

from ..db import SessionLocal
from ..models import DeviceLog

router = APIRouter(prefix="/logs", tags=["logs"])


class LogCreate(BaseModel):
    device_id: Optional[str] = None
    legacy_id: Optional[int] = None
    level: str = "info"
    category: str = "system"
    message: str
    details: Optional[dict] = None


class LogResponse(BaseModel):
    id: int
    device_id: Optional[str]
    legacy_id: Optional[int]
    timestamp: datetime
    level: str
    category: str
    message: str
    details: Optional[str]

    class Config:
        from_attributes = True


def add_log(
    device_id: str = None,
    legacy_id: int = None,
    level: str = "info",
    category: str = "system",
    message: str = "",
    details: dict = None
):
    """Helper function to add a log entry from anywhere in the backend"""
    with SessionLocal() as session:
        log = DeviceLog(
            device_id=device_id,
            legacy_id=legacy_id,
            level=level,
            category=category,
            message=message,
            details=json.dumps(details) if details else None
        )
        session.add(log)
        session.commit()


@router.get("")
def get_logs(
    device_id: Optional[str] = None,
    legacy_id: Optional[int] = None,
    level: Optional[str] = None,
    category: Optional[str] = None,
    hours: int = Query(default=24, description="Get logs from last N hours"),
    limit: int = Query(default=100, le=500)
):
    """Get device logs with optional filters"""
    with SessionLocal() as session:
        query = select(DeviceLog)

        # Filter by device
        if device_id:
            query = query.where(DeviceLog.device_id == device_id)
        if legacy_id:
            query = query.where(DeviceLog.legacy_id == legacy_id)

        # Filter by level/category
        if level:
            query = query.where(DeviceLog.level == level)
        if category:
            query = query.where(DeviceLog.category == category)

        # Filter by time
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        query = query.where(DeviceLog.timestamp >= cutoff)

        # Order and limit
        query = query.order_by(desc(DeviceLog.timestamp)).limit(limit)

        logs = session.execute(query).scalars().all()
        return [LogResponse.model_validate(log) for log in logs]


@router.get("/device/{device_id}")
def get_device_logs(
    device_id: str,
    limit: int = Query(default=50, le=200)
):
    """Get logs for a specific MQTT device"""
    with SessionLocal() as session:
        query = (
            select(DeviceLog)
            .where(DeviceLog.device_id == device_id)
            .order_by(desc(DeviceLog.timestamp))
            .limit(limit)
        )
        logs = session.execute(query).scalars().all()
        return [LogResponse.model_validate(log) for log in logs]


@router.get("/legacy/{legacy_id}")
def get_legacy_logs(
    legacy_id: int,
    limit: int = Query(default=50, le=200)
):
    """Get logs for a specific legacy device"""
    with SessionLocal() as session:
        query = (
            select(DeviceLog)
            .where(DeviceLog.legacy_id == legacy_id)
            .order_by(desc(DeviceLog.timestamp))
            .limit(limit)
        )
        logs = session.execute(query).scalars().all()
        return [LogResponse.model_validate(log) for log in logs]


@router.post("")
def create_log(log_data: LogCreate):
    """Create a new log entry"""
    add_log(
        device_id=log_data.device_id,
        legacy_id=log_data.legacy_id,
        level=log_data.level,
        category=log_data.category,
        message=log_data.message,
        details=log_data.details
    )
    return {"status": "ok"}


@router.delete("")
def clear_old_logs(days: int = Query(default=30, description="Delete logs older than N days")):
    """Delete logs older than specified days"""
    with SessionLocal() as session:
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = session.execute(
            DeviceLog.__table__.delete().where(DeviceLog.timestamp < cutoff)
        )
        session.commit()
        return {"deleted": result.rowcount}
