"""
Pydantic schemas for request validation and response serialization.
"""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models import EventSeverity, AlertLevel, AlertStatus


# ============ Authentication Schemas ============

class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    email: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ============ API Key Schemas ============

class ApiKeyCreate(BaseModel):
    """Schema for creating an API key."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class ApiKeyResponse(BaseModel):
    """Schema for API key response (without the actual key)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    description: Optional[str]
    key_prefix: str
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Schema for newly created API key (includes the actual key)."""
    key: str  # Only returned once at creation


class ApiKeyList(BaseModel):
    """Schema for list of API keys."""
    items: list[ApiKeyResponse]
    total: int


# ============ Event Schemas ============

class EventCreate(BaseModel):
    """Schema for creating an audit event."""
    event_type: str = Field(..., min_length=1, max_length=50)
    severity: EventSeverity = EventSeverity.INFO
    source: str = Field(..., min_length=1, max_length=100)
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None  # If not provided, uses server time


class EventResponse(BaseModel):
    """Schema for event response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    event_type: str
    severity: EventSeverity
    source: str
    payload: dict[str, Any]
    timestamp: datetime
    created_at: datetime
    api_key_id: UUID


class EventList(BaseModel):
    """Schema for paginated event list."""
    items: list[EventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class EventFilter(BaseModel):
    """Schema for event filtering."""
    event_type: Optional[str] = None
    severity: Optional[EventSeverity] = None
    source: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ============ Alert Schemas ============

class AlertResponse(BaseModel):
    """Schema for alert response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    title: str
    description: Optional[str]
    level: AlertLevel
    status: AlertStatus
    rule_name: str
    event_id: UUID
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]


class AlertUpdate(BaseModel):
    """Schema for updating alert status."""
    status: AlertStatus


class AlertList(BaseModel):
    """Schema for paginated alert list."""
    items: list[AlertResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AlertFilter(BaseModel):
    """Schema for alert filtering."""
    level: Optional[AlertLevel] = None
    status: Optional[AlertStatus] = None
    rule_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ============ Statistics Schemas ============

class EventStats(BaseModel):
    """Schema for event statistics."""
    total_events: int
    events_by_type: dict[str, int]
    events_by_severity: dict[str, int]
    events_today: int
    events_this_week: int


class AlertStats(BaseModel):
    """Schema for alert statistics."""
    total_alerts: int
    open_alerts: int
    acknowledged_alerts: int
    resolved_alerts: int
    alerts_by_level: dict[str, int]


class DashboardStats(BaseModel):
    """Schema for dashboard overview statistics."""
    events: EventStats
    alerts: AlertStats
    active_api_keys: int
