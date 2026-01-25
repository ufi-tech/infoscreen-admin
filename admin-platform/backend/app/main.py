"""Admin Platform API - FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .mqtt_bridge import bridge
from .routers import devices, legacy, locations, customers, assignments, tunnels, logs

app = FastAPI(title="Admin Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include all routers
app.include_router(devices.router)
app.include_router(legacy.router)
app.include_router(locations.router)
app.include_router(customers.router)
app.include_router(assignments.router)
app.include_router(tunnels.router)
app.include_router(logs.router)


@app.on_event("startup")
def startup() -> None:
    """Initialize database and start MQTT bridge."""
    Base.metadata.create_all(bind=engine)
    bridge.start()
