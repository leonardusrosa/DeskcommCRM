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
  credential_ciphertext TEXT NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_tag TEXT NOT NULL,
  last4 TEXT NOT NULL DEFAULT '0000',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_connections_org_provider UNIQUE (organization_id, provider)
);

CREATE TABLE IF NOT EXISTS public.pms_external_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'appointment')),
  external_id TEXT NOT NULL,
  deskcomm_id TEXT NOT NULL,
  external_version TEXT NOT NULL DEFAULT 'v1.0',
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

CREATE TABLE IF NOT EXISTS public.pms_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_connections_org
  ON public.pms_connections (organization_id);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_lookup
  ON public.pms_external_mappings (organization_id, provider, entity_type);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_status
  ON public.pms_external_mappings (organization_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_pms_audit_org_created
  ON public.pms_audit_events (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_pms_connections_touch ON public.pms_connections;
CREATE TRIGGER trg_pms_connections_touch
  BEFORE UPDATE ON public.pms_connections
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_audit_events ENABLE ROW LEVEL SECURITY;

-- Connection configuration and encrypted credentials are admin-only.
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

-- Administrative mappings are tenant-scoped; API RBAC controls mutation paths.
CREATE POLICY pms_external_mappings_tenant_isolation ON public.pms_external_mappings
  FOR ALL
  USING (
    organization_id IN (SELECT public.fn_user_org_ids())
    OR public.fn_is_platform_admin()
  )
  WITH CHECK (
    organization_id IN (SELECT public.fn_user_org_ids())
    OR public.fn_is_platform_admin()
  );

-- Audit is readable by tenant admins/platform admins and append-only to app roles.
CREATE POLICY pms_audit_events_select ON public.pms_audit_events
  FOR SELECT
  USING (
    public.fn_role_at_least(organization_id, 'admin')
    OR public.fn_is_platform_admin()
  );

CREATE POLICY pms_audit_events_insert ON public.pms_audit_events
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT public.fn_user_org_ids())
    OR public.fn_is_platform_admin()
  );

REVOKE UPDATE, DELETE ON public.pms_audit_events FROM authenticated, anon;
