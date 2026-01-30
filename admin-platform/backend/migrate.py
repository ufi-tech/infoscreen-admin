#!/usr/bin/env python3
"""
Database migration script for IOCast Admin.
Adds new columns and tables for Fase 1-3 features.

Run inside Docker:
    docker-compose exec backend python migrate.py
"""

import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "/data/app.db")


def get_existing_columns(cursor, table_name):
    """Get list of existing column names for a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def get_existing_tables(cursor):
    """Get list of existing table names."""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def migrate():
    """Run all migrations."""
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    existing_tables = get_existing_tables(cursor)
    print(f"Existing tables: {existing_tables}")

    # =========================================================================
    # CUSTOMERS TABLE - Add CMS fields
    # =========================================================================
    if "customers" in existing_tables:
        existing_cols = get_existing_columns(cursor, "customers")
        print(f"Existing customers columns: {existing_cols}")

        cms_columns = [
            ("cms_subdomain", "TEXT"),
            ("cms_status", "TEXT DEFAULT 'none'"),
            ("cms_docker_port", "INTEGER"),
            ("cms_deploy_port", "INTEGER"),
            ("cms_api_key", "TEXT"),
            ("cms_admin_password", "TEXT"),
            ("cms_provisioned_at", "DATETIME"),
        ]

        for col_name, col_type in cms_columns:
            if col_name not in existing_cols:
                sql = f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}"
                print(f"  Adding column: {col_name}")
                cursor.execute(sql)
            else:
                print(f"  Column exists: {col_name}")

    # =========================================================================
    # DEVICES TABLE - Add fully_password field
    # =========================================================================
    if "devices" in existing_tables:
        existing_cols = get_existing_columns(cursor, "devices")
        print(f"Existing devices columns: {existing_cols}")

        if "fully_password" not in existing_cols:
            print("  Adding column: fully_password")
            cursor.execute("ALTER TABLE devices ADD COLUMN fully_password TEXT DEFAULT ''")
        else:
            print("  Column exists: fully_password")

    # =========================================================================
    # PORTAL_USERS TABLE - New table
    # =========================================================================
    if "portal_users" not in existing_tables:
        print("Creating table: portal_users")
        cursor.execute("""
            CREATE TABLE portal_users (
                id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                role TEXT DEFAULT 'admin',
                is_active INTEGER DEFAULT 1,
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX idx_portal_users_customer ON portal_users(customer_id)")
        cursor.execute("CREATE INDEX idx_portal_users_email ON portal_users(email)")
    else:
        print("Table exists: portal_users")

    # =========================================================================
    # DEVICE_ASSIGNMENTS TABLE - New table
    # =========================================================================
    if "device_assignments" not in existing_tables:
        print("Creating table: device_assignments")
        cursor.execute("""
            CREATE TABLE device_assignments (
                id INTEGER PRIMARY KEY,
                device_id TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                screen_uuid TEXT,
                display_url TEXT,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                assigned_by TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX idx_device_assignments_device ON device_assignments(device_id)")
        cursor.execute("CREATE INDEX idx_device_assignments_customer ON device_assignments(customer_id)")
    else:
        print("Table exists: device_assignments")

    # =========================================================================
    # CUSTOMER_CODES TABLE - New table
    # =========================================================================
    if "customer_codes" not in existing_tables:
        print("Creating table: customer_codes")
        cursor.execute("""
            CREATE TABLE customer_codes (
                id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                code TEXT UNIQUE NOT NULL,
                auto_approve INTEGER DEFAULT 1,
                start_url TEXT DEFAULT 'https://iocast.dk',
                kiosk_mode INTEGER DEFAULT 1,
                keep_screen_on INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX idx_customer_codes_customer ON customer_codes(customer_id)")
        cursor.execute("CREATE INDEX idx_customer_codes_code ON customer_codes(code)")
    else:
        print("Table exists: customer_codes")

    # Commit all changes
    conn.commit()
    print("\n✅ Migration completed successfully!")

    # Show final schema
    print("\nFinal schema:")
    for table in ["customers", "devices", "portal_users", "device_assignments", "customer_codes"]:
        if table in get_existing_tables(cursor):
            cols = get_existing_columns(cursor, table)
            print(f"  {table}: {', '.join(cols)}")

    conn.close()


if __name__ == "__main__":
    migrate()
