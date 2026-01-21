"""
Authentication endpoints for user registration and login.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from app.security import hash_password, verify_password, create_access_token
from app.config import settings
from app.logging_conf import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.
    
    Args:
        user_data: User registration data
        db: Database session
    
    Returns:
        Created user object
    
    Raises:
        HTTPException: If email already exists
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("User registered", user_id=str(user.id), email=user.email)
    
    return user


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    
    Args:
        user_data: User login credentials
        db: Database session
    
    Returns:
        JWT access token
    
    Raises:
        HTTPException: If credentials are invalid
    """
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        logger.warning("Failed login attempt", email=user_data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Generate token
    access_token = create_access_token(user.id)
    
    logger.info("User logged in", user_id=str(user.id), email=user.email)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_expiration_minutes * 60
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(__import__('app.security', fromlist=['get_current_user']).get_current_user)
):
    """
    Get current authenticated user information.
    
    Args:
        current_user: Authenticated user from JWT
    
    Returns:
        User information
    """
    return current_user
