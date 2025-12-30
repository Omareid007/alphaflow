-- Strategy Lifecycle Migration
-- Adds status, mode, config, and related columns to enable full strategy lifecycle management

-- Step 1: Add new columns to strategies table
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "mode" text;
--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "template_id" text DEFAULT 'custom';
--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "config" jsonb DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "last_backtest_id" varchar;
--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "performance_summary" jsonb;
--> statement-breakpoint

-- Step 2: Migrate existing data - convert isActive to status
UPDATE "strategies"
SET "status" = CASE
  WHEN "is_active" = true THEN 'paper'
  ELSE 'draft'
END
WHERE "status" = 'draft' AND "is_active" IS NOT NULL;
--> statement-breakpoint

-- Step 3: Set mode for currently active strategies
UPDATE "strategies"
SET "mode" = 'paper'
WHERE "is_active" = true AND "mode" IS NULL;
--> statement-breakpoint

-- Step 4: Migrate parameters (text JSON) to config (JSONB) where possible
UPDATE "strategies"
SET "config" = CASE
  WHEN "parameters" IS NOT NULL
    AND "parameters" != ''
    AND "parameters" != 'null'
    AND "parameters" ~ '^[\{\[].*[\}\]]$'
  THEN "parameters"::jsonb
  ELSE '{}'::jsonb
END
WHERE ("config" = '{}' OR "config" IS NULL) AND "parameters" IS NOT NULL;
--> statement-breakpoint

-- Step 5: Set template_id based on type if not set
UPDATE "strategies"
SET "template_id" = COALESCE(
  CASE
    WHEN "type" ILIKE '%moving%average%' OR "type" = 'moving_average_crossover' THEN 'moving_average_crossover'
    WHEN "type" ILIKE '%mean%reversion%' OR "type" = 'mean_reversion_scalper' THEN 'mean_reversion_scalper'
    WHEN "type" ILIKE '%momentum%' OR "type" = 'momentum_strategy' THEN 'momentum_strategy'
    WHEN "type" ILIKE '%breakout%' THEN 'breakout_strategy'
    WHEN "type" ILIKE '%range%' THEN 'range_trading'
    ELSE "type"
  END,
  'custom'
)
WHERE "template_id" IS NULL OR "template_id" = 'custom';
--> statement-breakpoint

-- Step 6: Add foreign key constraint for last_backtest_id (if backtest_runs table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backtest_runs') THEN
    ALTER TABLE "strategies"
    ADD CONSTRAINT IF NOT EXISTS "strategies_last_backtest_id_fk"
    FOREIGN KEY ("last_backtest_id")
    REFERENCES "backtest_runs"("id")
    ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Constraint already exists, do nothing
END $$;
--> statement-breakpoint

-- Step 7: Add indexes for new columns
CREATE INDEX IF NOT EXISTS "strategies_status_idx" ON "strategies"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategies_mode_idx" ON "strategies"("mode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategies_template_id_idx" ON "strategies"("template_id");
--> statement-breakpoint

-- Step 8: Add check constraints for valid enum values
DO $$
BEGIN
  ALTER TABLE "strategies" ADD CONSTRAINT "strategies_status_check"
    CHECK ("status" IN ('draft', 'backtesting', 'paper', 'live', 'paused', 'stopped'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "strategies" ADD CONSTRAINT "strategies_mode_check"
    CHECK ("mode" IS NULL OR "mode" IN ('paper', 'live'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
