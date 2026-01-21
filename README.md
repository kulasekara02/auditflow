# AuditFlow - Audit Event Management SaaS Platform

A comprehensive audit event management system designed for enterprise-grade event tracking, real-time alerting, and compliance monitoring. This platform demonstrates modern microservices architecture integrating Python, Java, React, PostgreSQL, and Redis.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  External Apps  │────▶│   FastAPI API   │────▶│   PostgreSQL    │
│  (API Keys)     │     │   (Python)      │     │   Database      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Redis Streams  │
                        └────────┬────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│  React UI       │◀────│  Java Rule      │
│  Dashboard      │     │  Engine         │
└─────────────────┘     └─────────────────┘
```

## Components

### 1. FastAPI Backend (`/api`)
- RESTful API for event ingestion and management
- JWT-based authentication for dashboard users
- API key authentication for external applications
- Rate limiting per API key
- Redis Streams integration for event publishing

### 2. React Frontend (`/ui`)
- Modern dashboard built with React 18 and TypeScript
- Real-time event monitoring
- API key management interface
- Alert visualization and management

### 3. Java Rule Engine (`/rule-engine`)
- Consumes events from Redis Streams
- Applies configurable rules for alert generation
- Supports multiple alert severity levels
- Persistent alert storage in PostgreSQL

### 4. Infrastructure
- PostgreSQL 15 for persistent storage
- Redis 7 for event streaming
- Docker Compose for orchestration
- GitHub Actions for CI/CD

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/auditflow.git
cd auditflow

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Access Points
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Dashboard**: http://localhost:5173
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## API Usage

### Authentication

#### Register User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "securepassword"}'
```

#### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "securepassword"}'
```

### API Key Management

#### Create API Key
```bash
curl -X POST http://localhost:8000/api/keys \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "production-app", "description": "Production application key"}'
```

### Event Ingestion

#### Send Audit Event
```bash
curl -X POST http://localhost:8000/api/events \
  -H "X-API-Key: <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "login",
    "severity": "info",
    "source": "auth-service",
    "payload": {
      "user_id": "user123",
      "ip_address": "192.168.1.100",
      "success": true
    }
  }'
```

## Event Types and Severity Levels

### Supported Event Types
- `login` - User authentication events
- `logout` - User session termination
- `payment` - Financial transactions
- `error` - Application errors
- `access` - Resource access events
- `modification` - Data modification events
- `deletion` - Data deletion events
- `custom` - Custom event types

### Severity Levels
- `debug` - Debugging information
- `info` - Informational events
- `warning` - Warning conditions
- `error` - Error conditions
- `critical` - Critical conditions requiring immediate attention

## Rule Engine Configuration

The Java rule engine processes events and generates alerts based on configurable rules:

| Rule | Condition | Alert Level |
|------|-----------|-------------|
| Critical Error | `severity == critical` | HIGH |
| Payment Failure | `event_type == payment && payload.success == false` | HIGH |
| Multiple Failed Logins | `event_type == login && count > 5 in 5min` | MEDIUM |
| Unusual Access Pattern | `event_type == access && off_hours` | LOW |

## Development

### Running Tests

```bash
# API Tests
cd api
pip install -r requirements.txt
pytest tests/ -v

# UI Tests
cd ui
npm install
npm test

# Rule Engine Tests
cd rule-engine
mvn test
```

### Local Development

```bash
# Start infrastructure only
docker-compose up -d postgres redis

# Run API locally
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Run UI locally
cd ui
npm install
npm run dev

# Run Rule Engine locally
cd rule-engine
mvn spring-boot:run
```

## Database Schema

### Tables
- `users` - Dashboard user accounts
- `api_keys` - API keys for external applications
- `events` - Audit event storage
- `alerts` - Generated alerts

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | auditflow |
| `POSTGRES_PASSWORD` | Database password | auditflow_secret |
| `POSTGRES_DB` | Database name | auditflow |
| `JWT_SECRET` | JWT signing key | - |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `CORS_ORIGINS` | Allowed CORS origins | http://localhost:5173 |

## Security Considerations

1. **API Key Security**: Keys are hashed before storage
2. **Rate Limiting**: Per-key rate limiting prevents abuse
3. **JWT Tokens**: Short-lived tokens with secure signing
4. **Input Validation**: Pydantic schemas validate all input
5. **SQL Injection Prevention**: SQLAlchemy ORM prevents SQL injection

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issue tracker.
