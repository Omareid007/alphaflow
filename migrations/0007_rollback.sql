-- Rollback Migration: Make email required in users table
-- Created: 2026-01-03
-- Description:
--   Rolls back migration 0007_make_email_required.sql by:
--   1. Removing email validation check constraint
--   2. Removing unique index on email
--   3. Making email column nullable again

-- Step 1: Remove email validation check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_check;

-- Step 2: Remove unique index on email
DROP INDEX IF EXISTS users_email_unique;

-- Step 3: Make email column nullable again
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Verify rollback
DO $$
DECLARE
  is_nullable TEXT;
BEGIN
  SELECT c.is_nullable INTO is_nullable
  FROM information_schema.columns c
  WHERE c.table_name = 'users' AND c.column_name = 'email';

  RAISE NOTICE 'Rollback complete: email is_nullable = %', is_nullable;
END $$;
