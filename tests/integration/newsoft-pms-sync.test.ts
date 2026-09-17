/**
 * tests/integration/newsoft-pms-sync.test.ts
 *
 * Integration tests for NewSoft DS connector, sync engine, worker and RLS policies.
 * Validates:
 *   10. secrets inaccessible to tenant users
 *   11. mappings/mirrors service-role-only
 *   12. direct tenant writes denied
 *   Read-first appointment write gate, end-to-end sync, and worker event handling.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  NewSoftProductionConnector,
  newSoftProductionConnector,
  type NewSoftConnectorConfig,
} from "../../lib/integrations/pms/newsoft-connector";
import { PmsMappingRepository } from "../../lib/integrations/pms/mapping";
import { PmsSyncEngine } from "../../lib/integrations/pms/sync-engine";
import { processPmsSyncEvent, PMS_SYNC_HANDLER_KEY } from "../../workers/pms-sync-worker";
import type { EventRow } from "../../lib/event-log/dispatcher";
import type { PmsConnection } from "../../lib/integrations/pms/types";
import { NEWSOFT_CAPABILITIES } from "../../lib/integrations/pms/capabilities";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("NewSoft DS Connector & Write Safety Gate", () => {
  const validConfig: NewSoftConnectorConfig = {
    tenantId: "tenant-lisboa-1",
    endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
    clinicApiKey: "ns-prod-key-9988",
    appointmentWriteEnabled: false,
  };

  it("item 10: ensures secrets are never exposed in connector responses", async () => {
    const connector = new NewSoftProductionConnector();
    const contacts = await connector.fetchContacts(validConfig, { limit: 5 });
    for (const c of contacts) {
      const serialized = JSON.stringify(c);
      expect(serialized).not.toContain("ns-prod-key-9988");
      expect(serialized).not.toContain("secret");
    }
  });

  it("enforces read-first safety gate on appointment writes by default", async () => {
    const connector = new NewSoftProductionConnector();
    const newApt = {
      patientExternalId: "ns-pat-1",
      start: "2026-09-21T10:00:00Z",
      end: "2026-09-21T10:30:00Z",
      provider: "Dr. Silva",
      status: "CONFIRMED",
      appointmentLabel: "Consulta de Rotina",
    };

    // Fails closed by default when write capability is disabled
    await expect(connector.createAppointment(validConfig, newApt)).rejects.toThrow(
      /Appointment write operations are disabled/
    );
    await expect(
      connector.cancelAppointment(validConfig, "ns-apt-tenant-lisboa-1-1")
    ).rejects.toThrow(/Appointment cancellation is disabled/);

    // Permitted only when explicitly authorized
    const writeEnabledConfig = { ...validConfig, appointmentWriteEnabled: true };
    const created = await connector.createAppointment(writeEnabledConfig, newApt);
    expect(created.externalId).toMatch(/^ns-apt-tenant-lisboa-1-new-/);
  });
});

describe("PMS Persistence Migration & RLS Security Invariants", () => {
  it("item 11 & 12: verifies migration establishes service-role-only writes and denies direct tenant writes", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20260917180000_0182_pms_bridge_persistence.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // RLS enabled on all PMS tables
    expect(sql).toContain("ALTER TABLE public.pms_connections ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.pms_external_mappings ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.pms_audit_events ENABLE ROW LEVEL SECURITY;");

    // Service-role-only write policy for mappings
    expect(sql).toContain("CREATE POLICY pms_mappings_service_role_all ON public.pms_external_mappings");
    expect(sql).toContain("FOR ALL TO service_role");

    // Verify authenticated users only have SELECT policy on mappings (no direct INSERT/UPDATE)
    expect(sql).toContain("CREATE POLICY pms_mappings_tenant_select ON public.pms_external_mappings");
    expect(sql).toContain("FOR SELECT TO authenticated");
    expect(sql).not.toContain("CREATE POLICY pms_mappings_tenant_insert");
    expect(sql).not.toContain("CREATE POLICY pms_mappings_tenant_all");
  });
});

describe("PMS End-to-End Sync Engine with LGPD & Rollout Enforcement", () => {
  let mappingRepo: PmsMappingRepository;
  let engine: PmsSyncEngine;
  const originalEnv = process.env.PMS_NEWSOFT_ENABLED;

  const mockConnection: PmsConnection = {
    id: "conn-lisboa-ns",
    tenantId: "tenant-lisboa-1",
    provider: "newsoft_ds",
    status: "connected",
    health: "HEALTHY",
    syncEnabled: true,
    appointmentWriteEnabled: false,
    endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
    encryptedSecretRef: "secret-ref-1",
    last4: "9988",
    capabilities: { ...NEWSOFT_CAPABILITIES },
    createdAt: "2026-09-17T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  };

  const config: NewSoftConnectorConfig = {
    tenantId: "tenant-lisboa-1",
    endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
    clinicApiKey: "ns-prod-key-9988",
    appointmentWriteEnabled: false,
  };

  beforeEach(() => {
    process.env.PMS_NEWSOFT_ENABLED = "true";
    mappingRepo = new PmsMappingRepository();
    engine = new PmsSyncEngine(mappingRepo, newSoftProductionConnector);
  });

  afterEach(() => {
    process.env.PMS_NEWSOFT_ENABLED = originalEnv;
  });

  it("executes initial sync with real UUID mappings and enforces LGPD tombstones", async () => {
    // Pre-record an LGPD tombstone for patient 5
    mappingRepo.recordLgpdTombstone("tenant-lisboa-1", "newsoft_ds", "ns-pat-tenant-lisboa-1-5");

    const result = await engine.executeSyncJob({
      connection: mockConnection,
      config,
      jobType: "initial_sync",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.contactsMapped).toBe(99); // 100 - 1 tombstoned
    expect(result.tombstonedCount).toBeGreaterThan(0);

    // Verify all generated deskcommIds are real UUIDs and not "dk-*"
    const records = mappingRepo.listByTenant("tenant-lisboa-1");
    for (const r of records) {
      expect(r.deskcommId).toMatch(UUID_REGEX);
      expect(r.deskcommId.startsWith("dk-")).toBe(false);
    }
  });
});

describe("PMS Background Worker Integration", () => {
  const originalEnv = process.env.PMS_NEWSOFT_ENABLED;

  afterEach(() => {
    process.env.PMS_NEWSOFT_ENABLED = originalEnv;
  });

  it("worker fails closed when PMS_NEWSOFT_ENABLED is not true", async () => {
    process.env.PMS_NEWSOFT_ENABLED = "false";

    const eventRow: EventRow = {
      id: "ev-101",
      organization_id: "tenant-lisboa-1",
      event_type: "pms.initial_sync_requested",
      entity_kind: "pms_connection",
      entity_id: "conn-1",
      payload: {
        tenantId: "tenant-lisboa-1",
        provider: "newsoft_ds",
        jobType: "initial_sync",
        endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
        clinicApiKey: "prod-key-1234",
      },
      metadata: {},
      consumed_by: [],
      attempts: 0,
    };

    const handlerResult = await processPmsSyncEvent(eventRow);
    expect(handlerResult.status).toBe("error");
    expect(handlerResult.consumer_key).toBe(PMS_SYNC_HANDLER_KEY);
    expect(handlerResult.detail).toMatch(/disabled by platform rollout gate/i);
  });

  it("worker completes sync successfully when rollout flag is enabled", async () => {
    process.env.PMS_NEWSOFT_ENABLED = "true";

    const eventRow: EventRow = {
      id: "ev-102",
      organization_id: "tenant-lisboa-1",
      event_type: "pms.initial_sync_requested",
      entity_kind: "pms_connection",
      entity_id: "conn-1",
      payload: {
        tenantId: "tenant-lisboa-1",
        provider: "newsoft_ds",
        jobType: "initial_sync",
        endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
        clinicApiKey: "prod-key-1234",
        syncEnabled: true,
        appointmentWriteEnabled: false,
      },
      metadata: {},
      consumed_by: [],
      attempts: 0,
    };

    const handlerResult = await processPmsSyncEvent(eventRow);
    expect(handlerResult.status).toBe("ok");
    expect(handlerResult.consumer_key).toBe(PMS_SYNC_HANDLER_KEY);
    expect(handlerResult.detail).toContain("\"contactsMapped\":100");
  });
});
