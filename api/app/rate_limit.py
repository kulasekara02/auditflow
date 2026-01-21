"""
Rate limiting configuration using slowapi.
Provides per-API-key rate limiting for event ingestion.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

from app.config import settings


def get_api_key_identifier(request: Request) -> str:
    """
    Extract identifier for rate limiting.
    Uses API key if present, otherwise falls back to IP address.
    
    Args:
        request: FastAPI request object
    
    Returns:
        Rate limit identifier string
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Use first 16 chars of API key as identifier
        return f"apikey:{api_key[:16]}"
    return f"ip:{get_remote_address(request)}"


# Initialize limiter
limiter = Limiter(
    key_func=get_api_key_identifier,
    default_limits=[f"{settings.rate_limit_requests}/minute"]
)


def get_rate_limit_string() -> str:
    """Get rate limit configuration as string."""
    return f"{settings.rate_limit_requests}/minute"
