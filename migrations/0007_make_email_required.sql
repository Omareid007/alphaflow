-- Migration: Make email required in users table
-- Created: 2026-01-03
-- Description:
--   1. Backfill null emails with placeholder format
--   2. Make email column NOT NULL
--   3. Add unique constraint on email
--   4. Add email validation check constraint

-- Step 1: Check current state (for audit purposes)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM users WHERE email IS NULL;
  RAISE NOTICE 'Found % users with null emails', null_count;
END $$;

-- Step 2: Backfill null emails with placeholder
-- Format: noreply+{user_id}@alphaflow.app
UPDATE users
SET email = 'noreply+' || id || '@alphaflow.app'
WHERE email IS NULL;

-- Step 3: Make email column NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Step 4: Add unique constraint on email
-- Using CREATE UNIQUE INDEX for better performance
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);

-- Step 5: Add email validation check constraint
-- Validates basic email format: local-part@domain.tld
ALTER TABLE users ADD CONSTRAINT users_email_check
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Verify migration
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM users WHERE email IS NULL;
  SELECT COUNT(*) INTO total_count FROM users;
  RAISE NOTICE 'Migration complete: % total users, % with null emails (should be 0)', total_count, null_count;
END $$;
