-- Migration 0177: LLM Cost Precision Hardening
-- Convert AI model prices and budget tracking fields to unconstrained NUMERIC
-- to preserve fractional cents accurately without premature integer or scale-4 rounding.

-- 1. ai_models pricing columns: INTEGER -> NUMERIC
ALTER TABLE public.ai_models
  ALTER COLUMN input_price_per_million_cents TYPE numeric USING input_price_per_million_cents::numeric,
  ALTER COLUMN output_price_per_million_cents TYPE numeric USING output_price_per_million_cents::numeric;

-- 2. ai_budgets consumption tracking: NUMERIC(12,4) -> NUMERIC
ALTER TABLE public.ai_budgets
  ALTER COLUMN current_month_consumed_cents TYPE numeric USING current_month_consumed_cents::numeric;

-- 3. ai_invocations legacy table: NUMERIC(10,4) -> NUMERIC
ALTER TABLE public.ai_invocations
  ALTER COLUMN cost_cents TYPE numeric USING cost_cents::numeric;