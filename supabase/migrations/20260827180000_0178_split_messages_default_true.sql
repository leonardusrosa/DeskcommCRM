-- Migration 0178: Make split_messages default true for new ai_agent_versions
-- Product requirement: New agent versions default to split_messages = true.
-- Existing rows explicitly false are preserved; only the column default is altered.

ALTER TABLE public.ai_agent_versions
  ALTER COLUMN split_messages SET DEFAULT true;