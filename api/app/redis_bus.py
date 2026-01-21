"""
Redis Streams integration for event publishing.
Publishes audit events to Redis Streams for downstream processing.
"""

import json
from typing import Any, Optional
from datetime import datetime
from uuid import UUID

import redis
from redis.exceptions import ConnectionError, TimeoutError

from app.config import settings
from app.logging_conf import get_logger

logger = get_logger(__name__)


class RedisEventBus:
    """Redis Streams event bus for publishing audit events."""
    
    def __init__(self):
        """Initialize Redis connection."""
        self._client: Optional[redis.Redis] = None
        self._connected = False
    
    @property
    def client(self) -> redis.Redis:
        """Lazy-loaded Redis client."""
        if self._client is None:
            self._client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
        return self._client
    
    def _serialize_value(self, value: Any) -> str:
        """
        Serialize a value to string for Redis.
        
        Args:
            value: Value to serialize
        
        Returns:
            JSON string representation
        """
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return json.dumps(value, default=str)
        return str(value)
    
    def publish_event(
        self,
        event_id: UUID,
        event_type: str,
        severity: str,
        source: str,
        payload: dict,
        api_key_id: UUID,
        timestamp: datetime
    ) -> Optional[str]:
        """
        Publish an event to Redis Streams.
        
        Args:
            event_id: Event UUID
            event_type: Type of event
            severity: Event severity level
            source: Event source
            payload: Event payload data
            api_key_id: API key UUID that submitted the event
            timestamp: Event timestamp
        
        Returns:
            Stream entry ID if successful, None otherwise
        """
        try:
            message = {
                "event_id": str(event_id),
                "event_type": event_type,
                "severity": severity,
                "source": source,
                "payload": json.dumps(payload, default=str),
                "api_key_id": str(api_key_id),
                "timestamp": timestamp.isoformat()
            }
            
            entry_id = self.client.xadd(
                settings.event_stream_name,
                message,
                maxlen=100000  # Keep last 100k events in stream
            )
            
            logger.info(
                "Event published to Redis Stream",
                event_id=str(event_id),
                stream_entry_id=entry_id,
                event_type=event_type
            )
            
            self._connected = True
            return entry_id
            
        except (ConnectionError, TimeoutError) as e:
            logger.error(
                "Failed to publish event to Redis",
                event_id=str(event_id),
                error=str(e)
            )
            self._connected = False
            return None
    
    def health_check(self) -> bool:
        """
        Check Redis connection health.
        
        Returns:
            True if connected, False otherwise
        """
        try:
            self.client.ping()
            self._connected = True
            return True
        except (ConnectionError, TimeoutError):
            self._connected = False
            return False
    
    def get_stream_info(self) -> Optional[dict]:
        """
        Get information about the event stream.
        
        Returns:
            Stream info dict or None if unavailable
        """
        try:
            info = self.client.xinfo_stream(settings.event_stream_name)
            return {
                "length": info.get("length", 0),
                "first_entry": info.get("first-entry"),
                "last_entry": info.get("last-entry"),
                "groups": info.get("groups", 0)
            }
        except Exception as e:
            logger.error("Failed to get stream info", error=str(e))
            return None


# Global event bus instance
event_bus = RedisEventBus()
