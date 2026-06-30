-- Migration: Add supervisor_id to users for explicit supervisor→salesman assignment
-- Date: 2026-06-30

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
