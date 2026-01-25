from datetime import datetime
import json
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, desc

from .db import Base, engine, SessionLocal
from .models import Device, Telemetry, Event
from .mqtt_bridge import bridge
from .settings import API_TOKEN

app = FastAPI(title="Admin Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class CommandRequest(BaseModel):
    action: str
    payload: Optional[dict] = None


class ApproveRequest(BaseModel):
    approved: bool = True


def require_token(request: Request) -> None:
    if not API_TOKEN:
        return
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    bridge.start()


@app.get("/devices")
def list_devices(request: Request):
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(select(Device)).scalars().all()
        return [
            {
                "id": d.id,
                "name": d.name,
                "status": d.status,
                "approved": d.approved,
                "last_seen": d.last_seen,
                "ip": d.ip,
                "url": d.url,
                "mac": d.mac,
            }
            for d in rows
        ]


@app.get("/devices/{device_id}")
def get_device(device_id: str, request: Request):
    require_token(request)
    with SessionLocal() as session:
        d = session.get(Device, device_id)
        if not d:
            raise HTTPException(status_code=404, detail="Device not found")
        return {
            "id": d.id,
            "name": d.name,
            "status": d.status,
            "approved": d.approved,
            "last_seen": d.last_seen,
            "ip": d.ip,
            "url": d.url,
            "mac": d.mac,
        }


@app.post("/devices/{device_id}/command")
def send_command(device_id: str, body: CommandRequest, request: Request):
    require_token(request)
    topic = f"devices/{device_id}/cmd/{body.action}"
    payload = body.payload or {}
    bridge.publish(topic, payload)
    return {"ok": True, "topic": topic}


@app.post("/devices/{device_id}/approve")
def approve_device(device_id: str, body: ApproveRequest, request: Request):
    require_token(request)
    if not body.approved:
        return {"ok": True}
    topic = f"devices/pending/{device_id}/cmd/approve"
    bridge.publish(topic, {})
    return {"ok": True, "topic": topic}


@app.get("/devices/{device_id}/telemetry")
def get_telemetry(device_id: str, request: Request, limit: int = 50):
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(
            select(Telemetry)
            .where(Telemetry.device_id == device_id)
            .order_by(desc(Telemetry.id))
            .limit(limit)
        ).scalars().all()
        return [
            {
                "id": r.id,
                "ts": r.ts,
                "payload": json.loads(r.payload) if r.payload else {},
            }
            for r in rows
        ]


@app.get("/devices/{device_id}/events")
def get_events(device_id: str, request: Request, limit: int = 100):
    require_token(request)
    with SessionLocal() as session:
        rows = session.execute(
            select(Event)
            .where(Event.device_id == device_id)
            .order_by(desc(Event.id))
            .limit(limit)
        ).scalars().all()
        return [
            {
                "id": r.id,
                "ts": r.ts,
                "type": r.type,
                "payload": json.loads(r.payload) if r.payload else {},
            }
            for r in rows
        ]
