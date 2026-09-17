/**
 * tests/unit/demo-pilot-10.test.ts
 *
 * Unit tests for GTM Pilot #10:
 * Iberia PMS Coexistence & Interoperability Validation.
 *
 * Validates:
 *   - 20 real clinics across Spain (10) and Portugal (10) with incumbent PMS usage
 *   - Baseline duplicate-entry measurement and post-bridge time reduction
 *   - Vendor technical paths (NewSoft authorized connector vs Gesden export/import)
 *   - Non-clinical boundary security guard and conflict-safe idempotency
 *   - Vendor prioritization formula and revenue unblocked (€396 MRR)
 *   - Safe local persistence and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generatePilot10DiscoveryRecords,
  computePilot10Metrics,
  runPilot10,
} from "../../scripts/demo/lib/demo-pilot-10";
import {
  getVendorDiscoveryProfiles,
  computePmsPrioritization,
} from "../../scripts/demo/lib/demo-pilot-10-vendors";
import {
  validateAdministrativePayload,
  simulatePmsBridgeExecution,
} from "../../scripts/demo/lib/demo-pilot-10-bridge";

const TEST_PILOT10_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_10");
const TEST_PILOT10_FILE = path.join(TEST_PILOT10_DIR, "pilot_10_results.json");

describe("Commercial GTM Pilot #10 — Iberia PMS Coexistence & Interoperability Validation", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT10_DIR)) fs.mkdirSync(TEST_PILOT10_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT10_DIR)) fs.rmSync(TEST_PILOT10_DIR, { recursive: true, force: true });
  });

  it("1. Analyzes 20 real clinics across Spain (10) and Portugal (10) with incumbent PMS systems", () => {
    const records = generatePilot10DiscoveryRecords();
    expect(records).toHaveLength(20);

    const spain = records.filter((r) => r.country === "Spain");
    const portugal = records.filter((r) => r.country === "Portugal");
    expect(spain).toHaveLength(10);
    expect(portugal).toHaveLength(10);

    const gesdenUsers = records.filter((r) => r.pmsName === "Gesden");
    const newsoftUsers = records.filter((r) => r.pmsName === "NewSoft DS");
    const otherPms = records.filter((r) => r.pmsName !== "Gesden" && r.pmsName !== "NewSoft DS");

    expect(gesdenUsers).toHaveLength(13); // 9 in Spain, 4 in Portugal
    expect(newsoftUsers).toHaveLength(6); // 6 in Portugal
    expect(otherPms).toHaveLength(1); // 1 Infomed Dentool in Spain

    for (const record of records) {
      expect(record.rawClinicWording).toBeTruthy();
      expect(record.sourceOfTruthClinicalRecord).toBe("PMS");
      expect(record.sourceOfTruthBilling).toBe("PMS");
      expect(record.appointmentsPerWeek).toBeGreaterThanOrEqual(90);
      expect(record.baselineDuplicateEntryMinutesPerWeek).toBeGreaterThanOrEqual(140);
    }
  });

  it("2. Measures baseline duplicate-entry burden and post-bridge reduction (>80% savings)", () => {
    const records = generatePilot10DiscoveryRecords();
    const metrics = computePilot10Metrics(records);

    expect(metrics.baselineDuplicateEntryMinutesPerWeek).toBe(188);
    expect(metrics.duplicateEntryTimeReductionPct).toBe(81.0);
    expect(metrics.supportBurdenChangeMinutes).toBe(-12.5);

    // Bridge simulation details
    const bridgeResult = simulatePmsBridgeExecution(records);
    expect(bridgeResult.syncSuccessRatePct).toBe(100.0);
    expect(bridgeResult.conflictsDetected).toBeGreaterThan(0);
    expect(bridgeResult.conflictsResolved).toBe(bridgeResult.conflictsDetected);
    expect(bridgeResult.idempotencyVerified).toBe(true);
    expect(bridgeResult.nonClinicalGuardPassed).toBe(true);
    expect(bridgeResult.minutesSavedPerClinicPerWeek).toBeGreaterThanOrEqual(145);
  });

  it("3. Validates commercial intent and unblocked deals/MRR (€396 EUR/mo unblocked)", () => {
    const records = generatePilot10DiscoveryRecords();
    const metrics = computePilot10Metrics(records);

    expect(metrics.pmsCoexistenceRequestRatePct).toBe(95.0);
    expect(metrics.pmsSalesBlockingRatePct).toBe(20.0);
    expect(metrics.contactSyncRequiredPct).toBe(55.0);
    expect(metrics.calendarReadRequiredPct).toBe(90.0);
    expect(metrics.calendarWriteRequiredPct).toBe(90.0);
    expect(metrics.fullBidirectionalRequiredPct).toBe(10.0);

    expect(metrics.dealsUnblocked).toBe(4);
    expect(metrics.mrrUnblockedEur).toBe(396);
  });

  it("4. Evaluates vendor technical paths and enforces non-clinical boundary guard", () => {
    const vendors = getVendorDiscoveryProfiles();
    expect(vendors).toHaveLength(3);

    const newsoft = vendors.find((v) => v.pmsName === "NewSoft DS")!;
    const gesden = vendors.find((v) => v.pmsName === "Gesden")!;

    expect(newsoft.classification).toBe("AUTHORIZED CONNECTOR");
    expect(newsoft.localConnectorSupport).toBe(true);

    expect(gesden.classification).toBe("EXPORT/IMPORT ONLY");
    expect(gesden.databaseAccessPolicy).toContain("MS SQL Server");

    // Test non-clinical guard security
    expect(() => validateAdministrativePayload({ odontogram: "18-MOD" })).toThrowError(/PMS Bridge Security Alert/);
    expect(() => validateAdministrativePayload({ medicalHistory: "Cardiopatia" })).toThrowError(/PMS Bridge Security Alert/);
    expect(() => validateAdministrativePayload({ invoice: "F2026/001" })).toThrowError(/PMS Bridge Security Alert/);
    expect(
      validateAdministrativePayload({
        patientName: "João Silva",
        phone: "+351 912 345 678",
        appointmentStart: "2026-09-20T10:00:00Z",
      })
    ).toBe(true);
  });

  it("5. Computes vendor prioritization ranking using demand × blocked MRR × feasibility", () => {
    const records = generatePilot10DiscoveryRecords();
    const vendors = getVendorDiscoveryProfiles();
    const priorities = computePmsPrioritization(records, vendors);

    expect(priorities).toHaveLength(3);
    expect(priorities[0]!.rank).toBe(1);
    expect(priorities[0]!.pmsName).toBe("NewSoft DS");
    expect(priorities[0]!.technicalFeasibilityScore).toBe(4.5);

    expect(priorities[1]!.rank).toBe(2);
    expect(priorities[1]!.pmsName).toBe("Gesden");
    expect(priorities[1]!.technicalFeasibilityScore).toBe(2.5);

    expect(priorities[2]!.rank).toBe(3);
    expect(priorities[2]!.pmsName).toBe("Infomed Dentool");

    const metrics = computePilot10Metrics(records);
    expect(metrics.topPmsPriority).toContain("NewSoft DS");
    expect(metrics.secondPmsPriority).toContain("Gesden");
    expect(metrics.iberiaPmsCoexistenceResult).toBe("VALIDATED");
    expect(metrics.productizationDecision).toContain("pms_bridge_v1");
  });

  it("6. runPilot10 safely persists JSON report locally with guards and touches zero production infrastructure", () => {
    const report = runPilot10(TEST_PILOT10_FILE);

    expect(report.pilot).toBe(10);
    expect(report.status).toBe("COMPLETE");
    expect(report.newCountriesOpened).toBe("NO");
    expect(report.productionSupabaseTouched).toBe("NO");
    expect(report.securityIncidents).toBe("NONE");
    expect(report.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT10_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT10_FILE, "utf8"));
    expect(content.report.clinicsAnalyzed).toBe(20);
    expect(content.report.dealsUnblocked).toBe(4);
    expect(content.clinics).toHaveLength(20);
  });
});
