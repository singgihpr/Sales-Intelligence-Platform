# Sales Intelligence Platform

A mobile-first sales intelligence dashboard for field teams. Built with **React + Vite**, backed by **Neon PostgreSQL**, and deployed on **Netlify** using **Netlify Functions** (serverless API). Authentication is handled via **custom JWT + bcrypt** — no Netlify Identity required.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, PWA-ready |
| Backend | Netlify Functions (Node.js serverless) |
| Database | Neon PostgreSQL |
| Auth | Custom JWT (jsonwebtoken) + bcryptjs |
| Excel Import | xlsx + busboy |

---

## Prerequisites

- **Node.js** 20+
- **npm**
- **Neon PostgreSQL** account (free tier works)
- **Netlify CLI** (for local dev: `npm install -g netlify-cli`)
- **Netlify account** (for deployment)

---

## Database Setup

### 1. Create a Neon Project
1. Go to [neon.tech](https://neon.tech) and create a new project.
2. Copy the **connection string** (it looks like `postgresql://...`).
3. **Important:** Remove `channel_binding=require` from the connection string if present (the Node.js driver has compatibility issues with it).

### 2. Create Required Tables

Run the following SQL in the Neon SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'supervisor', 'admin')),
  region TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  netlify_uid TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT '',
  address TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID REFERENCES outlets(id),
  sales_id UUID REFERENCES users(id),
  record_date DATE NOT NULL,
  volume_be NUMERIC NOT NULL,
  sku_name TEXT
);

CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_be NUMERIC NOT NULL,
  incentive_rules JSONB DEFAULT '[]'::jsonb,
  UNIQUE(user_id, month, year)
);
```

### 3. Insert Initial Target Data (Optional)

The dashboard expects a target for the current month/year for the default user:

```sql
-- Replace user_id with your actual default user's UUID after seeding
INSERT INTO targets (user_id, month, year, target_be, incentive_rules)
VALUES (
  'YOUR_USER_UUID_HERE',
  EXTRACT(MONTH FROM CURRENT_DATE),
  EXTRACT(YEAR FROM CURRENT_DATE),
  1250,
  '[
    {"threshold": 90, "reward": 1000000, "label": "Tier 1"},
    {"threshold": 100, "reward": 2000000, "label": "Tier 2"},
    {"threshold": 110, "reward": 3500000, "label": "Tier 3"}
  ]'::jsonb
);
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-xxx-pooler.c-xxx.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
DEFAULT_PASSWORD=Password123!
DEFAULT_USER_ID=YOUR_DEFAULT_USER_UUID
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens (use a strong random string) |
| `DEFAULT_PASSWORD` | Default password for newly created users |
| `DEFAULT_USER_ID` | UUID of the default user for dashboard target lookup |

> **Note:** The API automatically strips `channel_binding=require` from the connection string to avoid driver compatibility issues.

---

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Seed the First Admin User

```bash
npm run seed -- admin@example.com YourPassword "Admin Name"
```

This creates (or updates) an admin user in Neon with a bcrypt-hashed password.

### 3. Start the Netlify Dev Server

Netlify Functions must be served by the Netlify CLI, not Vite alone:

```bash
# Terminal 1
npx netlify dev
```

This starts the function server (usually on `http://localhost:8888`).

### 4. Start the Vite Frontend

```bash
# Terminal 2
npm run dev
```

Vite will proxy API calls to the Netlify dev server automatically (configured in `vite.config.js`).

### 5. Open the App

Go to `http://localhost:5173` (or the port Vite reports).

- Login with your seeded admin credentials
- The `/admin` route is protected and requires `role === 'admin'`

---

## Project Structure

```
├── netlify/
│   └── functions/
│       └── api.js          # Serverless API (auth, CRUD, upload)
├── scripts/
│   └── seed-admin.js       # Admin user seeder
├── src/
│   ├── pages/
│   │   ├── Login.jsx       # Login page with show/hide password
│   │   └── AdminDashboard.jsx  # Admin panel
│   ├── App.jsx             # Sales dashboard
│   └── main.jsx            # Router + protected routes
├── .env                    # Environment variables (not committed)
├── netlify.toml            # Netlify config
└── vite.config.js          # Vite + PWA config
```

---

## Deployment to Netlify

### Option A: Deploy via Netlify CLI

```bash
# Make sure you're logged in
npx netlify login

# Build and deploy
npx netlify deploy --prod --build
```

### Option B: Deploy via Git (Recommended)

1. Push your code to a Git provider (GitHub/GitLab/Bitbucket).
2. In Netlify Dashboard, click **"Add new site" → "Import an existing project"**.
3. Select your repository.
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy**.
6. Go to **Site settings → Environment variables** and add:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `DEFAULT_PASSWORD`
   - `DEFAULT_USER_ID`
7. Re-deploy after adding environment variables.

### Post-Deployment Setup

After the first deploy:

1. **Seed the admin user** locally (it connects directly to Neon, so it works before or after deploy):
   ```bash
   npm run seed -- admin@yourcompany.com SecurePassword123 "Super Admin"
   ```
2. **Login** at `https://your-site.netlify.app/login`
3. **Access admin panel** at `/admin`

---

## Important Notes

- **No Netlify Identity:** This app does NOT use Netlify Auth/Identity. All authentication is custom JWT + Neon DB.
- **Neon Connection:** If you see "Illegal arguments: string, object", it means the user's `password_hash` is null or the DB connection failed. The code now handles both gracefully.
- **CORS:** The API includes CORS headers so it works during local development and on Netlify.
- **PWA:** The app is PWA-ready via `vite-plugin-pwa`. Icons are expected in `/public/icons/`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `500` on login | Check that `DATABASE_URL` is set in `.env` and `dotenv` is installed |
| `Illegal arguments: string, object` | User exists but has no `password_hash`. Run the seed script to fix |
| `404` on `/.netlify/functions/api` | Make sure you're running `npx netlify dev` alongside Vite |
| Dashboard shows "No target configured" | Insert a row into the `targets` table for the current month/year |
| Admin panel is blank / redirects | Check that `user_role` in `localStorage` is `"admin"` and JWT token is valid |

---

## License

MIT
