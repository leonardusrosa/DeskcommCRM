/**
 * tests/integration/newsoft-pms-sync.test.ts
 *
 * Integration test suite for the NewSoft DS PMS connector, sync engine,
 * and background event worker.
 * Validates read-first boundary, end-to-end sync jobs, and event processing.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  NewSoftProductionConnector,
  newSoftProductionConnector,
  type NewSoftConnectorConfig,
} from "../../lib/integrations/pms/newsoft-connector";
import { PmsMappingRepository } from "../../lib/integrations/pms/mapping";
import { PmsSyncEngine } from "../../lib/integrations/pms/sync-engine";
import { processPmsSyncEvent } from "../../workers/pms-sync-worker";
import type { EventRow } from "../../lib/event-log/dispatcher";
import type { PmsConnection } from "../../lib/integrations/pms/types";
import { NEWSOFT_CAPABILITIES } from "../../lib/integrations/pms/capabilities";

describe("NewSoft DS Production Connector Integration", () => {
  const validConfig: NewSoftConnectorConfig = {
    tenantId: "tenant-lisboa-1",
    endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
    clinicApiKey: "ns-prod-key-9988",
    appointmentWriteEnabled: false,
  };

  it("validates HTTPS transport and required credentials", () => {
    const connector = new NewSoftProductionConnector();
    expect(connector.testConnection(validConfig)).toBe(true);

    expect(() =>
      connector.testConnection({ ...validConfig, endpointUrl: "http://insecure.local" })
    ).toThrow(/HTTPS required/);

    expect(() =>
      connector.testConnection({ ...validConfig, clinicApiKey: "" })
    ).toThrow(/Missing required clinic API key/);
  });

  it("fetches administrative contacts with strict non-clinical attributes", async () => {
    const connector = new NewSoftProductionConnector();
    const contacts = await connector.fetchContacts(validConfig, { limit: 10 });

    expect(contacts.length).toBe(10);
    for (const c of contacts) {
      expect(c.externalId).toMatch(/^ns-pat-tenant-lisboa-1-/);
      expect(c.name).toBeDefined();
      expect(c.phone).toBeDefined();
      expect((c as unknown as Record<string, unknown>).odontograma).toBeUndefined();
      expect((c as unknown as Record<string, unknown>).fatura).toBeUndefined();
    }
  });

  it("fetches administrative appointments window with read-only defaults", async () => {
    const connector = new NewSoftProductionConnector();
    const appointments = await connector.fetchAppointments(validConfig, {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

    expect(appointments.length).toBeGreaterThan(0);
    const first = appointments[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.externalId).toMatch(/^ns-apt-tenant-lisboa-1-/);
      expect(first.patientExternalId).toBeDefined();
      expect(first.status).toBeDefined();
    }
  });

  it("enforces read-first safety gate on appointment write operations", async () => {
    const connector = new NewSoftProductionConnector();
    const newApt = {
      patientExternalId: "ns-pat-1",
      start: "2026-09-21T10:00:00Z",
      end: "2026-09-21T10:30:00Z",
      provider: "Dr. Silva",
      status: "CONFIRMED",
      appointmentLabel: "Consulta de Rotina",
    };

    // Fails closed when appointmentWriteEnabled is false
    await expect(
      connector.createAppointment(validConfig, newApt)
    ).rejects.toThrow(/Appointment write operations are disabled/);

    await expect(
      connector.cancelAppointment(validConfig, "ns-apt-tenant-lisboa-1-1")
    ).rejects.toThrow(/Appointment cancellation is disabled/);

    // Succeeds when write capability is explicitly enabled
    const writeEnabledConfig: NewSoftConnectorConfig = {
      ...validConfig,
      appointmentWriteEnabled: true,
    };

    const created = await connector.createAppointment(writeEnabledConfig, newApt);
    expect(created.externalId).toMatch(/^ns-apt-tenant-lisboa-1-new-/);

    const cancelled = await connector.cancelAppointment(
      writeEnabledConfig,
      "ns-apt-tenant-lisboa-1-10"
    );
    expect(cancelled).toBe(true);
  });
});

describe("PMS End-to-End Sync Engine Integration", () => {
  let mappingRepo: PmsMappingRepository;
  let engine: PmsSyncEngine;

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
    mappingRepo = new PmsMappingRepository();
    engine = new PmsSyncEngine(mappingRepo, newSoftProductionConnector);
  });

  it("executes initial sync and maps all entities idempotently", async () => {
    const result1 = await engine.executeSyncJob({
      connection: mockConnection,
      config,
      jobType: "initial_sync",
    });

    expect(result1.status).toBe("SUCCESS");
    expect(result1.contactsMapped).toBe(100);
    expect(result1.appointmentsMapped).toBe(60);
    expect(result1.duplicatesDetected).toBe(0);

    // Second run with identical data detects duplicates without modifying records
    const result2 = await engine.executeSyncJob({
      connection: mockConnection,
      config,
      jobType: "incremental_sync",
    });

    expect(result2.status).toBe("SUCCESS");
    expect(result2.contactsMapped).toBe(0);
    expect(result2.duplicatesDetected).toBeGreaterThan(0);

    const auditLogs = engine.getAuditLogs("tenant-lisboa-1");
    expect(auditLogs.length).toBeGreaterThan(1);
    expect(auditLogs[0]?.action).toBe("initial_sync_started");
  });
});

describe("PMS Sync Worker Event Dispatcher Integration", () => {
  it("processes pms.initial_sync_requested event successfully", async () => {
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
        syncEnabled: true,
        appointmentWriteEnabled: false,
      },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const handlerResult = await processPmsSyncEvent(eventRow);
    expect(handlerResult.status).toBe("ok");
    expect(handlerResult.consumer_key).toBe("pms-sync-worker.v1");
    expect(handlerResult.detail).toContain("\"contactsMapped\":100");
    expect(handlerResult.detail).toContain("\"appointmentsMapped\":60");
  });

  it("handles malformed event payload gracefully with error status", async () => {
    const malformedEvent: EventRow = {
      id: "ev-102",
      organization_id: "tenant-lisboa-1",
      event_type: "pms.initial_sync_requested",
      entity_kind: "pms_connection",
      entity_id: null,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const result = await processPmsSyncEvent(malformedEvent);
    expect(result.status).toBe("error");
    expect(result.detail).toMatch(/missing required tenantId or provider/i);
  });
});
