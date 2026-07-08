-- Migration: SKU Incentives + Bonus BE
-- Enables Admin to set promotional BE bonus per SKU for specific date ranges

CREATE TABLE IF NOT EXISTS sku_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_name TEXT NOT NULL,
  bonus_be NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sku_incentives_active ON sku_incentives(sku_name, start_date, end_date) WHERE is_active = true;
