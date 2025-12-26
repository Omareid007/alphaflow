-- Add critical performance indexes for high-traffic queries
-- These indexes will significantly improve query performance for common operations

-- AI Decisions table indexes (use created_at instead of timestamp)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_created_at_idx ON ai_decisions(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_symbol_idx ON ai_decisions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_status_idx ON ai_decisions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_action_idx ON ai_decisions(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_user_id_idx ON ai_decisions(user_id);

-- Trades table indexes (use executed_at instead of created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS trades_symbol_idx ON trades(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS trades_executed_at_idx ON trades(executed_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS trades_strategy_id_idx ON trades(strategy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS trades_user_id_idx ON trades(user_id);

-- Orders table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_symbol_idx ON orders(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_created_at_idx ON orders(created_at);

-- Positions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS positions_symbol_idx ON positions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS positions_user_id_idx ON positions(user_id);

-- Strategies table indexes (no user_id column in strategies)
CREATE INDEX CONCURRENTLY IF NOT EXISTS strategies_is_active_idx ON strategies(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS strategies_created_at_idx ON strategies(created_at);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_decisions_user_created_idx ON ai_decisions(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_user_status_idx ON orders(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS trades_user_executed_idx ON trades(user_id, executed_at DESC);

-- Sessions table for faster session lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes created successfully';
END $$;
