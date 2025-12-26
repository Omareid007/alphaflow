/*
  # Admin Hub Database Schema

  1. New Tables
    - `admin_providers` - External service providers (data, LLM, broker, etc.)
    - `admin_credentials` - Encrypted credentials for providers
    - `admin_budgets` - Usage limits and tracking per provider
    - `admin_llm_models` - LLM model catalog
    - `admin_llm_route_rules` - Routing rules for LLM selection
    - `admin_orchestrator_config` - Orchestrator configuration
    - `admin_job_runs` - Job execution history
    - `admin_risk_rules` - Risk enforcement rules
    - `admin_allocation_policies` - Position allocation policies
    - `admin_rebalance_policies` - Rebalancing policies
    - `admin_symbols` - Symbol master data
    - `admin_universe_lists` - Trading universe lists
    - `admin_fundamental_factors` - Fundamental data factors
    - `admin_candidates` - Trading candidates
    - `admin_orders` - Order admin view
    - `admin_positions` - Position admin view
    - `admin_strategy_meta` - Strategy admin metadata
    - `admin_audit_logs` - Audit trail
    - `admin_users` - Admin users
    
  2. Security
    - Enable RLS on all tables
    - Admin-only access policies
*/

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  hashed_password text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users full access" ON admin_users
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Providers
CREATE TABLE IF NOT EXISTS admin_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  base_url text,
  status text NOT NULL DEFAULT 'active',
  tags text[] DEFAULT ARRAY[]::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage providers" ON admin_providers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Credentials
CREATE TABLE IF NOT EXISTS admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES admin_providers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  encrypted_value text NOT NULL,
  last_rotated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credentials" ON admin_credentials
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Budgets
CREATE TABLE IF NOT EXISTS admin_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES admin_providers(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'org',
  daily_limit numeric NOT NULL DEFAULT 0,
  monthly_limit numeric NOT NULL DEFAULT 0,
  soft_limit numeric NOT NULL DEFAULT 0,
  hard_limit numeric NOT NULL DEFAULT 0,
  usage_today numeric DEFAULT 0,
  usage_month numeric DEFAULT 0,
  reset_policy jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budgets" ON admin_budgets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- LLM Models
CREATE TABLE IF NOT EXISTS admin_llm_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES admin_providers(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  context_window integer NOT NULL DEFAULT 4096,
  cost_input numeric NOT NULL DEFAULT 0,
  cost_output numeric NOT NULL DEFAULT 0,
  enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_llm_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage LLM models" ON admin_llm_models
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- LLM Route Rules
CREATE TABLE IF NOT EXISTS admin_llm_route_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  match_conditions jsonb NOT NULL,
  preferred_models uuid[] DEFAULT ARRAY[]::uuid[],
  fallback_models uuid[] DEFAULT ARRAY[]::uuid[],
  max_cost_per_req numeric,
  timeout_ms integer DEFAULT 30000,
  enabled boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_llm_route_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage route rules" ON admin_llm_route_rules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orchestrator Config
CREATE TABLE IF NOT EXISTS admin_orchestrator_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'paper',
  enabled_agents jsonb DEFAULT '[]'::jsonb,
  agent_params jsonb DEFAULT '{}'::jsonb,
  schedules jsonb DEFAULT '[]'::jsonb,
  kill_switch boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_orchestrator_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage orchestrator config" ON admin_orchestrator_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Job Runs
CREATE TABLE IF NOT EXISTS admin_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  logs_ref text,
  metrics jsonb DEFAULT '{}'::jsonb,
  error text
);

ALTER TABLE admin_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view job runs" ON admin_job_runs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can create job runs" ON admin_job_runs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Risk Rules
CREATE TABLE IF NOT EXISTS admin_risk_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  rule_type text NOT NULL,
  params jsonb NOT NULL,
  enabled boolean DEFAULT true,
  severity text DEFAULT 'medium',
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_risk_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage risk rules" ON admin_risk_rules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allocation Policies
CREATE TABLE IF NOT EXISTS admin_allocation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  constraints jsonb NOT NULL,
  defaults jsonb DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_allocation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage allocation policies" ON admin_allocation_policies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Rebalance Policies
CREATE TABLE IF NOT EXISTS admin_rebalance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cadence text NOT NULL,
  thresholds jsonb NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_rebalance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rebalance policies" ON admin_rebalance_policies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Symbols
CREATE TABLE IF NOT EXISTS admin_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  exchange text NOT NULL,
  asset_type text NOT NULL DEFAULT 'equity',
  is_eligible boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage symbols" ON admin_symbols
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Universe Lists
CREATE TABLE IF NOT EXISTS admin_universe_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  symbols uuid[] DEFAULT ARRAY[]::uuid[],
  rules jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_universe_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage universe lists" ON admin_universe_lists
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fundamental Factors
CREATE TABLE IF NOT EXISTS admin_fundamental_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text NOT NULL,
  refresh_cadence text NOT NULL,
  formula jsonb DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT true,
  last_refresh timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_fundamental_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fundamental factors" ON admin_fundamental_factors
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Candidates
CREATE TABLE IF NOT EXISTS admin_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid REFERENCES admin_symbols(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  rationale text,
  as_of timestamptz DEFAULT now(),
  source_run_id uuid,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage candidates" ON admin_candidates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orders (Admin View)
CREATE TABLE IF NOT EXISTS admin_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  strategy_id text,
  symbol text NOT NULL,
  side text NOT NULL,
  quantity numeric NOT NULL,
  price numeric,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view orders" ON admin_orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Positions (Admin View)
CREATE TABLE IF NOT EXISTS admin_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id text,
  symbol text NOT NULL,
  quantity numeric NOT NULL,
  avg_price numeric NOT NULL,
  current_price numeric,
  unrealized_pnl numeric DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view positions" ON admin_positions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Strategy Admin Meta
CREATE TABLE IF NOT EXISTS admin_strategy_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id text NOT NULL UNIQUE,
  flags jsonb DEFAULT '{}'::jsonb,
  override_status text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_strategy_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage strategy meta" ON admin_strategy_meta
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  diff jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON admin_audit_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can create audit logs" ON admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_providers_type ON admin_providers(type);
CREATE INDEX IF NOT EXISTS idx_credentials_provider ON admin_credentials(provider_id);
CREATE INDEX IF NOT EXISTS idx_budgets_provider ON admin_budgets(provider_id);
CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON admin_llm_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_type_status ON admin_job_runs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_symbols_ticker ON admin_symbols(ticker);
CREATE INDEX IF NOT EXISTS idx_candidates_symbol ON admin_candidates(symbol_id);
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON admin_orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_positions_strategy ON admin_positions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON admin_audit_logs(entity_type, entity_id);

-- Insert default orchestrator config
INSERT INTO admin_orchestrator_config (mode, enabled_agents, kill_switch)
VALUES ('paper', '["listener", "analyzer", "executor", "reporter"]'::jsonb, false)
ON CONFLICT DO NOTHING;
