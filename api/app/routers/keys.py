"""
API key management endpoints.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, ApiKey
from app.schemas import ApiKeyCreate, ApiKeyResponse, ApiKeyCreatedResponse, ApiKeyList
from app.security import (
    get_current_user, generate_api_key, hash_api_key, get_api_key_prefix
)
from app.logging_conf import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    key_data: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new API key.
    
    The actual key value is only returned once at creation.
    Store it securely as it cannot be retrieved later.
    
    Args:
        key_data: API key creation data
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Created API key with the actual key value
    """
    # Generate new API key
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    key_prefix = get_api_key_prefix(raw_key)
    
    # Create database record
    api_key = ApiKey(
        name=key_data.name,
        description=key_data.description,
        key_hash=key_hash,
        key_prefix=key_prefix,
        owner_id=current_user.id
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    logger.info(
        "API key created",
        key_id=str(api_key.id),
        key_prefix=key_prefix,
        user_id=str(current_user.id)
    )
    
    # Return with actual key (only time it's shown)
    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        key=raw_key
    )


@router.get("", response_model=ApiKeyList)
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = Query(False, description="Include inactive keys")
):
    """
    List all API keys for the current user.
    
    Args:
        current_user: Authenticated user
        db: Database session
        include_inactive: Whether to include inactive keys
    
    Returns:
        List of API keys (without actual key values)
    """
    query = db.query(ApiKey).filter(ApiKey.owner_id == current_user.id)
    
    if not include_inactive:
        query = query.filter(ApiKey.is_active == True)
    
    keys = query.order_by(ApiKey.created_at.desc()).all()
    
    return ApiKeyList(
        items=[ApiKeyResponse.model_validate(key) for key in keys],
        total=len(keys)
    )


@router.get("/{key_id}", response_model=ApiKeyResponse)
async def get_api_key(
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific API key by ID.
    
    Args:
        key_id: API key UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        API key details (without actual key value)
    
    Raises:
        HTTPException: If key not found or not owned by user
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.owner_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    return api_key


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deactivate an API key (soft delete).
    
    Args:
        key_id: API key UUID
        current_user: Authenticated user
        db: Database session
    
    Raises:
        HTTPException: If key not found or not owned by user
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.owner_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    api_key.is_active = False
    db.commit()
    
    logger.info(
        "API key deactivated",
        key_id=str(key_id),
        user_id=str(current_user.id)
    )


@router.post("/{key_id}/regenerate", response_model=ApiKeyCreatedResponse)
async def regenerate_api_key(
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate an API key with a new value.
    
    The old key will be invalidated immediately.
    
    Args:
        key_id: API key UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        API key with new key value
    
    Raises:
        HTTPException: If key not found or not owned by user
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.owner_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Generate new key
    raw_key = generate_api_key()
    api_key.key_hash = hash_api_key(raw_key)
    api_key.key_prefix = get_api_key_prefix(raw_key)
    api_key.is_active = True
    
    db.commit()
    db.refresh(api_key)
    
    logger.info(
        "API key regenerated",
        key_id=str(key_id),
        new_prefix=api_key.key_prefix,
        user_id=str(current_user.id)
    )
    
    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        key=raw_key
    )
