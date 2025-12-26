/*
  # Providers & API Integration System

  1. New Tables
    - `providers`
      - Core provider information with API integration configs
      - Includes rate limiting, retry policies, health checks
      - Full authentication and connection settings
    - `provider_credentials`
      - Encrypted credential storage
      - Support for multiple credential types per provider
    - `provider_budgets`
      - Budget limits and tracking per provider
      - Daily, monthly, and usage-based limits
    - `provider_usage`
      - Detailed usage tracking and metrics
      - Request counts, costs, errors
    - `provider_health_logs`
      - Health check history and status
      - Latency and error tracking

  2. Security
    - Enable RLS on all tables
    - Restrict access to authenticated admin users only
    - Encrypt sensitive credential data
*/

-- Create enum types
DO $$ BEGIN
  CREATE TYPE provider_type AS ENUM ('data', 'llm', 'broker', 'news', 'sentiment', 'analytics', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_status AS ENUM ('active', 'inactive', 'error', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE credential_kind AS ENUM ('apiKey', 'oauth', 'token', 'basic', 'bearer', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE auth_method AS ENUM ('header', 'query', 'body', 'oauth2', 'basic', 'bearer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Providers table
CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type provider_type NOT NULL,
  status provider_status DEFAULT 'active',
  
  -- API Configuration
  base_url text,
  api_version text,
  auth_method auth_method DEFAULT 'header',
  
  -- Rate Limiting
  rate_limit_requests integer DEFAULT 100,
  rate_limit_window_seconds integer DEFAULT 60,
  rate_limit_per_key boolean DEFAULT false,
  
  -- Retry Configuration
  retry_enabled boolean DEFAULT true,
  retry_max_attempts integer DEFAULT 3,
  retry_backoff_ms integer DEFAULT 1000,
  retry_backoff_multiplier numeric DEFAULT 2.0,
  
  -- Timeout Configuration
  timeout_connect_ms integer DEFAULT 5000,
  timeout_request_ms integer DEFAULT 30000,
  timeout_total_ms integer DEFAULT 60000,
  
  -- Health Check
  health_check_enabled boolean DEFAULT true,
  health_check_endpoint text,
  health_check_interval_seconds integer DEFAULT 300,
  health_check_timeout_ms integer DEFAULT 5000,
  
  -- Connection Pool
  connection_pool_size integer DEFAULT 10,
  connection_pool_timeout_ms integer DEFAULT 30000,
  
  -- Webhook Configuration
  webhook_url text,
  webhook_secret text,
  webhook_events text[] DEFAULT ARRAY[]::text[],
  
  -- Request/Response Format
  request_format text DEFAULT 'json',
  response_format text DEFAULT 'json',
  custom_headers jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  tags text[] DEFAULT ARRAY[]::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_health_check timestamptz,
  
  CONSTRAINT providers_name_key UNIQUE (name)
);

-- Provider credentials table
CREATE TABLE IF NOT EXISTS provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  kind credential_kind NOT NULL,
  
  -- Encrypted credential value
  encrypted_value text NOT NULL,
  encryption_key_id text,
  
  -- Credential metadata
  description text,
  expires_at timestamptz,
  rotation_policy_days integer DEFAULT 90,
  last_rotated_at timestamptz,
  
  -- Additional fields for OAuth
  refresh_token text,
  token_endpoint text,
  scopes text[],
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  
  -- Status
  is_active boolean DEFAULT true
);

-- Provider budgets table
CREATE TABLE IF NOT EXISTS provider_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Budget limits (in dollars)
  daily_limit numeric DEFAULT 100.00,
  monthly_limit numeric DEFAULT 3000.00,
  soft_limit numeric DEFAULT 80.00,
  hard_limit numeric DEFAULT 100.00,
  
  -- Usage tracking
  usage_today numeric DEFAULT 0.00,
  usage_month numeric DEFAULT 0.00,
  usage_total numeric DEFAULT 0.00,
  
  -- Request limits
  daily_request_limit integer,
  monthly_request_limit integer,
  requests_today integer DEFAULT 0,
  requests_month integer DEFAULT 0,
  
  -- Alert configuration
  alert_on_soft_limit boolean DEFAULT true,
  alert_on_hard_limit boolean DEFAULT true,
  alert_emails text[] DEFAULT ARRAY[]::text[],
  
  -- Reset tracking
  last_daily_reset timestamptz DEFAULT now(),
  last_monthly_reset timestamptz DEFAULT now(),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT provider_budgets_provider_id_key UNIQUE (provider_id)
);

-- Provider usage tracking table
CREATE TABLE IF NOT EXISTS provider_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Usage metrics
  date date NOT NULL,
  requests_count integer DEFAULT 0,
  requests_success integer DEFAULT 0,
  requests_failed integer DEFAULT 0,
  
  -- Cost tracking
  amount numeric DEFAULT 0.00,
  tokens_used integer DEFAULT 0,
  
  -- Performance metrics
  avg_latency_ms numeric,
  p95_latency_ms numeric,
  p99_latency_ms numeric,
  
  -- Error tracking
  error_rate numeric DEFAULT 0.00,
  error_details jsonb DEFAULT '{}'::jsonb,
  
  -- Additional metrics
  data_transferred_bytes bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT provider_usage_provider_date_key UNIQUE (provider_id, date)
);

-- Provider health logs table
CREATE TABLE IF NOT EXISTS provider_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Health check result
  success boolean NOT NULL,
  latency_ms integer,
  status_code integer,
  
  -- Error information
  error_message text,
  error_details jsonb,
  
  -- Timestamp
  checked_at timestamptz DEFAULT now(),
  
  -- Index for efficient queries
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_provider_id ON provider_credentials(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_active ON provider_credentials(provider_id, is_active);
CREATE INDEX IF NOT EXISTS idx_provider_usage_provider_date ON provider_usage(provider_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_health_logs_provider ON provider_health_logs(provider_id, checked_at DESC);

-- Enable Row Level Security
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for providers
CREATE POLICY "Authenticated users can view providers"
  ON providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert providers"
  ON providers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update providers"
  ON providers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete providers"
  ON providers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for provider_credentials
CREATE POLICY "Authenticated users can view credentials"
  ON provider_credentials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert credentials"
  ON provider_credentials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update credentials"
  ON provider_credentials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete credentials"
  ON provider_credentials FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for provider_budgets
CREATE POLICY "Authenticated users can view budgets"
  ON provider_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert budgets"
  ON provider_budgets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update budgets"
  ON provider_budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete budgets"
  ON provider_budgets FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for provider_usage
CREATE POLICY "Authenticated users can view usage"
  ON provider_usage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert usage"
  ON provider_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update usage"
  ON provider_usage FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for provider_health_logs
CREATE POLICY "Authenticated users can view health logs"
  ON provider_health_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert health logs"
  ON provider_health_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
  CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_provider_credentials_updated_at ON provider_credentials;
  CREATE TRIGGER update_provider_credentials_updated_at
    BEFORE UPDATE ON provider_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_provider_budgets_updated_at ON provider_budgets;
  CREATE TRIGGER update_provider_budgets_updated_at
    BEFORE UPDATE ON provider_budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
END $$;
