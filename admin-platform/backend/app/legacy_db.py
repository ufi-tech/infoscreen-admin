from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple

import pymysql

from .settings import (
    LEGACY_DB_HOST,
    LEGACY_DB_PORT,
    LEGACY_DB_NAME,
    LEGACY_DB_USER,
    LEGACY_DB_PASSWORD,
)


LEGACY_FIELDS = {
    "url": "Url",
    "support": "Support",
    "tv_on": "TVON",
    "hdmistart": "hdmistart",
    "hdmistop": "hdmistop",
    "delay_dmi": "DelayDmi",
    "width": "width",
    "height": "height",
    "description": "description",
    "company_name": "CompanyName",
    "zip_code": "ZipCode",
    "mail": "mail",
    "sms": "sms",
    "kirke": "Kirke",
    "camera": "camera",
}


def legacy_enabled() -> bool:
    return all([LEGACY_DB_HOST, LEGACY_DB_NAME, LEGACY_DB_USER, LEGACY_DB_PASSWORD])


@contextmanager
def legacy_conn():
    if not legacy_enabled():
        raise RuntimeError("Legacy DB is not configured")
    conn = pymysql.connect(
        host=LEGACY_DB_HOST,
        port=LEGACY_DB_PORT,
        user=LEGACY_DB_USER,
        password=LEGACY_DB_PASSWORD,
        database=LEGACY_DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=5,
        read_timeout=10,
        write_timeout=10,
        autocommit=True,
    )
    try:
        yield conn
    finally:
        conn.close()


def _identifier_clause(identifier: str) -> Tuple[str, str]:
    if identifier.isdigit():
        return "ID = %s", identifier
    return "MAC = %s", identifier


def list_legacy_devices(limit: int = 500) -> List[Dict]:
    query = (
        "SELECT ID, MAC, CompanyName, description, Url, Online, IP, wan, Support, "
        "TVON, hdmistart, hdmistop, DelayDmi, width, height, ZipCode, Kirke, "
        "`timestamp` "
        "FROM infoscreen "
        "ORDER BY (Online = '1') DESC, `timestamp` DESC, ID DESC "
        "LIMIT %s"
    )
    with legacy_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            return list(cur.fetchall())


def get_legacy_device(identifier: str) -> Optional[Dict]:
    clause, value = _identifier_clause(identifier)
    query = f"SELECT * FROM infoscreen WHERE {clause} LIMIT 1"
    with legacy_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (value,))
            return cur.fetchone()


def update_legacy_device(identifier: str, updates: Dict) -> Dict:
    if not updates:
        raise ValueError("No updates provided")

    fields = {}
    for key, value in updates.items():
        if key in LEGACY_FIELDS:
            fields[LEGACY_FIELDS[key]] = value

    if not fields:
        raise ValueError("No valid fields provided")

    set_clause = ", ".join([f"{column}=%s" for column in fields])
    params = list(fields.values())
    clause, value = _identifier_clause(identifier)
    params.append(value)

    query = f"UPDATE infoscreen SET {set_clause} WHERE {clause}"
    with legacy_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)

    device = get_legacy_device(identifier)
    if not device:
        raise ValueError("Legacy device not found")
    return device
