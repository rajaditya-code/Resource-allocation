"""
Shared FastAPI dependencies — used across all modules.

These are injected into route handlers via `Depends()`.
Centralizing them here avoids circular imports.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.models import User, TokenBlacklist
from app.auth.service import decode_access_token

# Bearer token extractor
bearer_scheme = HTTPBearer()

# Stores the raw token string for the current request (used by logout)
_current_raw_token = None


def get_db():
    """
    Yield a database session for each request.
    The session is automatically closed when the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT from the Authorization header,
    check it against the blacklist, then return the User object.
    """
    global _current_raw_token

    token = credentials.credentials
    _current_raw_token = token
    payload = decode_access_token(token)

    # Check if the token has been blacklisted (user logged out)
    jti = payload.get("jti")
    if jti:
        blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first()
        if blacklisted:
            raise HTTPException(status_code=401, detail="Token has been revoked")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def _get_raw_token() -> str:
    """Get the raw access token string from the current request. Used by logout."""
    return _current_raw_token or ""
