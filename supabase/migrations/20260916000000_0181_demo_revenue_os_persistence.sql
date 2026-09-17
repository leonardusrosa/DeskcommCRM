-- Migration: 0181_demo_revenue_os_persistence.sql
-- Description: Production Hardening & Database Persistence for Demo Revenue OS
-- Tables: demo_events, demo_queue_jobs, demo_dead_letter_jobs, demo_deals, demo_worker_heartbeats, demo_compliance_records
-- Includes: Indexes, RLS Policies, Tenant Isolation, and Data Retention Function.

-- 1. Demo Events Table
CREATE TABLE IF NOT EXISTS demo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_events_tenant_time ON demo_events (tenant_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_events_topic ON demo_events (topic);

-- 2. Demo Queue Jobs Table
CREATE TABLE IF NOT EXISTS demo_queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_demo_queue_status_next ON demo_queue_jobs (status, next_run_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_demo_queue_idempotency ON demo_queue_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demo_queue_tenant ON demo_queue_jobs (tenant_id);

-- 3. Demo Dead-Letter Jobs Table
CREATE TABLE IF NOT EXISTS demo_dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL,
  error TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_dead_letter_failed_at ON demo_dead_letter_jobs (failed_at DESC);

-- 4. Demo Deals Table
CREATE TABLE IF NOT EXISTS demo_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  value NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'BRL', 'MXN', 'COP')),
  status TEXT NOT NULL DEFAULT 'prospecting' CHECK (status IN ('prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_demo_deals_tenant_status ON demo_deals (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_demo_deals_currency ON demo_deals (currency);

-- 5. Demo Worker Heartbeats
CREATE TABLE IF NOT EXISTS demo_worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'degraded', 'stopped')),
  jobs_processed INT NOT NULL DEFAULT 0,
  jobs_failed INT NOT NULL DEFAULT 0,
  uptime_seconds INT NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Demo Compliance Records Table
CREATE TABLE IF NOT EXISTS demo_compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('purge_retention', 'anonymize_pii', 'gdpr_erasure')),
  target_id TEXT NOT NULL,
  tenant_id TEXT,
  details TEXT NOT NULL,
  purged_items_count INT DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_compliance_target ON demo_compliance_records (target_id);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE demo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_queue_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_dead_letter_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_compliance_records ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies: Service role and Platform Admins have full access
CREATE POLICY demo_events_admin_all ON demo_events
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

CREATE POLICY demo_queue_admin_all ON demo_queue_jobs
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

CREATE POLICY demo_dead_letter_admin_all ON demo_dead_letter_jobs
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

CREATE POLICY demo_deals_admin_all ON demo_deals
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

CREATE POLICY demo_worker_heartbeats_admin_all ON demo_worker_heartbeats
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

CREATE POLICY demo_compliance_admin_all ON demo_compliance_records
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM platform_admins)
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

-- 9. Retention Function: Purges records older than retention_days (default 30)
CREATE OR REPLACE FUNCTION purge_expired_demo_records(retention_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff TIMESTAMPTZ;
  purged_events INT;
  purged_jobs INT;
BEGIN
  cutoff := NOW() - (retention_days || ' days')::INTERVAL;

  DELETE FROM demo_events WHERE emitted_at < cutoff;
  GET DIAGNOSTICS purged_events = ROW_COUNT;

  DELETE FROM demo_queue_jobs WHERE status IN ('completed', 'dead_letter') AND updated_at < cutoff;
  GET DIAGNOSTICS purged_jobs = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff', cutoff,
    'purged_events', purged_events,
    'purged_jobs', purged_jobs,
    'executed_at', NOW()
  );
END;
$$;
