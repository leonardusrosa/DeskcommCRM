/**
 * tests/unit/demo-pilot-7.test.ts
 *
 * Unit tests for GTM Pilot #7 — Mexico Controlled Commercial Scale (300 Clinics).
 * Validates:
 *   - 300 unique Mexican clinics (100 CDMX, 100 GDL, 100 MTY) strictly disjoint from Pilots 1-6
 *   - Full funnel conversion rates matching calibrated Mexico playbook
 *   - Billing routes A–E & CFDI economic gate evaluation ($280,000 threshold)
 *   - Guided 48h activation, D30/D60 operational retention, and receptionist churn taxonomy
 *   - Colombia benchmark comparison & international expansion readiness
 *   - Safe local persistence and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generatePilot7Clinics,
  computePilot7Metrics,
  runPilot7,
} from "../../scripts/demo/lib/demo-pilot-7";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";
import { generatePilot3Proposals } from "../../scripts/demo/lib/demo-pilot-3";
import { generatePilot4Customers } from "../../scripts/demo/lib/demo-pilot-4";
import { generatePilot5Clinics } from "../../scripts/demo/lib/demo-pilot-5";
import { generatePilot6Opportunities } from "../../scripts/demo/lib/demo-pilot-6";

const TEST_PILOT7_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_7");
const TEST_PILOT7_FILE = path.join(TEST_PILOT7_DIR, "pilot_7_results.json");

describe("Commercial GTM Pilot #7 — Mexico Controlled Commercial Scale", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT7_DIR)) fs.mkdirSync(TEST_PILOT7_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT7_DIR)) fs.rmSync(TEST_PILOT7_DIR, { recursive: true, force: true });
  });

  it("1. Generates 300 new qualified Mexican clinics across CDMX, GDL, MTY disjoint from Pilots 1-6", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();
    const p4 = generatePilot4Customers();
    const p5 = generatePilot5Clinics();
    const p6 = generatePilot6Opportunities();
    const p7 = generatePilot7Clinics();

    expect(p7).toHaveLength(300);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
      ...p3.map((c) => c.clinic.toLowerCase()),
      ...p4.map((c) => c.clinic.toLowerCase()),
      ...p5.map((c) => c.clinic.toLowerCase()),
      ...p6.map((c) => c.clinic.toLowerCase()),
    ]);

    const cdmx = p7.filter((c) => c.city === "CDMX");
    const gdl = p7.filter((c) => c.city === "Guadalajara");
    const mty = p7.filter((c) => c.city === "Monterrey");

    expect(cdmx).toHaveLength(100);
    expect(gdl).toHaveLength(100);
    expect(mty).toHaveLength(100);

    const p7Names = new Set<string>();
    for (const record of p7) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(p7Names.has(record.clinic.toLowerCase())).toBe(false);
      p7Names.add(record.clinic.toLowerCase());

      expect(record.whatsapp).toMatch(/^\+52/);
      expect(record.chairs).toBeGreaterThanOrEqual(2);
      expect(record.chairs).toBeLessThanOrEqual(6);
    }
  });

  it("2. Validates full funnel conversion metrics and commercial revenue output", () => {
    const clinics = generatePilot7Clinics();
    const metrics = computePilot7Metrics(clinics);

    expect(metrics.funnel.contacted).toBe(300);
    expect(metrics.funnel.responded).toBe(186);
    expect(metrics.funnel.responseRatePct).toBe(62.0);
    expect(metrics.funnel.demoRequested).toBe(126);
    expect(metrics.funnel.demoRequestRatePct).toBe(42.0);
    expect(metrics.funnel.activated).toBe(102);
    expect(metrics.funnel.activationRatePct).toBe(81.0);
    expect(metrics.funnel.highIntent).toBe(69);
    expect(metrics.funnel.highIntentRatePct).toBe(67.6);
    expect(metrics.funnel.meetingsBooked).toBe(57);
    expect(metrics.funnel.meetingBookingRatePct).toBe(82.6);
    expect(metrics.funnel.meetingsAttended).toBe(51);
    expect(metrics.funnel.attendanceRatePct).toBe(89.5);
    expect(metrics.funnel.proposalsSent).toBe(39);
    expect(metrics.funnel.closedWon).toBe(30);
    expect(metrics.funnel.closeRatePct).toBe(76.9);

    // Revenue & Mix
    expect(metrics.funnel.totalMrrMxn).toBe(42900);
    expect(metrics.funnel.averageMrrMxn).toBe(1430);
    expect(metrics.funnel.planMix.starterPct).toBe(40.0);
    expect(metrics.funnel.planMix.professionalPct).toBe(60.0);

    // Balanced city distribution (10 won per city)
    expect(metrics.cityBreakdown.CDMX.won).toBe(10);
    expect(metrics.cityBreakdown.Guadalajara.won).toBe(10);
    expect(metrics.cityBreakdown.Monterrey.won).toBe(10);
    expect(metrics.cityBreakdown.CDMX.mrrMxn).toBe(14300);
  });

  it("3. Validates billing routing (Routes A–E) and CFDI economic gate threshold", () => {
    const clinics = generatePilot7Clinics();
    const metrics = computePilot7Metrics(clinics);

    expect(metrics.billing.foreignReceiptsIssued).toBe(18);
    expect(metrics.billing.foreignReceiptsAccepted).toBe(18);
    expect(metrics.billing.taxMemoEscalations).toBe(6);
    expect(metrics.billing.cfdiBlockedCustomers).toBe(6);
    expect(metrics.billing.localSupplierBlockedCustomers).toBe(3);

    // Economic gate: threshold $280,000 MXN vs actual blocked $8,040 MXN
    expect(metrics.billing.mrrBlockedCfdi).toBe(8040);
    expect(metrics.billing.cfdiThresholdMxn).toBe(280000);
    expect(metrics.billing.cfdiEconomicGate).toBe("BELOW");
    expect(metrics.decisionGates.nativeCfdi).toBe("DEFERRED");
  });

  it("4. Evaluates guided 48h onboarding and D30/D60 operational retention cohorts", () => {
    const clinics = generatePilot7Clinics();
    const metrics = computePilot7Metrics(clinics);

    expect(metrics.activationRetention.medianTimeToFirstValueHours).toBeLessThanOrEqual(28);
    expect(metrics.activationRetention.firstValueWithin48hPct).toBe(90.0);
    expect(metrics.activationRetention.humanSupportMinutesPerCustomer).toBeLessThan(65);

    // Operational retention cohorts
    expect(metrics.activationRetention.d7ActivePct).toBe(90.0);
    expect(metrics.activationRetention.d14ActivePct).toBe(80.0);
    expect(metrics.activationRetention.d30RetentionPct).toBe(80.0);
    expect(metrics.activationRetention.d60RetentionPct).toBe(80.0);

    // Churn diagnosis
    expect(metrics.activationRetention.topChurnReason).toBe("staff_adoption");
    expect(metrics.churnBreakdown.staff_adoption).toBeGreaterThan(0);
    expect(metrics.churnBreakdown.low_usage).toBeGreaterThan(0);
  });

  it("5. Verifies Colombia benchmark comparison and international expansion decision gate", () => {
    const clinics = generatePilot7Clinics();
    const metrics = computePilot7Metrics(clinics);

    expect(metrics.colombiaComparison).toHaveLength(7);
    for (const row of metrics.colombiaComparison) {
      expect(["AHEAD", "ON_PAR"]).toContain(row.status);
    }

    expect(metrics.decisionGates.acquisition).toBe("HEALTHY");
    expect(metrics.decisionGates.sales).toBe("HEALTHY");
    expect(metrics.decisionGates.billing).toBe("HEALTHY");
    expect(metrics.decisionGates.activation).toBe("HEALTHY");
    expect(metrics.decisionGates.d30Retention).toBe("HEALTHY");
    expect(metrics.decisionGates.supportScalability).toBe("HEALTHY");
    expect(metrics.decisionGates.mexicoScaleResult).toBe("HEALTHY");

    // Spain/Portugal expansion gate is READY FOR DECISION based on all 5 gates satisfied
    expect(metrics.decisionGates.spainPortugalExpansion).toBe("READY FOR DECISION");
  });

  it("6. runPilot7 safely persists JSON report locally with guards and touches zero production infrastructure", () => {
    const report = runPilot7(TEST_PILOT7_FILE);

    expect(report.pilot).toBe(7);
    expect(report.status).toBe("COMPLETE");
    expect(report.productionSafetyIncidents).toBe("NONE");
    expect(report.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT7_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT7_FILE, "utf8"));
    expect(content.report.funnel.contacted).toBe(300);
    expect(content.report.funnel.closedWon).toBe(30);
    expect(content.clinics).toHaveLength(300);
  });
});
