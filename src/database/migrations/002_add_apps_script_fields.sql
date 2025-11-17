-- Migration: 002_add_apps_script_fields.sql
-- Description: Add Apps Script metadata and LLM usage tracking to user_templates table

-- Add Apps Script fields to user_templates
ALTER TABLE user_templates
  ADD COLUMN IF NOT EXISTS apps_script_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS apps_script_webapp_url TEXT,
  ADD COLUMN IF NOT EXISTS apps_script_deployment_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_user_templates_apps_script_id ON user_templates(apps_script_id);

-- Create LLM usage logs table
CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_text TEXT NOT NULL,
    used_llm BOOLEAN NOT NULL DEFAULT false,
    llm_provider VARCHAR(50),
    tokens_used INTEGER,
    cost_cents DECIMAL(10,4),
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on user_id and created_at for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created ON llm_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage_logs(created_at);

-- Create user plan tiers table (for future usage limits)
CREATE TABLE IF NOT EXISTS user_plan_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    daily_llm_limit INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plan tiers
INSERT INTO user_plan_tiers (name, daily_llm_limit, description) VALUES
    ('free', 5, 'Free tier with 5 LLM queries per day'),
    ('basic', 20, 'Basic tier with 20 LLM queries per day'),
    ('premium', -1, 'Premium tier with unlimited LLM queries')
ON CONFLICT (name) DO NOTHING;

-- Add plan tier to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS llm_usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_date DATE DEFAULT CURRENT_DATE;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_plan_tier'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_plan_tier FOREIGN KEY (plan_tier) REFERENCES user_plan_tiers(name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_plan_tier ON users(plan_tier);
CREATE INDEX IF NOT EXISTS idx_users_usage_reset ON users(usage_reset_date);

