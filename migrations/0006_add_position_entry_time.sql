-- Migration: Add entry_time column to positions table
-- Fixes TE-001: Position entry time lost on restart
-- Date: 2025-12-31

-- Add entry_time column with default value of current timestamp
-- For existing positions, use opened_at as the entry time
ALTER TABLE positions
ADD COLUMN entry_time TIMESTAMP NOT NULL DEFAULT NOW();

-- Update existing positions to use opened_at as entry_time
-- This ensures existing positions get their correct entry time
UPDATE positions
SET entry_time = opened_at
WHERE entry_time = NOW();

-- Add comment for documentation
COMMENT ON COLUMN positions.entry_time IS 'Entry timestamp for exit rule tracking, persists across restarts (fixes TE-001 race condition)';
