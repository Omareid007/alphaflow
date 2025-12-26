-- Migration: Add User Data Isolation and Fix Security Issues
-- Date: 2025-12-24
-- Description: Adds userId columns to core tables for multi-user data isolation,
--              adds indexes for performance, and prepares for transaction support

-- ============================================================================
-- STEP 1: Add userId columns to core tables
-- ============================================================================

-- Add userId to trades table
ALTER TABLE trades
ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

-- Add userId to positions table
ALTER TABLE positions
ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

-- Add userId to ai_decisions table
ALTER TABLE ai_decisions
ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

-- Add userId to orders table
ALTER TABLE orders
ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Backfill existing data with first user (for existing data)
-- ============================================================================

-- Get the first user ID (or create a default user if none exists)
DO $$
DECLARE
  first_user_id VARCHAR;
BEGIN
  SELECT id INTO first_user_id FROM users ORDER BY username LIMIT 1;

  -- If no users exist, create a default admin user
  IF first_user_id IS NULL THEN
    INSERT INTO users (username, password, is_admin)
    VALUES ('admin', '$2a$10$YourHashedPasswordHere', true)
    RETURNING id INTO first_user_id;
  END IF;

  -- Update trades
  UPDATE trades SET user_id = first_user_id WHERE user_id IS NULL;

  -- Update positions
  UPDATE positions SET user_id = first_user_id WHERE user_id IS NULL;

  -- Update ai_decisions
  UPDATE ai_decisions SET user_id = first_user_id WHERE user_id IS NULL;

  -- Update orders
  UPDATE orders SET user_id = first_user_id WHERE user_id IS NULL;
END $$;

-- ============================================================================
-- STEP 3: Make userId columns NOT NULL (after backfill)
-- ============================================================================

ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE positions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_decisions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS trades_user_id_idx ON trades(user_id);
CREATE INDEX IF NOT EXISTS positions_user_id_idx ON positions(user_id);
CREATE INDEX IF NOT EXISTS ai_decisions_user_id_idx ON ai_decisions(user_id);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS trades_user_symbol_idx ON trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS trades_user_executed_at_idx ON trades(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS positions_user_symbol_idx ON positions(user_id, symbol);
CREATE INDEX IF NOT EXISTS ai_decisions_user_status_idx ON ai_decisions(user_id, status);
CREATE INDEX IF NOT EXISTS orders_user_status_idx ON orders(user_id, status);

-- ============================================================================
-- STEP 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN trades.user_id IS 'User ID for data isolation - ensures users only see their own trades';
COMMENT ON COLUMN positions.user_id IS 'User ID for data isolation - ensures users only see their own positions';
COMMENT ON COLUMN ai_decisions.user_id IS 'User ID for data isolation - ensures users only see their own AI decisions';
COMMENT ON COLUMN orders.user_id IS 'User ID for data isolation - ensures users only see their own orders';

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================

-- Verify all trades have userId
-- SELECT COUNT(*) as trades_without_user FROM trades WHERE user_id IS NULL;

-- Verify all positions have userId
-- SELECT COUNT(*) as positions_without_user FROM positions WHERE user_id IS NULL;

-- Verify all ai_decisions have userId
-- SELECT COUNT(*) as decisions_without_user FROM ai_decisions WHERE user_id IS NULL;

-- Verify all orders have userId
-- SELECT COUNT(*) as orders_without_user FROM orders WHERE user_id IS NULL;

-- Verify indexes were created
-- SELECT tablename, indexname FROM pg_indexes WHERE tablename IN ('trades', 'positions', 'ai_decisions', 'orders') AND indexname LIKE '%user_id%';
