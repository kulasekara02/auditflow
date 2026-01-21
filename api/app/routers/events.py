"""
Event ingestion and retrieval endpoints.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import math

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.db import get_db
from app.models import User, ApiKey, Event, EventSeverity
from app.schemas import (
    EventCreate, EventResponse, EventList, EventStats
)
from app.security import get_current_user, get_api_key
from app.redis_bus import event_bus
from app.rate_limit import limiter, get_rate_limit_string
from app.logging_conf import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(get_rate_limit_string())
async def create_event(
    request: Request,
    event_data: EventCreate,
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db)
):
    """
    Ingest a new audit event.
    
    Requires API key authentication via X-API-Key header.
    Events are stored in PostgreSQL and published to Redis Streams.
    
    Args:
        request: FastAPI request (for rate limiting)
        event_data: Event data
        api_key: Validated API key
        db: Database session
    
    Returns:
        Created event
    """
    # Use provided timestamp or current time
    timestamp = event_data.timestamp or datetime.utcnow()
    
    # Create event record
    event = Event(
        event_type=event_data.event_type,
        severity=event_data.severity,
        source=event_data.source,
        payload=event_data.payload,
        timestamp=timestamp,
        api_key_id=api_key.id
    )
    
    db.add(event)
    db.commit()
    db.refresh(event)
    
    # Publish to Redis Streams (non-blocking)
    event_bus.publish_event(
        event_id=event.id,
        event_type=event.event_type,
        severity=event.severity.value,
        source=event.source,
        payload=event.payload,
        api_key_id=event.api_key_id,
        timestamp=event.timestamp
    )
    
    logger.info(
        "Event created",
        event_id=str(event.id),
        event_type=event.event_type,
        severity=event.severity.value,
        api_key_prefix=api_key.key_prefix
    )
    
    return event


@router.get("", response_model=EventList)
async def list_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[EventSeverity] = Query(None, description="Filter by severity"),
    source: Optional[str] = Query(None, description="Filter by source"),
    start_date: Optional[datetime] = Query(None, description="Filter events after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter events before this date"),
    api_key_id: Optional[UUID] = Query(None, description="Filter by API key")
):
    """
    List audit events with filtering and pagination.
    
    Requires JWT authentication.
    Only returns events from API keys owned by the current user.
    
    Args:
        current_user: Authenticated user
        db: Database session
        page: Page number
        page_size: Items per page
        event_type: Optional event type filter
        severity: Optional severity filter
        source: Optional source filter
        start_date: Optional start date filter
        end_date: Optional end date filter
        api_key_id: Optional API key filter
    
    Returns:
        Paginated list of events
    """
    # Get user's API keys
    user_key_ids = [key.id for key in current_user.api_keys]
    
    if not user_key_ids:
        return EventList(items=[], total=0, page=page, page_size=page_size, total_pages=0)
    
    # Build query
    query = db.query(Event).filter(Event.api_key_id.in_(user_key_ids))
    
    # Apply filters
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if severity:
        query = query.filter(Event.severity == severity)
    if source:
        query = query.filter(Event.source == source)
    if start_date:
        query = query.filter(Event.timestamp >= start_date)
    if end_date:
        query = query.filter(Event.timestamp <= end_date)
    if api_key_id and api_key_id in user_key_ids:
        query = query.filter(Event.api_key_id == api_key_id)
    
    # Get total count
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    events = query.order_by(Event.timestamp.desc()).offset(offset).limit(page_size).all()
    
    return EventList(
        items=[EventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stats", response_model=EventStats)
async def get_event_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get event statistics for the current user.
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Event statistics
    """
    user_key_ids = [key.id for key in current_user.api_keys]
    
    if not user_key_ids:
        return EventStats(
            total_events=0,
            events_by_type={},
            events_by_severity={},
            events_today=0,
            events_this_week=0
        )
    
    base_query = db.query(Event).filter(Event.api_key_id.in_(user_key_ids))
    
    # Total events
    total = base_query.count()
    
    # Events by type
    type_counts = db.query(
        Event.event_type,
        func.count(Event.id)
    ).filter(
        Event.api_key_id.in_(user_key_ids)
    ).group_by(Event.event_type).all()
    
    events_by_type = {t: c for t, c in type_counts}
    
    # Events by severity
    severity_counts = db.query(
        Event.severity,
        func.count(Event.id)
    ).filter(
        Event.api_key_id.in_(user_key_ids)
    ).group_by(Event.severity).all()
    
    events_by_severity = {s.value: c for s, c in severity_counts}
    
    # Events today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    events_today = base_query.filter(Event.timestamp >= today_start).count()
    
    # Events this week
    week_start = today_start - timedelta(days=today_start.weekday())
    events_this_week = base_query.filter(Event.timestamp >= week_start).count()
    
    return EventStats(
        total_events=total,
        events_by_type=events_by_type,
        events_by_severity=events_by_severity,
        events_today=events_today,
        events_this_week=events_this_week
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific event by ID.
    
    Args:
        event_id: Event UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Event details
    
    Raises:
        HTTPException: If event not found or not accessible
    """
    user_key_ids = [key.id for key in current_user.api_keys]
    
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.api_key_id.in_(user_key_ids)
    ).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return event
