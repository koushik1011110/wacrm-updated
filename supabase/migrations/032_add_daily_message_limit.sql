-- ============================================================
-- 032_add_daily_message_limit.sql — Daily message limits & AI reply tracking
--
-- Adds:
--   1. `daily_message_limit` to `ai_configs` to allow configuring a
--      daily cap of AI automated replies.
--   2. `is_ai_reply` to `messages` to identify messages sent by the
--      AI bot (independent of flows/automations) for quota counting.
--   3. Widens constraint on `auto_reply_max_per_conversation` to 40.
--   4. Creates RPC function to reload schema cache.
-- ============================================================

-- Add daily_message_limit column to ai_configs
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS daily_message_limit integer NOT NULL DEFAULT 50
  CHECK (daily_message_limit BETWEEN 1 AND 1000);

-- Add is_ai_reply column to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_ai_reply boolean NOT NULL DEFAULT false;

-- Drop the old constraint if it exists (inline constraints on tables are named like table_column_check)
ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_auto_reply_max_per_conversation_check;

-- Re-create the constraint with 40 as the maximum
ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_auto_reply_max_per_conversation_check 
  CHECK (auto_reply_max_per_conversation BETWEEN 1 AND 40);

-- Create helper to reload PostgREST schema cache
CREATE OR REPLACE FUNCTION public.reload_schema()
RETURNS void AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
