/**
 * tests/unit/demo-pilot-3.test.ts
 *
 * Unit tests for GTM Pilot #3 — Colombia Dental Proposal Consensus Validation.
 * Validates:
 *   - 32 new proposal-stage deals across Bogotá, Medellín, Cali (disjoint from Pilot #1 and #2)
 *   - Balanced allocation: 16 control (standard_v1) vs 16 treatment (consensus_assisted_v1)
 *   - Lightweight consensus package generation
 *   - Primary metric: Proposal-to-decision velocity acceleration
 *   - Secondary metrics: Full stakeholder coverage, no-decision rate reduction, MRR stability
 *   - Safety guard and sample size warning
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  generatePilot3Proposals,
  computePilot3Metrics,
  runPilot3,
} from "../../scripts/demo/lib/demo-pilot-3";
import { generateConsensusProposalPackage } from "../../scripts/demo/lib/demo-consensus-package";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";

const TEST_PILOT3_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_3");
const TEST_PILOT3_FILE = path.join(TEST_PILOT3_DIR, "pilot_3_results.json");

describe("Commercial GTM Pilot #3 — Colombia Dental Proposal Consensus Validation", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT3_DIR)) fs.mkdirSync(TEST_PILOT3_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT3_DIR)) fs.rmSync(TEST_PILOT3_DIR, { recursive: true, force: true });
  });

  it("1. Generates 32 proposal opportunities across Bogotá, Medellín, and Cali disjoint from Pilots #1 & #2", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();

    expect(p3.length).toBeGreaterThanOrEqual(30);
    expect(p3).toHaveLength(32);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
    ]);

    for (const record of p3) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(["Bogotá", "Medellín", "Cali"]).toContain(record.city);
      expect(record.chairs).toBeGreaterThanOrEqual(2);
      expect(record.chairs).toBeLessThanOrEqual(6);
    }
  });

  it("2. Allocates balanced control (standard_v1) and treatment (consensus_assisted_v1) cohorts", () => {
    const p3 = generatePilot3Proposals();
    const control = p3.filter((r) => r.proposal_flow === "standard_v1");
    const treatment = p3.filter((r) => r.proposal_flow === "consensus_assisted_v1");

    expect(control).toHaveLength(16);
    expect(treatment).toHaveLength(16);
  });

  it("3. Generates lightweight consensus package with prospect ROI and decision CTAs", () => {
    const pkg = generateConsensusProposalPackage({
      clinic: "Clínica Dental Chicó Navarra",
      city: "Bogotá",
      chairs: 5,
      number_of_decision_makers: 2,
    });

    expect(pkg.clinicSummary.clinicName).toBe("Clínica Dental Chicó Navarra");
    expect(pkg.deskcommRecommendation.recommendedPlan).toBe("Professional");
    expect(pkg.deskcommRecommendation.monthlyPriceCop).toBe(360000);
    expect(pkg.roiSummary.recoverableAppointmentsPerMonth).toBeGreaterThan(0);
    expect(pkg.roiSummary.disclaimer).toContain("Estimaciones proyectadas");
    expect(pkg.decisionMakerSummary.forwardableText).toContain("Propuesta Deskcomm");
    expect(pkg.shareCta.action).toBe("share_with_partners");
    expect(pkg.decisionCta.options.map((o) => o.label)).toEqual([
      "Aprobar",
      "Tengo una pregunta",
      "No seguir",
    ]);
  });

  it("4. Validates primary metric: significant acceleration in proposal-to-decision latency", () => {
    const p3 = generatePilot3Proposals();
    const metrics = computePilot3Metrics(p3);

    expect(metrics.control.medianProposalToDecisionHours).toBe(72);
    expect(metrics.treatment.medianProposalToDecisionHours).toBe(32);
    expect(metrics.velocityChangeHours).toBe(-40);
    expect(metrics.velocityChangePct).toBeLessThan(-50); // > 50% latency reduction
    expect(metrics.consensusFlowResult).toBe("IMPROVED");
  });

  it("5. Validates secondary metrics: stakeholder coverage, no-decision rate reduction, and MRR stability", () => {
    const p3 = generatePilot3Proposals();
    const metrics = computePilot3Metrics(p3);

    // Stakeholder coverage
    expect(metrics.control.fullStakeholderCoveragePct).toBeLessThan(50);
    expect(metrics.treatment.fullStakeholderCoveragePct).toBe(100);

    // No-decision rate drop
    expect(metrics.control.noDecisionRatePct).toBe(25.0);
    expect(metrics.treatment.noDecisionRatePct).toBe(6.3);

    // Close rates
    expect(metrics.control.closedWon).toBe(8);
    expect(metrics.treatment.closedWon).toBe(12);

    // Revenue quality (Pricing unchanged: Starter 180k, Professional 360k)
    expect(metrics.treatment.avgMrrWonCustomerCop).toBeGreaterThanOrEqual(180000);
    expect(metrics.treatment.avgMrrWonCustomerCop).toBeLessThanOrEqual(360000);
  });

  it("6. Issues sample size warning and identifies next bottleneck without mutating production", () => {
    const { records, metrics } = runPilot3(TEST_PILOT3_FILE);

    expect(records).toHaveLength(32);
    expect(metrics.sampleSizeWarning).toBe(true);
    expect(metrics.sampleSizeWarningDetails).toContain("n=32");
    expect(metrics.nextSingleBottleneck).toContain("Onboarding & Clinical Agenda Migration");
    expect(metrics.productionSupabaseTouched).toBe(false);
    expect(metrics.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT3_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT3_FILE, "utf8"));
    expect(content.metrics.totalProposals).toBe(32);
  });
});
