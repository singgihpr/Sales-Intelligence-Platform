# Sales Intelligence Platform

A mobile-first sales intelligence dashboard for field teams. Built with **React + Vite**, backed by **PostgreSQL**, and deployable on **Netlify** (serverless) or your own **VM** (Docker + Nginx). Authentication is handled via **custom JWT + bcrypt** — no Netlify Identity required.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, PWA-ready |
| Backend | Shared core (Node.js) + Express (VM) / Netlify Functions (serverless) |
| Database | PostgreSQL — Neon (cloud) or self-hosted via Docker |
| Auth | Custom JWT (jsonwebtoken) + bcryptjs |
| Excel Import | xlsx + busboy |
| VM Infrastructure | Docker, Docker Compose, Nginx, Certbot |

---

## Prerequisites

- **Node.js** 20+
- **npm**
- For **Netlify** deploy: Neon PostgreSQL account (free tier works) + Netlify CLI
- For **VM** deploy: Docker + Docker Compose

---

## Quick Start (Local Dev)

### Native (Node.js on host)

```bash
npm install
npm run build          # Build frontend once
cp .env.example .env   # Then fill in your values
npm run server         # Terminal 1 — Express API on :3000
npm run dev            # Terminal 2 — Vite on :5173
```

The Vite dev server proxies `/api` to Express automatically.

### Docker (everything in containers — hot reload)

```bash
cp .env.example .env   # Fill in your values
npm run dev:docker     # Starts Postgres + Express (nodemon) + Vite (HMR)
```

- **Frontend:** `http://localhost:5173` — Vite HMR works instantly on file save
- **Backend:** `http://localhost:3000` — nodemon auto-restarts Express on code changes
- **Database:** `localhost:5432` — accessible from host for inspection

**Running scripts in Docker dev:**

```bash
# Seed admin user
docker compose -f docker-compose.dev.yml exec api npm run seed -- admin@example.com YourPassword "Admin Name"

# Run migrations manually (also runs automatically on api startup)
docker compose -f docker-compose.dev.yml exec api npm run migrate
```

> **Netlify mode (optional):** `npm run dev:netlify` runs the old Netlify dev server.

---

## Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon or local) |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) |
| `DEFAULT_PASSWORD` | Default password for newly created users |
| `DEFAULT_USER_ID` | UUID of the default user for dashboard target lookup |

> The API auto-strips `channel_binding=require` from the connection string for driver compatibility.

---

## Database Setup

