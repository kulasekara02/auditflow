"""
Alert management endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
import math

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models import User, Alert, AlertLevel, AlertStatus, Event
from app.schemas import AlertResponse, AlertUpdate, AlertList, AlertStats
from app.security import get_current_user
from app.logging_conf import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("", response_model=AlertList)
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    level: Optional[AlertLevel] = Query(None, description="Filter by alert level"),
    alert_status: Optional[AlertStatus] = Query(None, description="Filter by status"),
    rule_name: Optional[str] = Query(None, description="Filter by rule name"),
    start_date: Optional[datetime] = Query(None, description="Filter alerts after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter alerts before this date")
):
    """
    List alerts with filtering and pagination.
    
    Only returns alerts from events owned by the current user.
    
    Args:
        current_user: Authenticated user
        db: Database session
        page: Page number
        page_size: Items per page
        level: Optional alert level filter
        alert_status: Optional status filter
        rule_name: Optional rule name filter
        start_date: Optional start date filter
        end_date: Optional end date filter
    
    Returns:
        Paginated list of alerts
    """
    # Get user's API keys
    user_key_ids = [key.id for key in current_user.api_keys]
    
    if not user_key_ids:
        return AlertList(items=[], total=0, page=page, page_size=page_size, total_pages=0)
    
    # Build query with join to filter by user's events
    query = db.query(Alert).join(Event).filter(Event.api_key_id.in_(user_key_ids))
    
    # Apply filters
    if level:
        query = query.filter(Alert.level == level)
    if alert_status:
        query = query.filter(Alert.status == alert_status)
    if rule_name:
        query = query.filter(Alert.rule_name == rule_name)
    if start_date:
        query = query.filter(Alert.created_at >= start_date)
    if end_date:
        query = query.filter(Alert.created_at <= end_date)
    
    # Get total count
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    alerts = query.order_by(Alert.created_at.desc()).offset(offset).limit(page_size).all()
    
    return AlertList(
        items=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stats", response_model=AlertStats)
async def get_alert_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get alert statistics for the current user.
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Alert statistics
    """
    user_key_ids = [key.id for key in current_user.api_keys]
    
    if not user_key_ids:
        return AlertStats(
            total_alerts=0,
            open_alerts=0,
            acknowledged_alerts=0,
            resolved_alerts=0,
            alerts_by_level={}
        )
    
    # Base query
    base_query = db.query(Alert).join(Event).filter(Event.api_key_id.in_(user_key_ids))
    
    # Total alerts
    total = base_query.count()
    
    # Alerts by status
    open_alerts = base_query.filter(Alert.status == AlertStatus.OPEN).count()
    acknowledged_alerts = base_query.filter(Alert.status == AlertStatus.ACKNOWLEDGED).count()
    resolved_alerts = base_query.filter(Alert.status == AlertStatus.RESOLVED).count()
    
    # Alerts by level
    level_counts = db.query(
        Alert.level,
        func.count(Alert.id)
    ).join(Event).filter(
        Event.api_key_id.in_(user_key_ids)
    ).group_by(Alert.level).all()
    
    alerts_by_level = {l.value: c for l, c in level_counts}
    
    return AlertStats(
        total_alerts=total,
        open_alerts=open_alerts,
        acknowledged_alerts=acknowledged_alerts,
        resolved_alerts=resolved_alerts,
        alerts_by_level=alerts_by_level
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific alert by ID.
    
    Args:
        alert_id: Alert UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Alert details
    
    Raises:
        HTTPException: If alert not found or not accessible
    """
    user_key_ids = [key.id for key in current_user.api_keys]
    
    alert = db.query(Alert).join(Event).filter(
        Alert.id == alert_id,
        Event.api_key_id.in_(user_key_ids)
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert_status(
    alert_id: UUID,
    update_data: AlertUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update alert status (acknowledge or resolve).
    
    Args:
        alert_id: Alert UUID
        update_data: Status update data
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Updated alert
    
    Raises:
        HTTPException: If alert not found or not accessible
    """
    user_key_ids = [key.id for key in current_user.api_keys]
    
    alert = db.query(Alert).join(Event).filter(
        Alert.id == alert_id,
        Event.api_key_id.in_(user_key_ids)
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    # Update status and timestamps
    old_status = alert.status
    alert.status = update_data.status
    
    if update_data.status == AlertStatus.ACKNOWLEDGED and old_status == AlertStatus.OPEN:
        alert.acknowledged_at = datetime.utcnow()
    elif update_data.status == AlertStatus.RESOLVED:
        alert.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alert)
    
    logger.info(
        "Alert status updated",
        alert_id=str(alert_id),
        old_status=old_status.value,
        new_status=update_data.status.value,
        user_id=str(current_user.id)
    )
    
    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert (shortcut endpoint).
    
    Args:
        alert_id: Alert UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Updated alert
    """
    return await update_alert_status(
        alert_id,
        AlertUpdate(status=AlertStatus.ACKNOWLEDGED),
        current_user,
        db
    )


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resolve an alert (shortcut endpoint).
    
    Args:
        alert_id: Alert UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Updated alert
    """
    return await update_alert_status(
        alert_id,
        AlertUpdate(status=AlertStatus.RESOLVED),
        current_user,
        db
    )
