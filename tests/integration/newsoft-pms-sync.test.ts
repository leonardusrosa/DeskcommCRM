import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NewSoftProductionConnector,
  type NewSoftConnectorConfig,
} from "../../lib/integrations/pms/newsoft-connector";
import { PmsMappingRepository } from "../../lib/integrations/pms/mapping";
import {
  InMemoryPmsEntityProjector,
  PmsProjectionConflictError,
} from "../../lib/integrations/pms/entity-projector";
import { PmsSyncEngine } from "../../lib/integrations/pms/sync-engine";
import { createPmsSyncEventProcessor } from "../../workers/pms-sync-worker";
import type { EventRow } from "../../lib/event-log/dispatcher";
import type { PmsConnection } from "../../lib/integrations/pms/types";
import { NEWSOFT_CAPABILITIES } from "../../lib/integrations/pms/capabilities";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const publicResolver = async () => [{ address: "1.1.1.1", family: 4 }];

function makeBridgeFetch() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    const method = init?.method || "GET";
    if (url.pathname.endsWith("/health")) return json({ ok: true });
    if (url.pathname.endsWith("/contacts") && method === "GET") {
      const limit = Number(url.searchParams.get("limit") || "100");
      return json({
        items: Array.from({ length: limit }, (_, index) => ({
          externalId: `ns-pat-tenant-lisboa-1-${index + 1}`,
          name: `Utente ${index + 1}`,
          phone: `+351900${String(index + 1).padStart(4, "0")}`,
          email: `u${index + 1}@example.test`,
        })),
      });
    }
    if (url.pathname.endsWith("/appointments") && method === "GET") {
      return json({
        items: Array.from({ length: 60 }, (_, index) => ({
          externalId: `ns-apt-tenant-lisboa-1-${index + 1}`,
          patientExternalId: `ns-pat-tenant-lisboa-1-${(index % 30) + 1}`,
          start: "2026-09-21T10:00:00Z",
          end: "2026-09-21T10:30:00Z",
          provider: "Dr. Silva",
          status: "CONFIRMED",
          appointmentLabel: "Consulta",
        })),
      });
    }
    if (url.pathname.endsWith("/appointments") && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}"));
      return json({ ...body, externalId: "ns-apt-tenant-lisboa-1-new-1" });
    }
    if (url.pathname.includes("/appointments/") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return json({ error: "not found" }, 404);
  });
}

const validConfig: NewSoftConnectorConfig = {
  tenantId: "tenant-lisboa-1",
  endpointUrl: "https://pms-relay.clinica-lisboa.pt/api/v1",
  clinicApiKey: "ns-prod-key-9988",
  appointmentWriteEnabled: false,
};

const mockConnection: PmsConnection = {
  id: "conn-lisboa-ns",
  tenantId: "tenant-lisboa-1",
  provider: "newsoft_ds",
  status: "connected",
  health: "HEALTHY",
  syncEnabled: true,
  appointmentWriteEnabled: false,
  endpointUrl: validConfig.endpointUrl,
  encryptedSecretRef: "db:pms_connection_secrets:conn-lisboa-ns",
  last4: "9988",
  capabilities: { ...NEWSOFT_CAPABILITIES },
  createdAt: "2026-09-17T00:00:00Z",
  updatedAt: "2026-09-17T00:00:00Z",
};

