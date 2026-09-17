/**
 * tests/unit/demo-pilot-9.test.ts
 *
 * Unit tests for GTM Pilot #9 — Portugal Dental Market Replication.
 * Validates:
 *   - 100 new clinics across Lisboa (34), Porto (33), Braga (33) disjoint from Pilots 1–8
 *   - Replication scorecard against Spain and Mexico reference benchmarks
 *   - EUR pricing guardrails (€49 Starter, €99 Pro) and revenue output (€642 MRR won)
 *   - TTFV metrics (median, mean, P75, <=24h, <=48h, <=72h) and staff_handoff_15min_v1
 *   - NewSoft NDent / Gesden PMS coexistence discovery and reverse-charge billing
 *   - Safe local persistence and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generatePilot9Clinics,
  computePilot9Metrics,
  runPilot9,
} from "../../scripts/demo/lib/demo-pilot-9";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";
import { generatePilot3Proposals } from "../../scripts/demo/lib/demo-pilot-3";
import { generatePilot4Customers } from "../../scripts/demo/lib/demo-pilot-4";
import { generatePilot5Clinics } from "../../scripts/demo/lib/demo-pilot-5";
import { generatePilot6Opportunities } from "../../scripts/demo/lib/demo-pilot-6";
import { generatePilot7Clinics } from "../../scripts/demo/lib/demo-pilot-7";
import { generatePilot8Clinics } from "../../scripts/demo/lib/demo-pilot-8";

const TEST_PILOT9_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_9");
const TEST_PILOT9_FILE = path.join(TEST_PILOT9_DIR, "pilot_9_results.json");

describe("Commercial GTM Pilot #9 — Portugal Dental Market Replication", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT9_DIR)) fs.mkdirSync(TEST_PILOT9_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT9_DIR)) fs.rmSync(TEST_PILOT9_DIR, { recursive: true, force: true });
  });

  it("1. Generates 100 new qualified Portuguese clinics across Lisboa, Porto, Braga disjoint from Pilots 1-8", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();
    const p4 = generatePilot4Customers();
    const p5 = generatePilot5Clinics();
    const p6 = generatePilot6Opportunities();
    const p7 = generatePilot7Clinics();
    const p8 = generatePilot8Clinics();
    const p9 = generatePilot9Clinics();

    expect(p9).toHaveLength(100);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
      ...p3.map((c) => c.clinic.toLowerCase()),
      ...p4.map((c) => c.clinic.toLowerCase()),
      ...p5.map((c) => c.clinic.toLowerCase()),
      ...p6.map((c) => c.clinic.toLowerCase()),
      ...p7.map((c) => c.clinic.toLowerCase()),
      ...p8.map((c) => c.clinic.toLowerCase()),
    ]);

    const lis = p9.filter((c) => c.city === "Lisboa");
    const opo = p9.filter((c) => c.city === "Porto");
    const bgx = p9.filter((c) => c.city === "Braga");

    expect(lis).toHaveLength(34);
    expect(opo).toHaveLength(33);
    expect(bgx).toHaveLength(33);

    const p9Names = new Set<string>();
    for (const record of p9) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(p9Names.has(record.clinic.toLowerCase())).toBe(false);
      p9Names.add(record.clinic.toLowerCase());

      expect(record.phone).toMatch(/^\+351\s(21|22|253)\s\d{6}$/);
      expect(record.whatsapp).toMatch(/^\+351\s9[1-4]\s\d{6}$/);
      expect(record.chairs).toBeGreaterThanOrEqual(2);
      expect(record.chairs).toBeLessThanOrEqual(6);
      expect(record.nif).toMatch(/^50\d{7}$/);
    }
  });

  it("2. Verifies full funnel replication scorecard against Spain and Mexico benchmarks", () => {
    const clinics = generatePilot9Clinics();
    const metrics = computePilot9Metrics(clinics);

    expect(metrics.contacted).toBe(100);
    expect(metrics.responses).toBe(59);
    expect(metrics.responseRatePct).toBe(59.0);
    expect(metrics.demoRequests).toBe(39);
    expect(metrics.demoRequestRatePct).toBe(39.0);
    expect(metrics.activations).toBe(31);
    expect(metrics.activationRatePct).toBe(79.5);
    expect(metrics.highIntent).toBe(21);
    expect(metrics.highIntentRatePct).toBe(67.7);
    expect(metrics.meetingsBooked).toBe(18);
    expect(metrics.highIntentToMeetingRatePct).toBe(85.7);
    expect(metrics.meetingsAttended).toBe(15);
    expect(metrics.attendanceRatePct).toBe(83.3);
    expect(metrics.proposalsSent).toBe(11);
    expect(metrics.proposalRatePct).toBe(73.3);
    expect(metrics.closedWon).toBe(8);
    expect(metrics.closedLost).toBe(3);
    expect(metrics.closeRatePct).toBe(72.7);

    // Scorecard verification
    expect(metrics.scorecard.length).toBeGreaterThanOrEqual(8);
    for (const stage of metrics.scorecard) {
      expect(["REPLICATED", "STRONGER"]).toContain(stage.status);
    }
    expect(metrics.portugalPlaybookResult).toBe("REPLICATED");
  });

  it("3. Validates European pricing guardrails (€49 Starter / €99 Pro) and plan revenue mix", () => {
    const clinics = generatePilot9Clinics();
    const metrics = computePilot9Metrics(clinics);

    expect(metrics.mrrWonEur).toBe(642);
    expect(metrics.averageMrrEur).toBe(80.25);
    expect(metrics.planMix.starterPct).toBe(37.5);
    expect(metrics.planMix.professionalPct).toBe(62.5);

    expect(metrics.cityBreakdown.Lisboa.won).toBe(3);
    expect(metrics.cityBreakdown.Lisboa.mrrEur).toBe(247);
    expect(metrics.cityBreakdown.Porto.won).toBe(3);
    expect(metrics.cityBreakdown.Porto.mrrEur).toBe(247);
    expect(metrics.cityBreakdown.Braga.won).toBe(2);
    expect(metrics.cityBreakdown.Braga.mrrEur).toBe(148);
  });

  it("4. Evaluates TTFV percentiles, support minutes, and staff_handoff_15min_v1 execution", () => {
    const clinics = generatePilot9Clinics();
    const metrics = computePilot9Metrics(clinics);

    // TTFV percentiles and thresholds
    expect(metrics.medianTimeToFirstValueHours).toBe(25.5);
    expect(metrics.meanTimeToFirstValueHours).toBe(26.1);
    expect(metrics.p75TimeToFirstValueHours).toBe(29.5);
    expect(metrics.firstValueWithin24hPct).toBe(37.5);
    expect(metrics.firstValueWithin48hPct).toBe(100.0);
    expect(metrics.firstValueWithin72hPct).toBe(100.0);
    expect(metrics.humanSupportMinutesPerCustomer).toBe(51.5);

    // Staff handoff
    expect(metrics.staffHandoffMetrics.eventsCount).toBe(2);
    expect(metrics.staffHandoffMetrics.completionRatePct).toBe(100.0);
    expect(metrics.staffHandoffMetrics.averageDurationMinutes).toBe(13.5);
    expect(metrics.staffHandoffMetrics.supportMinutesTotal).toBe(7);

    // Early retention
    expect(metrics.d7ActivePct).toBe(100.0);
    expect(metrics.d14ActivePct).toBe(100.0);
    expect(metrics.d30RetentionPct).toBe(100.0);
    expect(metrics.d60RetentionStatus).toBe("PENDING");
  });

  it("5. Captures PMS coexistence (NewSoft NDent / Gesden), billing discovery, and next bottleneck", () => {
    const clinics = generatePilot9Clinics();
    const metrics = computePilot9Metrics(clinics);

    expect(metrics.billingTaxBlocked).toBe(0);
    expect(metrics.pmsCoexistenceRequests).toBe(6);
    expect(metrics.pmsIntegrationBlocked).toBe(1);
    expect(metrics.topExistingPms).toBe("NewSoft NDent");
    expect(metrics.topLostReason).toContain("missing_integration");
    expect(metrics.topPortugalLocalizationDifference).toContain("Art. 6.º do CIVA");
    expect(metrics.topPortugalLocalizationDifference).toContain("marcações");
    expect(metrics.nextSingleBottleneck).toContain("Practice Management Software (PMS) Coexistence Bridge");
  });

  it("6. runPilot9 safely persists JSON report locally with guards and touches zero production infrastructure", () => {
    const report = runPilot9(TEST_PILOT9_FILE);

    expect(report.pilot).toBe(9);
    expect(report.status).toBe("COMPLETE");
    expect(report.productionSupabaseTouched).toBe("NO");
    expect(report.productionSafetyIncidents).toBe("NONE");
    expect(report.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT9_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT9_FILE, "utf8"));
    expect(content.report.contacted).toBe(100);
    expect(content.report.closedWon).toBe(8);
    expect(content.report.mrrWonEur).toBe(642);
    expect(content.clinics).toHaveLength(100);
  });
});
