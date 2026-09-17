-- Migration: 20260917180000_0182_pms_bridge_persistence.sql
-- Description: Forward-only migration establishing durable persistence for PMS interoperability (pms_bridge_v1)
-- Safety: Enforces Row-Level Security (RLS), multi-tenant isolation, unique constraints, and non-clinical data boundaries.

-- 1. Table: pms_connections
CREATE TABLE IF NOT EXISTS public.pms_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'disabled')),
  health TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (health IN ('HEALTHY', 'DEGRADED', 'FAILED', 'DISABLED')),
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  appointment_write_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  endpoint_url TEXT NOT NULL,
  encrypted_secret_ref TEXT NOT NULL,
  last4 TEXT NOT NULL DEFAULT '0000',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_connections_tenant_provider UNIQUE (tenant_id, provider)
);

-- 2. Table: pms_external_mappings
CREATE TABLE IF NOT EXISTS public.pms_external_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'appointment')),
  external_id TEXT NOT NULL,
  deskcomm_id TEXT NOT NULL,
  external_version TEXT NOT NULL DEFAULT 'v1.0',
  checksum TEXT NOT NULL,
  last_external_update_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'failed', 'disabled')),
  conflict_type TEXT CHECK (conflict_type IN ('external_newer', 'deskcomm_newer', 'ambiguous', 'external_deleted', 'deskcomm_deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pms_external_mappings_natural UNIQUE (tenant_id, provider, entity_type, external_id)
);

-- 3. Table: pms_audit_events
CREATE TABLE IF NOT EXISTS public.pms_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_pms_connections_tenant ON public.pms_connections (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_lookup ON public.pms_external_mappings (tenant_id, provider, entity_type);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_status ON public.pms_external_mappings (tenant_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_pms_audit_tenant_created ON public.pms_audit_events (tenant_id, created_at DESC);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_audit_events ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY pms_connections_tenant_isolation ON public.pms_connections
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY pms_external_mappings_tenant_isolation ON public.pms_external_mappings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY pms_audit_events_tenant_isolation ON public.pms_audit_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
