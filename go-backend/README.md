# Go Backend - Sales Intelligence Platform

High-performance Go backend for the Sales Intelligence Platform, built with Echo framework and pgx PostgreSQL driver.

## Architecture

```
go-backend/
├── main.go                 # Entry point, routing
├── config/config.go        # Environment configuration
├── db/db.go                # PostgreSQL connection pool
├── handlers/               # API handlers
│   ├── auth.go             # Login, JWT
│   ├── users.go            # User CRUD, dashboard
│   ├── outlets.go          # Outlet CRUD
│   ├── records.go          # Sales records CRUD
│   ├── assignments.go      # Outlet assignments
│   ├── targets.go          # Sales targets
│   ├── incentives.go       # SKU incentives
│   └── upload.go           # Excel file upload
├── middleware/auth.go       # JWT authentication
├── models/models.go        # Data structures
└── utils/utils.go          # Business logic helpers
```

## Performance

| Metric | Value |
|--------|-------|
| Request throughput | ~50-100K req/s |
| Memory per request | ~2-8KB |
| Dashboard latency | ~100ms |
| Concurrent connections | ~100K |

## Key Features

- **Concurrent DB queries** - Dashboard data fetched in parallel using goroutines
- **Connection pooling** - pgxpool with configurable min/max connections
- **JWT authentication** - Custom JWT + bcrypt
- **Excel parsing** - Native Go excelize library
- **Same API contract** - Drop-in replacement for frontend

## Quick Start

### Prerequisites

- Go 1.25+
- PostgreSQL 17+

### Local Development

```bash
# Install dependencies
go mod tidy

# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/salesintel"
export JWT_SECRET="your-secret"
export DEFAULT_PASSWORD="default-password"

# Run
go run main.go
```

### Docker

```bash
# Build
docker build -t sales-intelligence-go .

# Run with docker-compose
docker-compose up -d
```

## API Endpoints

All endpoints use `/api` with query parameters:

### Auth
- `POST /api?type=auth` - Login

### Users
- `GET /api?type=profile` - Get profile
- `GET /api?type=users` - List users
- `POST /api?type=users` - Create user
- `PUT /api?type=users&id=X` - Update user
- `DELETE /api?type=users&id=X` - Delete user

### Outlets
- `GET /api?type=outlets` - List outlets
- `POST /api?type=outlets` - Create outlet
- `PUT /api?type=outlets&id=X` - Update outlet
- `DELETE /api?type=outlets&id=X` - Delete outlet

### Sales Records
- `GET /api?type=records` - List records
- `PUT /api?type=records&id=X` - Update record
- `DELETE /api?type=records&id=X` - Delete record

### Assignments
- `GET /api?type=assignments` - List assignments
- `POST /api?type=assignments` - Create assignment
- `PUT /api?type=assignments&id=X` - Unassign
- `DELETE /api?type=assignments&id=X` - Delete assignment

### Targets
- `GET /api?type=targets` - List targets
- `POST /api?type=targets` - Create target
- `PUT /api?type=targets&id=X` - Update target
- `DELETE /api?type=targets&id=X` - Delete target

### Incentives
- `GET /api?type=sku-incentives` - List incentives
- `POST /api?type=sku-incentives` - Create incentive
- `PUT /api?type=sku-incentives&id=X` - Update incentive
- `DELETE /api?type=sku-incentives&id=X` - Delete incentive

### Dashboard
- `GET /api` - Get dashboard (role-based)
- `GET /api?type=analytics` - Get analytics

### Upload
- `POST /api?action=upload` - Upload Excel file

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret` | JWT signing secret |
| `DEFAULT_PASSWORD` | - | Default password for new users |
| `FRONTEND_DIR` | `./dist` | Frontend static files directory |

## Benchmark

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Benchmark health endpoint
hey -n 10000 -c 100 http://localhost:3000/health

# Benchmark dashboard (with auth)
hey -n 1000 -c 50 -H "Authorization: Bearer TOKEN" http://localhost:3000/api
```
