/**
 * tests/unit/demo-pilot-8.test.ts
 *
 * Unit tests for GTM Pilot #8 — Spain Dental Market Replication.
 * Validates:
 *   - 100 new clinics across Madrid (34), Barcelona (33), Valencia (33) disjoint from Pilots 1–7
 *   - Replication scorecard against Mexico controlled-scale reference benchmarks
 *   - EUR pricing guardrails (€49 Starter, €99 Pro) and revenue output
 *   - staff_handoff_15min_v1 performance and retention preservation
 *   - EU reverse-charge billing discovery and Portugal gate status (NOT STARTED)
 *   - Safe local persistence and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generatePilot8Clinics,
  computePilot8Metrics,
  runPilot8,
} from "../../scripts/demo/lib/demo-pilot-8";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";
import { generatePilot3Proposals } from "../../scripts/demo/lib/demo-pilot-3";
import { generatePilot4Customers } from "../../scripts/demo/lib/demo-pilot-4";
import { generatePilot5Clinics } from "../../scripts/demo/lib/demo-pilot-5";
import { generatePilot6Opportunities } from "../../scripts/demo/lib/demo-pilot-6";
import { generatePilot7Clinics } from "../../scripts/demo/lib/demo-pilot-7";

const TEST_PILOT8_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_8");
const TEST_PILOT8_FILE = path.join(TEST_PILOT8_DIR, "pilot_8_results.json");

describe("Commercial GTM Pilot #8 — Spain Dental Market Replication", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT8_DIR)) fs.mkdirSync(TEST_PILOT8_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT8_DIR)) fs.rmSync(TEST_PILOT8_DIR, { recursive: true, force: true });
  });

  it("1. Generates 100 new qualified Spanish clinics across Madrid, Barcelona, Valencia disjoint from Pilots 1-7", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();
    const p4 = generatePilot4Customers();
    const p5 = generatePilot5Clinics();
    const p6 = generatePilot6Opportunities();
    const p7 = generatePilot7Clinics();
    const p8 = generatePilot8Clinics();

    expect(p8).toHaveLength(100);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
      ...p3.map((c) => c.clinic.toLowerCase()),
      ...p4.map((c) => c.clinic.toLowerCase()),
      ...p5.map((c) => c.clinic.toLowerCase()),
      ...p6.map((c) => c.clinic.toLowerCase()),
      ...p7.map((c) => c.clinic.toLowerCase()),
    ]);

    const mad = p8.filter((c) => c.city === "Madrid");
    const bcn = p8.filter((c) => c.city === "Barcelona");
    const vlc = p8.filter((c) => c.city === "Valencia");

    expect(mad).toHaveLength(34);
    expect(bcn).toHaveLength(33);
    expect(vlc).toHaveLength(33);

    const p8Names = new Set<string>();
    for (const record of p8) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(p8Names.has(record.clinic.toLowerCase())).toBe(false);
      p8Names.add(record.clinic.toLowerCase());

      expect(record.phone).toMatch(/^\+34/);
      expect(record.cabinets).toBeGreaterThanOrEqual(2);
      expect(record.cabinets).toBeLessThanOrEqual(6);
      expect(record.cifNif).toMatch(/^B\d{8}$/);
    }
  });

  it("2. Verifies full funnel replication scorecard against Mexico controlled-scale benchmarks", () => {
    const clinics = generatePilot8Clinics();
    const metrics = computePilot8Metrics(clinics);

    expect(metrics.contacted).toBe(100);
    expect(metrics.responses).toBe(60);
    expect(metrics.responseRatePct).toBe(60.0);
    expect(metrics.demoRequests).toBe(40);
    expect(metrics.demoRequestRatePct).toBe(40.0);
    expect(metrics.activations).toBe(32);
    expect(metrics.activationRatePct).toBe(80.0);
    expect(metrics.highIntent).toBe(22);
    expect(metrics.highIntentRatePct).toBe(68.8);
    expect(metrics.meetingsBooked).toBe(19);
    expect(metrics.meetingBookingRatePct).toBe(86.4);
    expect(metrics.meetingsAttended).toBe(16);
    expect(metrics.attendanceRatePct).toBe(84.2);
    expect(metrics.proposalsSent).toBe(11);
    expect(metrics.proposalRatePct).toBe(68.8);
    expect(metrics.closedWon).toBe(8);
    expect(metrics.closedLost).toBe(3);
    expect(metrics.closeRatePct).toBe(72.7);

    // Scorecard verification
    expect(metrics.scorecard.length).toBeGreaterThanOrEqual(8);
    for (const stage of metrics.scorecard) {
      expect(["REPLICATED", "STRONGER"]).toContain(stage.status);
    }
    expect(metrics.spainPlaybookResult).toBe("REPLICATED");
  });

  it("3. Validates European pricing guardrails (Starter €49 / Pro €99) and plan revenue mix", () => {
    const clinics = generatePilot8Clinics();
    const metrics = computePilot8Metrics(clinics);

    expect(metrics.mrrWonEur).toBe(642);
    expect(metrics.averageMrrEur).toBe(80);
    expect(metrics.planMix.starterPct).toBe(37.5);
    expect(metrics.planMix.professionalPct).toBe(62.5);

    expect(metrics.cityBreakdown.Madrid.won).toBe(3);
    expect(metrics.cityBreakdown.Barcelona.won).toBe(3);
    expect(metrics.cityBreakdown.Valencia.won).toBe(2);
  });

  it("4. Evaluates staff_handoff_15min_v1 performance, completion duration, and churn protection", () => {
    const clinics = generatePilot8Clinics();
    const metrics = computePilot8Metrics(clinics);

    expect(metrics.staffHandoffMetrics.eventsCount).toBe(2);
    expect(metrics.staffHandoffMetrics.completionRatePct).toBe(100.0);
    expect(metrics.staffHandoffMetrics.averageDurationMinutes).toBeLessThanOrEqual(15.0);
    expect(metrics.staffHandoffMetrics.averageDurationMinutes).toBe(13.0);
    expect(metrics.staffHandoffMetrics.supportMinutesTotal).toBe(8);
    expect(metrics.staffHandoffMetrics.validationResult).toBe("IMPROVED");

    // Onboarding & early retention
    expect(metrics.firstValueWithin48hPct).toBe(100.0);
    expect(metrics.d7ActivePct).toBe(100.0);
    expect(metrics.d14ActivePct).toBe(100.0);
    expect(metrics.d30RetentionPct).toBe(100.0);
    expect(metrics.d60RetentionStatus).toBe("PENDING");
  });

  it("5. Captures Spain localization nuances, incumbent PMS software, and Portugal gate", () => {
    const clinics = generatePilot8Clinics();
    const metrics = computePilot8Metrics(clinics);

    expect(metrics.topLostReason).toContain("existing_software");
    expect(metrics.topSpainLocalizationDifference).toContain("gabinetes");
    expect(metrics.topSpainLocalizationDifference).toContain("Reverse Charge");
    expect(metrics.billingTaxBlockedDeals).toBe(0);
    expect(metrics.nextSingleBottleneck).toContain("PMS");
    expect(metrics.portugalStatus).toBe("NOT STARTED");
  });

  it("6. runPilot8 safely persists JSON report locally with guards and touches zero production infrastructure", () => {
    const report = runPilot8(TEST_PILOT8_FILE);

    expect(report.pilot).toBe(8);
    expect(report.status).toBe("COMPLETE");
    expect(report.productionSafetyIncidents).toBe("NONE");
    expect(report.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT8_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT8_FILE, "utf8"));
    expect(content.report.contacted).toBe(100);
    expect(content.report.closedWon).toBe(8);
    expect(content.clinics).toHaveLength(100);
  });
});
