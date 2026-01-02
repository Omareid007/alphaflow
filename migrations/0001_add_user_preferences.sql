-- Migration: Add user_preferences table
-- Created: 2026-01-02
-- Description: Phase 3 Robinhood UI - User theme and animation preferences

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) NOT NULL DEFAULT 'dark',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#00C805',
  animation_level VARCHAR(10) NOT NULL DEFAULT 'full',
  chart_style VARCHAR(10) NOT NULL DEFAULT 'area',
  extras JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_preferences_user_id_unique UNIQUE(user_id)
);

-- Create index for fast user lookup
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

-- Add comment for documentation
COMMENT ON TABLE user_preferences IS 'User UI preferences for theme, animations, and chart styles';
COMMENT ON COLUMN user_preferences.theme IS 'Theme preference: dark, light, or system';
COMMENT ON COLUMN user_preferences.accent_color IS 'Custom accent color in hex format (e.g., #00C805)';
COMMENT ON COLUMN user_preferences.animation_level IS 'Animation preference: full, reduced, or none';
COMMENT ON COLUMN user_preferences.chart_style IS 'Chart display preference: area, candle, or line';
COMMENT ON COLUMN user_preferences.extras IS 'Extensible JSON field for future preferences';
