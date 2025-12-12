-- AI Active Trader Database Initialization
-- This script runs when the Postgres container first starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create service-specific schemas for future migration
CREATE SCHEMA IF NOT EXISTS trading_engine;
CREATE SCHEMA IF NOT EXISTS ai_decision;
CREATE SCHEMA IF NOT EXISTS market_data;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS orchestrator;

-- Grant permissions
GRANT ALL ON SCHEMA trading_engine TO postgres;
GRANT ALL ON SCHEMA ai_decision TO postgres;
GRANT ALL ON SCHEMA market_data TO postgres;
GRANT ALL ON SCHEMA analytics TO postgres;
GRANT ALL ON SCHEMA orchestrator TO postgres;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'AI Active Trader database initialized with service schemas';
END $$;
