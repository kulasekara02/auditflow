"""
Configuration management using Pydantic Settings.
Loads configuration from environment variables with sensible defaults.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql://auditflow:auditflow_secret@localhost:5432/auditflow"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Security
    jwt_secret: str = "your-super-secret-jwt-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Redis Streams
    event_stream_name: str = "auditflow:events"
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
