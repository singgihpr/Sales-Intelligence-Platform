-- Migration: Add unique constraint to sales_records for idempotent imports
-- Date: 2026-07-08
-- Ensures duplicate uploads overwrite existing volume instead of appending duplicates.
--
-- Steps:
-- 1. Normalize NULL sku_name values so the constraint can be plain.
-- 2. Remove duplicate rows that were created by the previous append-only import.
--    Keeps the row with the highest id (UUID, deterministic but arbitrary).
-- 3. Add a unique constraint on (outlet_id, sales_id, record_date, sku_name).

UPDATE sales_records SET sku_name = '' WHERE sku_name IS NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY outlet_id, sales_id, record_date, sku_name
    ORDER BY id DESC
  ) AS rn
  FROM sales_records
)
DELETE FROM sales_records
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE sales_records
  ADD CONSTRAINT uq_sales_records_unique
  UNIQUE (outlet_id, sales_id, record_date, sku_name);
