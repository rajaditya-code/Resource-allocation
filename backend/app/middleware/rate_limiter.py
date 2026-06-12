"""
Rate limiter middleware using SlowAPI.

Applies a global rate limit to all endpoints, with the ability
to set per-route limits using decorators.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Create the limiter instance — keyed by client IP address
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)