describe("NewSoft DS HTTP bridge", () => {
  it("uses HTTPS and bearer auth for real bridge requests", async () => {
    const bridgeFetch = makeBridgeFetch();
    const connector = new NewSoftProductionConnector(bridgeFetch as unknown as typeof fetch, publicResolver);
    await expect(connector.testConnection(validConfig)).resolves.toBe(true);
    expect(String(bridgeFetch.mock.calls[0]?.[0])).toContain("/health");
    const headers = new Headers(bridgeFetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer ns-prod-key-9988");
    expect(headers.get("X-Deskcomm-Tenant")).toBe("tenant-lisboa-1");

    const insecure = { ...validConfig, endpointUrl: "http://insecure.local" };
    await expect(connector.testConnection(insecure)).rejects.toThrow(/HTTPS required/);
  });

  it("rejects private DNS targets before issuing the bridge request", async () => {
    const bridgeFetch = makeBridgeFetch();
    const privateResolver = async () => [{ address: "127.0.0.1", family: 4 }];
    const connector = new NewSoftProductionConnector(
      bridgeFetch as unknown as typeof fetch,
      privateResolver,
    );

    await expect(connector.testConnection(validConfig)).rejects.toThrow(/private\/reserved network/i);
    expect(bridgeFetch).not.toHaveBeenCalled();
  });

  it("reads only allowlisted administrative contacts and appointments", async () => {
    const connector = new NewSoftProductionConnector(makeBridgeFetch() as unknown as typeof fetch, publicResolver);
    const contacts = await connector.fetchContacts(validConfig, { limit: 10 });
    expect(contacts).toHaveLength(10);
    const appointments = await connector.fetchAppointments(validConfig, {
      startDate: "2026-09-17T00:00:00Z",
      endDate: "2026-10-01T00:00:00Z",
    });
    expect(appointments).toHaveLength(60);
  });

  it("keeps writes disabled until explicitly enabled", async () => {
    const connector = new NewSoftProductionConnector(makeBridgeFetch() as unknown as typeof fetch, publicResolver);
    const appointment = {
      patientExternalId: "ns-pat-1",
      start: "2026-09-21T10:00:00Z",
      end: "2026-09-21T10:30:00Z",
      provider: "Dr. Silva",
      status: "CONFIRMED",
      appointmentLabel: "Consulta de Rotina",
    };
    await expect(connector.createAppointment(validConfig, appointment)).rejects.toThrow(/disabled/);
    const enabled = { ...validConfig, appointmentWriteEnabled: true };
    await expect(connector.createAppointment(enabled, appointment)).resolves.toMatchObject({
      externalId: "ns-apt-tenant-lisboa-1-new-1",
    });
    await expect(connector.cancelAppointment(enabled, "ns-apt-1")).resolves.toBe(true);
  });

  it("fails closed on unexpected fields even when they are not keyword-blacklisted", async () => {
    const badFetch = vi.fn(async () => json({ items: [{ externalId: "1", name: "A", notes: "x" }] }));
    const connector = new NewSoftProductionConnector(badFetch as unknown as typeof fetch, publicResolver);
    await expect(connector.fetchContacts(validConfig)).rejects.toThrow(/outside the administrative allowlist/);
  });
});

describe("PMS sync engine", () => {
  let engine: PmsSyncEngine;
  let mappings: PmsMappingRepository;

  beforeEach(() => {
    const connector = new NewSoftProductionConnector(makeBridgeFetch() as unknown as typeof fetch, publicResolver);
    mappings = new PmsMappingRepository();
    engine = new PmsSyncEngine(mappings, connector, new InMemoryPmsEntityProjector());
  });

  it("projects real UUID-shaped Deskcomm ids and stays idempotent across repeated runs", async () => {
    const first = await engine.executeSyncJob({
      connection: mockConnection,
      config: validConfig,
      jobType: "initial_sync",
    });
    expect(first.status).toBe("SUCCESS");
    expect(first.contactsMapped).toBe(100);
    expect(first.appointmentsMapped).toBe(60);

    const contactMap = mappings.getByExternalId(
      mockConnection.tenantId,
      "newsoft_ds",
      "contact",
      "ns-pat-tenant-lisboa-1-1",
    );
    const appointmentMap = mappings.getByExternalId(
      mockConnection.tenantId,
      "newsoft_ds",
      "appointment",
      "ns-apt-tenant-lisboa-1-1",
    );
    expect(contactMap?.deskcommId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(appointmentMap?.deskcommId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(contactMap?.deskcommId).not.toContain("dk-");
    expect(appointmentMap?.deskcommId).not.toContain("dk-");

    const second = await engine.executeSyncJob({
      connection: mockConnection,
      config: validConfig,
      jobType: "incremental_sync",
    });
    expect(second.contactsMapped).toBe(0);
    expect(second.appointmentsMapped).toBe(0);
    expect(second.duplicatesDetected).toBe(85);
  });

  it("marks projection identity collisions as partial instead of auto-merging", async () => {
    const connector = new NewSoftProductionConnector(makeBridgeFetch() as unknown as typeof fetch, publicResolver);
    const projector = new InMemoryPmsEntityProjector();
    projector.projectContact = vi.fn(async () => {
      throw new PmsProjectionConflictError("automatic merge forbidden");
    });
    const conflictEngine = new PmsSyncEngine(new PmsMappingRepository(), connector, projector);

    const result = await conflictEngine.executeSyncJob({
      connection: mockConnection,
      config: validConfig,
      jobType: "incremental_sync",
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.contactsMapped).toBe(0);
    expect(result.conflictsDetected).toBe(25);
    expect(result.errorsCount).toBe(25);
    expect(result.appointmentsMapped).toBe(60);
  });


  it("honors disabled contact tombstones and does not recreate patient appointment mirrors", async () => {
    const bridgeFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
      if (url.pathname.endsWith("/contacts")) {
        return json({
          items: [{
            externalId: "ns-pat-redacted-1",
            name: "Pessoa Redigida",
            phone: "+351912345678",
            email: "redacted@example.test",
          }],
        });
      }
      if (url.pathname.endsWith("/appointments")) {
        return json({
          items: [{
            externalId: "ns-apt-redacted-1",
            patientExternalId: "ns-pat-redacted-1",
            start: "2026-09-21T10:00:00Z",
            end: "2026-09-21T10:30:00Z",
            provider: "Dr. Silva",
            status: "CONFIRMED",
            appointmentLabel: "Consulta",
          }],
        });
      }
      return json({ ok: true });
    });
    const connector = new NewSoftProductionConnector(bridgeFetch as unknown as typeof fetch, publicResolver);
    const repo = new PmsMappingRepository();
    const tombstone = repo.upsert({
      tenantId: mockConnection.tenantId,
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ns-pat-redacted-1",
      deskcommId: "1c9e3c52-cda7-4bcc-aee8-3cc24bb83d2c",
      externalVersion: "redacted",
      lastExternalUpdateAt: "2026-09-17T00:00:00Z",
    }).record;
    tombstone.syncStatus = "disabled";

    const projector = new InMemoryPmsEntityProjector();
    const contactProjection = vi.spyOn(projector, "projectContact");
    const appointmentProjection = vi.spyOn(projector, "projectAppointment");
    const tombstoneEngine = new PmsSyncEngine(repo, connector, projector);

    const result = await tombstoneEngine.executeSyncJob({
      connection: mockConnection,
      config: validConfig,
      jobType: "incremental_sync",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.contactsRead).toBe(1);
    expect(result.contactsMapped).toBe(0);
    expect(result.appointmentsRead).toBe(1);
    expect(result.appointmentsMapped).toBe(0);
    expect(contactProjection).not.toHaveBeenCalled();
    expect(appointmentProjection).not.toHaveBeenCalled();
    expect(
      repo.getByExternalId(
        mockConnection.tenantId,
        "newsoft_ds",
        "appointment",
        "ns-apt-redacted-1",
      ),
    ).toBeNull();
  });
});

describe("PMS sync worker event contract", () => {
  it("accepts only connectionId/job metadata and resolves the secret server-side", async () => {
    const executeSyncJob = vi.fn(async () => ({
      tenantId: mockConnection.tenantId,
      provider: "newsoft_ds" as const,
      syncRunId: "sync-1",
      status: "SUCCESS" as const,
      contactsRead: 1,
      contactsMapped: 1,
      appointmentsRead: 1,
      appointmentsMapped: 1,
      duplicatesDetected: 0,
      conflictsDetected: 0,
      errorsCount: 0,
      durationMs: 10,
      syncedAt: new Date().toISOString(),
    }));
    const processor = createPmsSyncEventProcessor({
      connectionRepository: {
        getRuntimeConnection: vi.fn(async () => ({
          connection: mockConnection,
          clinicApiKey: "server-only-secret",
        })),
        recordSyncOutcome: vi.fn(async () => undefined),
      },
      syncEngine: { executeSyncJob, deriveHealth: () => "HEALTHY" },
    });
    const row: EventRow = {
      id: "ev-101",
      organization_id: mockConnection.tenantId,
      event_type: "pms.initial_sync_requested",
      entity_kind: "pms_connection",
      entity_id: mockConnection.id,
      payload: { connectionId: mockConnection.id, jobType: "initial_sync" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };
    const result = await processor(row);
    expect(result.status).toBe("ok");
    expect(JSON.stringify(row.payload)).not.toContain("secret");
    expect(executeSyncJob.mock.calls[0]?.[0].config.clinicApiKey).toBe("server-only-secret");
  });

  it("rejects malformed or cross-organization events", async () => {
    const processor = createPmsSyncEventProcessor({
      connectionRepository: {
        getRuntimeConnection: vi.fn(async () => ({
          connection: mockConnection,
          clinicApiKey: "x",
        })),
        recordSyncOutcome: vi.fn(async () => undefined),
      },
      syncEngine: { executeSyncJob: vi.fn(), deriveHealth: () => "HEALTHY" },
    });
    const malformed = {
      id: "ev-1",
      organization_id: mockConnection.tenantId,
      event_type: "pms.sync",
      entity_kind: "pms_connection",
      entity_id: null,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    } as EventRow;
    await expect(processor(malformed)).resolves.toMatchObject({ status: "error" });
    const crossTenant = {
      ...malformed,
      id: "ev-2",
      organization_id: "other-org",
      payload: { connectionId: mockConnection.id, jobType: "initial_sync" },
    } as EventRow;
    const result = await processor(crossTenant);
    expect(result.status).toBe("error");
    expect(result.detail).toMatch(/does not match connection organization/);
  });
});
