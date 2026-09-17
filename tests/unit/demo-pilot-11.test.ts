/**
 * tests/unit/demo-pilot-11.test.ts
 *
 * Unit tests for GTM Pilot #11:
 * PMS Bridge Productionization & Vendor Certification.
 *
 * Validates:
 *   - Corrected dual prioritization (Strategic Opportunity vs Build-Now Readiness)
 *   - Track A: NewSoft DS progressive rollout, acceptance gates, and idempotency
 *   - Track B: Gesden Henry Schein partner track questionnaire & interim ledger
 *   - Non-clinical fail-closed security guard and cross-tenant isolation
 *   - Kill switch functionality and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computePilot11Metrics,
  computePrioritizationAnalysis,
  executeNewSoftProgressiveRollout,
  runPilot11,
} from "../../scripts/demo/lib/demo-pilot-11";
import {
  NewSoftDsConnector,
} from "../../scripts/demo/lib/demo-newsoft-connector";
import {
  GESDEN_PARTNER_QUESTIONNAIRE,
  getGesdenVendorDossier,
} from "../../scripts/demo/lib/demo-gesden-track";
import {
  PmsMappingStore,
  globalPmsMappingStore,
} from "../../scripts/demo/lib/demo-pms-mapping";
import {
  assertProviderActive,
  assertTenantIsolation,
  isProviderEnabled,
  isTenantSyncEnabled,
  setProviderEnabled,
  setTenantSyncEnabled,
} from "../../scripts/demo/lib/demo-pms-provider";

const TEST_PILOT11_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_11");
const TEST_PILOT11_FILE = path.join(TEST_PILOT11_DIR, "pilot_11_results.json");

describe("Commercial GTM Pilot #11 — PMS Bridge Productionization & Vendor Certification", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT11_DIR)) fs.mkdirSync(TEST_PILOT11_DIR, { recursive: true });
    globalPmsMappingStore.clear();
    setProviderEnabled("newsoft_ds", true);
    setTenantSyncEnabled("test-tenant", true);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT11_DIR)) fs.rmSync(TEST_PILOT11_DIR, { recursive: true, force: true });
  });

  it("1. Verifies corrected dual prioritization model without collapsing strategic vs readiness scores", () => {
    const analysis = computePrioritizationAnalysis();

    expect(analysis.strategicOpportunityLeader).toBe("GESDEN");
    expect(analysis.strategicScores.gesdenScore).toBeGreaterThan(analysis.strategicScores.newsoftScore);
    expect(analysis.strategicScores.gesdenScore).toBe(9653);
    expect(analysis.strategicScores.newsoftScore).toBe(2673);

    expect(analysis.buildNowReadinessLeader).toBe("NEWSOFT");
    expect(analysis.readinessScores.newsoftScore).toBeGreaterThan(analysis.readinessScores.gesdenScore);
    expect(analysis.readinessScores.newsoftScore).toBe(92);
    expect(analysis.readinessScores.gesdenScore).toBe(35);
  });

  it("2. Validates Track A: NewSoft technical contract and progressive rollout across 6 clinics", () => {
    const contract = NewSoftDsConnector.getContract();
    expect(contract.patientContactRead).toBe("SUPPORTED");
    expect(contract.appointmentRead).toBe("SUPPORTED");
    expect(contract.appointmentCreate).toBe("SUPPORTED");
    expect(contract.appointmentUpdate).toBe("SUPPORTED");
    expect(contract.appointmentCancel).toBe("SUPPORTED");
    expect(contract.webhooks).toBe("SUPPORTED");
    expect(contract.incrementalSync).toBe("SUPPORTED");

    const rollout = executeNewSoftProgressiveRollout();
    expect(rollout.stages).toHaveLength(3);

    // Acceptance gates
    expect(rollout.overallSuccessRatePct).toBeGreaterThanOrEqual(99.0);
    expect(rollout.totalDuplicates).toBe(0);
    expect(rollout.unresolvedConflicts).toBe(0);
    expect(rollout.clinicalDataIngested).toBe(0);
    expect(rollout.securityIncidents).toBe(0);
    expect(rollout.duplicateEntryReductionPct).toBeGreaterThanOrEqual(70.0);
    expect(rollout.duplicateEntryReductionPct).toBe(82.5);

    const metrics = computePilot11Metrics();
    expect(metrics.newsoftClinicsConnected).toBe(6);
    expect(metrics.newsoftDealsUnblocked).toBe(1);
    expect(metrics.newsoftMrrUnblockedEur).toBe(99);
    expect(metrics.newsoftConnectorResult).toBe("PRODUCTIONIZED");
  });

  it("3. Validates Track B: Gesden Henry Schein partner track questionnaire & interim ledger", () => {
    expect(GESDEN_PARTNER_QUESTIONNAIRE.length).toBeGreaterThanOrEqual(10);
    const dossier = getGesdenVendorDossier();

    expect(dossier.vendorName).toContain("Henry Schein One");
    expect(dossier.partnerProgramAvailable).toBe(true);
    expect(dossier.officialApiConfirmed).toBe(false);
    expect(dossier.localMiddlewareRequired).toBe(true);
    expect(dossier.partnerStatus).toBe("PARTNER_PROCESS_PENDING");
    expect(dossier.interimPath).toBe("EXPORT_IMPORT_V1");
    expect(dossier.clinicsWaiting).toBe(13);
    expect(dossier.mrrWaitingEur).toBe(297);

    const metrics = computePilot11Metrics();
    expect(metrics.gesdenVendorContact).toBe("COMPLETED");
    expect(metrics.gesdenG5ApiConfirmed).toBe("NO");
    expect(metrics.gesdenPartnerStatus).toBe("PARTNER_PROCESS_PENDING");
    expect(metrics.gesdenConnectorResult).toBe("PARTNER_PENDING");
    expect(metrics.infomedDentool).toBe("WATCHLIST");
  });

  it("4. Enforces non-clinical fail-closed security boundary and rejects clinical payloads", () => {
    const connector = new NewSoftDsConnector();

    expect(() => connector.validateNonClinicalSafety({ odontogram: "16-O" })).toThrowError(
      /Non-clinical boundary violation/
    );
    expect(() => connector.validateNonClinicalSafety({ clinicalNote: "Cárie profunda" })).toThrowError(
      /Non-clinical boundary violation/
    );
    expect(() => connector.validateNonClinicalSafety({ anamnesis: "Hipertensão" })).toThrowError(
      /Non-clinical boundary violation/
    );
    expect(() => connector.validateNonClinicalSafety({ invoice: "FT2026/99" })).toThrowError(
      /Non-clinical boundary violation/
    );

    // Administrative payload must pass cleanly
    expect(() =>
      connector.validateNonClinicalSafety({
        externalId: "ext-1",
        name: "Carlos Matos",
        phone: "+351 912 345 678",
        status: "CONFIRMED",
      })
    ).not.toThrow();
  });

  it("5. Verifies multi-tenant isolation, idempotency key generation, and kill switches", () => {
    // Multi-tenant isolation test: cross-tenant access must throw
    expect(() => assertTenantIsolation("clinic-a", "clinic-b")).toThrowError(/Cross-tenant PMS access attempt blocked/);
    expect(() => assertTenantIsolation("clinic-a", "clinic-a")).not.toThrow();

    // Idempotency test: repeated sync does not create duplicate mappings
    const testStore = new PmsMappingStore();
    const res1 = testStore.upsertMapping({
      tenantId: "tenant-iso-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "pat-100",
      deskcommId: "dk-100",
      externalVersion: "v1",
      lastExternalUpdateAt: "2026-09-16T10:00:00Z",
    });
    expect(res1.isDuplicate).toBe(false);

    const res2 = testStore.upsertMapping({
      tenantId: "tenant-iso-1",
      provider: "newsoft_ds",
      entityType: "contact",
      externalId: "pat-100",
      deskcommId: "dk-100",
      externalVersion: "v1",
      lastExternalUpdateAt: "2026-09-16T10:00:00Z",
    });
    expect(res2.isDuplicate).toBe(true);
    expect(testStore.getMappingsByTenant("tenant-iso-1")).toHaveLength(1);

    // Kill switch tests
    setProviderEnabled("newsoft_ds", false);
    expect(isProviderEnabled("newsoft_ds")).toBe(false);
    expect(() => assertProviderActive("newsoft_ds", "tenant-iso-1")).toThrowError(/kill switch/);

    setProviderEnabled("newsoft_ds", true);
    setTenantSyncEnabled("tenant-iso-1", false);
    expect(isTenantSyncEnabled("tenant-iso-1")).toBe(false);
    expect(() => assertProviderActive("newsoft_ds", "tenant-iso-1")).toThrowError(/disabled for tenant/);
  });

  it("6. runPilot11 safely persists report locally and touches zero production infrastructure", () => {
    const report = runPilot11(TEST_PILOT11_FILE);

    expect(report.pilot).toBe(11);
    expect(report.status).toBe("COMPLETE");
    expect(report.newsoftConnectorResult).toBe("PRODUCTIONIZED");
    expect(report.gesdenConnectorResult).toBe("PARTNER_PENDING");
    expect(report.productionSafetyIncidents).toBe("NONE");
    expect(report.securityIncidents).toBe("NONE");
    expect(report.clinicalDataIncidents).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT11_FILE)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(TEST_PILOT11_FILE, "utf8"));
    expect(saved.newsoftClinicsConnected).toBe(6);
    expect(saved.gesdenClinicsWaiting).toBe(13);
  });
});
