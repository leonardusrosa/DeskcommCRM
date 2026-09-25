/**
 * tests/unit/pms-bridge-production.test.ts
 *
 * Unit tests for PMS interoperability layer (pms_bridge_v1).
 * Validates:
 *   1. administrative allowlist
 *   2. clinical/billing rejection
 *   3. credential encryption/decryption
 *   4. credential audit redaction & hashed external IDs
 *   5. real UUID mappings
 *   6. no "dk-*" prefixes
 *   7. repeat sync idempotency
 *   8. contact collision does not auto-merge
 *   9. tenant isolation
 *  13. SSRF private DNS/IP rejected before fetch
 *  14. production rollout flag fail-closed
 *  15. LGPD disabled tombstone prevents contact reimport
 *  16. LGPD disabled tombstone prevents appointment mirror recreation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ClinicalBoundaryViolationError,
  assertAdministrativePayloadSafe,
  sanitizeAdministrativeAppointment,
  sanitizeAdministrativeContact,
  ALLOWED_CONTACT_FIELDS,
} from "../../lib/integrations/pms/clinical-guard";
import {
  decryptPmsSecret,
  encryptPmsSecret,
  hashExternalIdForAudit,
  sanitizeCredentialsForAudit,
} from "../../lib/integrations/pms/credentials";
import { assertSafePmsEndpoint, PmsSsrfSecurityError } from "../../lib/integrations/pms/ssrf";
import { PmsMappingRepository } from "../../lib/integrations/pms/mapping";
import {
  PmsSyncEngine,
  isPmsRolloutEnabled,
} from "../../lib/integrations/pms/sync-engine";
import type { PmsConnection } from "../../lib/integrations/pms/types";
import { NEWSOFT_CAPABILITIES } from "../../lib/integrations/pms/capabilities";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("PMS Clinical Boundary & Administrative Allowlist", () => {
  it("item 1: rejects unexpected non-allowlisted fields", () => {
    const payload = {
      externalId: "pat-1",
      name: "Ana",
      unexpectedInternalField: "rogue_data",
    };
    expect(() =>
      assertAdministrativePayloadSafe(payload, ALLOWED_CONTACT_FIELDS, "contact")
    ).toThrow(ClinicalBoundaryViolationError);
  });

  it("item 2: rejects forbidden clinical and billing fields", () => {
    const forbidden = [
      { externalId: "1", name: "A", odontograma: { tooth: 1 } },
      { externalId: "2", name: "B", diagnosis: "Caries" },
      { externalId: "3", name: "C", prescription: { med: "Amoxicilina" } },
      { externalId: "4", name: "D", invoice: { total: 100 } },
      { externalId: "5", name: "E", payment: { amount: 50 } },
      { externalId: "6", name: "F", insurance: "Allianz" },
    ];
    for (const p of forbidden) {
      expect(() => assertAdministrativePayloadSafe(p)).toThrow(ClinicalBoundaryViolationError);
    }
  });

  it("sanitizes clean administrative payloads", () => {
    const c = sanitizeAdministrativeContact({
      externalId: "pat-99",
      name: "João Silva",
      phone: "+351912000111",
      email: "joao@exemplo.pt",
    });
    expect(c.externalId).toBe("pat-99");
    expect(c.name).toBe("João Silva");

    const a = sanitizeAdministrativeAppointment({
      externalId: "apt-88",
      patientExternalId: "pat-99",
      start: "2026-09-20T10:00:00Z",
      appointmentLabel: "Revisão",
    });
    expect(a.externalId).toBe("apt-88");
    expect(a.status).toBe("CONFIRMED");
  });
});

describe("PMS Credential Security & SSRF Protection", () => {
  it("item 3: performs AES-256-GCM encryption and decryption", () => {
    const secret = "live-clinic-token-xyz-1234";
    const encrypted = encryptPmsSecret(secret);
    expect(encrypted.last4).toBe("1234");
    expect(decryptPmsSecret(encrypted)).toBe(secret);
  });

  it("item 4: redacts secrets and hashes external IDs in audit logs", () => {
    const sanitized = sanitizeCredentialsForAudit({
      apiKey: "secret-key",
      endpointUrl: "https://api.pms.pt",
    });
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.endpointUrl).toBe("https://api.pms.pt");

    const hash = hashExternalIdForAudit("patient-12345");
    expect(hash).not.toBe("patient-12345");
    expect(hash).toHaveLength(16);
  });

  it("item 13: rejects SSRF private DNS and loopback/private IPs before fetch", () => {
    const dangerous = [
      "http://api.imaginasoft.pt", // Insecure HTTP
      "https://localhost:8080/pms",
      "https://127.0.0.1/api",
      "https://10.0.1.50/api",
      "https://192.168.1.1/api",
      "https://169.254.169.254/metadata", // Cloud metadata
      "https://pms.local/api",
      "https://pms.internal/api",
    ];
    for (const url of dangerous) {
      expect(() => assertSafePmsEndpoint(url)).toThrow(PmsSsrfSecurityError);
    }

    // Safe public HTTPS URL passes
    expect(() => assertSafePmsEndpoint("https://api.imaginasoft.pt/v1")).not.toThrow();
  });
});

describe("PMS Mapping Repository, Idempotency & Collision", () => {
  let repo: PmsMappingRepository;

  beforeEach(() => {
    repo = new PmsMappingRepository();
  });

  it("item 5 & 6: uses real UUID mappings and strictly bans 'dk-*' prefixes", () => {
    const res = repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-1",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
    });
    expect(res.record.deskcommId).toMatch(UUID_REGEX);
    expect(res.record.deskcommId.startsWith("dk-")).toBe(false);
    expect(res.record.id).toMatch(UUID_REGEX);
  });

  it("item 7: repeat sync idempotency returns duplicate without extra rows", () => {
    const params = {
      tenantId: "t-1",
      provider: "newsoft_ds" as const,
      entityType: "contact" as const,
      externalId: "ext-1",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
    };
    const first = repo.upsert(params);
    expect(first.isDuplicate).toBe(false);

    const second = repo.upsert(params);
    expect(second.isDuplicate).toBe(true);
    expect(repo.listByTenant("t-1").length).toBe(1);
  });

  it("item 8: contact collision on phone/email does not auto-merge", () => {
    repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-original",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
      phone: "+351912345678",
      email: "utente@clinica.pt",
    });

    const collided = repo.upsert({
      tenantId: "t-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "ext-collision-attempt",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:05:00Z",
      phone: "+351912345678",
      email: "outro@clinica.pt",
    });

    expect(collided.conflictDetected).toBe(true);
    expect(collided.record.syncStatus).toBe("conflict");
    expect(collided.record.conflictType).toBe("contact_collision");
  });

  it("item 9: enforces strict tenant isolation on conflict resolution", () => {
    const key = "tenant-a::newsoft_ds::contact::p-1";
    repo.upsert({
      tenantId: "tenant-a",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "p-1",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T10:00:00Z",
    });

    expect(() => repo.resolveConflict("tenant-b", key, "accept_pms")).toThrow(
      /Cross-tenant/
    );
  });

  it("item 15 & 16: LGPD disabled tombstone prevents contact reimport and cleans appointment mirrors", () => {
    repo.upsert({
      tenantId: "tenant-a",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "patient-anonymized-99",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T09:00:00Z",
    });
    repo.upsert({
      tenantId: "tenant-a",
      provider: "newsoft_ds",
      entityType: "appointment",
      externalId: "apt-patient-anonymized-99-1",
      externalVersion: "v1.0",
      lastExternalUpdateAt: "2026-09-17T09:00:00Z",
    });

    const tombstoneRes = repo.recordLgpdTombstone("tenant-a", "newsoft_ds", "patient-anonymized-99");
    expect(tombstoneRes.tombstonedContact?.syncStatus).toBe("disabled");
    expect(tombstoneRes.removedAppointments.length).toBe(1);

    // Subsequent re-import attempt must be rejected
    expect(repo.isTombstoned("tenant-a", "newsoft_ds", "patient-anonymized-99")).toBe(true);
    const reimport = repo.upsert({
      tenantId: "tenant-a",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "patient-anonymized-99",
      externalVersion: "v2.0",
      lastExternalUpdateAt: "2026-09-17T11:00:00Z",
    });
    expect(reimport.conflictDetected).toBe(true);
    expect(reimport.record.syncStatus).toBe("disabled");
  });
});

describe("PMS Rollout Gate & Fail-Closed Behavior", () => {
  const originalEnv = process.env.PMS_NEWSOFT_ENABLED;

  afterEach(() => {
    process.env.PMS_NEWSOFT_ENABLED = originalEnv;
  });

  it("item 14: production rollout flag defaults OFF and fails closed", async () => {
    delete process.env.PMS_NEWSOFT_ENABLED;
    expect(isPmsRolloutEnabled()).toBe(false);

    const engine = new PmsSyncEngine();
    const conn: PmsConnection = {
      id: "c-1",
      tenantId: "t-1",
      provider: "newsoft_ds",
      status: "connected",
      health: "HEALTHY",
      syncEnabled: true,
      appointmentWriteEnabled: false,
      endpointUrl: "https://api.imaginasoft.pt/v1",
      encryptedSecretRef: "enc-1",
      last4: "1234",
      capabilities: { ...NEWSOFT_CAPABILITIES },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(
      engine.executeSyncJob({
        connection: conn,
        config: { tenantId: "t-1", endpointUrl: "https://api.imaginasoft.pt/v1", clinicApiKey: "key" },
        jobType: "initial_sync",
      })
    ).rejects.toThrow(/disabled by platform rollout gate/);
  });
});
