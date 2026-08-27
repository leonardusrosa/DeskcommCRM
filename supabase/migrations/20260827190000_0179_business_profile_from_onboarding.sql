-- Migration 0179: Migrate onboarding_state.welcome.o_que_faz to organizations.settings.business_profile.description
-- Rules:
-- 1. For organizations where onboarding_state->'welcome'->>'o_que_faz' exists and is non-empty.
-- 2. Where settings->'business_profile'->>'description' is absent or null.
-- 3. Never overwrite an already-existing business_profile.description.
-- 4. Preserve every unrelated organizations.settings key and preserve onboarding_state.
-- 5. Idempotent and tenant-safe.

UPDATE public.organizations
SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'business_profile',
  coalesce(settings->'business_profile', '{}'::jsonb) || jsonb_build_object(
    'description', trim(onboarding_state->'welcome'->>'o_que_faz')
  )
)
WHERE (onboarding_state->'welcome'->>'o_que_faz') IS NOT NULL
  AND trim(onboarding_state->'welcome'->>'o_que_faz') <> ''
  AND (
    settings->'business_profile'->>'description' IS NULL
    OR trim(settings->'business_profile'->>'description') = ''
  );