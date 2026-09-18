-- 0181 — atomic capacity gate for anonymous synthetic demo provisioning
--
-- The public demo endpoint can receive concurrent requests. A count in Node followed
-- by an insert is racy: several requests can all observe 24 active demos and create
-- past the cap. This function keeps count + insert in one transaction and serializes
-- only this tiny critical section with an advisory transaction lock.
--
-- Service-role only: anonymous/authenticated users must never create organizations
-- directly through this function.

create or replace function public.fn_create_demo_organization(
  p_slug text,
  p_display_name text,
  p_legal_name text,
  p_timezone text,
  p_locale text,
  p_settings jsonb,
  p_onboarded_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('deskcomm:demo-capacity'));

  select count(*)
    into v_active
    from public.organizations
   where settings @> '{"demo": true}'::jsonb
     and nullif(settings->>'demo_expires_at', '')::timestamptz > now();

  if v_active >= 25 then
    raise exception 'Demo capacity reached. Try again after an existing demo expires.';
  end if;

  insert into public.organizations (
    slug,
    display_name,
    legal_name,
    timezone,
    locale,
    settings,
    onboarded_at
  )
  values (
    p_slug,
    p_display_name,
    p_legal_name,
    p_timezone,
    p_locale,
    p_settings,
    p_onboarded_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.fn_create_demo_organization(
  text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.fn_create_demo_organization(
  text, text, text, text, text, jsonb, timestamptz
) to service_role;
