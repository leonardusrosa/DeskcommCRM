/**
 * tests/unit/pms-bridge-production.test.ts
 *
 * Unit tests for the production PMS interoperability layer (pms_bridge_v1).
 * Validates clinical boundary guards, credential encryption, capabilities,
 * durable mapping, conflict detection, and sync engine controls.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  ClinicalBoundaryViolationError,
  assertAdministrativePayloadSafe,
  sanitizeAdministrativeAppointment,
  sanitizeAdministrativeContact,
} from "../../lib/integrations/pms/clinical-guard";
import {
  decryptPmsSecret,
  encryptPmsSecret,
  sanitizeCredentialsForAudit,
} from "../../lib/integrations/pms/credentials";
import {
  assertOperationSupported,
  getProviderDefaultCapabilities,
  GESDEN_CAPABILITIES,
  NEWSOFT_CAPABILITIES,
} from "../../lib/integrations/pms/capabilities";
import { PmsMappingRepository } from "../../lib/integrations/pms/mapping";
import {
  PmsSyncEngine,
  isPlatformProviderEnabled,
  setPlatformProviderEnabled,
} from "../../lib/integrations/pms/sync-engine";
import type { PmsConnection } from "../../lib/integrations/pms/types";

describe("PMS Clinical Boundary Guard", () => {
  it("rejects payloads containing forbidden clinical or billing terms", () => {
    const forbidden = [
      { id: "1", odontograma: { tooth18: "restored" } },
      { id: "2", diagnosis: "Gingivitis" },
      { id: "3", clinicalNote: "Patient reports sensitivity" },
      { id: "4", fatura: { total: 120, currency: "EUR" } },
      { id: "5", prescription: { medicine: "Amoxicillin" } },
      { id: "6", details: { nested: { xrayUrl: "https://pms.local/xray/1.png" } } },
    ];
    for (const p of forbidden) {
      expect(() => assertAdministrativePayloadSafe(p)).toThrow(ClinicalBoundaryViolationError);
    }
  });

  it("sanitizes valid administrative contacts and extracts required fields", () => {
    const contact = sanitizeAdministrativeContact({
      externalId: "pat-101",
      name: "Maria Silva",
      phone: "+351912345678",
      email: "MARIA@EXEMPLO.PT",
    });
    expect(contact.externalId).toBe("pat-101");
    expect(contact.name).toBe("Maria Silva");
    expect(contact.email).toBe("maria@exemplo.pt");
  });

  it("sanitizes valid administrative appointments and rejects missing mandatory keys", () => {
    const apt = sanitizeAdministrativeAppointment({
      externalId: "apt-202",
      patientExternalId: "pat-101",
      start: "2026-09-20T10:00:00Z",
      end: "2026-09-20T10:30:00Z",
      provider: "Dr. Santos",
      status: "confirmed",
      label: "Consulta de Avaliação",
    });
    expect(apt.externalId).toBe("apt-202");
    expect(apt.status).toBe("CONFIRMED");
    expect(apt.appointmentLabel).toBe("Consulta de Avaliação");
    expect(() => sanitizeAdministrativeAppointment({ externalId: "" })).toThrow();
  });
});

describe("PMS Credential Encryption & Masking", () => {
  it("performs AES-256-GCM encryption and decryption roundtrip", () => {
    const secret = "test-live-newsoft-token-xyz-789";
    const encrypted = encryptPmsSecret(secret);

    expect(encrypted.last4).toBe("-789");
    expect(encrypted.ciphertextHex).toBeDefined();
    expect(encrypted.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tagHex).toHaveLength(32); // 16 bytes = 32 hex chars

    const decrypted = decryptPmsSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("redacts sensitive credential fields for security audit logs", () => {
    const sensitive = {
      endpoint: "https://api.pms.local",
      apiKey: "super-secret-key",
      nested: { clinicToken: "auth-bearer-123", clinicName: "Clinica Central" },
    };

    const sanitized = sanitizeCredentialsForAudit(sensitive);
    expect(sanitized.endpoint).toBe("https://api.pms.local");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).clinicToken).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).clinicName).toBe("Clinica Central");
  });
});

describe("PMS Capabilities Discovery & Enforcement", () => {
  it("provides vendor-authorized capability profiles", () => {
    const ns = getProviderDefaultCapabilities("newsoft_ds");
    expect(ns.contactsRead).toBe(true);
    expect(ns.appointmentsRead).toBe(true);
    expect(ns.appointmentsCreate).toBe(true);

    const gesden = getProviderDefaultCapabilities("gesden");
    expect(gesden.contactsRead).toBe(true);
    expect(gesden.appointmentsRead).toBe(true);
    expect(gesden.appointmentsCreate).toBe(false);
    expect(gesden.realtimeWebhooks).toBe(false);
  });

  it("enforces operation permissions and rejects unsupported capabilities", () => {
    expect(() =>
      assertOperationSupported(NEWSOFT_CAPABILITIES, "appointmentsRead", "newsoft_ds")
    ).not.toThrow();

    expect(() =>
      assertOperationSupported(GESDEN_CAPABILITIES, "appointmentsCreate", "gesden")
    ).toThrow(/Capability Violation/);
  });
});

describe("PMS Durable Mapping Repository", () => {
  let repo: PmsMappingRepository;

  beforeEach(() => {
    repo = new PmsMappingRepository();
  });

  it("stores mappings and detects duplicates via deterministic idempotency keys", () => {
    const baseMap = {
      tenantId: "t-1",
      provider: "newsoft_ds" as const,
      entityType: "contact" as const,
      externalId: "ext-1",
      deskcommId: "dk-1",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
    };
    const res1 = repo.upsert(baseMap);
    expect(res1.isDuplicate).toBe(false);
    expect(res1.conflictDetected).toBe(false);

    const res2 = repo.upsert(baseMap);
    expect(res2.isDuplicate).toBe(true);
  });

  it("detects concurrent conflicts and preserves safety state", () => {
    repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-2",
      deskcommId: "dk-2",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T08:00:00Z",
    });

    const later1 = new Date(Date.now() + 2000).toISOString();
    const later2 = new Date(Date.now() + 3000).toISOString();

    const conflictRes = repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-2",
      deskcommId: "dk-2",
      externalVersion: "v2.0",
      lastExternalUpdateAt: later2,
      deskcommUpdatedAt: later1,
    });

    expect(conflictRes.conflictDetected).toBe(true);
    expect(conflictRes.record.syncStatus).toBe("conflict");
  });

  it("blocks cross-tenant conflict resolution", () => {
    const key = "t-1::newsoft_ds::contact::ext-3";
    repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-3",
      deskcommId: "dk-3",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
    });

    expect(() => repo.resolveConflict("t-other", key, "accept_pms")).toThrow(
      /Cross-tenant/
    );
  });
});

describe("PMS Sync Engine Kill Switches & Health", () => {
  const mockConn: PmsConnection = {
    id: "conn-1",
    tenantId: "t-1",
    provider: "newsoft_ds",
    status: "connected",
    health: "HEALTHY",
    syncEnabled: true,
    appointmentWriteEnabled: false,
    endpointUrl: "https://pms.local",
    encryptedSecretRef: "ref-1",
    last4: "1234",
    capabilities: { ...NEWSOFT_CAPABILITIES },
    createdAt: "2026-09-17T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  };

  it("honors platform-level provider kill switches", async () => {
    const engine = new PmsSyncEngine();
    setPlatformProviderEnabled("newsoft_ds", false);
    expect(isPlatformProviderEnabled("newsoft_ds")).toBe(false);

    await expect(
      engine.executeSyncJob({
        connection: mockConn,
        config: { tenantId: "t-1", endpointUrl: "https://pms.local", clinicApiKey: "key" },
        jobType: "initial_sync",
      })
    ).rejects.toThrow(/disabled by platform kill switch/);

    setPlatformProviderEnabled("newsoft_ds", true);
    expect(isPlatformProviderEnabled("newsoft_ds")).toBe(true);
  });

  it("honors tenant-level connection syncEnabled flag", async () => {
    const engine = new PmsSyncEngine();
    const disabledConn = { ...mockConn, syncEnabled: false };

    await expect(
      engine.executeSyncJob({
        connection: disabledConn,
        config: { tenantId: "t-1", endpointUrl: "https://pms.local", clinicApiKey: "key" },
        jobType: "initial_sync",
      })
    ).rejects.toThrow(/Synchronization is disabled for tenant/);
  });

  it("correctly derives health state across error and conflict boundaries", () => {
    const engine = new PmsSyncEngine();
    expect(engine.deriveHealth({ ...mockConn, syncEnabled: false })).toBe("DISABLED");
    expect(engine.deriveHealth(mockConn)).toBe("HEALTHY");

    const baseResult = {
      tenantId: "t-1",
      provider: "newsoft_ds" as const,
      contactsRead: 0,
      contactsMapped: 0,
      appointmentsRead: 0,
      appointmentsMapped: 0,
      duplicatesDetected: 0,
      conflictsDetected: 0,
      durationMs: 50,
      syncedAt: new Date().toISOString(),
    };

    expect(
      engine.deriveHealth(mockConn, {
        ...baseResult,
        syncRunId: "r-fail",
        status: "FAILED",
        errorsCount: 6,
      })
    ).toBe("FAILED");

    expect(
      engine.deriveHealth(mockConn, {
        ...baseResult,
        syncRunId: "r-deg",
        status: "SUCCESS",
        conflictsDetected: 2,
        errorsCount: 0,
      })
    ).toBe("DEGRADED");
  });
});
