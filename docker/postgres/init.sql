-- Full schema initialization for fresh VM deployment
-- Safe to run on empty database; does NOT drop existing tables

-- 1. Users (Salesmen, Supervisors, Admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'supervisor', 'admin')),
  region TEXT DEFAULT '',
  level TEXT CHECK (level IN ('L2', 'L3')),
  password_hash TEXT NOT NULL,
  netlify_uid TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Outlets (with Branch Area)
CREATE TABLE IF NOT EXISTS outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT '',
  branch_area TEXT DEFAULT '',
  address TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Outlet Assignments (supports history + vacant state)
CREATE TABLE IF NOT EXISTS outlet_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  salesman_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_oa_active ON outlet_assignments(unassigned_at) WHERE unassigned_at IS NULL;

-- 4. Sales Records
CREATE TABLE IF NOT EXISTS sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID REFERENCES outlets(id),
  sales_id UUID REFERENCES users(id),
  record_date DATE NOT NULL,
  volume_be NUMERIC NOT NULL,
  sku_name TEXT
);

-- 5. Targets (with structured bonus configs)
CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_be NUMERIC NOT NULL,
  incentive_rules JSONB DEFAULT '[]'::jsonb,
  percentage_config JSONB DEFAULT NULL,
  volume_config JSONB DEFAULT NULL,
  active_outlets_config JSONB DEFAULT NULL,
  UNIQUE(user_id, month, year)
);

-- 6. User Branches (supports multi-branch salesmen)
CREATE TABLE IF NOT EXISTS user_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, branch_name)
);
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_name);
