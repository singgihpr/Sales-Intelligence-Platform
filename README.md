# Sales Intelligence Platform

A mobile-first sales intelligence dashboard for field teams. Built with **React + Vite** frontend, **Go (Echo)** backend, and **PostgreSQL** database. Deployable on **VPS** with Docker or **Netlify** (serverless with Node.js adapter).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, PWA-ready |
| Backend | Go 1.25+ with Echo framework, pgx PostgreSQL driver |
| Database | PostgreSQL 17 — self-hosted via Docker or Neon (cloud) |
| Auth | Custom JWT (golang-jwt) + bcrypt |
| Excel Import | excelize (Go native, 10x faster than JS xlsx) |
| Infrastructure | Docker, Docker Compose, Nginx, Certbot |
| Dev Hot-Reload | Air (Go), Vite HMR (frontend) |

---

## Prerequisites

- **Go** 1.25+
- **Node.js** 20+ (frontend build only)
- **npm**
- **Docker + Docker Compose** (for containerized deploy)

---

## Quick Start (Local Dev)

### Docker (recommended — everything in containers with hot reload)

```bash
cp .env.example .env   # Fill in your values
docker compose -f docker-compose.dev.yml up
```

- **Frontend:** `http://localhost:5173` — Vite HMR works instantly on file save
- **Backend:** `http://localhost:3000` — Air auto-rebuilds Go on code changes
- **Database:** `localhost:5432` — accessible from host for inspection

### Native (Go on host)

```bash
# Terminal 1 — Go backend
cd go-backend
go run main.go

# Terminal 2 — Vite dev server
npm install
npm run dev
```

---

## Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) |
| `DEFAULT_PASSWORD` | Default password for newly created users |
| `DB_PASSWORD` | PostgreSQL password (Docker Compose) |

---

## Database Setup

### Docker (automatic)
The Docker Compose setup handles database creation automatically via `docker/postgres/init.sql`.

### Manual
```bash
# Run schema migration
psql $DATABASE_URL -f migrations/002_refresh_schema.sql
```

---

## Database Migrations

Migrations are stored in `migrations/` and run automatically on startup.

### Safe vs Destructive Migrations

- **Safe migrations** (e.g., `001_backlog_features.sql`, `003_user_branches.sql`) use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — they can be run repeatedly without harm.
- **Destructive migrations** (e.g., `002_refresh_schema.sql` which drops all tables) are **skipped** by the auto-runner.

### Manual Migration

```bash
# Inside Docker container
docker compose exec app ./server --migrate

# Or directly
psql $DATABASE_URL -f migrations/003_user_branches.sql
```

---

## Project Structure

```
├── go-backend/
│   ├── main.go                 # Go entry point, routing
│   ├── config/config.go        # Environment configuration
│   ├── db/db.go                # pgx connection pool
│   ├── handlers/               # API handlers
│   │   ├── auth.go             # Login, JWT
│   │   ├── users.go            # User CRUD + dashboard
│   │   ├── outlets.go          # Outlet CRUD
│   │   ├── records.go          # Sales records
│   │   ├── assignments.go      # Outlet assignments
│   │   ├── targets.go          # Sales targets
│   │   ├── incentives.go       # SKU incentives
│   │   └── upload.go           # Excel upload
│   ├── middleware/auth.go      # JWT authentication
│   ├── models/models.go        # Data structures
│   └── utils/utils.go          # Business logic
├── src/                        # React frontend
│   ├── components/             # Dashboards, outlet views, bonus cards
│   ├── pages/                  # Login, Admin panel
│   ├── lib/api.js              # Unified API base path (/api)
│   ├── App.jsx                 # Main app shell
│   └── main.jsx                # Router + protected routes
├── migrations/                 # SQL migrations
├── docker/postgres/init.sql    # Schema for fresh DB
├── Dockerfile                  # Production: frontend + Go multi-stage
├── Dockerfile.dev              # Development: Go + air hot-reload
├── docker-compose.yml          # Production: db + Go app + nginx
├── docker-compose.dev.yml      # Development: db + Go api + Vite
├── .air.toml                   # Air hot-reload config
├── nginx.conf                  # Reverse proxy + SPA fallback
└── vite.config.js              # Vite + PWA + dev proxy
```

---

## Deployment

### Production (VPS)

**VM specs:** 1 CPU, 2 GB RAM minimum (1 GB tight), Ubuntu 22.04/24.04 LTS

**1. Provision the server**
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

**2. Clone & configure**
```bash
git clone <repo> /opt/salesintel
cd /opt/salesintel
cp .env.example .env
# Edit .env with your values
```

**3. Build & start**
```bash
docker compose up -d --build
```

**4. SSL with Certbot**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Netlify (Serverless — legacy)

The `netlify/` directory contains a Node.js adapter for Netlify Functions. Use this only if deploying to Netlify with Neon PostgreSQL.

---

## Performance Comparison (Go vs Node.js)

| Metric | Node.js/Express | Go/Echo | Improvement |
|--------|----------------|---------|-------------|
| Request throughput | ~5-10K req/s | ~50-100K req/s | 10x |
| Memory per request | ~2-5MB | ~2-8KB | 500x |
| Dashboard latency | ~500ms | ~100ms | 5x |
| Concurrent connections | ~1K | ~100K | 100x |
| Excel parsing | JS xlsx | Go excelize | 10x |
| Docker image size | ~200MB | ~20MB | 10x |

---

## API Endpoints

All endpoints use `/api` with query parameters:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api?type=auth` | Login |
| GET | `/api?type=profile` | Get user profile |
| GET | `/api?type=users` | List users |
| GET | `/api?type=outlets` | List outlets |
| GET | `/api?type=records` | List sales records |
| GET | `/api?type=assignments` | List assignments |
| GET | `/api?type=targets` | List targets |
| GET | `/api?type=sku-incentives` | List incentives |
| GET | `/api` | Get dashboard (role-based) |
| GET | `/api?type=analytics` | Get analytics |
| POST | `/api` (multipart) | Upload Excel file |

CRUD operations: `POST` (create), `PUT` (update), `DELETE` (delete) for each type.

---

## Local Development Modes

| Command | Backend | Database | Use Case |
|---------|---------|----------|----------|
| `docker compose -f docker-compose.dev.yml up` | Go + Air (:3000) + Vite (:5173) | Postgres (Docker) | **Recommended** — full stack with hot reload |
| `go run main.go` + `npm run dev` | Go (:3000) + Vite (:5173) | `.env` DATABASE_URL | Native development |

---

## Important Notes

- **No Netlify Identity:** All authentication is custom JWT + PostgreSQL.
- **Concurrent queries:** Go backend runs dashboard queries in parallel using goroutines.
- **PWA:** The app is PWA-ready via `vite-plugin-pwa`. Icons are expected in `/public/icons/`.
- **CORS:** Enabled on both Go and Netlify adapters for flexibility.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `500` on login | Check `DATABASE_URL` is set and accessible |
| `404` on `/api` | Ensure Go backend is running (`go run main.go` or Docker) |
| Dashboard shows "No target configured" | Insert a row into `targets` for the current month/year |
| Docker container exits | Check `docker compose logs app` for missing env vars |
| Air not rebuilding | Check `.air.toml` paths match your directory structure |

---

## License

MIT
