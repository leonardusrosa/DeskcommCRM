-- Migration: 20260917180000_0182_pms_bridge_persistence.sql
-- PMS bridge persistence. Forward-only and not yet applied to production.
-- Uses canonical Deskcomm organization tenancy helpers from Spec 01.

CREATE TABLE IF NOT EXISTS public.pms_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'disconnected', 'error', 'disabled')),
  health TEXT NOT NULL DEFAULT 'HEALTHY'
    CHECK (health IN ('HEALTHY', 'DEGRADED', 'FAILED', 'DISABLED')),
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  appointment_write_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  endpoint_url TEXT NOT NULL CHECK (endpoint_url ~ '^https://'),
  last4 TEXT NOT NULL DEFAULT '0000',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_connections_org_provider UNIQUE (organization_id, provider)
);

-- Encrypted credential material is deliberately separated from tenant-visible
-- connection metadata. No authenticated/anon policy is created for this table;
-- server workers access it with the service role and explicit organization_id.
CREATE TABLE IF NOT EXISTS public.pms_connection_secrets (
  connection_id UUID PRIMARY KEY REFERENCES public.pms_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credential_ciphertext TEXT NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_connection_secrets_org_connection UNIQUE (organization_id, connection_id)
);

CREATE TABLE IF NOT EXISTS public.pms_external_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'appointment')),
  external_id TEXT NOT NULL,
  deskcomm_id TEXT NOT NULL,
  external_version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  last_external_update_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'failed', 'disabled')),
  conflict_type TEXT
    CHECK (conflict_type IN ('external_newer', 'deskcomm_newer', 'ambiguous', 'external_deleted', 'deskcomm_deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_external_mappings_natural
    UNIQUE (organization_id, provider, entity_type, external_id)
);

-- Read-only administrative mirror of PMS appointments.
-- It is intentionally NOT calendar_appointments: importing a PMS appointment
-- must not trigger Deskcomm reminders, lead transitions, Google sync, or availability writes.
CREATE TABLE IF NOT EXISTS public.pms_appointment_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  external_id TEXT NOT NULL,
  patient_external_id TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  provider_label TEXT,
  status TEXT NOT NULL,
  appointment_label TEXT NOT NULL,
  external_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_appointment_mirrors_natural
    UNIQUE (organization_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.pms_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_pms_external_identity
  ON public.contacts (
    organization_id,
    ((source_metadata #>> '{pms,provider}')),
    ((source_metadata #>> '{pms,external_id}'))
  )
  WHERE source = 'pms'
    AND (source_metadata #>> '{pms,provider}') IS NOT NULL
    AND (source_metadata #>> '{pms,external_id}') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pms_connections_org
  ON public.pms_connections (organization_id);
CREATE INDEX IF NOT EXISTS idx_pms_connection_secrets_org
  ON public.pms_connection_secrets (organization_id);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_lookup
  ON public.pms_external_mappings (organization_id, provider, entity_type);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_status
  ON public.pms_external_mappings (organization_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_pms_appointment_mirrors_window
  ON public.pms_appointment_mirrors (organization_id, provider, starts_at);
CREATE INDEX IF NOT EXISTS idx_pms_appointment_mirrors_contact
  ON public.pms_appointment_mirrors (organization_id, contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pms_audit_org_created
  ON public.pms_audit_events (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_pms_connections_touch ON public.pms_connections;
CREATE TRIGGER trg_pms_connections_touch
  BEFORE UPDATE ON public.pms_connections
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pms_connection_secrets_touch ON public.pms_connection_secrets;
CREATE TRIGGER trg_pms_connection_secrets_touch
  BEFORE UPDATE ON public.pms_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pms_appointment_mirrors_touch ON public.pms_appointment_mirrors;
CREATE TRIGGER trg_pms_appointment_mirrors_touch
  BEFORE UPDATE ON public.pms_appointment_mirrors
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_appointment_mirrors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_audit_events ENABLE ROW LEVEL SECURITY;

-- Metadata is visible/manageable only to tenant admins/platform admins.
DROP POLICY IF EXISTS pms_connections_admin_only ON public.pms_connections;
CREATE POLICY pms_connections_admin_only ON public.pms_connections
  FOR ALL
  USING (
    public.fn_role_at_least(organization_id, 'admin')
    OR public.fn_is_platform_admin()
  )
  WITH CHECK (
    public.fn_role_at_least(organization_id, 'admin')
    OR public.fn_is_platform_admin()
  );
GRANT SELECT ON public.pms_connections TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pms_connections FROM authenticated, anon;

-- No policy on pms_connection_secrets: service-role only (BYPASSRLS).
REVOKE ALL ON public.pms_connection_secrets FROM authenticated, anon;

-- External ids and patient linkage are internal integration state.
-- No tenant-facing PostgREST access: safe product surfaces must expose only the
-- administrative fields they actually need.
DROP POLICY IF EXISTS pms_external_mappings_select ON public.pms_external_mappings;
REVOKE ALL ON public.pms_external_mappings FROM authenticated, anon;

DROP POLICY IF EXISTS pms_appointment_mirrors_select ON public.pms_appointment_mirrors;
REVOKE ALL ON public.pms_appointment_mirrors FROM authenticated, anon;

-- Audit is readable by tenant admins/platform admins and written by service-role only.
DROP POLICY IF EXISTS pms_audit_events_select ON public.pms_audit_events;
CREATE POLICY pms_audit_events_select ON public.pms_audit_events
  FOR SELECT
  USING (
    public.fn_role_at_least(organization_id, 'admin')
    OR public.fn_is_platform_admin()
  );
GRANT SELECT ON public.pms_audit_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pms_audit_events FROM authenticated, anon;
