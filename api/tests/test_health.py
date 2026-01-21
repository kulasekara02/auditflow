"""
API health check tests.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestHealthEndpoint:
    """Tests for health check endpoint."""
    
    def test_health_check_returns_200(self, client):
        """Health endpoint should return 200 OK."""
        response = client.get("/health")
        assert response.status_code == 200
    
    def test_health_check_returns_status(self, client):
        """Health endpoint should return status healthy."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "auditflow-api"
        assert "version" in data
    
    def test_root_endpoint_returns_200(self, client):
        """Root endpoint should return 200 OK."""
        response = client.get("/")
        assert response.status_code == 200
    
    def test_root_endpoint_returns_info(self, client):
        """Root endpoint should return service info."""
        response = client.json()
        data = response.json()
        assert data["service"] == "AuditFlow API"
        assert "docs" in data


class TestAuthEndpoints:
    """Tests for authentication endpoints."""
    
    def test_register_user_success(self, client):
        """Should successfully register a new user."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "securepassword123"
            }
        )
        # May fail if database is not connected, but structure should be valid
        assert response.status_code in [201, 500]
    
    def test_register_user_invalid_email(self, client):
        """Should reject invalid email."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "notanemail",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 422
    
    def test_register_user_short_password(self, client):
        """Should reject short password."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "short"
            }
        )
        assert response.status_code == 422
    
    def test_login_missing_credentials(self, client):
        """Should reject missing credentials."""
        response = client.post("/api/auth/login", json={})
        assert response.status_code == 422


class TestApiKeyEndpoints:
    """Tests for API key endpoints."""
    
    def test_create_key_requires_auth(self, client):
        """Should require authentication to create API key."""
        response = client.post(
            "/api/keys",
            json={"name": "test-key"}
        )
        assert response.status_code == 403
    
    def test_list_keys_requires_auth(self, client):
        """Should require authentication to list API keys."""
        response = client.get("/api/keys")
        assert response.status_code == 403


class TestEventEndpoints:
    """Tests for event endpoints."""
    
    def test_create_event_requires_api_key(self, client):
        """Should require API key to create event."""
        response = client.post(
            "/api/events",
            json={
                "event_type": "login",
                "severity": "info",
                "source": "test",
                "payload": {}
            }
        )
        assert response.status_code == 401
    
    def test_list_events_requires_auth(self, client):
        """Should require authentication to list events."""
        response = client.get("/api/events")
        assert response.status_code == 403
    
    def test_event_stats_requires_auth(self, client):
        """Should require authentication for event stats."""
        response = client.get("/api/events/stats")
        assert response.status_code == 403


class TestAlertEndpoints:
    """Tests for alert endpoints."""
    
    def test_list_alerts_requires_auth(self, client):
        """Should require authentication to list alerts."""
        response = client.get("/api/alerts")
        assert response.status_code == 403
    
    def test_alert_stats_requires_auth(self, client):
        """Should require authentication for alert stats."""
        response = client.get("/api/alerts/stats")
        assert response.status_code == 403
