/**
 * tests/unit/demo-pilot.test.ts
 *
 * Unit tests for Commercial GTM Pilot Runner (Colombia Dental Market).
 * Validates:
 *   - 50 qualified clinics across Bogotá, Medellín, and Cali
 *   - Conversion funnel metric calculations
 *   - Low-sample statistical flags
 *   - Stage health classification & single constraint detection
 *   - Production guard safety
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  generateColombiaPilotClinics,
  computePilotMetrics,
  evaluateFunnelHealth,
  runColombiaPilot,
} from "../../scripts/demo/lib/demo-pilot";

const TEST_PILOT_DIR = path.resolve(process.cwd(), ".demo", "test_pilot");
const TEST_PILOT_FILE = path.join(TEST_PILOT_DIR, "pilot_results.json");

describe("Commercial GTM Pilot — Colombia Dental Market", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT_DIR)) fs.mkdirSync(TEST_PILOT_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT_DIR)) fs.rmSync(TEST_PILOT_DIR, { recursive: true, force: true });
  });

  it("1. Generates exactly 50 qualified clinics across Bogotá, Medellín, and Cali", () => {
    const clinics = generateColombiaPilotClinics();
    expect(clinics).toHaveLength(50);

    const bogota = clinics.filter((c) => c.city === "Bogotá");
    const medellin = clinics.filter((c) => c.city === "Medellín");
    const cali = clinics.filter((c) => c.city === "Cali");

    expect(bogota.length).toBeGreaterThan(10);
    expect(medellin.length).toBeGreaterThan(10);
    expect(cali.length).toBeGreaterThan(10);

    // Each clinic must have phone/whatsapp and clinical chairs configured
    for (const c of clinics) {
      expect(c.whatsapp).toMatch(/^\+57/);
      expect(c.chairs).toBeGreaterThanOrEqual(2);
    }
  });

  it("2. Accurately calculates baseline funnel conversion metrics and MRR", () => {
    const clinics = generateColombiaPilotClinics();
    const metrics = computePilotMetrics(clinics);

    expect(metrics.totalOutreach).toBe(50);
    expect(metrics.responses).toBe(31);
    expect(metrics.responseRatePct).toBe(62.0);

    expect(metrics.demoRequests).toBe(22);
    expect(metrics.demoRequestRatePct).toBe(44.0);

    expect(metrics.demoActivations).toBe(18);
    expect(metrics.demoActivationRatePct).toBe(81.8);

    expect(metrics.highIntentDemos).toBe(12);
    expect(metrics.highIntentRatePct).toBe(66.7);

    expect(metrics.meetingsBooked).toBe(8);
    expect(metrics.meetingBookingRatePct).toBe(66.7);

    expect(metrics.proposalsSent).toBe(6);
    expect(metrics.proposalRatePct).toBe(75.0);

    expect(metrics.closedWon).toBe(4);
    expect(metrics.closeRatePct).toBe(66.7);

    expect(metrics.totalMrrWonCop).toBeGreaterThan(0);
    expect(metrics.totalMrrWonUsd).toBeGreaterThan(0);
    expect(metrics.avgTimeToActivationHours).toBeGreaterThan(0);
    expect(metrics.avgTimeToMeetingHours).toBeGreaterThan(0);
  });

  it("3. Flags low sample sizes to prevent over-optimization on small datasets", () => {
    const clinics = generateColombiaPilotClinics();
    const metrics = computePilotMetrics(clinics);

    expect(metrics.lowSampleFlags.length).toBeGreaterThan(0);
    const flagStr = metrics.lowSampleFlags.join(" ");
    expect(flagStr).toContain("PROPOSAL_RATE");
    expect(flagStr).toContain("CLOSE_RATE");
  });

  it("4. Evaluates stage health and identifies single largest funnel constraint", () => {
    const clinics = generateColombiaPilotClinics();
    const metrics = computePilotMetrics(clinics);
    const evaluation = evaluateFunnelHealth(metrics);

    expect(evaluation.acquisition).toBe("HEALTHY");
    expect(evaluation.demoActivation).toBe("HEALTHY");
    expect(evaluation.singleLargestConstraint).toBeDefined();
    expect(evaluation.singleLargestConstraint).toContain("Velocity");
    expect(evaluation.recommendedAction).toBeDefined();
  });

  it("5. Executes full pilot run and persists results safely to local storage", () => {
    const result = runColombiaPilot(TEST_PILOT_FILE);
    expect(result.clinics).toHaveLength(50);
    expect(result.metrics.closedWon).toBe(4);
    expect(fs.existsSync(TEST_PILOT_FILE)).toBe(true);

    const saved = JSON.parse(fs.readFileSync(TEST_PILOT_FILE, "utf8"));
    expect(saved.metrics.totalOutreach).toBe(50);
  });
});
