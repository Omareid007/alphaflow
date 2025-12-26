/*
  # Provider API Functions System

  1. New Tables
    - `provider_api_functions`
      - Stores discovered API endpoints/functions from providers
      - Includes method, path, parameters, responses
      - Links to parent provider
    - `provider_api_schemas`
      - Stores discovered data schemas/models
      - Referenced by API functions

  2. Security
    - Enable RLS on all tables
    - Authenticated users can manage API functions
*/

-- API Functions table
CREATE TABLE IF NOT EXISTS provider_api_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Endpoint identification
  name text NOT NULL,
  operation_id text,
  method text NOT NULL,
  path text NOT NULL,
  
  -- Documentation
  summary text,
  description text,
  tags text[] DEFAULT ARRAY[]::text[],
  
  -- Parameters
  parameters jsonb DEFAULT '[]'::jsonb,
  request_body jsonb,
  
  -- Responses
  responses jsonb DEFAULT '{}'::jsonb,
  
  -- Security requirements
  security jsonb DEFAULT '[]'::jsonb,
  auth_required boolean DEFAULT true,
  
  -- Rate limiting specific to this endpoint
  rate_limit integer,
  rate_limit_window_seconds integer,
  
  -- Pricing/cost info
  cost_per_call numeric DEFAULT 0,
  tokens_per_call integer,
  
  -- Status
  is_enabled boolean DEFAULT true,
  is_deprecated boolean DEFAULT false,
  deprecated_message text,
  
  -- Testing
  last_tested_at timestamptz,
  last_test_success boolean,
  last_test_latency_ms integer,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT provider_api_functions_unique UNIQUE (provider_id, method, path)
);

-- API Schemas table
CREATE TABLE IF NOT EXISTS provider_api_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Schema identification
  name text NOT NULL,
  schema_type text DEFAULT 'object',
  
  -- Schema definition
  properties jsonb DEFAULT '{}'::jsonb,
  required_fields text[] DEFAULT ARRAY[]::text[],
  
  -- Documentation
  description text,
  example jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT provider_api_schemas_unique UNIQUE (provider_id, name)
);

-- API Discovery logs
CREATE TABLE IF NOT EXISTS provider_api_discovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  
  -- Discovery info
  source_url text NOT NULL,
  source_type text,
  
  -- Results
  success boolean NOT NULL,
  functions_discovered integer DEFAULT 0,
  schemas_discovered integer DEFAULT 0,
  
  -- Error info
  error_message text,
  error_details jsonb,
  
  -- Timestamp
  discovered_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_functions_provider ON provider_api_functions(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_functions_method ON provider_api_functions(method);
CREATE INDEX IF NOT EXISTS idx_api_functions_tags ON provider_api_functions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_api_schemas_provider ON provider_api_schemas(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_discovery_provider ON provider_api_discovery_logs(provider_id);

-- Enable RLS
ALTER TABLE provider_api_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_api_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_api_discovery_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for provider_api_functions
CREATE POLICY "Authenticated users can view api functions"
  ON provider_api_functions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert api functions"
  ON provider_api_functions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update api functions"
  ON provider_api_functions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api functions"
  ON provider_api_functions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for provider_api_schemas
CREATE POLICY "Authenticated users can view api schemas"
  ON provider_api_schemas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert api schemas"
  ON provider_api_schemas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update api schemas"
  ON provider_api_schemas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api schemas"
  ON provider_api_schemas FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for provider_api_discovery_logs
CREATE POLICY "Authenticated users can view discovery logs"
  ON provider_api_discovery_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert discovery logs"
  ON provider_api_discovery_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Triggers for updated_at
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_provider_api_functions_updated_at ON provider_api_functions;
  CREATE TRIGGER update_provider_api_functions_updated_at
    BEFORE UPDATE ON provider_api_functions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_provider_api_schemas_updated_at ON provider_api_schemas;
  CREATE TRIGGER update_provider_api_schemas_updated_at
    BEFORE UPDATE ON provider_api_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
END $$;
