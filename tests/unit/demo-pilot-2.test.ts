/**
 * tests/unit/demo-pilot-2.test.ts
 *
 * Unit tests for GTM Pilot #2 — Colombia Dental Funnel Validation.
 * Validates:
 *   - 100 new clinics across Bogotá, Medellín, and Cali (disjoint from Pilot #1)
 *   - Experimental variable: meeting_flow = "whatsapp_1click_v1"
 *   - Funnel conversion metrics and comparison vs Pilot #1 baseline (66.7%)
 *   - Secondary meeting quality metric (attendance >= 85%)
 *   - Sample size warning and bottleneck detection
 *   - Safe local file persistence
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  generatePilot2Clinics,
  computePilot2Metrics,
  runPilot2,
} from "../../scripts/demo/lib/demo-pilot-2";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";

const TEST_PILOT2_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_2");
const TEST_PILOT2_FILE = path.join(TEST_PILOT2_DIR, "pilot_2_results.json");

describe("Commercial GTM Pilot #2 — Colombia Dental Funnel Validation", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT2_DIR)) fs.mkdirSync(TEST_PILOT2_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT2_DIR)) fs.rmSync(TEST_PILOT2_DIR, { recursive: true, force: true });
  });

  it("1. Generates 100 new qualified clinics across Bogotá, Medellín, and Cali completely disjoint from Pilot #1", () => {
    const pilot1Clinics = generateColombiaPilotClinics();
    const pilot2Clinics = generatePilot2Clinics();

    expect(pilot2Clinics).toHaveLength(100);

    const bogota = pilot2Clinics.filter((c) => c.city === "Bogotá");
    const medellin = pilot2Clinics.filter((c) => c.city === "Medellín");
    const cali = pilot2Clinics.filter((c) => c.city === "Cali");

    expect(bogota).toHaveLength(34);
    expect(medellin).toHaveLength(33);
    expect(cali).toHaveLength(33);

    const pilot1Names = new Set(pilot1Clinics.map((c) => c.clinicName.toLowerCase()));
    for (const c of pilot2Clinics) {
      expect(c.whatsapp).toMatch(/^\+57/);
      expect(c.chairs).toBeGreaterThanOrEqual(2);
      expect(c.chairs).toBeLessThanOrEqual(6);
      expect(c.meeting_flow).toBe("whatsapp_1click_v1");
      // Must not reuse Pilot #1 clinics
      expect(pilot1Names.has(c.clinic.toLowerCase())).toBe(false);
    }
  });

  it("2. Accurately tracks all funnel steps and valid ISO transition timestamps", () => {
    const clinics = generatePilot2Clinics();
    for (const c of clinics) {
      expect(Date.parse(c.timestamps.outreach)).toBeGreaterThan(0);
      if (c.response) expect(Date.parse(c.timestamps.response!)).toBeGreaterThan(0);
      if (c.demo_requested) expect(Date.parse(c.timestamps.demo_requested!)).toBeGreaterThan(0);
      if (c.demo_created) expect(Date.parse(c.timestamps.demo_created!)).toBeGreaterThan(0);
      if (c.first_login) expect(Date.parse(c.timestamps.first_login!)).toBeGreaterThan(0);
      if (c.activated) expect(Date.parse(c.timestamps.activated!)).toBeGreaterThan(0);
      if (c.high_intent) expect(Date.parse(c.timestamps.high_intent!)).toBeGreaterThan(0);
      if (c.meeting_link_presented) expect(Date.parse(c.timestamps.meeting_link_presented!)).toBeGreaterThan(0);
      if (c.meeting_link_clicked) expect(Date.parse(c.timestamps.meeting_link_clicked!)).toBeGreaterThan(0);
      if (c.meeting_booked) expect(Date.parse(c.timestamps.meeting_booked!)).toBeGreaterThan(0);
      if (c.meeting_attended) expect(Date.parse(c.timestamps.meeting_attended!)).toBeGreaterThan(0);
      if (c.proposal_sent) expect(Date.parse(c.timestamps.proposal_sent!)).toBeGreaterThan(0);
      if (c.closed_won) expect(Date.parse(c.timestamps.closed_won!)).toBeGreaterThan(0);
      if (c.closed_lost) expect(Date.parse(c.timestamps.closed_lost!)).toBeGreaterThan(0);
    }
  });

  it("3. Validates significant improvement in high_intent -> meeting_booked via whatsapp_1click_v1", () => {
    const clinics = generatePilot2Clinics();
    const metrics = computePilot2Metrics(clinics);

    expect(metrics.outreachContacts).toBe(100);
    expect(metrics.responses).toBe(63);
    expect(metrics.demoRequests).toBe(44);
    expect(metrics.demoActivations).toBe(36);
    expect(metrics.highIntentCount).toBe(24);
    expect(metrics.meetingLinkPresentedCount).toBe(24);
    expect(metrics.meetingLinkClickedCount).toBe(22);
    expect(metrics.meetingLinkClickRatePct).toBe(91.7);

    // Booked meetings: 20 of 24 = 83.3%
    expect(metrics.meetingsBooked).toBe(20);
    expect(metrics.highIntentToMeetingBookedRatePct).toBe(83.3);

    // Pilot #1 Baseline comparison
    expect(metrics.pilot1BaselineMeetingRatePct).toBe(66.7);
    expect(metrics.absoluteChangePercentagePoints).toBe(16.6); // +16.6 pp
    expect(metrics.relativeChangePct).toBe(24.9); // +24.9%
    expect(metrics.meetingFlowResult).toBe("IMPROVED");
  });

  it("4. Evaluates secondary quality metric: meeting attendance shows no degradation", () => {
    const clinics = generatePilot2Clinics();
    const metrics = computePilot2Metrics(clinics);

    expect(metrics.meetingsAttended).toBe(18);
    expect(metrics.meetingAttendanceRatePct).toBe(90.0); // 18 / 20 attended
    expect(metrics.highIntentToMeetingAttendedRatePct).toBe(75.0); // 18 / 24

    // Downstream commercial stability
    expect(metrics.proposalsSent).toBe(14);
    expect(metrics.closedWon).toBe(9);
    expect(metrics.closedLost).toBe(5);
    expect(metrics.closeRatePct).toBe(64.3);
    expect(metrics.totalMrrWonCop).toBe(2520000);
    expect(metrics.totalMrrWonUsd).toBe(605);
  });

  it("5. Issues sample size warning and identifies next single funnel bottleneck", () => {
    const clinics = generatePilot2Clinics();
    const metrics = computePilot2Metrics(clinics);

    expect(metrics.sampleSizeWarning).toBe(true);
    expect(metrics.sampleSizeWarningDetails).toContain("n=24");
    expect(metrics.nextSingleFunnelBottleneck).toContain("Proposal Delivery to Close Velocity");
  });

  it("6. runPilot2 persists valid JSON results to custom target without mutating production", () => {
    const { clinics, metrics } = runPilot2(TEST_PILOT2_FILE);
    expect(clinics).toHaveLength(100);
    expect(metrics.closedWon).toBe(9);

    expect(fs.existsSync(TEST_PILOT2_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT2_FILE, "utf8"));
    expect(content.metrics.meetingsBooked).toBe(20);
    expect(content.clinics).toHaveLength(100);
  });
});
