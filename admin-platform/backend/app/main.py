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


def run_migrations(conn, logger) -> None:
    """
    Run database migrations for SQLite.

    Adds new columns to existing tables without data loss.
    """
    cursor = conn.connection.cursor()

    # Get existing columns in customers table
    cursor.execute("PRAGMA table_info(customers)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    # New columns to add to customers table (for CMS provisioning)
    new_columns = [
        ("cms_subdomain", "TEXT"),
        ("cms_status", "TEXT DEFAULT 'none'"),
        ("cms_docker_port", "INTEGER"),
        ("cms_deploy_port", "INTEGER"),
        ("cms_api_key", "TEXT"),
        ("cms_admin_password", "TEXT"),
        ("cms_provisioned_at", "DATETIME"),
    ]

    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            logger.info(f"Adding column {col_name} to customers table")
            try:
                cursor.execute(f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                logger.warning(f"Could not add column {col_name}: {e}")

    conn.connection.commit()


@app.on_event("startup")
def startup() -> None:
    """Initialize database and start MQTT bridge."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.info("Starting Admin Platform API...")
    Base.metadata.create_all(bind=engine)

    # Run migrations for existing tables
    with engine.connect() as conn:
        run_migrations(conn, logger)

    logger.info("Database initialized, starting MQTT bridge...")
    bridge.start()
    logger.info("MQTT bridge started")
