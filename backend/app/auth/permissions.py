"""
Role-based access control — permission dependencies.

These are FastAPI dependencies that you add to route handlers
to restrict access based on the user's role.
"""

from functools import wraps
from typing import List

from fastapi import HTTPException, status, Depends

from app.auth.models import User


def require_role(*allowed_roles: str):
    """
    Dependency factory that checks if the current user has one of the allowed roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
        def admin_endpoint(): ...

    Or inject the user directly:
        @router.get("/admin-stuff")
        def admin_endpoint(user: User = Depends(require_role("admin"))): ...
    """
    from app.dependencies import get_current_user

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


def require_admin():
    """Shorthand for require_role("admin")."""
    return require_role("admin")


def require_user():
    """Shorthand for require_role("user")."""
    return require_role("user")


def require_any_authenticated():
    """Allow any authenticated user regardless of role."""
    return require_role("admin", "user")
