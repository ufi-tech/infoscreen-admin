"""Shared dependencies for routers."""

from fastapi import HTTPException, Request

from ..settings import API_TOKEN


def require_token(request: Request) -> None:
    """Validate API token from Authorization header."""
    if not API_TOKEN:
        return
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