### Option A: Neon (for Netlify deploy)
1. Go to [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string.
3. Run the schema SQL from `migrations/002_refresh_schema.sql` (or `001_backlog_features.sql` for incremental).

### Option B: Local Postgres (for VM dev)
The Docker Compose setup handles this automatically. See **VM Deployment** below.

---

## Database Migrations

Migrations are stored in `migrations/` and run automatically on startup for VM/Docker deployments.

### How It Works

| Environment | Behavior |
|-------------|----------|
| **VM / Docker** | `server/index.js` runs safe migrations automatically before starting the API |
| **Netlify / Neon** | Run `npm run migrate` manually, or execute migration SQL in Neon SQL Editor |
| **Fresh Docker DB** | `docker/postgres/init.sql` also creates the schema on first initialization |

### Safe vs Destructive Migrations

- **Safe migrations** (e.g., `001_backlog_features.sql`, `003_user_branches.sql`) use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — they can be run repeatedly without harm.
- **Destructive migrations** (e.g., `002_refresh_schema.sql` which drops all tables) are **skipped** by the auto-runner.

### Manual Migration

```bash
# Run all safe migrations (local dev with localhost database)
npm run migrate

# Run migrations inside Docker production container
docker compose exec app npm run migrate

# Run migrations inside Docker dev container
docker compose -f docker-compose.dev.yml exec api npm run migrate

# Or run a specific migration manually
psql $DATABASE_URL -f migrations/003_user_branches.sql
```

> **Note:** `npm run migrate` on your host machine only works if `DATABASE_URL` points to `localhost`. If you're using Docker and your `.env` points to `@db:5432`, run the migration inside the container instead.

### Creating New Migrations

1. Create a new file: `migrations/004_your_feature.sql`
2. Use `IF NOT EXISTS` for safety
3. Avoid `DROP TABLE` unless you explicitly mark it as destructive

---

## Project Structure

```
├── netlify/
│   └── functions/
│       ├── api.js              # Thin Netlify adapter (~20 lines)
│       └── lib/
│           ├── core.js         # Shared business logic (~1300 lines)
│           ├── db.js           # Auto-detects Neon vs node-postgres
│           └── multipart.js    # (reserved for future normalization)
├── server/
│   └── index.js              # Express entry point for VM deploy
├── scripts/
│   ├── seed-admin.js         # Admin user seeder
│   └── seed-demo-data.js     # Full demo dataset seeder
├── docker/
│   └── postgres/
│       └── init.sql          # Schema for fresh VM database
├── src/
│   ├── components/           # Dashboards, outlet views, bonus cards
│   ├── pages/                # Login, Admin panel
│   ├── lib/
│   │   └── api.js            # Unified API base path (/api)
│   ├── App.jsx               # Main app shell
│   └── main.jsx              # Router + protected routes
├── .env.example              # Environment template
├── docker-compose.yml        # Production VM stack: db + app + nginx
├── docker-compose.dev.yml    # Development stack with hot reload
├── Dockerfile                # Production Node.js API container
├── Dockerfile.dev            # Dev image (Linux node_modules)
├── nginx.conf                # Reverse proxy + SPA fallback
├── netlify.toml              # Netlify build + redirect rules
└── vite.config.js            # Vite + PWA + dev proxy
```

---

## Deployment

### Option A: VM (Linode / DigitalOcean / AWS EC2)

**VM specs:** 1 CPU, 4 GB RAM (minimum), Ubuntu 22.04/24.04 LTS

**1. Provision the server**
```bash
# Install Docker + Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

**2. Clone & configure**
```bash
git clone <repo> /opt/salesintel
cd /opt/salesintel
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgres://salesintel:YOUR_PASSWORD@db:5432/salesintel
#   JWT_SECRET=...
#   DEFAULT_PASSWORD=...
#   DEFAULT_USER_ID=...
```

**3. Build & start**
```bash
npm install
npm run build
docker compose up -d
```

**4. Initialize database & admin**
```bash
# Schema is auto-created by docker/postgres/init.sql on first boot.
# Seed the admin user:
docker compose exec app node scripts/seed-admin.js admin@yourdomain.com YourPassword "Admin Name"
```

**5. SSL with Certbot**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

> The `nginx.conf` handles HTTPS if certificates are present. See inline comments for cert paths.

---

### Option B: Netlify (Serverless)

**1. Set environment variables** in Netlify Dashboard → Site settings → Environment variables:
- `DATABASE_URL` (pointing to Neon)
- `JWT_SECRET`
- `DEFAULT_PASSWORD`
- `DEFAULT_USER_ID`

**2. Deploy**
```bash
# Via CLI
npx netlify deploy --prod --build

# Or via Git push (recommended)
git push origin main
```

**3. Post-deploy seed**
```bash
npm run seed -- admin@yourcompany.com SecurePassword123 "Super Admin"
```

**How it works:** `netlify.toml` redirects `/api` → `/.netlify/functions/api`, so the frontend's `/api` calls work transparently on both platforms.

---

## How the Hybrid Architecture Works

The app uses a **single shared backend core** that runs on two different hosts:

| Platform | Adapter | Database | Frontend Served By |
|----------|---------|----------|-------------------|
| **VM** | Express (`server/index.js`) | Local Postgres (Docker) | Nginx (static `dist/`) |
| **Netlify** | Netlify Function (`netlify/functions/api.js`) | Neon PostgreSQL | Netlify CDN |

The frontend always calls `/api`. The hosting platform handles routing:
- **Nginx** proxies `/api` → Express container
- **Netlify** rewrites `/api` → serverless function

This means **one codebase**, **two deployment targets**, zero frontend changes needed when switching platforms.

---

## Local Development Modes

| Command | Backend | Database | Use Case |
|---------|---------|----------|----------|
| `npm run server` + `npm run dev` | Express (:3000) | `.env` DATABASE_URL | **Default** — VM development |
| `npm run dev:docker` | Express (:3000) + Vite (:5173) | Postgres (Docker) | Full stack in Docker with hot reload |
| `npm run dev:netlify` | Netlify Dev (:8888) | Neon | Netlify-specific testing |

---

## Important Notes

- **No Netlify Identity:** All authentication is custom JWT + PostgreSQL.
- **Database abstraction:** `netlify/functions/lib/db.js` auto-detects whether `DATABASE_URL` points to Neon or a local Postgres, so the same queries run on both.
- **PWA:** The app is PWA-ready via `vite-plugin-pwa`. Icons are expected in `/public/icons/`.
- **CORS:** Enabled on both Express and Netlify adapters for flexibility.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `500` on login | Check `DATABASE_URL` is set and accessible from the running process |
| `Illegal arguments: string, object` | User exists but has no `password_hash`. Run the seed script |
| `404` on `/api` | Ensure Express is running (`npm run server`) or Netlify dev is active |
| Dashboard shows "No target configured" | Insert a row into `targets` for the current month/year |
| Admin panel blank / redirects | Check `user_role` in `localStorage` is `"admin"` and JWT is valid |
| Netlify build fails with `pg` error | Make sure `pg` is in `dependencies` (not `devDependencies`) |
| Docker container exits | Check `docker compose logs app` for missing env vars |

---

## License

MIT
