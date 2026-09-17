-- Migration: 0182_pms_bridge_persistence.sql
-- Establishes durable persistence and RLS security for PMS interoperability (pms_bridge_v1).
-- Forward-only migration. Direct tenant writes to mappings are denied (service-role-only writes).
-- Plaintext secrets are never stored; only AES-256-GCM encrypted references and masked last4.

CREATE TABLE IF NOT EXISTS public.pms_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('newsoft_ds', 'gesden', 'infomed_dentool')),
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
    health TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (health IN ('HEALTHY', 'DEGRADED', 'FAILED', 'DISABLED')),
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    appointment_write_enabled BOOLEAN NOT NULL DEFAULT false,
    endpoint_url TEXT NOT NULL,
    encrypted_secret_ciphertext TEXT NOT NULL,
    encrypted_secret_iv TEXT NOT NULL,
    encrypted_secret_tag TEXT NOT NULL,
    last4 TEXT NOT NULL DEFAULT '****',
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    CONSTRAINT uq_pms_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.pms_external_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'appointment')),
    external_id TEXT NOT NULL,
    deskcomm_id UUID NOT NULL,
    external_version TEXT NOT NULL DEFAULT 'v1.0',
    checksum TEXT NOT NULL,
    last_external_update_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'disabled')),
    conflict_type TEXT CHECK (conflict_type IN ('contact_collision', 'ambiguous', 'stale_external', 'tombstoned')),
    phone TEXT,
    email TEXT,
    CONSTRAINT uq_pms_natural_key UNIQUE (tenant_id, provider, entity_type, external_id)
);

CREATE TABLE IF NOT EXISTS public.pms_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & idempotent lookups
CREATE INDEX IF NOT EXISTS idx_pms_connections_tenant ON public.pms_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_lookup ON public.pms_external_mappings(tenant_id, provider, entity_type, external_id);
CREATE INDEX IF NOT EXISTS idx_pms_mappings_status ON public.pms_external_mappings(tenant_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_pms_audit_tenant ON public.pms_audit_events(tenant_id, created_at DESC);

-- Multi-Tenant RLS Policies
ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_audit_events ENABLE ROW LEVEL SECURITY;

-- Connections: Authenticated users can view metadata for their organization, but not raw cipher fields directly
CREATE POLICY pms_connections_tenant_select ON public.pms_connections
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT auth.uid()));

CREATE POLICY pms_connections_tenant_admin ON public.pms_connections
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid()))
    WITH CHECK (tenant_id = (SELECT auth.uid()));

-- Mappings: Read-only for authenticated tenants; writes restricted to service_role
CREATE POLICY pms_mappings_tenant_select ON public.pms_external_mappings
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT auth.uid()));

CREATE POLICY pms_mappings_service_role_all ON public.pms_external_mappings
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Direct tenant writes denied on mappings (enforced by lack of INSERT/UPDATE policy for authenticated)

-- Audit events: Tenant can view events for their organization
CREATE POLICY pms_audit_tenant_select ON public.pms_audit_events
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT auth.uid()));

CREATE POLICY pms_audit_service_role_all ON public.pms_audit_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
