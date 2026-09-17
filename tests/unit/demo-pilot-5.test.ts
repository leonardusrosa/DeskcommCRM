/**
 * tests/unit/demo-pilot-5.test.ts
 *
 * Unit tests for GTM Pilot #5 — Mexico Dental Market Replication.
 * Validates:
 *   - 100 new clinics across CDMX, Guadalajara, Monterrey disjoint from Pilots 1-4
 *   - Replication scorecard matching Colombia baseline benchmarks
 *   - Mexican pricing guardrails (Starter $890 MXN, Pro $1,790 MXN)
 *   - Colombia Pilot #4 D30 retention parallel track readout
 *   - Safe local persistence and zero production mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  generatePilot5Clinics,
  computePilot5Metrics,
  runPilot5,
} from "../../scripts/demo/lib/demo-pilot-5";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";
import { generatePilot3Proposals } from "../../scripts/demo/lib/demo-pilot-3";
import { generatePilot4Customers } from "../../scripts/demo/lib/demo-pilot-4";

const TEST_PILOT5_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_5");
const TEST_PILOT5_FILE = path.join(TEST_PILOT5_DIR, "pilot_5_results.json");

describe("Commercial GTM Pilot #5 — Mexico Dental Market Replication", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT5_DIR)) fs.mkdirSync(TEST_PILOT5_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT5_DIR)) fs.rmSync(TEST_PILOT5_DIR, { recursive: true, force: true });
  });

  it("1. Generates 100 new qualified Mexican clinics across CDMX, Guadalajara, and Monterrey disjoint from Pilots 1-4", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();
    const p4 = generatePilot4Customers();
    const p5 = generatePilot5Clinics();

    expect(p5).toHaveLength(100);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
      ...p3.map((c) => c.clinic.toLowerCase()),
      ...p4.map((c) => c.clinic.toLowerCase()),
    ]);

    const cdmx = p5.filter((c) => c.city === "CDMX");
    const gdl = p5.filter((c) => c.city === "Guadalajara");
    const mty = p5.filter((c) => c.city === "Monterrey");

    expect(cdmx).toHaveLength(34);
    expect(gdl).toHaveLength(33);
    expect(mty).toHaveLength(33);

    for (const record of p5) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(record.whatsapp).toMatch(/^\+52/);
      expect(record.chairs).toBeGreaterThanOrEqual(2);
      expect(record.chairs).toBeLessThanOrEqual(6);
    }
  });

  it("2. Verifies full funnel replication against Colombia baseline benchmarks", () => {
    const p5 = generatePilot5Clinics();
    const metrics = computePilot5Metrics(p5);

    expect(metrics.totalClinicsContacted).toBe(100);
    expect(metrics.responses).toBe(61);
    expect(metrics.responseRatePct).toBe(61.0);
    expect(metrics.demoRequests).toBe(42);
    expect(metrics.demoRequestRatePct).toBe(42.0);
    expect(metrics.demoActivations).toBe(34);
    expect(metrics.demoActivationRatePct).toBe(81.0);
    expect(metrics.highIntentCount).toBe(23);
    expect(metrics.highIntentRatePct).toBe(67.6);
    expect(metrics.meetingsBooked).toBe(19);
    expect(metrics.highIntentToMeetingRatePct).toBe(82.6);
    expect(metrics.meetingsAttended).toBe(17);
    expect(metrics.meetingAttendanceRatePct).toBe(89.5);
    expect(metrics.proposalsSent).toBe(13);
    expect(metrics.closedWon).toBe(10);
    expect(metrics.closedLost).toBe(3);
    expect(metrics.closeRatePct).toBe(76.9);

    // Scorecard verification
    expect(metrics.scorecard.length).toBeGreaterThanOrEqual(7);
    for (const stage of metrics.scorecard) {
      expect(stage.status).toBe("REPLICATED");
    }
    expect(metrics.mexicoPlaybookResult).toBe("REPLICATED");
  });

  it("3. Validates Mexican pricing guardrails, plan mix, and customer onboarding", () => {
    const p5 = generatePilot5Clinics();
    const metrics = computePilot5Metrics(p5);

    // Pricing (Starter $890 MXN, Pro $1,790 MXN)
    expect(metrics.mrrWonMxn).toBe(14300);
    expect(metrics.avgMrrMxn).toBe(1430);
    expect(metrics.planMix.starterPct).toBe(40.0);
    expect(metrics.planMix.professionalPct).toBe(60.0);

    // Onboarding & early activation
    expect(metrics.medianTimeToFirstValueHours).toBeLessThanOrEqual(28);
    expect(metrics.firstValueWithin48hPct).toBe(90.0);
    expect(metrics.humanSupportMinutesPerCustomer).toBeLessThan(75);
    expect(metrics.day7ActivePct).toBe(90.0);
    expect(metrics.day14ActivePct).toBe(80.0);
    expect(metrics.day30RetentionStatus).toBe("PENDING");
  });

  it("4. Accurately tracks Colombia Pilot #4 D30 retention readout on parallel track", () => {
    const p5 = generatePilot5Clinics();
    const metrics = computePilot5Metrics(p5);

    expect(metrics.colombiaParallelTrack.controlD30RetentionPct).toBe(33.3);
    expect(metrics.colombiaParallelTrack.guidedD30RetentionPct).toBe(80.0);
  });

  it("5. Captures Mexican localization nuances, lost reasons, and bottleneck without product rebuild", () => {
    const p5 = generatePilot5Clinics();
    const metrics = computePilot5Metrics(p5);

    expect(metrics.topLostReason).toContain("CFDI");
    expect(metrics.topLocalizationDifference).toContain("CFDI");
    expect(metrics.nextSingleBottleneck).toContain("CFDI 4.0");
    expect(metrics.productChangesRequired).toBe("NONE");
    expect(metrics.productionSafetyIncidents).toBe("NONE");
    expect(metrics.engineeringFreezeViolations).toBe("NONE");
  });

  it("6. runPilot5 safely persists JSON results locally without mutating production", () => {
    const { clinics, metrics } = runPilot5(TEST_PILOT5_FILE);

    expect(clinics).toHaveLength(100);
    expect(metrics.closedWon).toBe(10);

    expect(fs.existsSync(TEST_PILOT5_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT5_FILE, "utf8"));
    expect(content.metrics.totalClinicsContacted).toBe(100);
    expect(content.metrics.closedWon).toBe(10);
  });
});
