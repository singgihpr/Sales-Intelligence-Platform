-- Migration: Backlog Feature Completion (Safe Re-run)
-- Date: 2026-05-20

-- 1. Salesman Level (L2 / L3)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('L2', 'L3'));

-- 2. Branch Area Name on Outlets
ALTER TABLE outlets 
  ADD COLUMN IF NOT EXISTS branch_area TEXT DEFAULT '';

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

-- 4. Structured Bonus Configs per User per Month
ALTER TABLE targets 
  ADD COLUMN IF NOT EXISTS percentage_config JSONB DEFAULT NULL;
ALTER TABLE targets 
  ADD COLUMN IF NOT EXISTS volume_config JSONB DEFAULT NULL;
ALTER TABLE targets 
  ADD COLUMN IF NOT EXISTS active_outlets_config JSONB DEFAULT NULL;
